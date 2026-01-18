// Setup file for server tests

// Mock environment variables for tests
process.env.JIRA_URL = process.env.JIRA_URL || 'http://test-jira.example.com';
process.env.JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || 'test-token';
process.env.JIRA_TEAM_ID = process.env.JIRA_TEAM_ID || 'test-team-id';
