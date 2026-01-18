/**
 * Test fixtures for snapshot mutation testing
 * Represents various snapshot states for testing mutation functions
 */

// Base snapshot with 2 sprints, backlog, and initiatives
export const baseSnapshot = {
  sprints: [
    {
      id: 36,
      name: 'Sprint 1',
      issues: [
        {
          key: 'SP-100',
          summary: 'Task 1',
          storyPoints: 3,
          category: 'goal',
          epicKey: 'SP-10',
          epicName: 'Epic 1',
          updated: '2026-01-01T10:00:00.000Z'
        },
        {
          key: 'SP-101',
          summary: 'Task 2',
          storyPoints: 5,
          category: 'other',
          epicKey: 'SP-11',
          epicName: 'Epic 2',
          updated: '2026-01-01T11:00:00.000Z'
        }
      ]
    },
    {
      id: 37,
      name: 'Sprint 2',
      issues: [
        {
          key: 'SP-102',
          summary: 'Task 3',
          storyPoints: 2,
          category: 'goal',
          epicKey: 'SP-10',
          epicName: 'Epic 1',
          updated: '2026-01-01T12:00:00.000Z'
        }
      ]
    }
  ],
  backlog: [
    {
      key: 'SP-103',
      summary: 'Backlog Task 1',
      storyPoints: 8,
      category: 'other',
      epicKey: null,
      epicName: null,
      updated: '2026-01-01T13:00:00.000Z'
    },
    {
      key: 'SP-104',
      summary: 'Backlog Task 2',
      storyPoints: 1,
      category: 'goal',
      epicKey: 'SP-10',
      epicName: 'Epic 1',
      updated: '2026-01-01T14:00:00.000Z'
    }
  ],
  initiatives: [
    {
      key: 'SP-1',
      name: 'Initiative 1',
      epics: [
        { key: 'SP-10', name: 'Epic 1' },
        { key: 'SP-11', name: 'Epic 2' }
      ]
    },
    {
      key: 'SP-2',
      name: 'Engineering Excellence',
      epics: [
        { key: 'SP-20', name: 'EE Epic' }
      ]
    }
  ],
  eeConfig: {
    initiativeKey: 'SP-2',
    epicKey: 'SP-20'
  }
};

// Snapshot with no EE config
export const snapshotNoEEConfig = {
  ...baseSnapshot,
  eeConfig: null
};

// Empty snapshot
export const emptySnapshot = {
  sprints: [],
  backlog: [],
  initiatives: [],
  eeConfig: null
};

// Snapshot with only backlog
export const backlogOnlySnapshot = {
  sprints: [],
  backlog: [
    {
      key: 'SP-200',
      summary: 'Backlog Item',
      storyPoints: 3,
      category: 'goal',
      epicKey: null,
      epicName: null,
      updated: '2026-01-01T10:00:00.000Z'
    }
  ],
  initiatives: [],
  eeConfig: null
};

// Snapshot with issue in multiple locations (should not happen, but test edge case)
export const duplicateIssueSnapshot = {
  sprints: [
    {
      id: 36,
      name: 'Sprint 1',
      issues: [
        {
          key: 'SP-100',
          summary: 'Duplicate',
          storyPoints: 3,
          category: 'goal',
          updated: '2026-01-01T10:00:00.000Z'
        }
      ]
    }
  ],
  backlog: [
    {
      key: 'SP-100', // Same key as above
      summary: 'Duplicate',
      storyPoints: 3,
      category: 'goal',
      updated: '2026-01-01T10:00:00.000Z'
    }
  ],
  initiatives: [],
  eeConfig: null
};

export const adfSamples = {
  baseSnapshot,
  snapshotNoEEConfig,
  emptySnapshot,
  backlogOnlySnapshot,
  duplicateIssueSnapshot
};
