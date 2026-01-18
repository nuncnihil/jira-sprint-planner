/**
 * Mock Jira API response fixtures
 * Based on actual Jira REST API v3 response structures
 */

// Mock boards response
const boardsResponse = {
  values: [
    { id: 1, name: 'Sprint Board', type: 'scrum' },
    { id: 2, name: 'Kanban Board', type: 'kanban' }
  ]
};

// Mock sprints response
const sprintsResponse = {
  values: [
    {
      id: 36,
      name: 'Sprint 1',
      state: 'active',
      startDate: '2026-01-01T10:00:00.000Z',
      endDate: '2026-01-14T10:00:00.000Z'
    },
    {
      id: 37,
      name: 'Sprint 2',
      state: 'future',
      startDate: null,
      endDate: null
    }
  ]
};

// Mock board details response
const boardDetailsResponse = {
  id: 1,
  name: 'Sprint Board',
  type: 'scrum',
  location: {
    projectKey: 'SP'
  }
};

// Mock field IDs
const mockFieldIds = {
  storyPoints: 'customfield_10036',
  team: 'customfield_10040',
  sprint: 'customfield_10020'
};

// Mock sprint issues response (REST API v3 with ADF)
const sprintIssuesResponse = {
  issues: [
    {
      key: 'SP-100',
      fields: {
        summary: 'Task 1',
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Description text' }]
            }
          ]
        },
        issuetype: { name: 'Task' },
        parent: {
          key: 'SP-10',
          fields: { summary: 'Epic 1' }
        },
        status: { name: 'In Progress' },
        labels: ['backend', 'api'],
        updated: '2026-01-01T10:00:00.000Z',
        customfield_10036: 5
      }
    },
    {
      key: 'SP-101',
      fields: {
        summary: 'Task 2',
        description: null,
        issuetype: { name: 'Bug' },
        parent: null,
        status: { name: 'To Do' },
        labels: [],
        updated: '2026-01-01T11:00:00.000Z',
        customfield_10036: 3
      }
    },
    {
      key: 'SP-102',
      fields: {
        summary: 'Done Task',
        description: null,
        issuetype: { name: 'Task' },
        parent: null,
        status: { name: 'Done' },
        labels: [],
        updated: '2026-01-01T12:00:00.000Z',
        customfield_10036: 2
      }
    }
  ]
};

// Mock backlog response
const backlogResponse = {
  issues: [
    {
      key: 'SP-200',
      fields: {
        summary: 'Backlog Task',
        description: 'Plain text description',
        issuetype: { name: 'Task' },
        parent: { key: 'SP-10', fields: { summary: 'Epic 1' } },
        status: { name: 'To Do' },
        labels: ['frontend'],
        updated: '2026-01-01T13:00:00.000Z',
        customfield_10036: 8
      }
    },
    {
      key: 'SP-201',
      fields: {
        summary: 'Done Backlog Task',
        description: null,
        issuetype: { name: 'Task' },
        parent: null,
        status: { name: 'Done' },
        labels: [],
        updated: '2026-01-01T14:00:00.000Z',
        customfield_10036: 1
      }
    }
  ]
};

// Mock initiatives response
const initiativesResponse = {
  issues: [
    {
      key: 'SP-1',
      fields: {
        summary: 'Initiative 1',
        status: { name: 'In Progress' },
        customfield_10040: { id: 'team-123', name: 'Raptors' }
      }
    },
    {
      key: 'SP-2',
      fields: {
        summary: 'Engineering Excellence',
        status: { name: 'In Progress' },
        customfield_10040: { id: 'team-123', name: 'Raptors' }
      }
    },
    {
      key: 'SP-3',
      fields: {
        summary: 'Wrong Team Initiative',
        status: { name: 'In Progress' },
        customfield_10040: { id: 'team-456', name: 'Lions' }
      }
    },
    {
      key: 'SP-4',
      fields: {
        summary: 'Done Initiative',
        status: { name: 'Done' },
        customfield_10040: { id: 'team-123', name: 'Raptors' }
      }
    }
  ]
};

// Mock epics response
const epicsResponse = {
  issues: [
    {
      key: 'SP-10',
      fields: {
        summary: 'Epic 1',
        parent: { key: 'SP-1' }
      }
    },
    {
      key: 'SP-11',
      fields: {
        summary: 'Epic 2',
        parent: { key: 'SP-1' }
      }
    },
    {
      key: 'SP-20',
      fields: {
        summary: 'EE Epic',
        parent: { key: 'SP-2' }
      }
    }
  ]
};

// Mock issue details response (for getIssueUpdated)
const issueDetailsResponse = {
  key: 'SP-100',
  fields: {
    updated: '2026-01-01T10:00:00.000Z'
  }
};

// Mock created issue response
const createdIssueResponse = {
  key: 'SP-300',
  id: '10500'
};

// Empty responses for edge cases
const emptyIssuesResponse = {
  issues: []
};

module.exports = {
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
};
