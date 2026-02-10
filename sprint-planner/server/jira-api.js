const path = require('path');
require('../../jira/env-loader'); // Load jira.env from configurable location

const { makeJiraClient } = require('../../jira/client');
const { loadJiraConfig } = require('../../jira/config');
const { getFieldIds } = require('../../jira/field-resolver');

// Initialize Jira client once
const config = loadJiraConfig();
const jira = makeJiraClient(config);

/**
 * Get all boards
 * @returns {Promise<Array>} [{id, name, type}]
 */
async function getBoards() {
  const response = await jira.request('GET', '/rest/agile/1.0/board');
  return response.values.map(board => ({
    id: board.id,
    name: board.name,
    type: board.type
  }));
}

/**
 * Get sprints for a board
 * @param {number} boardId - Board ID
 * @returns {Promise<Array>} [{id, name, state, startDate, endDate}]
 */
async function getSprints(boardId) {
  const response = await jira.request('GET', `/rest/agile/1.0/board/${boardId}/sprint`);
  return response.values.map(sprint => ({
    id: sprint.id,
    name: sprint.name,
    state: sprint.state,
    startDate: sprint.startDate || null,
    endDate: sprint.endDate || null,
    goal: sprint.goal || ''
  }));
}

/**
 * Get board details including project
 * @param {number} boardId - Board ID
 * @returns {Promise<object>} {id, name, projectKey}
 */
async function getBoardDetails(boardId) {
  const response = await jira.request('GET', `/rest/agile/1.0/board/${boardId}`);
  return {
    id: response.id,
    name: response.name,
    projectKey: response.location?.projectKey || null
  };
}

/**
 * Get issues in a sprint (using REST API v3 to get ADF descriptions)
 * @param {number} sprintId - Sprint ID
 * @returns {Promise<Array>} [{key, type, summary, description, epicKey, epicName, storyPoints, status, labels, updated}]
 */
async function getSprintIssues(sprintId) {
  const fieldIds = await getFieldIds(jira);
  
  // Use REST API v3 with JQL to get proper ADF descriptions
  // Note: /rest/api/3/search/jql uses POST, not GET
  const jql = `sprint=${sprintId} AND status != Done`;
  const fields = ['summary', 'description', 'issuetype', 'parent', 'status', 'labels', 'updated', fieldIds.storyPoints];
  
  const response = await jira.request('POST', `/rest/api/3/search/jql`, {
    jql,
    fields,
    maxResults: 1000
  });
  
  return response.issues.map(issue => ({
    key: issue.key,
    type: issue.fields.issuetype?.name || 'Unknown',
    summary: issue.fields.summary,
    description: issue.fields.description || null, // Now returns ADF object
    epicKey: issue.fields.parent?.key || null,
    epicName: issue.fields.parent?.fields?.summary || null,
    storyPoints: issue.fields[fieldIds.storyPoints] || null,
    status: issue.fields.status?.name || 'Unknown',
    labels: issue.fields.labels || [],
    updated: issue.fields.updated || null
  }));
}

/**
 * Get backlog issues for a board
 * @param {number} boardId - Board ID
 * @returns {Promise<Array>} [{key, type, summary, epicKey, epicName, storyPoints, status, labels}]
 */
async function getBacklog(boardId) {
  const fieldIds = await getFieldIds(jira);
  const response = await jira.request('GET', `/rest/agile/1.0/board/${boardId}/backlog?maxResults=1000`);
  return response.issues
    .filter(issue => issue.fields.status?.name !== 'Done') // Exclude Done issues
    .map(issue => ({
      key: issue.key,
      type: issue.fields.issuetype?.name || 'Unknown',
      summary: issue.fields.summary,
      description: issue.fields.description || null,
      epicKey: issue.fields.parent?.key || null,
      epicName: issue.fields.parent?.fields?.summary || null,
      storyPoints: issue.fields[fieldIds.storyPoints] || null,
      status: issue.fields.status?.name || 'Unknown',
      labels: issue.fields.labels || [],
      updated: issue.fields.updated || null
    }));
}

/**
 * Get initiatives for a project and team
 * @param {string} projectKey - Project key
 * @param {string} teamId - Team ID to filter by
 * @returns {Promise<Array>} [{key, name, teamId, teamName}]
 */
async function getInitiatives(projectKey, teamId) {
  const fieldIds = await getFieldIds(jira);
  
  // Fetch all initiatives and filter by team ID in code
  // (JQL doesn't easily filter by team object.id, so we filter after fetch)
  const jql = `project=${projectKey} AND type=Initiative ORDER BY created DESC`;
  const response = await jira.request('POST', `/rest/api/3/search/jql`, {
    jql,
    fields: ['summary', 'status', fieldIds.team],
    maxResults: 100
  });
  
  if (!response.issues || !Array.isArray(response.issues)) {
    return [];
  }
  
  return response.issues
    .filter(issue => issue.fields?.[fieldIds.team]?.id === teamId)
    .filter(issue => issue.fields?.status?.name !== 'Done') // Exclude Done initiatives
    .map(issue => ({
      key: issue.key,
      name: issue.fields?.summary || 'Untitled',
      teamId: issue.fields?.[fieldIds.team]?.id || null,
      teamName: issue.fields?.[fieldIds.team]?.name || null
    }));
}

/**
 * Get epics for initiatives
 * @param {Array<string>} initiativeKeys - Array of initiative keys
 * @returns {Promise<Array>} [{key, name, parentKey, issueKeys}]
 */
async function getEpicsForInitiatives(initiativeKeys) {
  if (initiativeKeys.length === 0) {
    return [];
  }
  
  const jql = `parent IN (${initiativeKeys.join(',')}) AND type=Epic ORDER BY created DESC`;
  const response = await jira.request('POST', `/rest/api/3/search/jql`, {
    jql,
    fields: ['summary', 'parent'],
    maxResults: 100
  });
  
  if (!response.issues || !Array.isArray(response.issues)) {
    return [];
  }
  
  return response.issues.map(issue => ({
    key: issue.key,
    name: issue.fields?.summary || 'Untitled',
    parentKey: issue.fields?.parent?.key || null,
    issueKeys: []  // Will be populated by matching issues to epics
  }));
}

/**
 * Update an issue in Jira
 * @param {string} issueKey - Issue key (e.g., 'SP-123')
 * @param {Object} fields - Fields to update in Jira format
 * @returns {Promise<void>}
 */
async function updateIssue(issueKey, fields) {
  await jira.request('PUT', `/rest/api/3/issue/${issueKey}`, { fields });
}

/**
 * Get issue updated timestamp (for conflict detection)
 * @param {string} issueKey - Issue key
 * @returns {Promise<string>} Updated timestamp
 */
async function getIssueUpdated(issueKey) {
  const response = await jira.request('GET', `/rest/api/3/issue/${issueKey}?fields=updated`);
  return response.fields.updated;
}

/**
 * Create a test issue
 * @param {Object} params - { projectKey, summary, issueType, epicKey, storyPoints, teamId }
 * @returns {Promise<Object>} Created issue { key, id }
 */
async function createIssue({ projectKey, summary, issueType = 'Task', epicKey = null, storyPoints = null, teamId = null }) {
  const fieldIds = await getFieldIds(jira);
  
  const fields = {
    project: { key: projectKey },
    summary,
    issuetype: { name: issueType }
  };
  
  if (epicKey) {
    fields.parent = { key: epicKey };
  }
  
  if (storyPoints !== null) {
    fields[fieldIds.storyPoints] = storyPoints;
  }
  
  if (teamId) {
    fields[fieldIds.team] = teamId;
  }
  
  const response = await jira.request('POST', '/rest/api/3/issue', { fields });
  return { key: response.key, id: response.id };
}

/**
 * Add issues to a sprint
 * @param {number} sprintId - Sprint ID
 * @param {string[]} issueKeys - Array of issue keys
 * @returns {Promise<void>}
 */
async function addIssuesToSprint(sprintId, issueKeys) {
  if (!issueKeys || issueKeys.length === 0) return;
  await jira.request('POST', `/rest/agile/1.0/sprint/${sprintId}/issue`, {
    issues: issueKeys
  });
}

/**
 * Update sprint goal
 * @param {number} sprintId - Sprint ID
 * @param {string} goal - Sprint goal text
 * @param {string} name - Sprint name (required by Jira)
 * @param {string} state - Sprint state (required by Jira)
 * @returns {Promise<void>}
 */
async function updateSprintGoal(sprintId, goal, name, state) {
  await jira.request('PUT', `/rest/agile/1.0/sprint/${sprintId}`, {
    name: name,
    state: state,
    goal: goal
  });
}

/**
 * Delete an issue
 * @param {string} issueKey - Issue key to delete
 * @returns {Promise<void>}
 */
async function deleteIssue(issueKey) {
  await jira.request('DELETE', `/rest/api/3/issue/${issueKey}`);
}

/**
 * Get project details by project key or ID
 * @param {string} projectKeyOrId - Project key or ID
 * @returns {Promise<Object>} {id, key, name, projectTypeKey}
 */
async function getProject(projectKeyOrId) {
  const response = await jira.request('GET', `/rest/api/3/project/${projectKeyOrId}`);
  return {
    id: response.id,
    key: response.key,
    name: response.name,
    projectTypeKey: response.projectTypeKey
  };
}

/**
 * Get dynamically discovered custom field IDs
 * @returns {Promise<Object>} { storyPoints, team, sprint }
 */
async function getCustomFieldIds() {
  return await getFieldIds(jira);
}

module.exports = {
  getBoards,
  getSprints,
  getBoardDetails,
  getSprintIssues,
  getBacklog,
  getInitiatives,
  getEpicsForInitiatives,
  updateIssue,
  getIssueUpdated,
  createIssue,
  addIssuesToSprint,
  updateSprintGoal,
  deleteIssue,
  getProject,
  getCustomFieldIds
};

