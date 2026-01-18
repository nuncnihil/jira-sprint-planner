#!/usr/bin/env node

/**
 * Jira inventory (read-only)
 *
 * Lists:
 * - Boards (name/id)
 * - Sprints on the target board (name/id/state)
 * - Initiatives and their child Epics
 * - Stories/Tasks with parent Epic and Sprint
 *
 * Usage:
 *   node inventory.js
 *
 * Optional:
 *   node inventory.js --project SP --board "dynaform-raptors-board" --limit 200
 */

const path = require('path');
require('../jira/env-loader'); // Load jira.env from configurable location

const { loadJiraConfig } = require('../jira/config');
const { makeJiraClient } = require('../jira/client');
const { getFieldIds } = require('../jira/field-resolver');

function parseArgs(argv) {
  const get = (flag) => {
    const idx = argv.indexOf(flag);
    if (idx === -1) return null;
    return argv[idx + 1] || null;
  };
  const limit = Number(get('--limit') || 200);
  return {
    projectKey: get('--project'),
    boardName: get('--board'),
    limit: Number.isFinite(limit) ? limit : 200,
  };
}

function q(params) {
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    qp.set(k, String(v));
  }
  return qp.toString();
}

async function searchJql(jira, { jql, fields, maxResults = 100 }) {
  // Jira Cloud in this environment uses /rest/api/3/search/jql
  const qp = q({
    jql,
    maxResults,
    fields: fields.join(','),
  });
  return await jira.request('GET', `/rest/api/3/search/jql?${qp}`);
}

function sprintSummaryFromField(sprintFieldValue) {
  if (!sprintFieldValue) return '';
  const arr = Array.isArray(sprintFieldValue) ? sprintFieldValue : [sprintFieldValue];
  const sprints = arr.filter(Boolean).map((s) => {
    const id = s.id != null ? `#${s.id}` : '';
    const name = s.name || s.state || 'Sprint';
    return `${name}${id}`;
  });
  return sprints.length ? sprints.join(', ') : '';
}

async function run() {
  const cfg = loadJiraConfig();
  const jira = makeJiraClient(cfg);
  const args = parseArgs(process.argv);

  // Discover custom field IDs dynamically
  const fieldIds = await getFieldIds(jira);

  const projectKey = args.projectKey || cfg.projectKey;
  const boardName = args.boardName || cfg.targetBoardName;

  if (!projectKey) throw new Error('Missing project key (set JIRA_PROJECT_KEY or pass --project)');
  if (!boardName) throw new Error('Missing board name (set JIRA_TARGET_BOARD_NAME or pass --board)');

  console.log('=== Jira inventory (read-only) ===\n');
  console.log(`Project: ${projectKey}`);
  console.log(`Target board: ${boardName}\n`);

  // Boards
  const boardsRes = await jira.request('GET', `/rest/agile/1.0/board?maxResults=${args.limit}`);
  const boards = boardsRes.values || [];
  console.log('Boards:');
  for (const b of boards) {
    const loc = b.location?.name ? `, Location: ${b.location.name}` : '';
    console.log(`- ${b.name} (ID: ${b.id}, Type: ${b.type}${loc})`);
  }

  const targetBoard = boards.find((b) => b.name === boardName);
  if (!targetBoard) throw new Error(`Target board not found in list: ${boardName}`);

  // Sprints on target board
  const sprintsRes = await jira.request(
    'GET',
    `/rest/agile/1.0/board/${encodeURIComponent(targetBoard.id)}/sprint?maxResults=${args.limit}`
  );
  const sprints = sprintsRes.values || [];
  console.log('\nSprints (target board):');
  for (const s of sprints) {
    console.log(`- ${s.name} (ID: ${s.id}, State: ${s.state})`);
  }

  // Initiatives
  const initiativesRes = await searchJql(jira, {
    jql: `project=${projectKey} AND type=Initiative ORDER BY created DESC`,
    fields: ['key', 'summary', 'status', 'issuetype'],
    maxResults: args.limit,
  });
  const initiatives = initiativesRes.issues || [];
  console.log('\nInitiatives:');
  if (!initiatives.length) console.log('- (none found)');
  for (const i of initiatives) {
    console.log(`- ${i.key}: ${i.fields.summary} [${i.fields.status?.name || 'N/A'}]`);
  }

  // Epics (by initiative parent)
  console.log('\nInitiatives -> Epics:');
  if (!initiatives.length) {
    console.log('- (no initiatives to expand)');
  } else {
    for (const i of initiatives) {
      const epicsRes = await searchJql(jira, {
        jql: `project=${projectKey} AND type=Epic AND parent=${i.key} ORDER BY created DESC`,
        fields: ['key', 'summary', 'status', 'parent', 'issuetype'],
        maxResults: args.limit,
      });
      const epics = epicsRes.issues || [];
      console.log(`- ${i.key}: ${i.fields.summary}`);
      if (!epics.length) {
        console.log('  - (no child epics)');
      } else {
        for (const e of epics) {
          console.log(`  - ${e.key}: ${e.fields.summary} [${e.fields.status?.name || 'N/A'}]`);
        }
      }
    }
  }

  // Stories/Tasks with parent epic + sprint
  const workRes = await searchJql(jira, {
    jql: `project=${projectKey} AND type in (Story, Task) ORDER BY created DESC`,
    fields: ['key', 'summary', 'issuetype', 'status', 'parent', fieldIds.sprint],
    maxResults: args.limit,
  });
  const workItems = workRes.issues || [];
  console.log('\nStories/Tasks (latest):');
  if (!workItems.length) console.log('- (none found)');
  for (const it of workItems) {
    const parent = it.fields.parent ? it.fields.parent.key : '(no epic)';
    const sprint = sprintSummaryFromField(it.fields[fieldIds.sprint]) || '(no sprint)';
    console.log(`- ${it.key} [${it.fields.issuetype?.name}] ${it.fields.summary}`);
    console.log(`  status=${it.fields.status?.name || 'N/A'} epic=${parent} sprint=${sprint}`);
  }

  console.log('\n✅ Done');
}

run().catch((e) => {
  console.error('\n❌ inventory failed.');
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});


