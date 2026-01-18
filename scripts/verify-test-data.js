#!/usr/bin/env node

/**
 * Verify/assert Jira test data created by our tooling.
 *
 * It checks:
 * - target board exists
 * - initiatives/epics exist (defaults to SP-19/20/21/22 unless overridden)
 * - sprints created by our latest run exist (via registry)
 * - counts issues in those sprints
 *
 * Inventory mode:
 *   node verify-test-data.js --inventory
 *
 * Assert mode (name-based; safe across delete/recreate):
 *   node verify-test-data.js --assert-names
 *
 * Optional overrides:
 *   --project SP
 *   --board "dynaform-raptors-board"
 *   --initiative "Internationalization"
 *   --epics "GCE Alignment,Core Framework,Approval Process"
 *   --sprints "dynaform Sprint 2"
 *   --strict  (fail if any Story/Task is missing an epic or sprint)
 *
 * Optional: list issues by JQL (safe/read-only):
 *   node verify-test-data.js --jql "project=SP ORDER BY created DESC"
 */

const path = require('path');
require('../jira/env-loader'); // Load jira.env from configurable location

const { loadJiraConfig } = require('../jira/config');
const { makeJiraClient } = require('../jira/client');

function requiredCfg(cfg, name) {
  if (!cfg[name]) throw new Error(`Missing required config: ${name} (set env var)`);
  return cfg[name];
}

async function findBoardByName(jira, name) {
  const res = await jira.request('GET', `/rest/agile/1.0/board?maxResults=200`);
  const match = (res.values || []).find((b) => b.name === name);
  return match || null;
}

async function listBoards(jira) {
  const res = await jira.request('GET', `/rest/agile/1.0/board?maxResults=200`);
  return res.values || [];
}

async function listBoardSprints(jira, boardId) {
  const res = await jira.request('GET', `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?maxResults=200`);
  return res.values || [];
}

async function sprintIssueCount(jira, sprintId) {
  const res = await jira.request('GET', `/rest/agile/1.0/sprint/${encodeURIComponent(sprintId)}/issue?maxResults=1`);
  return res.total || 0;
}

function parseArgs(argv) {
  const provided = argv.slice(2);
  const args = new Set(provided);
  const get = (flag) => {
    const idx = argv.indexOf(flag);
    if (idx === -1) return null;
    return argv[idx + 1] || null;
  };
  const noFlagsProvided = provided.length === 0;
  // Default behavior: run "everything" (inventory-style output + name-based checks),
  // without requiring the user to pass flags.
  return {
    inventory: noFlagsProvided || args.has('--inventory'),
    assertNames: noFlagsProvided || args.has('--assert-names'),
    strict: args.has('--strict'),
    jql: get('--jql'),
    projectKey: get('--project'),
    boardName: get('--board'),
    initiativeName: get('--initiative'),
    epicsCsv: get('--epics'),
    sprintsCsv: get('--sprints'),
  };
}

async function searchJql(jira, jql, maxResults = 100) {
  // Note: Jira Cloud in this environment removed /rest/api/3/search; /search/jql works.
  const qp = new URLSearchParams();
  qp.set('jql', jql);
  qp.set('maxResults', String(maxResults));
  qp.set('fields', 'key,summary,issuetype,status,created,parent');
  return await jira.request('GET', `/rest/api/3/search/jql?${qp.toString()}`);
}

function assertEqual(name, actual, expected, failures) {
  if (actual !== expected) {
    failures.push(`${name}: expected ${expected}, got ${actual}`);
  }
}

function assertCondition(name, ok, failures, detail) {
  if (!ok) failures.push(detail ? `${name}: ${detail}` : `${name}: failed`);
}

function splitCsv(s) {
  if (!s) return [];
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

async function getIssueSummary(jira, key, cache) {
  if (cache.has(key)) return cache.get(key);
  const res = await jira.request('GET', `/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,issuetype`);
  const summary = res.fields?.summary || '';
  cache.set(key, { summary, issuetype: res.fields?.issuetype?.name });
  return cache.get(key);
}

async function listBoardSprints(jira, boardId, maxResults = 200) {
  const res = await jira.request(
    'GET',
    `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?maxResults=${maxResults}`
  );
  return res.values || [];
}

async function listSprintIssues(jira, sprintId, maxResults = 200) {
  // paginate if needed
  const issues = [];
  let startAt = 0;
  while (true) {
    const res = await jira.request(
      'GET',
      `/rest/agile/1.0/sprint/${encodeURIComponent(sprintId)}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=summary,issuetype,status,parent`
    );
    issues.push(...(res.issues || []));
    startAt += res.maxResults || maxResults;
    if ((res.issues || []).length === 0) break;
    if (issues.length >= (res.total || issues.length)) break;
  }
  return issues;
}

async function listBoardBacklogIssues(jira, boardId, maxResults = 200) {
  // Agile API: GET /rest/agile/1.0/board/{boardId}/backlog
  // paginate if needed
  const issues = [];
  let startAt = 0;
  while (true) {
    const res = await jira.request(
      'GET',
      `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/backlog?startAt=${startAt}&maxResults=${maxResults}&fields=summary,issuetype,status,parent`
    );
    issues.push(...(res.issues || []));
    startAt += res.maxResults || maxResults;
    if ((res.issues || []).length === 0) break;
    if (issues.length >= (res.total || issues.length)) break;
  }
  return issues;
}

async function run() {
  const args = parseArgs(process.argv);
  const cfg = loadJiraConfig();
  const jira = makeJiraClient(cfg);

  const boardName = args.boardName || requiredCfg(cfg, 'targetBoardName');
  const projectKey = args.projectKey || cfg.projectKey;
  if (!projectKey) throw new Error('Missing project key (set JIRA_PROJECT_KEY or pass --project)');

  const initiativeName = args.initiativeName || 'Internationalization';
  const epicNames = args.epicsCsv ? splitCsv(args.epicsCsv) : ['GCE Alignment', 'Core Framework', 'Approval Process'];
  const sprintNames = args.sprintsCsv ? splitCsv(args.sprintsCsv) : [];
  const disposableLabel = process.env.JIRA_TESTDATA_LABEL || 'non-permanent-test-data';
  const extraInitiatives = process.env.JIRA_EXTRA_INITIATIVES
    ? process.env.JIRA_EXTRA_INITIATIVES.split(',').map((s) => s.trim()).filter(Boolean)
    : ['unified mobile', 'AI component builder', 'server side rendering'];

  console.log('=== Verify Jira data ===\n');

  const failures = [];

  if (args.inventory) {
    const boards = await listBoards(jira);
    console.log('Boards:');
    for (const b of boards) {
      console.log(`- ${b.name} (ID: ${b.id}, Type: ${b.type}${b.location?.name ? `, Location: ${b.location.name}` : ''})`);
    }
    console.log('');
  }

  const board = await findBoardByName(jira, boardName);
  if (!board) throw new Error(`Board not found: ${boardName}`);
  console.log(`✓ Board found: ${board.name} (ID: ${board.id})`);

  // Disposable test data count (label-based, stable across delete/recreate)
  try {
    const labeledRes = await searchJql(jira, `project=${projectKey} AND labels="${disposableLabel}"`, 1);
    const labeledTotal = labeledRes.total ?? (labeledRes.issues || []).length;
    console.log(`✓ Issues with label "${disposableLabel}": ${labeledTotal}`);
  } catch {
    console.log(`✓ Issues with label "${disposableLabel}": (failed to count)`);
  }

  if (args.inventory) {
    const sprints = await listBoardSprints(jira, board.id);
    console.log('\nSprints on target board:');
    for (const s of sprints) {
      console.log(`- ${s.name} (ID: ${s.id}, State: ${s.state})`);
    }
    console.log('');
  }

  // Name-based assertions (stable across delete/recreate)
  if (args.assertNames) {
    // 0) Additional initiatives (existence only, by name)
    if (extraInitiatives.length) {
      console.log('\nExtra initiatives:');
      for (const name of extraInitiatives) {
        const res = await searchJql(jira, `project=${projectKey} AND type=Initiative AND summary ~ "${name}"`, 10);
        const matches = res.issues || [];
        if (!matches.length) {
          failures.push(`missing Initiative matching summary ~ "${name}"`);
          console.log(`- ${name}: MISSING`);
        } else {
          console.log(`- ${name}: ${matches.map((m) => m.key).join(', ')}`);
        }
      }
    }

    // 1) Find initiative by name
    const initRes = await searchJql(jira, `project=${projectKey} AND type=Initiative AND summary ~ "${initiativeName}"`, 50);
    const initiatives = initRes.issues || [];
    assertCondition(
      'initiative lookup',
      initiatives.length === 1,
      failures,
      initiatives.length === 0
        ? `no Initiative found matching summary ~ "${initiativeName}"`
        : `multiple Initiatives matched "${initiativeName}" (${initiatives.map((i) => i.key).join(', ')})`
    );

    const initiativeKey = initiatives[0]?.key;
    if (initiativeKey) console.log(`✓ Initiative matched: ${initiativeKey} (${initiativeName})`);

    // 2) Find child epics by parent
    const epicsRes = initiativeKey
      ? await searchJql(jira, `project=${projectKey} AND type=Epic AND parent=${initiativeKey} ORDER BY created DESC`, 200)
      : { issues: [] };
    const childEpics = epicsRes.issues || [];
    const childBySummary = new Map(childEpics.map((e) => [e.fields.summary, e]));

    if (args.inventory) {
      console.log('\nEpics under initiative:');
      for (const e of childEpics) {
        console.log(`- ${e.key}: ${e.fields.summary} [${e.fields.status?.name || 'N/A'}]`);
      }
      if (!childEpics.length) console.log('- (no child epics)');
    }

    for (const en of epicNames) {
      assertCondition(
        `epic exists under initiative (${en})`,
        childBySummary.has(en),
        failures,
        `missing epic "${en}" as child of ${initiativeKey || '(unknown initiative)'}`
      );
    }

    // 3) Sprints: by default, verify Stories/Tasks across all ACTIVE/FUTURE sprints on the target board.
    const allSprints = await listBoardSprints(jira, board.id, 200);
    const sprintNameToId = new Map(allSprints.map((s) => [s.name, s.id]));
    const sprintsToCheck = sprintNames.length
      ? sprintNames
      : allSprints.filter((s) => s.state === 'active' || s.state === 'future').map((s) => s.name);

    // If user specified sprint names, validate they exist.
    for (const sn of sprintNames) {
      assertCondition('sprint exists', sprintNameToId.has(sn), failures, `missing sprint "${sn}" on board "${boardName}"`);
    }

    // Always print sprint issue counts (helps decide what to clean/delete).
    console.log('\nSprint issue counts (target board):');
    const sprintCountsByName = new Map();
    for (const s of allSprints) {
      try {
        const c = await sprintIssueCount(jira, s.id);
        sprintCountsByName.set(s.name, c);
        console.log(`- ${s.name} [${s.state}]: ${c}`);
      } catch {
        console.log(`- ${s.name} [${s.state}]: (failed to count)`);
      }
    }

    // 4) Stories/Tasks checks (default on; strict controls failing behavior).
    const parentCache = new Map();
    const expectedEpicSummaries = new Set(epicNames);

    // Backlog checks (board backlog = no sprint)
    try {
      const backlogIssues = await listBoardBacklogIssues(jira, board.id, 200);
      const backlogWork = backlogIssues.filter(
        (i) => i.fields?.issuetype?.name === 'Story' || i.fields?.issuetype?.name === 'Task'
      );
      const backlogMissingEpic = backlogWork.filter((i) => !i.fields?.parent).map((i) => i.key);
      const backlogUnexpectedEpic = [];

      for (const wi of backlogWork) {
        if (!wi.fields?.parent?.key) continue;
        const parentKey = wi.fields.parent.key;
        const parentInfo = await getIssueSummary(jira, parentKey, parentCache);
        if (parentInfo.issuetype === 'Epic' && !expectedEpicSummaries.has(parentInfo.summary)) {
          backlogUnexpectedEpic.push(`${wi.key}→${parentKey}(${parentInfo.summary})`);
        }
      }

      console.log('\nBacklog (target board):');
      console.log(`- total issues: ${backlogIssues.length}`);
      console.log(`- stories/tasks: ${backlogWork.length}`);
      console.log(`- missing epic: ${backlogMissingEpic.length}`);
      console.log(`- unexpected epic: ${backlogUnexpectedEpic.length}`);

      if (backlogMissingEpic.length) {
        console.log(
          `  missing epic examples: ${backlogMissingEpic.slice(0, 10).join(', ')}${backlogMissingEpic.length > 10 ? '…' : ''}`
        );
      }
      if (backlogUnexpectedEpic.length) {
        console.log(
          `  unexpected epic examples: ${backlogUnexpectedEpic.slice(0, 5).join(', ')}${backlogUnexpectedEpic.length > 5 ? '…' : ''}`
        );
      }

      if (args.strict) {
        assertCondition(
          'all Stories/Tasks in backlog have an epic',
          backlogMissingEpic.length === 0,
          failures,
          `backlog missing epic for: ${backlogMissingEpic.slice(0, 20).join(', ')}${backlogMissingEpic.length > 20 ? '…' : ''}`
        );
        assertCondition(
          'all Stories/Tasks in backlog use expected epics',
          backlogUnexpectedEpic.length === 0,
          failures,
          `backlog unexpected epics: ${backlogUnexpectedEpic.slice(0, 10).join(', ')}${backlogUnexpectedEpic.length > 10 ? '…' : ''}`
        );
      }
    } catch (e) {
      console.log('\nBacklog (target board): (failed to fetch)');
      if (args.strict) failures.push(`backlog fetch failed: ${String(e.message || e).slice(0, 200)}`);
    }

    for (const sn of sprintsToCheck) {
      const sid = sprintNameToId.get(sn);
      if (!sid) continue;
      const totalCount = sprintCountsByName.get(sn);
      if (totalCount === 0) continue; // don't waste time fetching empty sprints

      const sprintIssues = await listSprintIssues(jira, sid, 200);
      const work = sprintIssues.filter(
        (i) => i.fields?.issuetype?.name === 'Story' || i.fields?.issuetype?.name === 'Task'
      );

      const missingEpic = work.filter((i) => !i.fields?.parent).map((i) => i.key);
      const unexpectedEpic = [];

      for (const wi of work) {
        if (!wi.fields?.parent?.key) continue;
        const parentKey = wi.fields.parent.key;
        const parentInfo = await getIssueSummary(jira, parentKey, parentCache);
        // If parent isn't one of the expected epics under this initiative, count as unexpected.
        if (parentInfo.issuetype === 'Epic' && !expectedEpicSummaries.has(parentInfo.summary)) {
          unexpectedEpic.push(`${wi.key}→${parentKey}(${parentInfo.summary})`);
        }
      }

      console.log(`\nSprint "${sn}" (ID: ${sid})`);
      console.log(`- total issues: ${sprintIssues.length}`);
      console.log(`- stories/tasks: ${work.length}`);
      console.log(`- missing epic: ${missingEpic.length}`);
      console.log(`- unexpected epic: ${unexpectedEpic.length}`);

      if (missingEpic.length) {
        console.log(`  missing epic examples: ${missingEpic.slice(0, 10).join(', ')}${missingEpic.length > 10 ? '…' : ''}`);
      }
      if (unexpectedEpic.length) {
        console.log(`  unexpected epic examples: ${unexpectedEpic.slice(0, 5).join(', ')}${unexpectedEpic.length > 5 ? '…' : ''}`);
      }

      if (args.strict) {
        assertCondition(
          `all Stories/Tasks in sprint "${sn}" have an epic`,
          missingEpic.length === 0,
          failures,
          `missing epic for: ${missingEpic.slice(0, 20).join(', ')}${missingEpic.length > 20 ? '…' : ''}`
        );
        assertCondition(
          `all Stories/Tasks in sprint "${sn}" use expected epics`,
          unexpectedEpic.length === 0,
          failures,
          `unexpected epics: ${unexpectedEpic.slice(0, 10).join(', ')}${unexpectedEpic.length > 10 ? '…' : ''}`
        );
      }
    }

    if (failures.length) {
      console.log('\n❌ ASSERT FAILURES:');
      for (const f of failures) console.log(`- ${f}`);
      process.exit(2);
    }
    console.log('\n✅ Name-based assertions passed');
  } else {
    // Non-assert mode: still verify baseline keys if envs are set (legacy behavior)
    const initiativeKey = process.env.JIRA_INITIATIVE_KEY || 'SP-19';
    const epics = {
      gce: process.env.JIRA_EPIC_GCE_KEY || 'SP-20',
      framework: process.env.JIRA_EPIC_FRAMEWORK_KEY || 'SP-21',
      approval: process.env.JIRA_EPIC_APPROVAL_KEY || 'SP-22',
    };

    await jira.request('GET', `/rest/api/3/issue/${encodeURIComponent(initiativeKey)}?fields=summary,issuetype`);
    console.log(`✓ Initiative exists: ${initiativeKey}`);

    for (const [name, key] of Object.entries(epics)) {
      await jira.request('GET', `/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,issuetype,parent`);
      console.log(`✓ Epic exists (${name}): ${key}`);
    }
  }

  if (args.jql) {
    const res = await searchJql(jira, args.jql, 100);
    console.log(`\nJQL results (${res.total ?? 'unknown'} total, showing ${res.issues?.length || 0}):`);
    for (const issue of res.issues || []) {
      const parent = issue.fields.parent ? ` parent=${issue.fields.parent.key}` : '';
      console.log(`- ${issue.key} [${issue.fields.issuetype?.name}] ${issue.fields.summary}${parent}`);
    }
  }

  console.log('\n✅ Verify complete');
}

run().catch((e) => {
  console.error('\n❌ verify-test-data failed.');
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});


