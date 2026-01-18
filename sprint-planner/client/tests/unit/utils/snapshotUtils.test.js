/**
 * Tests for snapshot mutation utilities
 * 
 * Testing both existing functions in snapshotUtils.js
 * AND new functions we're about to extract from PlanningView.jsx
 */

import {
  moveIssues,
  assignEpic,
  addPendingChange,
  getPendingChange,
  removePendingChange,
  clearPendingChanges,
  updateCategory,
  updateStoryPoints,
  updateIssueField
} from '../../../src/utils/snapshotUtils.js';

import {
  baseSnapshot,
  snapshotNoEEConfig,
  emptySnapshot,
  backlogOnlySnapshot
} from '../../fixtures/snapshotSamples.js';

describe('snapshotUtils - Snapshot Mutations', () => {
  
  // ============================================================================
  // EXISTING FUNCTIONS - moveIssues()
  // ============================================================================
  
  describe('moveIssues()', () => {
    test('moves single issue from sprint to backlog', () => {
      const result = moveIssues(baseSnapshot, ['SP-100'], 'backlog');
      
      // Issue should be removed from Sprint 1
      expect(result.sprints[0].issues).toHaveLength(1);
      expect(result.sprints[0].issues[0].key).toBe('SP-101');
      
      // Issue should be added to backlog
      expect(result.backlog).toHaveLength(3);
      expect(result.backlog.find(i => i.key === 'SP-100')).toBeDefined();
    });
    
    test('moves multiple issues from sprint to backlog', () => {
      const result = moveIssues(baseSnapshot, ['SP-100', 'SP-101'], 'backlog');
      
      // Sprint 1 should be empty
      expect(result.sprints[0].issues).toHaveLength(0);
      
      // Both issues should be in backlog
      expect(result.backlog).toHaveLength(4);
      expect(result.backlog.find(i => i.key === 'SP-100')).toBeDefined();
      expect(result.backlog.find(i => i.key === 'SP-101')).toBeDefined();
    });
    
    test('moves issue from backlog to sprint', () => {
      const result = moveIssues(baseSnapshot, ['SP-103'], 37);
      
      // Issue should be removed from backlog
      expect(result.backlog).toHaveLength(1);
      expect(result.backlog.find(i => i.key === 'SP-103')).toBeUndefined();
      
      // Issue should be added to Sprint 2
      expect(result.sprints[1].issues).toHaveLength(2);
      expect(result.sprints[1].issues.find(i => i.key === 'SP-103')).toBeDefined();
    });
    
    test('moves issue from one sprint to another', () => {
      const result = moveIssues(baseSnapshot, ['SP-100'], 37);
      
      // Issue should be removed from Sprint 1
      expect(result.sprints[0].issues).toHaveLength(1);
      
      // Issue should be added to Sprint 2
      expect(result.sprints[1].issues).toHaveLength(2);
      expect(result.sprints[1].issues.find(i => i.key === 'SP-100')).toBeDefined();
    });
    
    test('handles non-existent issue keys gracefully', () => {
      const result = moveIssues(baseSnapshot, ['SP-999'], 'backlog');
      
      // Snapshot should be unchanged
      expect(result.sprints[0].issues).toHaveLength(2);
      expect(result.backlog).toHaveLength(2);
    });
    
    test('handles empty issue array', () => {
      const result = moveIssues(baseSnapshot, [], 'backlog');
      
      // Snapshot should be unchanged
      expect(result.sprints[0].issues).toHaveLength(2);
      expect(result.backlog).toHaveLength(2);
    });
    
    test('does not mutate original snapshot', () => {
      const original = JSON.parse(JSON.stringify(baseSnapshot));
      moveIssues(baseSnapshot, ['SP-100'], 'backlog');
      
      expect(baseSnapshot).toEqual(original);
    });
  });
  
  // ============================================================================
  // EXISTING FUNCTIONS - assignEpic()
  // ============================================================================
  
  describe('assignEpic()', () => {
    test('assigns epic to single issue in sprint', () => {
      const result = assignEpic(baseSnapshot, ['SP-100'], 'SP-20', 'EE Epic');
      
      const issue = result.sprints[0].issues.find(i => i.key === 'SP-100');
      expect(issue.epicKey).toBe('SP-20');
      expect(issue.epicName).toBe('EE Epic');
    });
    
    test('assigns epic to multiple issues', () => {
      const result = assignEpic(baseSnapshot, ['SP-100', 'SP-101'], 'SP-20', 'EE Epic');
      
      const issue1 = result.sprints[0].issues.find(i => i.key === 'SP-100');
      const issue2 = result.sprints[0].issues.find(i => i.key === 'SP-101');
      expect(issue1.epicKey).toBe('SP-20');
      expect(issue2.epicKey).toBe('SP-20');
    });
    
    test('assigns epic to issue in backlog', () => {
      const result = assignEpic(baseSnapshot, ['SP-103'], 'SP-10', 'Epic 1');
      
      const issue = result.backlog.find(i => i.key === 'SP-103');
      expect(issue.epicKey).toBe('SP-10');
      expect(issue.epicName).toBe('Epic 1');
    });
    
    test('removes epic by passing null', () => {
      const result = assignEpic(baseSnapshot, ['SP-100'], null, null);
      
      const issue = result.sprints[0].issues.find(i => i.key === 'SP-100');
      expect(issue.epicKey).toBeNull();
      expect(issue.epicName).toBeNull();
    });
    
    test('does not mutate original snapshot', () => {
      const original = JSON.parse(JSON.stringify(baseSnapshot));
      assignEpic(baseSnapshot, ['SP-100'], 'SP-20', 'EE Epic');
      
      expect(baseSnapshot).toEqual(original);
    });
  });
  
  // ============================================================================
  // EXISTING FUNCTIONS - Pending Changes
  // ============================================================================
  
  describe('addPendingChange()', () => {
    test('adds new pending change', () => {
      const result = addPendingChange([], 'SP-100', { sprint: 37 }, '2026-01-01T10:00:00.000Z');
      
      expect(result).toHaveLength(1);
      expect(result[0].issueKey).toBe('SP-100');
      expect(result[0].changes.sprint).toBe(37);
      expect(result[0].snapshotUpdated).toBe('2026-01-01T10:00:00.000Z');
      expect(result[0].timestamp).toBeDefined();
    });
    
    test('merges with existing pending change for same issue', () => {
      const existing = [
        { issueKey: 'SP-100', changes: { sprint: 37 }, timestamp: '2026-01-01T10:00:00.000Z' }
      ];
      
      const result = addPendingChange(existing, 'SP-100', { epic: 'SP-20' });
      
      expect(result).toHaveLength(1);
      expect(result[0].changes.sprint).toBe(37);
      expect(result[0].changes.epic).toBe('SP-20');
    });
    
    test('adds separate pending change for different issue', () => {
      const existing = [
        { issueKey: 'SP-100', changes: { sprint: 37 }, timestamp: '2026-01-01T10:00:00.000Z' }
      ];
      
      const result = addPendingChange(existing, 'SP-101', { epic: 'SP-20' });
      
      expect(result).toHaveLength(2);
      expect(result.find(pc => pc.issueKey === 'SP-101')).toBeDefined();
    });
  });
  
  describe('getPendingChange()', () => {
    test('returns pending change for issue', () => {
      const pendingChanges = [
        { issueKey: 'SP-100', changes: { sprint: 37 } },
        { issueKey: 'SP-101', changes: { epic: 'SP-20' } }
      ];
      
      const result = getPendingChange(pendingChanges, 'SP-100');
      expect(result.issueKey).toBe('SP-100');
    });
    
    test('returns null when no pending change exists', () => {
      const result = getPendingChange([], 'SP-999');
      expect(result).toBeNull();
    });
  });
  
  describe('removePendingChange()', () => {
    test('removes pending change for specific issue', () => {
      const pendingChanges = [
        { issueKey: 'SP-100', changes: { sprint: 37 } },
        { issueKey: 'SP-101', changes: { epic: 'SP-20' } }
      ];
      
      const result = removePendingChange(pendingChanges, 'SP-100');
      expect(result).toHaveLength(1);
      expect(result[0].issueKey).toBe('SP-101');
    });
  });
  
  describe('clearPendingChanges()', () => {
    test('returns empty array', () => {
      const result = clearPendingChanges();
      expect(result).toEqual([]);
    });
  });
  
  // ============================================================================
  // NEW FUNCTIONS - updateCategory() (to be extracted)
  // ============================================================================
  
  describe('updateCategory()', () => {
    test('updates category for issue in sprint', () => {
      const result = updateCategory(baseSnapshot, 'SP-100', 'ee');
      
      const issue = result.sprints[0].issues.find(i => i.key === 'SP-100');
      expect(issue.category).toBe('ee');
    });
    
    test('updates category for issue in backlog', () => {
      const result = updateCategory(baseSnapshot, 'SP-103', 'goal');
      
      const issue = result.backlog.find(i => i.key === 'SP-103');
      expect(issue.category).toBe('goal');
    });
    
    test('auto-assigns EE epic when category is "ee" and config exists', () => {
      const result = updateCategory(baseSnapshot, 'SP-100', 'ee');
      
      const issue = result.sprints[0].issues.find(i => i.key === 'SP-100');
      expect(issue.category).toBe('ee');
      expect(issue.epicKey).toBe('SP-20');
      expect(issue.epicName).toBe('EE Epic');
    });
    
    test('does not auto-assign epic when category is not "ee"', () => {
      const result = updateCategory(baseSnapshot, 'SP-100', 'other');
      
      const issue = result.sprints[0].issues.find(i => i.key === 'SP-100');
      expect(issue.category).toBe('other');
      expect(issue.epicKey).toBe('SP-10'); // Original epic preserved
    });
    
    test('does not auto-assign epic when no EE config exists', () => {
      const result = updateCategory(snapshotNoEEConfig, 'SP-100', 'ee');
      
      const issue = result.sprints[0].issues.find(i => i.key === 'SP-100');
      expect(issue.category).toBe('ee');
      expect(issue.epicKey).toBe('SP-10'); // Original epic preserved
    });
    
    test('handles non-existent issue gracefully', () => {
      const result = updateCategory(baseSnapshot, 'SP-999', 'ee');
      
      // Snapshot should be unchanged
      expect(result).toEqual(baseSnapshot);
    });
    
    test('does not mutate original snapshot', () => {
      const original = JSON.parse(JSON.stringify(baseSnapshot));
      updateCategory(baseSnapshot, 'SP-100', 'ee');
      
      expect(baseSnapshot).toEqual(original);
    });
  });
  
  // ============================================================================
  // NEW FUNCTIONS - updateStoryPoints() (to be extracted)
  // ============================================================================
  
  describe('updateStoryPoints()', () => {
    test('updates story points for issue in sprint', () => {
      const result = updateStoryPoints(baseSnapshot, 'SP-100', 8);
      
      const issue = result.sprints[0].issues.find(i => i.key === 'SP-100');
      expect(issue.storyPoints).toBe(8);
    });
    
    test('updates story points for issue in backlog', () => {
      const result = updateStoryPoints(baseSnapshot, 'SP-103', 13);
      
      const issue = result.backlog.find(i => i.key === 'SP-103');
      expect(issue.storyPoints).toBe(13);
    });
    
    test('allows setting story points to 0', () => {
      const result = updateStoryPoints(baseSnapshot, 'SP-100', 0);
      
      const issue = result.sprints[0].issues.find(i => i.key === 'SP-100');
      expect(issue.storyPoints).toBe(0);
    });
    
    test('allows setting story points to null', () => {
      const result = updateStoryPoints(baseSnapshot, 'SP-100', null);
      
      const issue = result.sprints[0].issues.find(i => i.key === 'SP-100');
      expect(issue.storyPoints).toBeNull();
    });
    
    test('handles non-existent issue gracefully', () => {
      const result = updateStoryPoints(baseSnapshot, 'SP-999', 5);
      
      // Snapshot should be unchanged
      expect(result).toEqual(baseSnapshot);
    });
    
    test('does not mutate original snapshot', () => {
      const original = JSON.parse(JSON.stringify(baseSnapshot));
      updateStoryPoints(baseSnapshot, 'SP-100', 8);
      
      expect(baseSnapshot).toEqual(original);
    });
  });
  
  // ============================================================================
  // NEW FUNCTIONS - updateIssueField() (generic field updater)
  // ============================================================================
  
  describe('updateIssueField()', () => {
    test('updates single field for issue in sprint', () => {
      const result = updateIssueField(baseSnapshot, 'SP-100', { summary: 'New Summary' });
      
      const issue = result.sprints[0].issues.find(i => i.key === 'SP-100');
      expect(issue.summary).toBe('New Summary');
    });
    
    test('updates multiple fields at once', () => {
      const result = updateIssueField(baseSnapshot, 'SP-100', {
        summary: 'New Summary',
        storyPoints: 8,
        category: 'ee'
      });
      
      const issue = result.sprints[0].issues.find(i => i.key === 'SP-100');
      expect(issue.summary).toBe('New Summary');
      expect(issue.storyPoints).toBe(8);
      expect(issue.category).toBe('ee');
    });
    
    test('updates field for issue in backlog', () => {
      const result = updateIssueField(baseSnapshot, 'SP-103', { summary: 'Updated Backlog' });
      
      const issue = result.backlog.find(i => i.key === 'SP-103');
      expect(issue.summary).toBe('Updated Backlog');
    });
    
    test('preserves other fields when updating', () => {
      const result = updateIssueField(baseSnapshot, 'SP-100', { summary: 'New Summary' });
      
      const issue = result.sprints[0].issues.find(i => i.key === 'SP-100');
      expect(issue.key).toBe('SP-100');
      expect(issue.storyPoints).toBe(3); // Original value preserved
      expect(issue.category).toBe('goal'); // Original value preserved
    });
    
    test('handles non-existent issue gracefully', () => {
      const result = updateIssueField(baseSnapshot, 'SP-999', { summary: 'Test' });
      
      // Snapshot should be unchanged
      expect(result).toEqual(baseSnapshot);
    });
    
    test('does not mutate original snapshot', () => {
      const original = JSON.parse(JSON.stringify(baseSnapshot));
      updateIssueField(baseSnapshot, 'SP-100', { summary: 'New Summary' });
      
      expect(baseSnapshot).toEqual(original);
    });
  });
});
