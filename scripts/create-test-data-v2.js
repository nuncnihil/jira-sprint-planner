#!/usr/bin/env node

/**
 * Create realistic, messy Jira test data for sprint planning POC
 * 
 * Based on: TEST-DATA-SPEC.md
 * 
 * Creates:
 * - 5 Initiatives (4 feature + 1 Engineering Excellence)
 * - 6 Epics (intentionally incomplete - 50% missing)
 * - ~70 Issues across 3 sprints + backlog
 * - 60% unassigned with description hints
 * - All sprints stay "future" state
 * - No story points (deferred)
 * 
 * Usage: node create-test-data-v2.js
 */

const path = require('path');
require('../jira/env-loader'); // Load jira.env from configurable location

const { loadJiraConfig } = require('../jira/config');
const { makeJiraClient } = require('../jira/client');
const { getFieldIds } = require('../jira/field-resolver');

// ============================================================================
// HELPERS
// ============================================================================

function adfText(text) {
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function adfWithHint(description, suggestedEpic, suggestedInitiative) {
  return {
    type: 'doc',
    version: 1,
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: description }] },
      { type: 'paragraph', content: [{ type: 'text', text: '' }] },
      { type: 'paragraph', content: [{ type: 'text', text: `Suggested Epic: ${suggestedEpic}`, marks: [{ type: 'em' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: `Suggested Initiative: ${suggestedInitiative}`, marks: [{ type: 'em' }] }] },
    ],
  };
}

async function searchByName(jira, projectKey, type, name) {
  const jql = `project=${projectKey} AND type="${type}" AND summary ~ "${name}" ORDER BY created DESC`;
  const res = await jira.request('GET', `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=10&fields=key,summary`);
  return res.issues?.[0]?.key || null;
}

async function findSprintByName(jira, boardId, name) {
  const res = await jira.request('GET', `/rest/agile/1.0/board/${boardId}/sprint?maxResults=200`);
  return (res.values || []).find(s => s.name === name) || null;
}

async function findBoardByName(jira, name) {
  const res = await jira.request('GET', `/rest/agile/1.0/board?maxResults=200`);
  return (res.values || []).find(b => b.name === name) || null;
}

async function createIssue(jira, fields) {
  const res = await jira.request('POST', `/rest/api/3/issue`, { fields });
  return res.key;
}

async function addIssueToSprint(jira, sprintId, issueKeys) {
  if (!Array.isArray(issueKeys)) issueKeys = [issueKeys];
  await jira.request('POST', `/rest/agile/1.0/sprint/${sprintId}/issue`, { issues: issueKeys });
}

// ============================================================================
// DATA DEFINITIONS (from TEST-DATA-SPEC.md)
// ============================================================================

const INITIATIVES = [
  { name: 'Internationalization', label: 'internationalization' },
  { name: 'unified mobile', label: 'unified-mobile' },
  { name: 'AI component builder', label: 'ai-component-builder' },
  { name: 'server side rendering', label: 'ssr' },
  // Engineering Excellence will be added from config
];

const EPICS_TO_CREATE = [
  { name: 'GCE Alignment', initiative: 'Internationalization' },
  { name: 'Authentication & Security', initiative: 'unified mobile' },
  { name: 'Component Generation', initiative: 'AI component builder' },
  { name: 'SSR Infrastructure', initiative: 'server side rendering' },
  // Engineering Excellence epic will be added from config
];

const SPRINT1_ISSUES = [
  { type: 'Task', summary: 'Implement locale detection from Accept-Language header', epic: 'GCE Alignment', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Add translation keys for product catalog', epic: 'GCE Alignment', initiative: 'Internationalization' },
  { type: 'Story', summary: 'As a user, I can see my preferred language on login', epic: 'GCE Alignment', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Update date formatting to support regional formats', epic: 'GCE Alignment', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Set up i18n library and configuration', epic: null, suggestedEpic: 'Core Framework', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Close out i18n extraction TODOs from last sprint', epic: null, suggestedEpic: 'Core Framework', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Fix locale fallback edge-case for empty Accept-Language', epic: null, suggestedEpic: 'Core Framework', initiative: 'Internationalization' },
  { type: 'Story', summary: 'As a user, see translated navigation labels', epic: 'GCE Alignment', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Update translation glossary for key product terms', epic: 'GCE Alignment', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Add translation approval checklist to workflow', epic: null, suggestedEpic: 'Approval Process', initiative: 'Internationalization' },
  { type: 'Story', summary: 'As a reviewer, approve/reject translation changes', epic: null, suggestedEpic: 'Approval Process', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Remove deprecated i18n keys and cleanup unused strings', epic: null, suggestedEpic: 'Engineering Excellence', initiative: 'Engineering Excellence', isEE: true },
  { type: 'Task', summary: 'Backfill missing i18n unit tests for locale negotiation', epic: null, suggestedEpic: 'Engineering Excellence', initiative: 'Engineering Excellence', isEE: true },
];

const SPRINT2_ISSUES = [
  { type: 'Story', summary: 'As a user, I can switch languages without losing context', epic: 'GCE Alignment', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Create translation file structure and loading', epic: null, suggestedEpic: 'Core Framework', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Implement pluralization rules for supported languages', epic: null, suggestedEpic: 'Core Framework', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Add translation fallback chain logic', epic: null, suggestedEpic: 'Core Framework', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Create translation review workflow', epic: null, suggestedEpic: 'Approval Process', initiative: 'Internationalization' },
  { type: 'Story', summary: 'As a mobile user, I can navigate using unified nav component', epic: null, suggestedEpic: 'Cross-Platform Navigation', initiative: 'unified mobile' },
  { type: 'Task', summary: 'Migrate iOS navigation to shared component', epic: null, suggestedEpic: 'Cross-Platform Navigation', initiative: 'unified mobile' },
  { type: 'Task', summary: 'Implement responsive breakpoints for tablet', epic: null, suggestedEpic: 'Cross-Platform Navigation', initiative: 'unified mobile' },
  { type: 'Story', summary: 'As a user, I can log in using biometric authentication', epic: 'Authentication & Security', initiative: 'unified mobile' },
  { type: 'Task', summary: 'Create unified authentication flow', epic: 'Authentication & Security', initiative: 'unified mobile' },
  { type: 'Task', summary: 'Add biometric login support', epic: 'Authentication & Security', initiative: 'unified mobile' },
  { type: 'Task', summary: 'Design component schema definition format', epic: null, suggestedEpic: 'Schema & Parser', initiative: 'AI component builder' },
  { type: 'Task', summary: 'Build natural language parser for component specs', epic: null, suggestedEpic: 'Schema & Parser', initiative: 'AI component builder' },
  { type: 'Story', summary: 'As a dev, I can generate a component from natural language', epic: 'Component Generation', initiative: 'AI component builder' },
  { type: 'Task', summary: 'Set up SSR infrastructure and routing', epic: 'SSR Infrastructure', initiative: 'server side rendering' },
  { type: 'Task', summary: 'Implement page hydration logic', epic: 'SSR Infrastructure', initiative: 'server side rendering' },
  { type: 'Story', summary: 'As a user, pages load faster with server-side rendering', epic: 'SSR Infrastructure', initiative: 'server side rendering' },
  { type: 'Task', summary: 'Add SEO metadata generation', epic: null, suggestedEpic: 'SEO & Metadata', initiative: 'server side rendering' },
  { type: 'Task', summary: 'Refactor push notification handling', epic: null, suggestedEpic: 'Engineering Excellence', initiative: 'Engineering Excellence', isEE: true },
  { type: 'Task', summary: 'Update CI pipeline to run E2E tests on mobile emulators', epic: null, suggestedEpic: 'Engineering Excellence', initiative: 'Engineering Excellence', isEE: true },
];

const SPRINT3_ISSUES = [
  { type: 'Task', summary: 'Create locale-specific currency display logic', epic: 'GCE Alignment', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Add language switcher to navigation bar', epic: 'GCE Alignment', initiative: 'Internationalization' },
  { type: 'Story', summary: 'As an admin, I can manage supported languages', epic: 'GCE Alignment', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Build translation key extraction tooling', epic: null, suggestedEpic: 'Core Framework', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Implement translation caching for performance', epic: null, suggestedEpic: 'Core Framework', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Add approval gates for new translation keys', epic: null, suggestedEpic: 'Approval Process', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Implement translation quality scoring', epic: null, suggestedEpic: 'Approval Process', initiative: 'Internationalization' },
  { type: 'Story', summary: 'As a reviewer, I can see translation change history', epic: null, suggestedEpic: 'Approval Process', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Build reviewer assignment logic', epic: null, suggestedEpic: 'Approval Process', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Add translation change history tracking', epic: null, suggestedEpic: 'Approval Process', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Optimize mobile app bundle size', epic: null, suggestedEpic: 'Performance Optimization', initiative: 'unified mobile' },
  { type: 'Task', summary: 'Implement lazy loading for mobile screens', epic: null, suggestedEpic: 'Performance Optimization', initiative: 'unified mobile' },
  { type: 'Story', summary: 'As a mobile user, the app loads 50% faster', epic: null, suggestedEpic: 'Performance Optimization', initiative: 'unified mobile' },
  { type: 'Task', summary: 'Add mobile performance monitoring', epic: null, suggestedEpic: 'Performance Optimization', initiative: 'unified mobile' },
  { type: 'Task', summary: 'Create component preview renderer', epic: null, suggestedEpic: 'Preview & Management', initiative: 'AI component builder' },
  { type: 'Task', summary: 'Implement component version management', epic: null, suggestedEpic: 'Preview & Management', initiative: 'AI component builder' },
  { type: 'Story', summary: 'As a dev, I can preview generated components before saving', epic: null, suggestedEpic: 'Preview & Management', initiative: 'AI component builder' },
  { type: 'Task', summary: 'Add AI-suggested property recommendations', epic: 'Component Generation', initiative: 'AI component builder' },
  { type: 'Task', summary: 'Build component library integration', epic: 'Component Generation', initiative: 'AI component builder' },
  { type: 'Task', summary: 'Create server-side data prefetching', epic: null, suggestedEpic: 'Caching & Performance', initiative: 'server side rendering' },
  { type: 'Task', summary: 'Build static page caching layer', epic: null, suggestedEpic: 'Caching & Performance', initiative: 'server side rendering' },
  { type: 'Story', summary: 'As a user, cached pages load instantly', epic: null, suggestedEpic: 'Caching & Performance', initiative: 'server side rendering' },
  { type: 'Task', summary: 'Implement cache invalidation strategy', epic: null, suggestedEpic: 'Caching & Performance', initiative: 'server side rendering' },
  { type: 'Task', summary: 'Add CDN integration for static assets', epic: null, suggestedEpic: 'Caching & Performance', initiative: 'server side rendering' },
  { type: 'Task', summary: 'Create server-side error handling', epic: 'SSR Infrastructure', initiative: 'server side rendering' },
  { type: 'Task', summary: 'Add server-side logging and monitoring', epic: 'SSR Infrastructure', initiative: 'server side rendering' },
  { type: 'Task', summary: 'Implement progressive enhancement fallbacks', epic: 'SSR Infrastructure', initiative: 'server side rendering' },
  { type: 'Task', summary: 'Fix memory leak in background sync service', epic: null, suggestedEpic: 'Engineering Excellence', initiative: 'Engineering Excellence', isEE: true },
  { type: 'Task', summary: 'Update dependencies to patch security vulnerabilities', epic: null, suggestedEpic: 'Engineering Excellence', initiative: 'Engineering Excellence', isEE: true },
  { type: 'Task', summary: 'Add automated accessibility testing to CI pipeline', epic: null, suggestedEpic: 'Engineering Excellence', initiative: 'Engineering Excellence', isEE: true },
];

const BACKLOG_ISSUES = [
  // Internationalization - GCE Alignment (existing epic)
  { type: 'Task', summary: 'Support right-to-left (RTL) languages', epic: 'GCE Alignment', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Add locale-specific formatting for addresses', epic: 'GCE Alignment', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Implement regional tax rules display', epic: 'GCE Alignment', initiative: 'Internationalization' },
  { type: 'Story', summary: 'As a user in EU, I see GDPR-compliant language options', epic: 'GCE Alignment', initiative: 'Internationalization' },
  
  // Internationalization - Core Framework (missing epic)
  { type: 'Task', summary: 'Add support for dynamic translation loading', epic: null, suggestedEpic: 'Core Framework', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Implement translation interpolation with variables', epic: null, suggestedEpic: 'Core Framework', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Create translation key naming conventions', epic: null, suggestedEpic: 'Core Framework', initiative: 'Internationalization' },
  { type: 'Story', summary: 'As a dev, I can add new translation keys easily', epic: null, suggestedEpic: 'Core Framework', initiative: 'Internationalization' },
  
  // Internationalization - Approval Process (missing epic)
  { type: 'Task', summary: 'Add automated translation quality checks', epic: null, suggestedEpic: 'Approval Process', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Implement reviewer notification system', epic: null, suggestedEpic: 'Approval Process', initiative: 'Internationalization' },
  { type: 'Story', summary: 'As a reviewer, I receive alerts for pending translations', epic: null, suggestedEpic: 'Approval Process', initiative: 'Internationalization' },
  { type: 'Task', summary: 'Create translation approval dashboard', epic: null, suggestedEpic: 'Approval Process', initiative: 'Internationalization' },
  
  // unified mobile - Cross-Platform Navigation (missing epic)
  { type: 'Task', summary: 'Create shared bottom tab bar component', epic: null, suggestedEpic: 'Cross-Platform Navigation', initiative: 'unified mobile' },
  { type: 'Story', summary: 'As a mobile user, navigation feels native on both platforms', epic: null, suggestedEpic: 'Cross-Platform Navigation', initiative: 'unified mobile' },
  { type: 'Task', summary: 'Add navigation analytics tracking', epic: null, suggestedEpic: 'Cross-Platform Navigation', initiative: 'unified mobile' },
  
  // unified mobile - Authentication & Security (existing epic)
  { type: 'Task', summary: 'Implement secure token storage', epic: 'Authentication & Security', initiative: 'unified mobile' },
  { type: 'Story', summary: 'As a user, I stay logged in securely across app restarts', epic: 'Authentication & Security', initiative: 'unified mobile' },
  { type: 'Task', summary: 'Add session timeout handling', epic: 'Authentication & Security', initiative: 'unified mobile' },
  
  // unified mobile - Performance Optimization (missing epic)
  { type: 'Task', summary: 'Implement image lazy loading', epic: null, suggestedEpic: 'Performance Optimization', initiative: 'unified mobile' },
  { type: 'Task', summary: 'Add network request batching', epic: null, suggestedEpic: 'Performance Optimization', initiative: 'unified mobile' },
  { type: 'Story', summary: 'As a user on slow network, the app remains responsive', epic: null, suggestedEpic: 'Performance Optimization', initiative: 'unified mobile' },
  
  // AI component builder - Schema & Parser (missing epic)
  { type: 'Task', summary: 'Add validation rules for component schemas', epic: null, suggestedEpic: 'Schema & Parser', initiative: 'AI component builder' },
  { type: 'Story', summary: 'As a dev, I can validate component specs before generation', epic: null, suggestedEpic: 'Schema & Parser', initiative: 'AI component builder' },
  { type: 'Task', summary: 'Create schema documentation', epic: null, suggestedEpic: 'Schema & Parser', initiative: 'AI component builder' },
  
  // AI component builder - Component Generation (existing epic)
  { type: 'Task', summary: 'Implement style generation from design tokens', epic: 'Component Generation', initiative: 'AI component builder' },
  { type: 'Task', summary: 'Add accessibility attributes to generated components', epic: 'Component Generation', initiative: 'AI component builder' },
  { type: 'Story', summary: 'As a dev, generated components are accessible by default', epic: 'Component Generation', initiative: 'AI component builder' },
  
  // AI component builder - Preview & Management (missing epic)
  { type: 'Task', summary: 'Add component search and filtering', epic: null, suggestedEpic: 'Preview & Management', initiative: 'AI component builder' },
  { type: 'Story', summary: 'As a dev, I can find and reuse existing components', epic: null, suggestedEpic: 'Preview & Management', initiative: 'AI component builder' },
  { type: 'Task', summary: 'Implement component usage analytics', epic: null, suggestedEpic: 'Preview & Management', initiative: 'AI component builder' },
  
  // server side rendering - SSR Infrastructure (existing epic)
  { type: 'Task', summary: 'Add support for dynamic routes', epic: 'SSR Infrastructure', initiative: 'server side rendering' },
  { type: 'Story', summary: 'As a user, all pages work with SSR', epic: 'SSR Infrastructure', initiative: 'server side rendering' },
  { type: 'Task', summary: 'Implement SSR for authenticated routes', epic: 'SSR Infrastructure', initiative: 'server side rendering' },
  
  // server side rendering - SEO & Metadata (missing epic)
  { type: 'Task', summary: 'Add structured data for rich snippets', epic: null, suggestedEpic: 'SEO & Metadata', initiative: 'server side rendering' },
  { type: 'Story', summary: 'As a marketer, pages have proper SEO metadata', epic: null, suggestedEpic: 'SEO & Metadata', initiative: 'server side rendering' },
  { type: 'Task', summary: 'Create sitemap generation', epic: null, suggestedEpic: 'SEO & Metadata', initiative: 'server side rendering' },
  
  // server side rendering - Caching & Performance (missing epic)
  { type: 'Task', summary: 'Implement edge caching strategy', epic: null, suggestedEpic: 'Caching & Performance', initiative: 'server side rendering' },
  { type: 'Task', summary: 'Add cache warming for popular pages', epic: null, suggestedEpic: 'Caching & Performance', initiative: 'server side rendering' },
  { type: 'Story', summary: 'As a user, popular pages load instantly', epic: null, suggestedEpic: 'Caching & Performance', initiative: 'server side rendering' },
  
  // Engineering Excellence
  { type: 'Task', summary: 'Upgrade React to latest version', epic: null, suggestedEpic: 'Engineering Excellence', initiative: 'Engineering Excellence', isEE: true },
  { type: 'Task', summary: 'Migrate from Redux to Zustand', epic: null, suggestedEpic: 'Engineering Excellence', initiative: 'Engineering Excellence', isEE: true },
  { type: 'Task', summary: 'Add end-to-end test coverage for checkout flow', epic: null, suggestedEpic: 'Engineering Excellence', initiative: 'Engineering Excellence', isEE: true },
  { type: 'Task', summary: 'Refactor legacy API client', epic: null, suggestedEpic: 'Engineering Excellence', initiative: 'Engineering Excellence', isEE: true },
  { type: 'Task', summary: 'Document authentication flow', epic: null, suggestedEpic: 'Engineering Excellence', initiative: 'Engineering Excellence', isEE: true },
];

// ============================================================================
// MAIN LOGIC
// ============================================================================

async function run() {
  console.log('=== Creating Test Data (v2 - from TEST-DATA-SPEC.md) ===\n');

  const cfg = loadJiraConfig();
  const jira = makeJiraClient(cfg);

  // Discover custom field IDs dynamically
  const fieldIds = await getFieldIds(jira);

  if (!cfg.projectId || !cfg.projectKey) {
    throw new Error('Missing JIRA_PROJECT_ID or JIRA_PROJECT_KEY');
  }
  if (!cfg.targetBoardName) {
    throw new Error('Missing JIRA_TARGET_BOARD_NAME');
  }

  const projectId = cfg.projectId;
  const projectKey = cfg.projectKey;
  const teamId = cfg.teamId;
  const boardName = cfg.targetBoardName;
  const disposableLabel = process.env.JIRA_TESTDATA_LABEL || 'non-permanent-test-data';

  // Engineering Excellence config
  const eeInitiative = cfg.eeInitiative || 'Engineering Excellence';
  const eeEpic = cfg.eeEpic || 'Engineering Excellence';
  const eeLabel = cfg.eeLabel || 'engineering-excellence';

  // Add EE to initiatives and epics lists
  INITIATIVES.push({ name: eeInitiative, label: eeLabel });
  EPICS_TO_CREATE.push({ name: eeEpic, initiative: eeInitiative });

  console.log(`Project: ${projectKey} (${projectId})`);
  console.log(`Board: ${boardName}`);
  console.log(`Team: ${teamId || '(none)'}`);
  console.log(`Disposable label: ${disposableLabel}`);
  console.log(`EE Initiative: ${eeInitiative}`);
  console.log(`EE Epic: ${eeEpic}\n`);

  // Find board
  const board = await findBoardByName(jira, boardName);
  if (!board) {
    throw new Error(`Board "${boardName}" not found`);
  }
  console.log(`✓ Found board: ${board.name} (${board.id})\n`);

  // Find sprints
  console.log('Finding sprints...');
  const sprint1 = await findSprintByName(jira, board.id, 'dynaform Sprint 1');
  const sprint2 = await findSprintByName(jira, board.id, 'dynaform Sprint 2');
  const sprint3 = await findSprintByName(jira, board.id, 'dynaform Sprint 3');
  
  if (!sprint1 || !sprint2 || !sprint3) {
    throw new Error('Required sprints not found (dynaform Sprint 1, 2, 3)');
  }
  console.log(`✓ Sprint 1: ${sprint1.name} (${sprint1.id}) - ${sprint1.state}`);
  console.log(`✓ Sprint 2: ${sprint2.name} (${sprint2.id}) - ${sprint2.state}`);
  console.log(`✓ Sprint 3: ${sprint3.name} (${sprint3.id}) - ${sprint3.state}\n`);

  // Create/find initiatives
  console.log('Creating/finding initiatives...');
  const initiativeKeys = {};
  for (const init of INITIATIVES) {
    let key = await searchByName(jira, projectKey, 'Initiative', init.name);
    if (!key) {
      key = await createIssue(jira, {
        project: { id: projectId },
        issuetype: { name: 'Initiative' },
        summary: init.name,
        description: adfText(`Initiative for ${init.name}`),
        labels: [disposableLabel, init.label],
        ...(teamId ? { [fieldIds.team]: teamId } : {}),
      });
      console.log(`  ✓ Created: ${key} - ${init.name}`);
    } else {
      console.log(`  ✓ Found: ${key} - ${init.name}`);
    }
    initiativeKeys[init.name] = key;
  }
  console.log();

  // Create/find epics
  console.log('Creating/finding epics (only 6 total)...');
  const epicKeys = {};
  for (const epic of EPICS_TO_CREATE) {
    const initiativeKey = initiativeKeys[epic.initiative];
    if (!initiativeKey) {
      console.log(`  ⚠️  Skipping epic "${epic.name}" - initiative not found`);
      continue;
    }

    let key = await searchByName(jira, projectKey, 'Epic', epic.name);
    if (!key) {
      key = await createIssue(jira, {
        project: { id: projectId },
        issuetype: { name: 'Epic' },
        summary: epic.name,
        description: adfText(`Epic for ${epic.name}`),
        parent: { key: initiativeKey },
        labels: [disposableLabel],
        ...(teamId ? { [fieldIds.team]: teamId } : {}),
      });
      console.log(`  ✓ Created: ${key} - ${epic.name} (under ${epic.initiative})`);
    } else {
      console.log(`  ✓ Found: ${key} - ${epic.name}`);
    }
    epicKeys[epic.name] = key;
  }
  console.log();

  // Create Sprint 1 issues
  console.log('Creating Sprint 1 issues...');
  const sprint1Keys = [];
  for (const issue of SPRINT1_ISSUES) {
    const labels = [disposableLabel];
    if (issue.isEE) {
      labels.push(eeLabel);
    }

    const fields = {
      project: { id: projectId },
      issuetype: { name: issue.type },
      summary: issue.summary,
      labels,
      ...(teamId ? { [fieldIds.team]: teamId } : {}),
    };

    // Add epic if it exists
    if (issue.epic && epicKeys[issue.epic]) {
      fields.parent = { key: epicKeys[issue.epic] };
      fields.description = adfText(issue.summary);
    } else if (issue.suggestedEpic) {
      // Add description hint
      fields.description = adfWithHint(
        issue.summary,
        issue.suggestedEpic,
        issue.initiative
      );
    } else {
      fields.description = adfText(issue.summary);
    }

    const key = await createIssue(jira, fields);
    sprint1Keys.push(key);
    
    const epicInfo = issue.epic ? `→ ${issue.epic}` : (issue.suggestedEpic ? `(suggest: ${issue.suggestedEpic})` : '(no epic)');
    console.log(`  ✓ ${key}: ${issue.summary.substring(0, 50)}... ${epicInfo}`);
  }
  console.log();

  // Add to Sprint 1
  console.log(`Adding ${sprint1Keys.length} issues to Sprint 1...`);
  await addIssueToSprint(jira, sprint1.id, sprint1Keys);
  console.log(`✓ Added to Sprint 1\n`);

  // Create Sprint 2 issues
  console.log('Creating Sprint 2 issues...');
  const sprint2Keys = [];
  for (const issue of SPRINT2_ISSUES) {
    const labels = [disposableLabel];
    if (issue.isEE) {
      labels.push(eeLabel);
    }

    const fields = {
      project: { id: projectId },
      issuetype: { name: issue.type },
      summary: issue.summary,
      labels,
      ...(teamId ? { [fieldIds.team]: teamId } : {}),
    };

    if (issue.epic && epicKeys[issue.epic]) {
      fields.parent = { key: epicKeys[issue.epic] };
      fields.description = adfText(issue.summary);
    } else if (issue.suggestedEpic) {
      fields.description = adfWithHint(
        issue.summary,
        issue.suggestedEpic,
        issue.initiative
      );
    } else {
      fields.description = adfText(issue.summary);
    }

    const key = await createIssue(jira, fields);
    sprint2Keys.push(key);
    
    const epicInfo = issue.epic ? `→ ${issue.epic}` : (issue.suggestedEpic ? `(suggest: ${issue.suggestedEpic})` : '(no epic)');
    console.log(`  ✓ ${key}: ${issue.summary.substring(0, 50)}... ${epicInfo}`);
  }
  console.log();

  // Add to Sprint 2
  console.log(`Adding ${sprint2Keys.length} issues to Sprint 2...`);
  await addIssueToSprint(jira, sprint2.id, sprint2Keys);
  console.log(`✓ Added to Sprint 2\n`);

  // Create Sprint 3 issues
  console.log('Creating Sprint 3 issues...');
  const sprint3Keys = [];
  for (const issue of SPRINT3_ISSUES) {
    const labels = [disposableLabel];
    if (issue.isEE) {
      labels.push(eeLabel);
    }

    const fields = {
      project: { id: projectId },
      issuetype: { name: issue.type },
      summary: issue.summary,
      labels,
      ...(teamId ? { [fieldIds.team]: teamId } : {}),
    };

    if (issue.epic && epicKeys[issue.epic]) {
      fields.parent = { key: epicKeys[issue.epic] };
      fields.description = adfText(issue.summary);
    } else if (issue.suggestedEpic) {
      fields.description = adfWithHint(
        issue.summary,
        issue.suggestedEpic,
        issue.initiative
      );
    } else {
      fields.description = adfText(issue.summary);
    }

    const key = await createIssue(jira, fields);
    sprint3Keys.push(key);
    
    const epicInfo = issue.epic ? `→ ${issue.epic}` : (issue.suggestedEpic ? `(suggest: ${issue.suggestedEpic})` : '(no epic)');
    console.log(`  ✓ ${key}: ${issue.summary.substring(0, 50)}... ${epicInfo}`);
  }
  console.log();

  // Add to Sprint 3
  console.log(`Adding ${sprint3Keys.length} issues to Sprint 3...`);
  await addIssueToSprint(jira, sprint3.id, sprint3Keys);
  console.log(`✓ Added to Sprint 3\n`);

  // Create Backlog issues (no sprint assignment)
  console.log('Creating Backlog issues...');
  const backlogKeys = [];
  for (const issue of BACKLOG_ISSUES) {
    const labels = [disposableLabel];
    if (issue.isEE) {
      labels.push(eeLabel);
    }

    const fields = {
      project: { id: projectId },
      issuetype: { name: issue.type },
      summary: issue.summary,
      labels,
      ...(teamId ? { [fieldIds.team]: teamId } : {}),
    };

    if (issue.epic && epicKeys[issue.epic]) {
      fields.parent = { key: epicKeys[issue.epic] };
      fields.description = adfText(issue.summary);
    } else if (issue.suggestedEpic) {
      fields.description = adfWithHint(
        issue.summary,
        issue.suggestedEpic,
        issue.initiative
      );
    } else {
      fields.description = adfText(issue.summary);
    }

    const key = await createIssue(jira, fields);
    backlogKeys.push(key);
    
    const epicInfo = issue.epic ? `→ ${issue.epic}` : (issue.suggestedEpic ? `(suggest: ${issue.suggestedEpic})` : '(no epic)');
    console.log(`  ✓ ${key}: ${issue.summary.substring(0, 50)}... ${epicInfo}`);
  }
  console.log(`✓ ${backlogKeys.length} backlog issues created (not assigned to sprint)\n`);

  // Summary
  console.log('=== Summary ===');
  console.log(`✓ Initiatives: ${INITIATIVES.length} (${Object.keys(initiativeKeys).length} created/found)`);
  console.log(`✓ Epics: ${EPICS_TO_CREATE.length} (${Object.keys(epicKeys).length} created/found)`);
  console.log(`✓ Sprint 1 issues: ${sprint1Keys.length}`);
  console.log(`  - Assigned to epics: ${SPRINT1_ISSUES.filter(i => i.epic).length}`);
  console.log(`  - Unassigned with hints: ${SPRINT1_ISSUES.filter(i => !i.epic && i.suggestedEpic).length}`);
  console.log(`  - Engineering Excellence: ${SPRINT1_ISSUES.filter(i => i.isEE).length}`);
  console.log(`✓ Sprint 2 issues: ${sprint2Keys.length}`);
  console.log(`  - Assigned to epics: ${SPRINT2_ISSUES.filter(i => i.epic).length}`);
  console.log(`  - Unassigned with hints: ${SPRINT2_ISSUES.filter(i => !i.epic && i.suggestedEpic).length}`);
  console.log(`  - Engineering Excellence: ${SPRINT2_ISSUES.filter(i => i.isEE).length}`);
  console.log(`✓ Sprint 3 issues: ${sprint3Keys.length}`);
  console.log(`  - Assigned to epics: ${SPRINT3_ISSUES.filter(i => i.epic).length}`);
  console.log(`  - Unassigned with hints: ${SPRINT3_ISSUES.filter(i => !i.epic && i.suggestedEpic).length}`);
  console.log(`  - Engineering Excellence: ${SPRINT3_ISSUES.filter(i => i.isEE).length}`);
  console.log(`✓ Backlog issues: ${backlogKeys.length}`);
  console.log(`  - Assigned to epics: ${BACKLOG_ISSUES.filter(i => i.epic).length}`);
  console.log(`  - Unassigned with hints: ${BACKLOG_ISSUES.filter(i => !i.epic && i.suggestedEpic).length}`);
  console.log(`  - Engineering Excellence: ${BACKLOG_ISSUES.filter(i => i.isEE).length}`);
  console.log();
  console.log('✅ All test data created successfully!');
}

run().catch((err) => {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  // Don't exit(1) to avoid closing terminal
});

