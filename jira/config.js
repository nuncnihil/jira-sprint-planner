function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optionalEnv(name, fallback) {
  const v = process.env[name];
  return v == null || v === '' ? fallback : v;
}

function normalizeBaseUrl(url) {
  // Accept https://example.atlassian.net or example.atlassian.net
  const withProto = url.startsWith('http') ? url : `https://${url}`;
  return withProto.replace(/\/+$/, '');
}

function loadJiraConfig() {
  return {
    baseUrl: normalizeBaseUrl(requiredEnv('JIRA_BASE_URL')),
    email: requiredEnv('JIRA_EMAIL'),
    apiToken: requiredEnv('JIRA_API_TOKEN'),

    projectKey: optionalEnv('JIRA_PROJECT_KEY', undefined),
    projectId: optionalEnv('JIRA_PROJECT_ID', undefined),
    teamId: optionalEnv('JIRA_TEAM_ID', undefined),
    teamName: optionalEnv('JIRA_TEAM_NAME', undefined),
    targetBoardName: optionalEnv('JIRA_TARGET_BOARD_NAME', undefined),
    
    // Engineering Excellence configuration
    eeInitiative: optionalEnv('JIRA_EE_INITIATIVE', undefined),
    eeEpic: optionalEnv('JIRA_EE_EPIC', undefined),
    eeLabel: optionalEnv('JIRA_EE_LABEL', undefined),
  };
}

module.exports = { loadJiraConfig };


