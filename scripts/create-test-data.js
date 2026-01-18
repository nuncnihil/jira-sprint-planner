#!/usr/bin/env node

/**
 * Create Jira test data (messy sprint planning scenario).
 *
 * Safety:
 * - Preflight validates required config & target board before creating anything
 * - Marks all created issues with a disposable label (default: non-permanent-test-data)
 *
 * Usage:
 *   node create-test-data.js
 *
 * Env (required):
 *   JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
 *
 * Env (recommended):
 *   JIRA_PROJECT_ID, JIRA_PROJECT_KEY, JIRA_TEAM_ID, JIRA_TARGET_BOARD_NAME
 *   JIRA_INITIATIVE_KEY (default: SP-19)
 *   JIRA_EPIC_GCE_KEY (default: SP-20)
 *   JIRA_EPIC_FRAMEWORK_KEY (default: SP-21)
 *   JIRA_EPIC_APPROVAL_KEY (default: SP-22)
 */

const path = require('path');
require('../jira/env-loader'); // Load jira.env from configurable location

const { loadJiraConfig } = require('../jira/config');
const { makeJiraClient } = require('../jira/client');
const { getFieldIds } = require('../jira/field-resolver');

function requiredCfg(cfg, name) {
  if (!cfg[name]) throw new Error(`Missing required config: ${name} (set env var)`);
  return cfg[name];
}

async function findBoardByName(jira, name) {
  const res = await jira.request('GET', `/rest/agile/1.0/board?maxResults=200`);
  const match = (res.values || []).find((b) => b.name === name);
  return match || null;
}

function q(params) {
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    qp.set(k, String(v));
  }
  return qp.toString();
}

async function searchJql(jira, { jql, fields, maxResults = 50 }) {
  const qp = q({
    jql,
    maxResults,
    fields: fields.join(','),
  });
  return await jira.request('GET', `/rest/api/3/search/jql?${qp}`);
}

async function ensureInitiativeAndEpics({
  jira,
  projectId,
  projectKey,
  teamId,
  baseLabels,
  initiativeName,
  epicNames,
  fieldIds,
}) {
  // Find or create Initiative by summary
  const initRes = await searchJql(jira, {
    jql: `project=${projectKey} AND type=Initiative AND summary ~ "${initiativeName}" ORDER BY created DESC`,
    fields: ['key', 'summary', 'issuetype'],
    maxResults: 10,
  });
  let initiativeKey = initRes.issues?.[0]?.key || null;

  if (!initiativeKey) {
    const created = await jira.request('POST', `/rest/api/3/issue`, {
      fields: {
        project: { id: projectId },
        issuetype: { name: 'Initiative' },
        summary: initiativeName,
        description: adfText('Top-level Initiative for Internationalization test data.'),
        labels: baseLabels.concat(['internationalization']),
        ...(teamId ? { [fieldIds.team]: teamId } : {}),
      },
    });
    initiativeKey = created.key;
    console.log(`✓ Created Initiative: ${initiativeKey} (${initiativeName})`);
  } else {
    console.log(`✓ Found Initiative: ${initiativeKey} (${initiativeName})`);
  }

  // Find existing child Epics under initiative
  const epicsRes = await searchJql(jira, {
    jql: `project=${projectKey} AND type=Epic AND parent=${initiativeKey} ORDER BY created DESC`,
    fields: ['key', 'summary', 'issuetype', 'parent'],
    maxResults: 200,
  });
  const existingBySummary = new Map((epicsRes.issues || []).map((e) => [e.fields.summary, e.key]));

  const epicKeys = {};
  for (const name of epicNames) {
    let key = existingBySummary.get(name) || null;
    if (!key) {
      const created = await jira.request('POST', `/rest/api/3/issue`, {
        fields: {
          project: { id: projectId },
          issuetype: { name: 'Epic' },
          summary: name,
          parent: { key: initiativeKey },
          description: adfText(`Epic under Initiative "${initiativeName}".`),
          labels: baseLabels.concat(['internationalization', 'epic']),
          ...(teamId ? { [fieldIds.team]: teamId } : {}),
        },
      });
      key = created.key;
      console.log(`✓ Created Epic: ${key} (${name})`);
    } else {
      console.log(`✓ Found Epic: ${key} (${name})`);
    }
    epicKeys[name] = key;
  }

  return { initiativeKey, epicKeys };
}

async function ensureInitiativeOnly({ jira, projectId, projectKey, teamId, baseLabels, initiativeName, fieldIds }) {
  const initRes = await searchJql(jira, {
    jql: `project=${projectKey} AND type=Initiative AND summary ~ "${initiativeName}" ORDER BY created DESC`,
    fields: ['key', 'summary', 'issuetype'],
    maxResults: 10,
  });
  let initiativeKey = initRes.issues?.[0]?.key || null;

  if (!initiativeKey) {
    const created = await jira.request('POST', `/rest/api/3/issue`, {
      fields: {
        project: { id: projectId },
        issuetype: { name: 'Initiative' },
        summary: initiativeName,
        description: adfText('Standalone Initiative for Jira-assist test data.'),
        labels: baseLabels,
        ...(teamId ? { [fieldIds.team]: teamId } : {}),
      },
    });
    initiativeKey = created.key;
    console.log(`✓ Created Initiative: ${initiativeKey} (${initiativeName})`);
  } else {
    console.log(`✓ Found Initiative: ${initiativeKey} (${initiativeName})`);
  }

  return initiativeKey;
}

async function listBoardSprints(jira, boardId, maxResults = 200) {
  const res = await jira.request(
    'GET',
    `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?maxResults=${maxResults}`
  );
  return res.values || [];
}

function adfText(text) {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

async function createIssue(jira, fields) {
  return await jira.request('POST', `/rest/api/3/issue`, { fields });
}

async function addIssuesToSprint(jira, sprintId, issueKeys) {
  if (!issueKeys.length) return;
  await jira.request('POST', `/rest/agile/1.0/sprint/${encodeURIComponent(sprintId)}/issue`, {
    issues: issueKeys,
  });
}

async function listSprintIssues(jira, sprintId, maxResults = 200) {
  const issues = [];
  let startAt = 0;
  while (true) {
    const res = await jira.request(
      'GET',
      `/rest/agile/1.0/sprint/${encodeURIComponent(sprintId)}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=summary,issuetype,status,parent,labels`
    );
    issues.push(...(res.issues || []));
    startAt += res.maxResults || maxResults;
    if ((res.issues || []).length === 0) break;
    if (issues.length >= (res.total || issues.length)) break;
  }
  return issues;
}

async function transitionIssueToDone(jira, issueKey) {
  try {
    const res = await jira.request('GET', `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`);
    const transitions = res.transitions || [];
    const done = transitions.find((t) => (t.to?.name || '').toLowerCase() === 'done');
    if (!done) return false;
    await jira.request('POST', `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, {
      transition: { id: done.id },
    });
    return true;
  } catch {
    return false;
  }
}

async function updateIssueSummary(jira, issueKey, summary) {
  await jira.request('PUT', `/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
    fields: { summary },
  });
}

async function updateIssueFields(jira, issueKey, fields) {
  await jira.request('PUT', `/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
    fields,
  });
}

async function startSprintIfFuture(jira, sprint) {
  if (!sprint) return;
  if (sprint.state === 'active') return;
  if (sprint.state !== 'future') {
    console.log(`⚠️  Sprint "${sprint.name}" is state=${sprint.state}; not starting automatically.`);
    return;
  }
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
  await jira.request('PUT', `/rest/agile/1.0/sprint/${encodeURIComponent(sprint.id)}`, {
    // Jira requires name on update in some configurations
    name: sprint.name,
    state: 'active',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
  console.log(`✓ Started sprint: ${sprint.name} (${sprint.id})`);
}

async function run() {
  const cfg = loadJiraConfig();
  const jira = makeJiraClient(cfg);

  // Discover custom field IDs dynamically
  const fieldIds = await getFieldIds(jira);

  const projectId = requiredCfg(cfg, 'projectId');
  const projectKey = requiredCfg(cfg, 'projectKey');
  const boardName = requiredCfg(cfg, 'targetBoardName');
  const teamId = cfg.teamId;

  const initiativeName = process.env.JIRA_INITIATIVE_NAME || 'Internationalization';
  const epicNames = process.env.JIRA_EPIC_NAMES
    ? process.env.JIRA_EPIC_NAMES.split(',').map((s) => s.trim()).filter(Boolean)
    : ['GCE Alignment', 'Core Framework', 'Approval Process'];
  const extraInitiatives = process.env.JIRA_EXTRA_INITIATIVES
    ? process.env.JIRA_EXTRA_INITIATIVES.split(',').map((s) => s.trim()).filter(Boolean)
    : ['unified mobile', 'AI component builder', 'server side rendering'];

  console.log('=== Create Jira test data ===\n');
  console.log(`Target board: ${boardName}`);
  console.log(`Project: ${projectKey} (${projectId})`);
  console.log(`Initiative (name): ${initiativeName}`);
  console.log(`Epics (names): ${epicNames.join(', ')}\n`);

  // Preflight: ensure board exists
  const board = await findBoardByName(jira, boardName);
  if (!board) throw new Error(`Board not found: ${boardName}`);

  // No preflight for initiative/epics by key: we create/find them by name below.

  // Anything we create that is meant to be disposable should carry this label,
  // so we can safely purge without relying on keys/IDs.
  const disposableLabel = process.env.JIRA_TESTDATA_LABEL || 'non-permanent-test-data';
  const baseLabels = [`bmad-testdata`, disposableLabel];

  // Ensure additional initiatives exist (no epics required for these)
  console.log('\nEnsuring additional initiatives exist:\n');
  for (const name of extraInitiatives) {
    await ensureInitiativeOnly({
      jira,
      projectId,
      projectKey,
      teamId,
      baseLabels: baseLabels.concat(['initiative']),
      initiativeName: name,
      fieldIds,
    });
  }

  // Ensure Initiative + Epics exist (create if missing)
  const ensured = await ensureInitiativeAndEpics({
    jira,
    projectId,
    projectKey,
    teamId,
    baseLabels,
    initiativeName,
    epicNames,
    fieldIds,
  });

  const epics = {
    gce: ensured.epicKeys['GCE Alignment'],
    framework: ensured.epicKeys['Core Framework'],
    approval: ensured.epicKeys['Approval Process'],
  };

  // Sprints:
  // We do NOT create/delete sprints. We reuse the sprints that exist today on the target board.
  // Expected sprint set for this environment:
  // - dynaform Sprint 1 (will be started if currently future)
  // - dynaform Sprint 2
  // - dynaform Sprint 3
  const sprints = await listBoardSprints(jira, board.id, 200);
  const sprint1 = sprints.find((s) => s.name === 'dynaform Sprint 1') || null;
  const sprint2 = sprints.find((s) => s.name === 'dynaform Sprint 2') || null;
  const sprint3 = sprints.find((s) => s.name === 'dynaform Sprint 3') || null;
  if (!sprint1) throw new Error(`Missing sprint on board "${boardName}": dynaform Sprint 1`);
  if (!sprint2) throw new Error(`Missing sprint on board "${boardName}": dynaform Sprint 2`);
  if (!sprint3) throw new Error(`Missing sprint on board "${boardName}": dynaform Sprint 3`);
  // Seed Sprint 1 with 5 already-estimated tasks (1,2,3,3,1)
  // Story points are set via UPDATE API after creation (cannot set during CREATE due to screen restrictions)
  const seedTitles = [
    'Implement i18n string extraction pipeline',
    'Add locale fallback resolution',
    'Integrate translation bundle loading (async)',
    'Add lint rule for untranslated strings',
    'Harden server-side rendering locale negotiation',
  ];
  const seedStoryPoints = [1, 2, 3, 3, 1];
  const seedLabels = baseLabels.concat(['seed', 'sprint1']);

  const sprint1Existing = await listSprintIssues(jira, sprint1.id, 200);
  const existingSeedKeys = new Set(
    sprint1Existing
      .filter((i) => (i.fields.labels || []).includes('seed') && (i.fields.labels || []).includes(disposableLabel))
      .map((i) => i.key)
  );

  const seedCreatedKeys = [];
  console.log(`\nCreating seed tasks (${seedTitles.length} total)...`);
  for (let i = 0; i < seedTitles.length; i++) {
    // Avoid creating duplicates if seed tasks already exist in the sprint.
    const already = sprint1Existing.find((it) => it.fields.summary === seedTitles[i]);
    if (already) {
      console.log(`  ↷ Skipping (already exists): ${seedTitles[i]}`);
      continue;
    }

    const fields = {
      project: { id: projectId },
      issuetype: { name: 'Task' },
      summary: seedTitles[i],
      description: adfText('Seed task for sprint planning workflow tests.'),
      labels: seedLabels,
      ...(teamId ? { [fieldIds.team]: teamId } : {}),
    };
    
    try {
      const created = await createIssue(jira, fields);
      if (created && created.key) {
        seedCreatedKeys.push(created.key);
        console.log(`  ✓ Created ${created.key}: ${seedTitles[i].substring(0, 50)}...`);
        
        // Try to add story points via UPDATE (2-step process)
        try {
          await updateIssueFields(jira, created.key, { [fieldIds.storyPoints]: seedStoryPoints[i] });
          console.log(`    → Set story points: ${seedStoryPoints[i]}`);
        } catch (error) {
          console.warn(`    ⚠️  Could not set story points: ${error.message}`);
          console.warn(`    → You'll need to manually set ${seedStoryPoints[i]} points for ${created.key} in Jira UI`);
        }
      } else {
        console.warn(`  ⚠️  Failed to create seed task ${i + 1}: No key returned`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to create seed task ${i + 1}: ${error.message}`);
    }
  }
  if (seedCreatedKeys.length) {
    await addIssuesToSprint(jira, sprint1.id, seedCreatedKeys);
    console.log(`✓ Seeded ${seedCreatedKeys.length} task(s) into ${sprint1.name}`);
  } else {
    console.log(`✓ Seed tasks already present in ${sprint1.name} (no new tasks created)`);
  }

  // Create backlog: 40 ungroomed items, mix of:
  // - epic child items (i18n initiative work)
  // - standalone Engineering Excellence / Security items
  const backlogIssueKeys = [];
  console.log(`\nCreating backlog items (40 total)...`);
  for (let i = 1; i <= 40; i++) {
    const isStandalone = i % 4 === 0;
    const issueType = i % 7 === 0 ? 'Story' : 'Task';
    const summary = isStandalone
      ? `[UNGROOMED][Engineering Excellence] Backlog item ${i}`
      : `[UNGROOMED][i18n] Backlog item ${i}`;

    const shouldHaveEpic = !isStandalone && i % 2 === 0; // ~half of i18n items get an epic
    const epicKey = shouldHaveEpic ? [epics.gce, epics.framework, epics.approval][i % 3] : null;

    const fields = {
      project: { id: projectId },
      issuetype: { name: issueType },
      summary,
      description: adfText('Ungroomed: needs acceptance criteria, sizing, and refinement.'),
      labels: baseLabels.concat(isStandalone ? ['engineering-excellence'] : ['internationalization']),
      ...(teamId ? { [fieldIds.team]: teamId } : {}),
      ...(epicKey ? { parent: { key: epicKey } } : {}),
    };

    try {
      const created = await createIssue(jira, fields);
      if (created && created.key) {
        backlogIssueKeys.push(created.key);
        if (i % 10 === 0 || i === 40) {
          console.log(`  ✓ Created ${backlogIssueKeys.length} of ${i}...`);
        }
      } else {
        console.warn(`  ⚠️  Failed to create backlog item ${i}: No key returned`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to create backlog item ${i}: ${error.message}`);
    }
  }
  console.log(`✓ Created ${backlogIssueKeys.length}/40 backlog item(s)`);


  // Sprint 1 additional items: 8 carryover items (realistic names) — set status to Done if possible.
  // If they already exist (from a prior run), update names + transition instead of creating duplicates.
  const carryoverTemplates = [
    { type: 'Task', summary: 'Close out i18n extraction TODOs from last sprint', epic: 'Core Framework' },
    { type: 'Task', summary: 'Fix locale fallback edge-case for empty Accept-Language', epic: 'Core Framework' },
    { type: 'Story', summary: 'As a user, see translated navigation labels', epic: 'GCE Alignment' },
    { type: 'Task', summary: 'Update translation glossary for key product terms', epic: 'GCE Alignment' },
    { type: 'Task', summary: 'Add translation approval checklist to workflow', epic: 'Approval Process' },
    { type: 'Story', summary: 'As a reviewer, approve/reject translation changes', epic: 'Approval Process' },
    { type: 'Task', summary: 'Remove deprecated i18n keys and cleanup unused strings', epic: null }, // intentionally no epic
    { type: 'Task', summary: 'Backfill missing i18n unit tests for locale negotiation', epic: null }, // intentionally no epic
  ];

  const sprint1IssuesNow = await listSprintIssues(jira, sprint1.id, 200);
  const existingCarryover = sprint1IssuesNow.filter((i) => {
    const labels = i.fields?.labels || [];
    return labels.includes(disposableLabel) && labels.includes('sprint0');
  });

  const carryoverKeys = [];
  if (existingCarryover.length) {
    console.log(`\nFound ${existingCarryover.length} existing carryover item(s) in ${sprint1.name}; updating names + setting Done...`);
    // Update as many as we can, in order (we don’t assume stable keys).
    for (let idx = 0; idx < Math.min(existingCarryover.length, carryoverTemplates.length); idx++) {
      const issueKey = existingCarryover[idx].key;
      const tmpl = carryoverTemplates[idx];
      await updateIssueSummary(jira, issueKey, tmpl.summary);
      const transitioned = await transitionIssueToDone(jira, issueKey);
      console.log(`✓ Updated ${issueKey} → "${tmpl.summary}"${transitioned ? ' (Done)' : ''}`);
      carryoverKeys.push(issueKey);
    }
  } else {
    console.log(`\nCreating ${carryoverTemplates.length} carryover items...`);
    for (const tmpl of carryoverTemplates) {
      const epicKey =
        tmpl.epic === 'GCE Alignment'
          ? epics.gce
          : tmpl.epic === 'Core Framework'
            ? epics.framework
            : tmpl.epic === 'Approval Process'
              ? epics.approval
              : null;

      const fields = {
        project: { id: projectId },
        issuetype: { name: tmpl.type },
        summary: tmpl.summary,
        description: adfText('Carryover work seeded for sprint planning flow.'),
        labels: baseLabels.concat(['sprint0']),
        ...(teamId ? { [fieldIds.team]: teamId } : {}),
        ...(epicKey ? { parent: { key: epicKey } } : {}),
      };
      try {
        const created = await createIssue(jira, fields);
        if (created && created.key) {
          carryoverKeys.push(created.key);
          console.log(`  ✓ Created ${created.key}: ${tmpl.summary.substring(0, 50)}...`);
        } else {
          console.warn(`  ⚠️  Failed to create carryover item: ${tmpl.summary} (no key returned)`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Failed to create carryover item: ${tmpl.summary} - ${error.message}`);
      }
    }
    if (carryoverKeys.length > 0) {
      await addIssuesToSprint(jira, sprint1.id, carryoverKeys);
      // Try to transition to Done
      for (const key of carryoverKeys) {
        await transitionIssueToDone(jira, key);
      }
      console.log(`✓ Created ${carryoverKeys.length}/${carryoverTemplates.length} carryover item(s) in ${sprint1.name} and attempted to set Done`);
    } else {
      console.log(`⚠️  No carryover items were created successfully`);
    }
  }

  // Sprint 2: 20 items (3 stories + 17 tasks), no points, half missing epic
  const sprint2Keys = [];
  console.log(`\nCreating Sprint 2 items (20 total)...`);
  for (let i = 1; i <= 20; i++) {
    const issueType = i <= 3 ? 'Story' : 'Task';
    const shouldHaveEpic = i % 2 === 0; // half
    const epicKey = shouldHaveEpic ? [epics.gce, epics.framework, epics.approval][i % 3] : null;
    const summary =
      issueType === 'Story'
        ? `[Sprint2][i18n] Story ${i} - placeholder (no AC / no points)`
        : `[Sprint2][i18n] Task ${i - 3} - placeholder (no points)`;

    const fields = {
      project: { id: projectId },
      issuetype: { name: issueType },
      summary,
      description: adfText('Shell ticket: missing sizing/AC. Epic may be missing.'),
      labels: baseLabels.concat(['sprint2', 'shell']),
      ...(teamId ? { [fieldIds.team]: teamId } : {}),
      ...(epicKey ? { parent: { key: epicKey } } : {}),
    };
    try {
      const created = await createIssue(jira, fields);
      if (created && created.key) {
        sprint2Keys.push(created.key);
        if (i % 5 === 0 || i === 20) {
          console.log(`  ✓ Created ${sprint2Keys.length} of ${i}...`);
        }
      } else {
        console.warn(`  ⚠️  Failed to create Sprint 2 item ${i}: No key returned`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to create Sprint 2 item ${i}: ${error.message}`);
    }
  }
  if (sprint2Keys.length > 0) {
    await addIssuesToSprint(jira, sprint2.id, sprint2Keys);
    console.log(`✓ Created ${sprint2Keys.length}/20 item(s) in ${sprint2.name}`);
  }

  // Sprint 3: 30 shell tickets (6 stories + 24 tasks), mixed epic assignment
  const sprint3Keys = [];
  console.log(`\nCreating Sprint 3 items (30 total: 6 stories + 24 tasks)...`);
  // 6 stories
  for (let i = 1; i <= 6; i++) {
    const hasEpic = i % 3 !== 0; // ~2/3 have epic
    const epicKey = hasEpic ? [epics.gce, epics.framework, epics.approval][i % 3] : null;
    const summary = `[Sprint3][i18n] Story ${i} - shell ticket (no points)`;
    const fields = {
      project: { id: projectId },
      issuetype: { name: 'Story' },
      summary,
      description: adfText('Shell ticket: created early; missing sizing/AC. Epic may be missing.'),
      labels: baseLabels.concat(['sprint3', 'shell']),
      ...(teamId ? { [fieldIds.team]: teamId } : {}),
      ...(epicKey ? { parent: { key: epicKey } } : {}),
    };
    try {
      const created = await createIssue(jira, fields);
      if (created && created.key) {
        sprint3Keys.push(created.key);
      } else {
        console.warn(`  ⚠️  Failed to create Sprint 3 story ${i}: No key returned`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to create Sprint 3 story ${i}: ${error.message}`);
    }
  }
  console.log(`  ✓ Created ${sprint3Keys.length} stories...`);
  // 24 tasks
  const taskStartCount = sprint3Keys.length;
  for (let i = 1; i <= 24; i++) {
    const hasEpic = i % 3 !== 0;
    const epicKey = hasEpic ? [epics.gce, epics.framework, epics.approval][i % 3] : null;
    const summary = `[Sprint3][i18n] Task ${i} - shell ticket (no points)`;
    const fields = {
      project: { id: projectId },
      issuetype: { name: 'Task' },
      summary,
      description: adfText('Shell ticket: created early; missing sizing/AC. Epic may be missing.'),
      labels: baseLabels.concat(['sprint3', 'shell']),
      ...(teamId ? { [fieldIds.team]: teamId } : {}),
      ...(epicKey ? { parent: { key: epicKey } } : {}),
    };
    try {
      const created = await createIssue(jira, fields);
      if (created && created.key) {
        sprint3Keys.push(created.key);
        if (i % 10 === 0 || i === 24) {
          console.log(`  ✓ Created ${sprint3Keys.length - taskStartCount} tasks so far...`);
        }
      } else {
        console.warn(`  ⚠️  Failed to create Sprint 3 task ${i}: No key returned`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to create Sprint 3 task ${i}: ${error.message}`);
    }
  }
  if (sprint3Keys.length > 0) {
    await addIssuesToSprint(jira, sprint3.id, sprint3Keys);
    console.log(`✓ Created ${sprint3Keys.length}/30 item(s) in ${sprint3.name}`);
  }

  // As the last step of setup, start Sprint 1 (if it is currently future)
  // (Placed at the end so a start-sprint error can't interrupt ticket creation.)
  // NOTE: Commented out - keeping Sprint 1 in "future" state for testing
  // await startSprintIfFuture(jira, sprint1);

  console.log('\n✅ Created test data');
  console.log(`- Board: ${board.name} (${board.id})`);
  console.log(`- Sprint 1: ${sprint1.name} (${sprint1.id}) state=${sprint1.state}`);
  console.log(`- Sprint 2: ${sprint2.name} (${sprint2.id}) state=${sprint2.state}`);
  console.log(`- Sprint 3: ${sprint3.name} (${sprint3.id}) state=${sprint3.state}`);
  console.log(`- Issues created: ${40 + seedCreatedKeys.length + 8 + 20 + 30}`);
  console.log(`\nTo delete everything created by this script:`);
  console.log(`  node purge-by-label.js --yes`);
}

run().catch((e) => {
  console.error('\n❌ create-test-data failed.');
  console.error(String(e && e.stack ? e.stack : e));
  console.error('\nTo remove partial data, use: node purge-by-label.js --yes');
  // Do not exit non-zero: some terminals (e.g., ephemeral Cursor terminals)
  // may close on non-zero exit codes, which is disruptive during interactive use.
  // We still print the failure prominently above.
});


