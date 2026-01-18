const jiraApi = require('./jira-api');
const logger = require('./logger');
const { loadJiraConfig } = require('../../jira/config');

/**
 * Fetch all Jira data needed for the snapshot
 */
async function fetchJiraData(boardId) {
  const board = await jiraApi.getBoardDetails(boardId);
  logger.info(`Board: ${board.name} (project: ${board.projectKey})`);
  
  const allSprints = await jiraApi.getSprints(boardId);
  logger.info(`Found ${allSprints.length} sprints`);
  
  const sprintsWithIssues = await Promise.all(
    allSprints.map(async (sprint) => {
      const issues = await jiraApi.getSprintIssues(sprint.id);
      return { ...sprint, issues };
    })
  );
  logger.info(`Loaded issues for ${sprintsWithIssues.length} sprints`);
  
  const backlog = await jiraApi.getBacklog(boardId);
  logger.info(`Found ${backlog.length} backlog issues`);
  
  const config = loadJiraConfig();
  const initiatives = await jiraApi.getInitiatives(board.projectKey, config.teamId);
  logger.info(`Found ${initiatives.length} initiatives`);
  
  const initiativeKeys = initiatives.map(i => i.key);
  const epics = await jiraApi.getEpicsForInitiatives(initiativeKeys);
  logger.info(`Found ${epics.length} epics`);
  
  return {
    board,
    sprints: sprintsWithIssues,
    backlog,
    initiatives,
    epics,
    config
  };
}

/**
 * Build initiative tree with nested epics
 */
function buildInitiativeTree(initiatives, epics, allIssues) {
  const initiativesWithEpics = initiatives.map(initiative => ({
    key: initiative.key,
    name: initiative.name,
    epics: epics
      .filter(epic => epic.parentKey === initiative.key)
      .map(epic => ({
        key: epic.key,
        name: epic.name,
        parentKey: epic.parentKey,
        issueKeys: []
      }))
  }));
  
  // Populate epic issueKeys
  initiativesWithEpics.forEach(initiative => {
    initiative.epics.forEach(epic => {
      epic.issueKeys = allIssues
        .filter(issue => issue.epicKey === epic.key)
        .map(issue => issue.key);
    });
  });
  
  return initiativesWithEpics;
}

/**
 * Build epic -> initiative mapping for category detection
 */
function buildEpicToInitiativeMap(initiativesWithEpics) {
  const map = {};
  initiativesWithEpics.forEach(initiative => {
    initiative.epics.forEach(epic => {
      map[epic.key] = initiative.key;
    });
  });
  return map;
}

/**
 * Auto-categorize issues based on EE config
 */
function categorizeIssues(issues, eeConfig, epicToInitiative) {
  return issues.map(issue => {
    const { eeEpic, eeInitiative, eeLabel } = eeConfig;
    
    const isEE = 
      (eeEpic && issue.epicKey === eeEpic) ||
      (eeInitiative && issue.epicKey && epicToInitiative[issue.epicKey] === eeInitiative) ||
      (eeLabel && issue.labels && issue.labels.includes(eeLabel));
    
    return {
      ...issue,
      category: isEE ? 'ee' : 'other'
    };
  });
}

/**
 * Build complete snapshot from Jira data
 */
async function buildSnapshot(boardId, sprintId) {
  logger.info(`Loading snapshot for board ${boardId}, sprint ${sprintId}...`);
  
  const jiraData = await fetchJiraData(boardId);
  
  const allIssues = [
    ...jiraData.sprints.flatMap(s => s.issues),
    ...jiraData.backlog
  ];
  
  const initiativesWithEpics = buildInitiativeTree(
    jiraData.initiatives,
    jiraData.epics,
    allIssues
  );
  
  const epicToInitiative = buildEpicToInitiativeMap(initiativesWithEpics);
  
  const eeConfig = {
    eeEpic: jiraData.config.eeEpic,
    eeInitiative: jiraData.config.eeInitiative,
    eeLabel: jiraData.config.eeLabel
  };
  
  const categorizedSprints = jiraData.sprints.map(sprint => ({
    ...sprint,
    issues: categorizeIssues(sprint.issues, eeConfig, epicToInitiative)
  }));
  
  const categorizedBacklog = categorizeIssues(jiraData.backlog, eeConfig, epicToInitiative);
  
  // Re-populate epic issueKeys with categorized issues
  const categorizedAllIssues = [
    ...categorizedSprints.flatMap(s => s.issues),
    ...categorizedBacklog
  ];
  
  initiativesWithEpics.forEach(initiative => {
    initiative.epics.forEach(epic => {
      epic.issueKeys = categorizedAllIssues
        .filter(issue => issue.epicKey === epic.key)
        .map(issue => issue.key);
    });
  });
  
  return {
    board: jiraData.board,
    sprints: categorizedSprints,
    backlog: categorizedBacklog,
    initiatives: initiativesWithEpics
  };
}

module.exports = {
  buildSnapshot,
  fetchJiraData,
  buildInitiativeTree,
  categorizeIssues
};

