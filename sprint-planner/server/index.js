const path = require('path');
require('../../jira/env-loader'); // Load jira.env from configurable location
const express = require('express');
const cors = require('cors');
const jiraApi = require('./jira-api');
const snapshot = require('./snapshot');
const snapshotLoader = require('./snapshot-loader');
const logger = require('./logger');
const { SERVER_PORT } = require('./constants');

const app = express();

app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Sprint planner API is running' });
});

// Context endpoint - returns boards for selection
app.get('/api/context', async (req, res) => {
  try {
    const boards = await jiraApi.getBoards();
    res.json({ boards });
  } catch (error) {
    logger.error('Error fetching context:', error);
    res.status(500).json({
      error: 'Failed to fetch context',
      details: error.message
    });
  }
});

// Project endpoint - returns configured project info
app.get('/api/project', async (req, res) => {
  try {
    const config = require('../../jira/config').loadJiraConfig();
    const project = await jiraApi.getProject(config.projectKey || config.projectId);
    res.json({ project });
  } catch (error) {
    logger.error('Error fetching project:', error);
    res.status(500).json({
      error: 'Failed to fetch project',
      details: error.message
    });
  }
});

// Sprints endpoint - returns sprints for a board
app.get('/api/sprints/:boardId', async (req, res) => {
  try {
    const boardId = parseInt(req.params.boardId);
    if (isNaN(boardId)) {
      return res.status(400).json({ error: 'Invalid boardId' });
    }

    const sprints = await jiraApi.getSprints(boardId);
    res.json({ sprints });
  } catch (error) {
    logger.error(`Error fetching sprints for board ${req.params.boardId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch sprints',
      details: error.message
    });
  }
});

// Load snapshot - fetch all data from Jira and create local snapshot
app.post('/api/snapshot/load', async (req, res) => {
  try {
    const { boardId, sprintId } = req.body;
    
    if (!boardId || !sprintId) {
      return res.status(400).json({ error: 'boardId and sprintId are required' });
    }
    
    const snapshotData = await snapshotLoader.buildSnapshot(boardId, sprintId);
    
    snapshot.saveSnapshot(snapshotData);
    logger.info('Snapshot saved');
    
    // Find EE initiative and epic keys from names
    const eeInitiativeName = process.env.JIRA_EE_INITIATIVE?.replace(/"/g, '');
    const eeEpicName = process.env.JIRA_EE_EPIC?.replace(/"/g, '');
    
    let eeConfig = null;
    if (eeInitiativeName && eeEpicName) {
      const eeInitiative = snapshotData.initiatives.find(i => i.name === eeInitiativeName);
      if (eeInitiative) {
        const eeEpic = eeInitiative.epics.find(e => e.name === eeEpicName);
        if (eeEpic) {
          eeConfig = {
            initiativeKey: eeInitiative.key,
            epicKey: eeEpic.key
          };
          logger.info(`EE auto-assignment configured: ${eeInitiative.key} / ${eeEpic.key}`);
        }
      }
    }
    
    res.json({ 
      snapshot: { 
        ...snapshotData, 
        createdAt: new Date().toISOString(),
        eeConfig 
      } 
    });
    
  } catch (error) {
    logger.error('Error loading snapshot:', error);
    res.status(500).json({
      error: 'Failed to load snapshot',
      details: error.message
    });
  }
});

// POST /api/changes/save - Save pending changes to Jira
app.post('/api/changes/save', async (req, res) => {
  try {
    const { pendingChanges } = req.body;
    
    if (!pendingChanges || !Array.isArray(pendingChanges)) {
      return res.status(400).json({ error: 'pendingChanges array is required' });
    }
    
    logger.info(`Saving ${pendingChanges.length} pending changes to Jira`);
    
    // Get custom field IDs once for all changes
    const fieldIds = await jiraApi.getCustomFieldIds();
    
    const results = {
      saved: [],
      conflicts: [],
      errors: []
    };
    
    // Process each pending change
    for (const change of pendingChanges) {
      try {
        const { issueKey, snapshotUpdated, changes } = change;
        
        // Check for conflicts
        const currentUpdated = await jiraApi.getIssueUpdated(issueKey);
        if (new Date(currentUpdated) > new Date(snapshotUpdated)) {
          logger.warn(`Conflict detected for ${issueKey}: Jira updated at ${currentUpdated}, snapshot from ${snapshotUpdated}`);
          results.conflicts.push({
            issueKey,
            snapshotUpdated,
            jiraUpdated: currentUpdated,
            changes
          });
          continue; // Skip this issue
        }
        
        // Handle sprint changes separately (using Agile API)
        if (changes.sprint !== undefined) {
          if (changes.sprint === null) {
            // TODO: Move to backlog (requires different API call)
            logger.warn(`Moving ${issueKey} to backlog not yet implemented`);
          } else {
            await jiraApi.addIssuesToSprint(changes.sprint, [issueKey]);
            logger.info(`✅ Moved ${issueKey} to sprint ${changes.sprint}`);
          }
        }
        
        // Convert other changes to Jira format
        const fields = {};
        
        if (changes.epic !== undefined) {
          if (changes.epic === null) {
            fields.parent = null;
          } else {
            fields.parent = { key: changes.epic };
          }
        }
        
        if (changes.storyPoints !== undefined) {
          fields[fieldIds.storyPoints] = changes.storyPoints;
        }
        
        if (changes.summary !== undefined) {
          fields.summary = changes.summary;
        }
        
        if (changes.description !== undefined) {
          fields.description = changes.description;
        }
        
        if (changes.status !== undefined) {
          fields.status = { name: changes.status };
        }
        
        // Update issue fields in Jira (if any fields to update)
        if (Object.keys(fields).length > 0) {
          await jiraApi.updateIssue(issueKey, fields);
          logger.info(`✅ Updated fields for ${issueKey}`);
        }
        
        results.saved.push(issueKey);
        
      } catch (error) {
        logger.error(`Error updating ${change.issueKey}:`, error.message);
        results.errors.push({
          issueKey: change.issueKey,
          error: error.message
        });
      }
    }
    
    logger.info(`Save complete: ${results.saved.length} saved, ${results.conflicts.length} conflicts, ${results.errors.length} errors`);
    res.json(results);
    
  } catch (error) {
    logger.error('Error in /api/changes/save:', error);
    res.status(500).json({ 
      error: 'Failed to save changes',
      message: error.message 
    });
  }
});

app.listen(SERVER_PORT, () => {
  logger.info(`Server running on http://localhost:${SERVER_PORT}`);
});

