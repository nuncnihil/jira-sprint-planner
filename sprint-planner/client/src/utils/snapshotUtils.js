/**
 * Utilities for manipulating the local snapshot state
 */

/**
 * Move issues to a new location (sprint or backlog)
 * @param {Object} snapshot - Current snapshot
 * @param {Array<string>} issueKeys - Issue keys to move
 * @param {string|number} targetLocation - 'backlog' or sprint ID
 * @returns {Object} Updated snapshot
 */
export function moveIssues(snapshot, issueKeys, targetLocation) {
  
  const updatedSnapshot = { ...snapshot };
  const issuesToMove = [];
  
  // 1. Find and remove issues from their current locations
  updatedSnapshot.sprints = updatedSnapshot.sprints.map(sprint => {
    const remainingIssues = sprint.issues.filter(issue => {
      if (issueKeys.includes(issue.key)) {
        issuesToMove.push(issue);
        return false; // Remove from this sprint
      }
      return true; // Keep in this sprint
    });
    
    return { ...sprint, issues: remainingIssues };
  });
  
  // Also check backlog
  updatedSnapshot.backlog = updatedSnapshot.backlog.filter(issue => {
    if (issueKeys.includes(issue.key)) {
      issuesToMove.push(issue);
      return false; // Remove from backlog
    }
    return true; // Keep in backlog
  });
  
  
  // 2. Add issues to target location
  if (targetLocation === 'backlog') {
    updatedSnapshot.backlog = [...updatedSnapshot.backlog, ...issuesToMove];
  } else {
    // Target is a sprint ID
    updatedSnapshot.sprints = updatedSnapshot.sprints.map(sprint => {
      if (sprint.id === targetLocation) {
        return { ...sprint, issues: [...sprint.issues, ...issuesToMove] };
      }
      return sprint;
    });
  }
  
  return updatedSnapshot;
}

/**
 * Assign epic to issues
 * @param {Object} snapshot - Current snapshot
 * @param {Array<string>} issueKeys - Issue keys to update
 * @param {string|null} epicKey - Epic key to assign (or null for no epic)
 * @param {string} epicName - Epic name
 * @returns {Object} Updated snapshot
 */
export function assignEpic(snapshot, issueKeys, epicKey, epicName) {
  
  const updatedSnapshot = { ...snapshot };
  
  // Update in sprints
  updatedSnapshot.sprints = updatedSnapshot.sprints.map(sprint => ({
    ...sprint,
    issues: sprint.issues.map(issue => 
      issueKeys.includes(issue.key) 
        ? { ...issue, epicKey, epicName }
        : issue
    )
  }));
  
  // Update in backlog
  updatedSnapshot.backlog = updatedSnapshot.backlog.map(issue =>
    issueKeys.includes(issue.key) 
      ? { ...issue, epicKey, epicName }
      : issue
  );
  
  return updatedSnapshot;
}

/**
 * Add or merge a pending change
 * @param {Array} pendingChanges - Current pending changes array
 * @param {string} issueKey - Issue key
 * @param {Object} changes - Changes object (e.g., { sprint: 36, epic: 'SP-100' })
 * @param {string} snapshotUpdated - When the issue was last updated in the snapshot
 * @returns {Array} Updated pending changes array
 */
export function addPendingChange(pendingChanges, issueKey, changes, snapshotUpdated) {
  const existingIndex = pendingChanges.findIndex(pc => pc.issueKey === issueKey);
  
  if (existingIndex >= 0) {
    // Merge with existing change
    const updated = [...pendingChanges];
    updated[existingIndex] = {
      ...updated[existingIndex],
      timestamp: new Date().toISOString(),
      changes: {
        ...updated[existingIndex].changes,
        ...changes
      }
    };
    return updated;
  } else {
    // Add new change
    return [
      ...pendingChanges,
      {
        issueKey,
        timestamp: new Date().toISOString(),
        snapshotUpdated,
        changes
      }
    ];
  }
}

/**
 * Get pending change for a specific issue
 * @param {Array} pendingChanges - Pending changes array
 * @param {string} issueKey - Issue key
 * @returns {Object|null} Pending change or null
 */
export function getPendingChange(pendingChanges, issueKey) {
  return pendingChanges.find(pc => pc.issueKey === issueKey) || null;
}

/**
 * Clear all pending changes
 * @returns {Array} Empty array
 */
export function clearPendingChanges() {
  return [];
}

/**
 * Remove pending change for a specific issue
 * @param {Array} pendingChanges - Pending changes array
 * @param {string} issueKey - Issue key
 * @returns {Array} Updated pending changes array
 */
export function removePendingChange(pendingChanges, issueKey) {
  return pendingChanges.filter(pc => pc.issueKey !== issueKey);
}

/**
 * Update category for an issue (with EE auto-assignment)
 * @param {Object} snapshot - Current snapshot
 * @param {string} issueKey - Issue key to update
 * @param {string} newCategory - New category ('goal', 'ee', 'other')
 * @returns {Object} Updated snapshot
 */
export function updateCategory(snapshot, issueKey, newCategory) {
  const updatedSnapshot = { ...snapshot };
  const eeConfig = snapshot.eeConfig;
  let issueFound = false;
  
  // Update in sprints
  updatedSnapshot.sprints = updatedSnapshot.sprints.map(sprint => ({
    ...sprint,
    issues: sprint.issues.map(issue => {
      if (issue.key === issueKey) {
        issueFound = true;
        const updated = { ...issue, category: newCategory };
        
        // Auto-assign EE epic if category is 'ee' and config exists
        if (newCategory === 'ee' && eeConfig?.epicKey) {
          const epicName = snapshot.initiatives
            .flatMap(init => init.epics)
            .find(epic => epic.key === eeConfig.epicKey)?.name || 'EE Epic';
          updated.epicKey = eeConfig.epicKey;
          updated.epicName = epicName;
        }
        
        return updated;
      }
      return issue;
    })
  }));
  
  // Update in backlog
  updatedSnapshot.backlog = updatedSnapshot.backlog.map(issue => {
    if (issue.key === issueKey) {
      issueFound = true;
      const updated = { ...issue, category: newCategory };
      
      // Auto-assign EE epic if category is 'ee' and config exists
      if (newCategory === 'ee' && eeConfig?.epicKey) {
        const epicName = snapshot.initiatives
          .flatMap(init => init.epics)
          .find(epic => epic.key === eeConfig.epicKey)?.name || 'EE Epic';
        updated.epicKey = eeConfig.epicKey;
        updated.epicName = epicName;
      }
      
      return updated;
    }
    return issue;
  });
  
  // Return original snapshot if issue not found (no mutation)
  return issueFound ? updatedSnapshot : snapshot;
}

/**
 * Update story points for an issue
 * @param {Object} snapshot - Current snapshot
 * @param {string} issueKey - Issue key to update
 * @param {number|null} newPoints - New story points value
 * @returns {Object} Updated snapshot
 */
export function updateStoryPoints(snapshot, issueKey, newPoints) {
  return updateIssueField(snapshot, issueKey, { storyPoints: newPoints });
}

/**
 * Update any field(s) for an issue (generic updater)
 * @param {Object} snapshot - Current snapshot
 * @param {string} issueKey - Issue key to update
 * @param {Object} updates - Object with fields to update (e.g., { summary: 'New', storyPoints: 8 })
 * @returns {Object} Updated snapshot
 */
export function updateIssueField(snapshot, issueKey, updates) {
  const updatedSnapshot = { ...snapshot };
  let issueFound = false;
  
  // Update in sprints
  updatedSnapshot.sprints = updatedSnapshot.sprints.map(sprint => ({
    ...sprint,
    issues: sprint.issues.map(issue => {
      if (issue.key === issueKey) {
        issueFound = true;
        return { ...issue, ...updates };
      }
      return issue;
    })
  }));
  
  // Update in backlog
  updatedSnapshot.backlog = updatedSnapshot.backlog.map(issue => {
    if (issue.key === issueKey) {
      issueFound = true;
      return { ...issue, ...updates };
    }
    return issue;
  });
  
  // Return original snapshot if issue not found (no mutation)
  return issueFound ? updatedSnapshot : snapshot;
}

/**
 * Convert pending changes to Jira API format
 * NOTE: This function is currently unused as conversion is handled server-side
 * in POST /api/changes/save endpoint, which dynamically resolves custom field IDs.
 * 
 * @param {Object} pendingChange - Single pending change
 * @param {Object} fieldIds - Optional custom field IDs { storyPoints, sprint, team }
 * @returns {Object} Jira API update payload
 */
export function convertToJiraFormat(pendingChange, fieldIds = {}) {
  const fields = {};
  
  if (pendingChange.changes.sprint !== undefined) {
    const sprintFieldId = fieldIds.sprint || 'customfield_10020';
    if (pendingChange.changes.sprint === null) {
      // Move to backlog - remove sprint field
      fields[sprintFieldId] = null;
    } else {
      // Move to sprint
      fields[sprintFieldId] = [pendingChange.changes.sprint];
    }
  }
  
  if (pendingChange.changes.epic !== undefined) {
    if (pendingChange.changes.epic === null) {
      // Remove epic
      fields.parent = null;
    } else {
      // Assign epic
      fields.parent = { key: pendingChange.changes.epic };
    }
  }
  
  if (pendingChange.changes.storyPoints !== undefined) {
    const storyPointsFieldId = fieldIds.storyPoints || 'customfield_10036';
    fields[storyPointsFieldId] = pendingChange.changes.storyPoints;
  }
  
  if (pendingChange.changes.summary !== undefined) {
    fields.summary = pendingChange.changes.summary;
  }
  
  if (pendingChange.changes.description !== undefined) {
    fields.description = pendingChange.changes.description;
  }
  
  if (pendingChange.changes.status !== undefined) {
    fields.status = { name: pendingChange.changes.status };
  }
  
  return { fields };
}

