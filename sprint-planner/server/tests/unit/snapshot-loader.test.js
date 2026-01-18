/**
 * Unit tests for snapshot-loader.js
 * Tests data orchestration and transformation functions
 */

// Mock jira-api module completely
jest.mock('../../jira-api', () => ({
  getBoardDetails: jest.fn(),
  getSprints: jest.fn(),
  getSprintIssues: jest.fn(),
  getBacklog: jest.fn(),
  getInitiatives: jest.fn(),
  getEpicsForInitiatives: jest.fn()
}));

// Mock logger
jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Mock config
jest.mock('../../../../jira/config', () => ({
  loadJiraConfig: jest.fn()
}));

// Now safe to import
const jiraApi = require('../../jira-api');
const { loadJiraConfig } = require('../../../../jira/config');
const {
  buildSnapshot,
  fetchJiraData,
  buildInitiativeTree,
  categorizeIssues
} = require('../../snapshot-loader');

describe('snapshot-loader.js - Data Orchestration', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    loadJiraConfig.mockReturnValue({
      teamId: 'team-123',
      eeEpic: 'SP-20',
      eeInitiative: 'SP-2',
      eeLabel: 'eng-excellence'
    });
  });
  
  // ============================================================================
  // buildInitiativeTree()
  // ============================================================================
  
  describe('buildInitiativeTree()', () => {
    const initiatives = [
      { key: 'SP-1', name: 'Initiative 1' },
      { key: 'SP-2', name: 'Initiative 2' }
    ];
    
    const epics = [
      { key: 'SP-10', name: 'Epic 1', parentKey: 'SP-1' },
      { key: 'SP-11', name: 'Epic 2', parentKey: 'SP-1' },
      { key: 'SP-20', name: 'Epic 3', parentKey: 'SP-2' }
    ];
    
    const allIssues = [
      { key: 'SP-100', epicKey: 'SP-10' },
      { key: 'SP-101', epicKey: 'SP-10' },
      { key: 'SP-102', epicKey: 'SP-20' }
    ];
    
    test('builds initiative tree with nested epics', () => {
      const result = buildInitiativeTree(initiatives, epics, allIssues);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        key: 'SP-1',
        name: 'Initiative 1',
        epics: [
          { key: 'SP-10', name: 'Epic 1', parentKey: 'SP-1', issueKeys: ['SP-100', 'SP-101'] },
          { key: 'SP-11', name: 'Epic 2', parentKey: 'SP-1', issueKeys: [] }
        ]
      });
      expect(result[1].epics[0].issueKeys).toEqual(['SP-102']);
    });
    
    test('handles initiative with no epics', () => {
      const initiativesNoEpics = [{ key: 'SP-3', name: 'Initiative 3' }];
      
      const result = buildInitiativeTree(initiativesNoEpics, epics, allIssues);
      
      expect(result[0].epics).toEqual([]);
    });
    
    test('handles epic with no issues', () => {
      const result = buildInitiativeTree(initiatives, epics, allIssues);
      
      const epicWithNoIssues = result[0].epics.find(e => e.key === 'SP-11');
      expect(epicWithNoIssues.issueKeys).toEqual([]);
    });
    
    test('handles empty inputs', () => {
      const result = buildInitiativeTree([], [], []);
      
      expect(result).toEqual([]);
    });
  });
  
  // ============================================================================
  // categorizeIssues()
  // ============================================================================
  
  describe('categorizeIssues()', () => {
    const epicToInitiative = {
      'SP-10': 'SP-1',
      'SP-20': 'SP-2', // EE Initiative
      'SP-21': 'SP-2'
    };
    
    test('categorizes issue as "ee" based on eeEpic', () => {
      const issues = [
        { key: 'SP-100', epicKey: 'SP-20', labels: [] }
      ];
      
      const eeConfig = { eeEpic: 'SP-20', eeInitiative: null, eeLabel: null };
      
      const result = categorizeIssues(issues, eeConfig, epicToInitiative);
      
      expect(result[0].category).toBe('ee');
    });
    
    test('categorizes issue as "ee" based on eeInitiative', () => {
      const issues = [
        { key: 'SP-100', epicKey: 'SP-21', labels: [] } // SP-21 belongs to SP-2 (EE Initiative)
      ];
      
      const eeConfig = { eeEpic: null, eeInitiative: 'SP-2', eeLabel: null };
      
      const result = categorizeIssues(issues, eeConfig, epicToInitiative);
      
      expect(result[0].category).toBe('ee');
    });
    
    test('categorizes issue as "ee" based on eeLabel', () => {
      const issues = [
        { key: 'SP-100', epicKey: 'SP-10', labels: ['eng-excellence', 'backend'] }
      ];
      
      const eeConfig = { eeEpic: null, eeInitiative: null, eeLabel: 'eng-excellence' };
      
      const result = categorizeIssues(issues, eeConfig, epicToInitiative);
      
      expect(result[0].category).toBe('ee');
    });
    
    test('categorizes issue as "other" when no EE match', () => {
      const issues = [
        { key: 'SP-100', epicKey: 'SP-10', labels: ['backend'] }
      ];
      
      const eeConfig = { eeEpic: 'SP-20', eeInitiative: 'SP-2', eeLabel: 'eng-excellence' };
      
      const result = categorizeIssues(issues, eeConfig, epicToInitiative);
      
      expect(result[0].category).toBe('other');
    });
    
    test('handles issue without epic', () => {
      const issues = [
        { key: 'SP-100', epicKey: null, labels: [] }
      ];
      
      const eeConfig = { eeEpic: 'SP-20', eeInitiative: 'SP-2', eeLabel: null };
      
      const result = categorizeIssues(issues, eeConfig, epicToInitiative);
      
      expect(result[0].category).toBe('other');
    });
    
    test('handles issue without labels', () => {
      const issues = [
        { key: 'SP-100', epicKey: 'SP-10', labels: null }
      ];
      
      const eeConfig = { eeEpic: null, eeInitiative: null, eeLabel: 'eng-excellence' };
      
      const result = categorizeIssues(issues, eeConfig, epicToInitiative);
      
      expect(result[0].category).toBe('other');
    });
    
    test('handles empty EE config', () => {
      const issues = [
        { key: 'SP-100', epicKey: 'SP-20', labels: ['eng-excellence'] }
      ];
      
      const eeConfig = { eeEpic: null, eeInitiative: null, eeLabel: null };
      
      const result = categorizeIssues(issues, eeConfig, epicToInitiative);
      
      expect(result[0].category).toBe('other');
    });
    
    test('preserves other issue fields', () => {
      const issues = [
        { 
          key: 'SP-100', 
          summary: 'Task',
          storyPoints: 5,
          epicKey: 'SP-10',
          labels: [] 
        }
      ];
      
      const eeConfig = { eeEpic: null, eeInitiative: null, eeLabel: null };
      
      const result = categorizeIssues(issues, eeConfig, epicToInitiative);
      
      expect(result[0]).toEqual({
        key: 'SP-100',
        summary: 'Task',
        storyPoints: 5,
        epicKey: 'SP-10',
        labels: [],
        category: 'other'
      });
    });
    
    test('handles empty issues array', () => {
      const result = categorizeIssues([], { eeEpic: 'SP-20' }, {});
      
      expect(result).toEqual([]);
    });
  });
  
  // ============================================================================
  // fetchJiraData()
  // ============================================================================
  
  describe('fetchJiraData()', () => {
    const mockBoardDetails = { id: 1, name: 'Board', projectKey: 'SP' };
    const mockSprints = [
      { id: 36, name: 'Sprint 1', state: 'active' },
      { id: 37, name: 'Sprint 2', state: 'future' }
    ];
    const mockSprintIssues = [
      { key: 'SP-100', summary: 'Task 1' },
      { key: 'SP-101', summary: 'Task 2' }
    ];
    const mockBacklog = [
      { key: 'SP-200', summary: 'Backlog Task' }
    ];
    const mockInitiatives = [
      { key: 'SP-1', name: 'Initiative 1' }
    ];
    const mockEpics = [
      { key: 'SP-10', name: 'Epic 1' }
    ];
    
    beforeEach(() => {
      jiraApi.getBoardDetails.mockResolvedValue(mockBoardDetails);
      jiraApi.getSprints.mockResolvedValue(mockSprints);
      jiraApi.getSprintIssues.mockResolvedValue(mockSprintIssues);
      jiraApi.getBacklog.mockResolvedValue(mockBacklog);
      jiraApi.getInitiatives.mockResolvedValue(mockInitiatives);
      jiraApi.getEpicsForInitiatives.mockResolvedValue(mockEpics);
    });
    
    test('orchestrates all Jira API calls', async () => {
      const result = await fetchJiraData(1);
      
      expect(jiraApi.getBoardDetails).toHaveBeenCalledWith(1);
      expect(jiraApi.getSprints).toHaveBeenCalledWith(1);
      expect(jiraApi.getSprintIssues).toHaveBeenCalledTimes(2); // Once per sprint
      expect(jiraApi.getBacklog).toHaveBeenCalledWith(1);
      expect(jiraApi.getInitiatives).toHaveBeenCalledWith('SP', 'team-123');
      expect(jiraApi.getEpicsForInitiatives).toHaveBeenCalledWith(['SP-1']);
    });
    
    test('attaches issues to sprints', async () => {
      const result = await fetchJiraData(1);
      
      expect(result.sprints).toHaveLength(2);
      expect(result.sprints[0].issues).toEqual(mockSprintIssues);
      expect(result.sprints[1].issues).toEqual(mockSprintIssues);
    });
    
    test('returns all fetched data', async () => {
      const result = await fetchJiraData(1);
      
      expect(result).toEqual({
        board: mockBoardDetails,
        sprints: [
          { ...mockSprints[0], issues: mockSprintIssues },
          { ...mockSprints[1], issues: mockSprintIssues }
        ],
        backlog: mockBacklog,
        initiatives: mockInitiatives,
        epics: mockEpics,
        config: {
          teamId: 'team-123',
          eeEpic: 'SP-20',
          eeInitiative: 'SP-2',
          eeLabel: 'eng-excellence'
        }
      });
    });
    
    test('handles board with no initiatives', async () => {
      jiraApi.getInitiatives.mockResolvedValue([]);
      
      const result = await fetchJiraData(1);
      
      expect(result.initiatives).toEqual([]);
      expect(jiraApi.getEpicsForInitiatives).toHaveBeenCalledWith([]);
    });
  });
  
  // ============================================================================
  // buildSnapshot() - Integration of all functions
  // ============================================================================
  
  describe('buildSnapshot()', () => {
    const mockBoardDetails = { id: 1, name: 'Board', projectKey: 'SP' };
    const mockSprints = [
      { 
        id: 36, 
        name: 'Sprint 1', 
        state: 'active',
        issues: [
          { key: 'SP-100', summary: 'Task 1', epicKey: 'SP-20', labels: [] }
        ]
      }
    ];
    const mockBacklog = [
      { key: 'SP-200', summary: 'Backlog Task', epicKey: 'SP-10', labels: [] }
    ];
    const mockInitiatives = [
      { key: 'SP-1', name: 'Initiative 1' },
      { key: 'SP-2', name: 'EE Initiative' }
    ];
    const mockEpics = [
      { key: 'SP-10', name: 'Epic 1', parentKey: 'SP-1' },
      { key: 'SP-20', name: 'EE Epic', parentKey: 'SP-2' }
    ];
    
    beforeEach(() => {
      jiraApi.getBoardDetails.mockResolvedValue(mockBoardDetails);
      jiraApi.getSprints.mockResolvedValue([mockSprints[0]]);
      jiraApi.getSprintIssues.mockResolvedValue(mockSprints[0].issues);
      jiraApi.getBacklog.mockResolvedValue(mockBacklog);
      jiraApi.getInitiatives.mockResolvedValue(mockInitiatives);
      jiraApi.getEpicsForInitiatives.mockResolvedValue(mockEpics);
    });
    
    test('builds complete snapshot with categorized issues', async () => {
      const result = await buildSnapshot(1, 36);
      
      expect(result.board).toEqual(mockBoardDetails);
      expect(result.sprints).toHaveLength(1);
      expect(result.sprints[0].issues[0].category).toBe('ee'); // SP-20 is EE epic
      expect(result.backlog[0].category).toBe('other'); // SP-10 is not EE
    });
    
    test('builds initiative tree with issue keys', async () => {
      const result = await buildSnapshot(1, 36);
      
      expect(result.initiatives).toHaveLength(2);
      const eeInitiative = result.initiatives.find(i => i.key === 'SP-2');
      expect(eeInitiative.epics[0].issueKeys).toEqual(['SP-100']);
      
      const otherInitiative = result.initiatives.find(i => i.key === 'SP-1');
      expect(otherInitiative.epics[0].issueKeys).toEqual(['SP-200']);
    });
    
    test('returns properly structured snapshot', async () => {
      const result = await buildSnapshot(1, 36);
      
      expect(result).toHaveProperty('board');
      expect(result).toHaveProperty('sprints');
      expect(result).toHaveProperty('backlog');
      expect(result).toHaveProperty('initiatives');
      expect(result.sprints[0].issues[0]).toHaveProperty('category');
      expect(result.backlog[0]).toHaveProperty('category');
    });
  });
});
