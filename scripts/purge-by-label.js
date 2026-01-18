#!/usr/bin/env node

/**
 * Purge disposable test data by label (preview-first).
 *
 * Default label: non-permanent-test-data
 * Override: JIRA_TESTDATA_LABEL or --label "<label>"
 *
 * Usage:
 *   node purge-by-label.js
 *   node purge-by-label.js --yes
 *   node purge-by-label.js --project SP --label non-permanent-test-data --yes
 *
 * Optional:
 *   --types "Epic,Initiative"   # filter output/deletion to specific issue types
 *   --limit 2000                # increase preview/delete limit
 */

const path = require('path');
require('../jira/env-loader'); // Load jira.env from configurable location

const { loadJiraConfig } = require('../jira/config');
const { makeJiraClient } = require('../jira/client');

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  const get = (flag) => {
    const idx = argv.indexOf(flag);
    if (idx === -1) return null;
    return argv[idx + 1] || null;
  };
  return {
    yes: args.has('--yes'),
    projectKey: get('--project'),
    label: get('--label'),
    typesCsv: get('--types'),
    limit: Number(get('--limit') || 500),
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

async function searchJql(jira, { jql, fields, maxResults = 100, startAt = 0 }) {
  const qp = q({
    jql,
    startAt,
    maxResults,
    fields: fields.join(','),
  });
  return await jira.request('GET', `/rest/api/3/search/jql?${qp}`);
}

async function listAllByLabel(jira, projectKey, label, limit) {
  const fields = ['key', 'summary', 'issuetype', 'status', 'parent', 'created'];
  const jql = `project=${projectKey} AND labels="${label}" ORDER BY created DESC`;
  const issues = [];
  let startAt = 0;
  const pageSize = Math.min(100, limit);

  while (issues.length < limit) {
    const res = await searchJql(jira, { jql, fields, maxResults: pageSize, startAt });
    issues.push(...(res.issues || []));
    startAt += res.maxResults || pageSize;
    if ((res.issues || []).length === 0) break;
    if (issues.length >= (res.total || issues.length)) break;
  }

  return issues.slice(0, limit);
}

function splitCsv(s) {
  if (!s) return [];
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function groupByType(issues) {
  const m = new Map();
  for (const it of issues) {
    const t = it.fields.issuetype?.name || 'Unknown';
    m.set(t, (m.get(t) || 0) + 1);
  }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

function sortWithHierarchyFirst(issues) {
  const rank = (t) => (t === 'Initiative' ? 0 : t === 'Epic' ? 1 : 2);
  return issues.slice().sort((a, b) => {
    const ta = a.fields.issuetype?.name || '';
    const tb = b.fields.issuetype?.name || '';
    const ra = rank(ta);
    const rb = rank(tb);
    if (ra !== rb) return ra - rb;
    // fall back to created desc if available
    const ca = a.fields.created || '';
    const cb = b.fields.created || '';
    return cb.localeCompare(ca);
  });
}

function sortForDeletionChildrenFirst(issues) {
  // Delete leaf work items first, then Epics, then Initiatives last.
  const rank = (t) => (t === 'Initiative' ? 2 : t === 'Epic' ? 1 : 0);
  return issues.slice().sort((a, b) => {
    const ta = a.fields.issuetype?.name || '';
    const tb = b.fields.issuetype?.name || '';
    const ra = rank(ta);
    const rb = rank(tb);
    if (ra !== rb) return ra - rb;
    const ca = a.fields.created || '';
    const cb = b.fields.created || '';
    return cb.localeCompare(ca);
  });
}

async function deleteIssue(jira, key) {
  await jira.request('DELETE', `/rest/api/3/issue/${encodeURIComponent(key)}?deleteSubtasks=true`);
}

async function run() {
  const cfg = loadJiraConfig();
  const jira = makeJiraClient(cfg);
  const args = parseArgs(process.argv);

  const projectKey = args.projectKey || cfg.projectKey;
  if (!projectKey) throw new Error('Missing project key (set JIRA_PROJECT_KEY or pass --project)');

  const label = args.label || process.env.JIRA_TESTDATA_LABEL || 'non-permanent-test-data';
  const types = splitCsv(args.typesCsv);

  console.log('=== Purge by label (preview-first) ===\n');
  console.log(`Project: ${projectKey}`);
  console.log(`Label: ${label}`);
  if (types.length) console.log(`Types filter: ${types.join(', ')}`);
  console.log(`Mode: ${args.yes ? 'DELETE' : 'PREVIEW'}\n`);

  const jql = `project=${projectKey} AND labels="${label}" ORDER BY created DESC`;
  console.log(`JQL: ${jql}\n`);

  let issues = await listAllByLabel(jira, projectKey, label, args.limit);
  if (types.length) {
    issues = issues.filter((it) => types.includes(it.fields.issuetype?.name));
  }
  const previewIssues = sortWithHierarchyFirst(issues);

  console.log(`Found ${issues.length} issue(s) in preview (limit ${args.limit}).`);
  const grouped = groupByType(issues);
  if (grouped.length) {
    console.log('Counts by type:');
    for (const [t, c] of grouped) console.log(`- ${t}: ${c}`);
  }
  console.log('');

  for (const it of previewIssues) {
    const parent = it.fields.parent ? ` parent=${it.fields.parent.key}` : '';
    console.log(`- ${it.key} [${it.fields.issuetype?.name}] ${it.fields.summary}${parent}`);
  }

  if (!args.yes) {
    console.log('\nNothing deleted. Re-run with --yes to delete the above issues.');
    return;
  }

  console.log('\nDeleting (children first; with retry passes)...\n');
  let ok = 0;
  const failed = [];
  const maxPasses = 5;
  for (let pass = 1; pass <= maxPasses; pass++) {
    const remainingNow = await listAllByLabel(jira, projectKey, label, args.limit);
    let remainingFilteredNow = remainingNow;
    if (types.length) remainingFilteredNow = remainingFilteredNow.filter((it) => types.includes(it.fields.issuetype?.name));
    if (!remainingFilteredNow.length) break;

    const deleteOrder = sortForDeletionChildrenFirst(remainingFilteredNow);
    let passDeleted = 0;
    console.log(`Pass ${pass}/${maxPasses}: attempting ${deleteOrder.length} delete(s)`);

    for (const it of deleteOrder) {
      try {
        await deleteIssue(jira, it.key);
        ok++;
        passDeleted++;
        console.log(`✓ Deleted ${it.key}`);
      } catch (e) {
        const msg = String(e.message || e).slice(0, 200);
        failed.push({ key: it.key, msg });
        console.log(`✗ Failed ${it.key}: ${msg}`);
      }
    }

    if (passDeleted === 0) {
      console.log('No progress this pass; stopping retries.');
      break;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Deleted: ${ok}/${issues.length}`);

  // Post-check: re-query and report remaining issues with this label.
  try {
    const remaining = await listAllByLabel(jira, projectKey, label, args.limit);
    const remainingFiltered = types.length
      ? remaining.filter((it) => types.includes(it.fields.issuetype?.name))
      : remaining;
    console.log(`Remaining with label "${label}" (preview limit ${args.limit}): ${remainingFiltered.length}`);
    if (remainingFiltered.length) {
      const attempted = new Set(previewIssues.map((i) => i.key));
      const failureMap = new Map(failed.map((f) => [f.key, f.msg]));

      console.log('\nNot deleted (details):');
      for (const it of sortWithHierarchyFirst(remainingFiltered)) {
        const wasAttempted = attempted.has(it.key);
        const why = wasAttempted
          ? (failureMap.get(it.key) || 'unknown failure (no message captured)')
          : `not attempted (not in delete set; check --limit/--types)`;
        console.log(`- ${it.key} [${it.fields.issuetype?.name}] ${it.fields.summary}`);
        console.log(`  why: ${why}`);
      }

      console.log('\nCommon causes:');
      console.log('- HTTP 403: missing "Delete issues" permission');
      console.log('- HTTP 400: issue has constraints (screen/workflow) or invalid request');
      console.log('- HTTP 404: issue key not visible or already deleted');
    }
  } catch (e) {
    console.log(`Post-check failed: ${String(e.message || e).slice(0, 200)}`);
  }

  if (failed.length) {
    console.log('\nFailures (copy/paste):');
    for (const f of failed) console.log(`- ${f.key}: ${f.msg}`);
  }
}

run().catch((e) => {
  console.error('\n❌ purge-by-label failed.');
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});


