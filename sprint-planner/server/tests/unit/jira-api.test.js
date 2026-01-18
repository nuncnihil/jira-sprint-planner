/**
 * Unit tests for jira-api.js
 * Tests all Jira API interaction functions with mocked responses
 */

const {
  boardsResponse,
  sprintsResponse,
  boardDetailsResponse,
  mockFieldIds,
  sprintIssuesResponse,
  backlogResponse,
  initiativesResponse,
  epicsResponse,
  issueDetailsResponse,
  createdIssueResponse,
  emptyIssuesResponse
} = require('../fixtures/jiraApiResponses');

// Mock dependencies before importing jira-api
jest.mock('../../../../jira/env-loader', () => ({}));
jest.mock('../../../../jira/client');
jest.mock('../../../../jira/config');
jest.mock('../../../../jira/field-resolver');

const { makeJiraClient } = require('../../../../jira/client');
const { loadJiraConfig } = require('../../../../jira/config');
const { getFieldIds } = require('../../../../jira/field-resolver');

// Setup mocks
const mockRequest = jest.fn();
makeJiraClient.mockReturnValue({ request: mockRequest });
loadJiraConfig.mockReturnValue({ teamId: 'team-123', eeEpic: 'SP-20' });
getFieldIds.mockResolvedValue(mockFieldIds);

// Import after mocks are set up
const jiraApi = require('../../jira-api');

describe('jira-api.js - Jira API Functions', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // ============================================================================
  // getBoards()
  // ============================================================================
  
  describe('getBoards()', () => {
    test('fetches and transforms boards list', async () => {
      mockRequest.mockResolvedValue(boardsResponse);
      
      const result = await jiraApi.getBoards();
      
      expect(mockRequest).toHaveBeenCalledWith('GET', '/rest/agile/1.0/board');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'Sprint Board', type: 'scrum' });
      expect(result[1]).toEqual({ id: 2, name: 'Kanban Board', type: 'kanban' });
    });
    
    test('handles empty boards response', async () => {
      mockRequest.mockResolvedValue({ values: [] });
      
      const result = await jiraApi.getBoards();
      
      expect(result).toEqual([]);
    });
  });
  
  // ============================================================================
  // getSprints()
  // ============================================================================
  
  describe('getSprints()', () => {
    test('fetches sprints for a board', async () => {
      mockRequest.mockResolvedValue(sprintsResponse);
      
      const result = await jiraApi.getSprints(1);
      
      expect(mockRequest).toHaveBeenCalledWith('GET', '/rest/agile/1.0/board/1/sprint');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 36,
        name: 'Sprint 1',
        state: 'active',
        startDate: '2026-01-01T10:00:00.000Z',
        endDate: '2026-01-14T10:00:00.000Z'
      });
    });
    
    test('handles sprints with null dates', async () => {
      mockRequest.mockResolvedValue(sprintsResponse);
      
      const result = await jiraApi.getSprints(1);
      
      expect(result[1].startDate).toBeNull();
      expect(result[1].endDate).toBeNull();
    });
  });
  
  // ============================================================================
  // getBoardDetails()
  // ============================================================================
  
  describe('getBoardDetails()', () => {
    test('fetches board details with project key', async () => {
      mockRequest.mockResolvedValue(boardDetailsResponse);
      
      const result = await jiraApi.getBoardDetails(1);
      
      expect(mockRequest).toHaveBeenCalledWith('GET', '/rest/agile/1.0/board/1');
      expect(result).toEqual({
        id: 1,
        name: 'Sprint Board',
        projectKey: 'SP'
      });
    });
    
    test('handles board without project key', async () => {
      const responseNoProject = { ...boardDetailsResponse, location: {} };
      mockRequest.mockResolvedValue(responseNoProject);
      
      const result = await jiraApi.getBoardDetails(1);
      
      expect(result.projectKey).toBeNull();
    });
  });
  
  // ============================================================================
  // getSprintIssues()
  // ============================================================================
  
  describe('getSprintIssues()', () => {
    test('fetches issues for a sprint with ADF descriptions', async () => {
      mockRequest.mockResolvedValue(sprintIssuesResponse);
      
      const result = await jiraApi.getSprintIssues(36);
      
      // Verify correct API call (REST v3 POST with JQL)
      expect(mockRequest).toHaveBeenCalledWith('POST', '/rest/api/3/search/jql', {
        jql: 'sprint=36 AND status != Done',
        fields: ['summary', 'description', 'issuetype', 'parent', 'status', 'labels', 'updated', 'customfield_10036'],
        maxResults: 1000
      });
      
      // Verify transformation
      // Note: JQL filters "Done" on server side, but fixture includes it for completeness
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        key: 'SP-100',
        type: 'Task',
        summary: 'Task 1',
        description: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Description text' }] }]
        },
        epicKey: 'SP-10',
        epicName: 'Epic 1',
        storyPoints: 5,
        status: 'In Progress',
        labels: ['backend', 'api'],
        updated: '2026-01-01T10:00:00.000Z'
      });
    });
    
    test('handles issues without epic', async () => {
      mockRequest.mockResolvedValue(sprintIssuesResponse);
      
      const result = await jiraApi.getSprintIssues(36);
      
      expect(result[1].epicKey).toBeNull();
      expect(result[1].epicName).toBeNull();
    });
    
    test('handles issues without description', async () => {
      mockRequest.mockResolvedValue(sprintIssuesResponse);
      
      const result = await jiraApi.getSprintIssues(36);
      
      expect(result[1].description).toBeNull();
    });
    
    test('handles empty sprint', async () => {
      mockRequest.mockResolvedValue(emptyIssuesResponse);
      
      const result = await jiraApi.getSprintIssues(99);
      
      expect(result).toEqual([]);
    });
  });
  
  // ============================================================================
  // getBacklog()
  // ============================================================================
  
  describe('getBacklog()', () => {
    test('fetches backlog issues and filters out Done', async () => {
      mockRequest.mockResolvedValue(backlogResponse);
      
      const result = await jiraApi.getBacklog(1);
      
      expect(mockRequest).toHaveBeenCalledWith('GET', '/rest/agile/1.0/board/1/backlog?maxResults=1000');
      expect(result).toHaveLength(1); // SP-201 filtered out (Done)
      expect(result[0]).toEqual({
        key: 'SP-200',
        type: 'Task',
        summary: 'Backlog Task',
        description: 'Plain text description',
        epicKey: 'SP-10',
        epicName: 'Epic 1',
        storyPoints: 8,
        status: 'To Do',
        labels: ['frontend'],
        updated: '2026-01-01T13:00:00.000Z'
      });
    });
  });
  
  // ============================================================================
  // getInitiatives()
  // ============================================================================
  
  describe('getInitiatives()', () => {
    test('fetches initiatives and filters by team', async () => {
      mockRequest.mockResolvedValue(initiativesResponse);
      
      const result = await jiraApi.getInitiatives('SP', 'team-123');
      
      expect(mockRequest).toHaveBeenCalledWith('POST', '/rest/api/3/search/jql', {
        jql: 'project=SP AND type=Initiative ORDER BY created DESC',
        fields: ['summary', 'status', 'customfield_10040'],
        maxResults: 100
      });
      
      // Should filter to only team-123 and exclude Done
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        key: 'SP-1',
        name: 'Initiative 1',
        teamId: 'team-123',
        teamName: 'Raptors'
      });
      expect(result[1].key).toBe('SP-2');
    });
    
    test('handles initiatives without team field', async () => {
      const responseNoTeam = {
        issues: [{
          key: 'SP-1',
          fields: { summary: 'Initiative', status: { name: 'In Progress' } }
        }]
      };
      mockRequest.mockResolvedValue(responseNoTeam);
      
      const result = await jiraApi.getInitiatives('SP', 'team-123');
      
      expect(result).toEqual([]); // Filtered out due to no team match
    });
    
    test('handles empty initiatives response', async () => {
      mockRequest.mockResolvedValue(emptyIssuesResponse);
      
      const result = await jiraApi.getInitiatives('SP', 'team-123');
      
      expect(result).toEqual([]);
    });
    
    test('handles malformed response', async () => {
      mockRequest.mockResolvedValue({ issues: null });
      
      const result = await jiraApi.getInitiatives('SP', 'team-123');
      
      expect(result).toEqual([]);
    });
  });
  
  // ============================================================================
  // getEpicsForInitiatives()
  // ============================================================================
  
  describe('getEpicsForInitiatives()', () => {
    test('fetches epics for multiple initiatives', async () => {
      mockRequest.mockResolvedValue(epicsResponse);
      
      const result = await jiraApi.getEpicsForInitiatives(['SP-1', 'SP-2']);
      
      expect(mockRequest).toHaveBeenCalledWith('POST', '/rest/api/3/search/jql', {
        jql: 'parent IN (SP-1,SP-2) AND type=Epic ORDER BY created DESC',
        fields: ['summary', 'parent'],
        maxResults: 100
      });
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        key: 'SP-10',
        name: 'Epic 1',
        parentKey: 'SP-1',
        issueKeys: []
      });
    });
    
    test('handles empty initiative keys', async () => {
      const result = await jiraApi.getEpicsForInitiatives([]);
      
      expect(mockRequest).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
    
    test('handles malformed response', async () => {
      mockRequest.mockResolvedValue({ issues: null });
      
      const result = await jiraApi.getEpicsForInitiatives(['SP-1']);
      
      expect(result).toEqual([]);
    });
  });
  
  // ============================================================================
  // updateIssue()
  // ============================================================================
  
  describe('updateIssue()', () => {
    test('updates an issue with provided fields', async () => {
      mockRequest.mockResolvedValue({});
      
      const fields = { summary: 'Updated Summary', customfield_10036: 8 };
      await jiraApi.updateIssue('SP-100', fields);
      
      expect(mockRequest).toHaveBeenCalledWith('PUT', '/rest/api/3/issue/SP-100', { fields });
    });
  });
  
  // ============================================================================
  // getIssueUpdated()
  // ============================================================================
  
  describe('getIssueUpdated()', () => {
    test('fetches issue updated timestamp', async () => {
      mockRequest.mockResolvedValue(issueDetailsResponse);
      
      const result = await jiraApi.getIssueUpdated('SP-100');
      
      expect(mockRequest).toHaveBeenCalledWith('GET', '/rest/api/3/issue/SP-100?fields=updated');
      expect(result).toBe('2026-01-01T10:00:00.000Z');
    });
  });
  
  // ============================================================================
  // createIssue()
  // ============================================================================
  
  describe('createIssue()', () => {
    test('creates issue with minimal params', async () => {
      mockRequest.mockResolvedValue(createdIssueResponse);
      
      const result = await jiraApi.createIssue({
        projectKey: 'SP',
        summary: 'New Task'
      });
      
      expect(mockRequest).toHaveBeenCalledWith('POST', '/rest/api/3/issue', {
        fields: {
          project: { key: 'SP' },
          summary: 'New Task',
          issuetype: { name: 'Task' }
        }
      });
      expect(result).toEqual({ key: 'SP-300', id: '10500' });
    });
    
    test('creates issue with all params', async () => {
      mockRequest.mockResolvedValue(createdIssueResponse);
      
      await jiraApi.createIssue({
        projectKey: 'SP',
        summary: 'New Story',
        issueType: 'Story',
        epicKey: 'SP-10',
        storyPoints: 5,
        teamId: 'team-123'
      });
      
      expect(mockRequest).toHaveBeenCalledWith('POST', '/rest/api/3/issue', {
        fields: {
          project: { key: 'SP' },
          summary: 'New Story',
          issuetype: { name: 'Story' },
          parent: { key: 'SP-10' },
          customfield_10036: 5,
          customfield_10040: 'team-123'
        }
      });
    });
  });
  
  // ============================================================================
  // addIssuesToSprint()
  // ============================================================================
  
  describe('addIssuesToSprint()', () => {
    test('adds issues to sprint', async () => {
      mockRequest.mockResolvedValue({});
      
      await jiraApi.addIssuesToSprint(36, ['SP-100', 'SP-101']);
      
      expect(mockRequest).toHaveBeenCalledWith('POST', '/rest/agile/1.0/sprint/36/issue', {
        issues: ['SP-100', 'SP-101']
      });
    });
    
    test('handles empty issue array', async () => {
      await jiraApi.addIssuesToSprint(36, []);
      
      expect(mockRequest).not.toHaveBeenCalled();
    });
    
    test('handles null issue array', async () => {
      await jiraApi.addIssuesToSprint(36, null);
      
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });
  
  // ============================================================================
  // deleteIssue()
  // ============================================================================
  
  describe('deleteIssue()', () => {
    test('deletes an issue', async () => {
      mockRequest.mockResolvedValue({});
      
      await jiraApi.deleteIssue('SP-100');
      
      expect(mockRequest).toHaveBeenCalledWith('DELETE', '/rest/api/3/issue/SP-100');
    });
  });
  
  // ============================================================================
  // getCustomFieldIds()
  // ============================================================================
  
  describe('getCustomFieldIds()', () => {
    test('returns custom field IDs', async () => {
      const result = await jiraApi.getCustomFieldIds();
      
      expect(result).toEqual(mockFieldIds);
      expect(getFieldIds).toHaveBeenCalled();
    });
  });
});
