/**
 * End-to-end test for sprint planner workflow
 * 
 * Tests the complete user journey:
 * 1. Load context (boards)
 * 2. Select board and sprint
 * 3. Load snapshot
 * 4. Verify data for Tab 1 (Sprints & Backlog)
 * 5. Verify data for Tab 2 (Initiatives & Epics)
 * 
 * Prerequisites:
 * - Server must be running (npm start)
 * - jira.env must be loaded with valid credentials
 * - Test data must be created (node ../scripts/create-test-data.js)
 * 
 * Usage: node e2e.test.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

function makePostRequest(path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testCompleteWorkflow() {
  console.log('=== E2E Test: Complete Sprint Planning Workflow ===\n');

  try {
    // Step 1: Load context
    console.log('Step 1: Loading context (boards)...');
    const contextResponse = await makeRequest('/api/context');
    
    if (contextResponse.status !== 200) {
      throw new Error(`Context API failed with status ${contextResponse.status}`);
    }
    
    const { boards } = contextResponse.data;
    console.log(`✅ Loaded ${boards.length} boards`);

    // Step 2: Find target board
    console.log('\nStep 2: Finding target board...');
    const targetBoard = boards.find(b => b.name === 'dynaform-raptors-board');
    
    if (!targetBoard) {
      throw new Error('Target board "dynaform-raptors-board" not found');
    }
    console.log(`✅ Found board: ${targetBoard.name} (id: ${targetBoard.id})`);

    // Step 3: Load snapshot for Sprint 1
    console.log('\nStep 3: Loading snapshot for Sprint 1...');
    const snapshotResponse = await makePostRequest('/api/snapshot/load', {
      boardId: targetBoard.id,
      sprintId: 36 // dynaform Sprint 1
    });

    if (snapshotResponse.status !== 200) {
      throw new Error(`Snapshot load failed with status ${snapshotResponse.status}`);
    }

    const { snapshot } = snapshotResponse.data;
    console.log(`✅ Snapshot loaded: ${snapshot.board.name}`);

    // Step 4: Validate Tab 1 (Sprints & Backlog) data requirements
    console.log('\nStep 4: Validating Tab 1 data (Sprints & Backlog)...');
    
    // Check we have sprints
    if (!Array.isArray(snapshot.sprints) || snapshot.sprints.length === 0) {
      throw new Error('No sprints in snapshot');
    }
    console.log(`✅ Sprints: ${snapshot.sprints.length} loaded`);

    // Check sprint 1 has issues
    const sprint1 = snapshot.sprints.find(s => s.id === 36);
    if (!sprint1) {
      throw new Error('Sprint 1 not found in snapshot');
    }
    if (sprint1.issues.length === 0) {
      throw new Error('Sprint 1 has no issues');
    }
    console.log(`✅ Sprint 1: ${sprint1.issues.length} issues`);

    // Check backlog exists
    if (!Array.isArray(snapshot.backlog)) {
      throw new Error('Backlog missing from snapshot');
    }
    console.log(`✅ Backlog: ${snapshot.backlog.length} issues`);

    // Validate issue structure for Tab 1 display
    const sampleIssue = sprint1.issues[0];
    if (!sampleIssue.key || !sampleIssue.summary || !sampleIssue.status) {
      throw new Error('Issue missing required fields for Tab 1 display');
    }
    console.log(`✅ Issue structure valid for Tab 1 display`);

    // Step 5: Validate Tab 2 (Initiatives & Epics) data requirements
    console.log('\nStep 5: Validating Tab 2 data (Initiatives & Epics)...');

    // Check we have initiatives
    if (!Array.isArray(snapshot.initiatives) || snapshot.initiatives.length === 0) {
      throw new Error('No initiatives in snapshot');
    }
    console.log(`✅ Initiatives: ${snapshot.initiatives.length} loaded`);

    // Check initiatives have epics
    let totalEpics = 0;
    snapshot.initiatives.forEach(init => {
      if (!Array.isArray(init.epics)) {
        throw new Error(`Initiative ${init.key} missing epics array`);
      }
      totalEpics += init.epics.length;
    });
    console.log(`✅ Epics: ${totalEpics} loaded across all initiatives`);

    // Check epic structure
    const sampleInitiative = snapshot.initiatives.find(i => i.epics.length > 0);
    if (!sampleInitiative) {
      throw new Error('No initiative with epics found');
    }
    const sampleEpic = sampleInitiative.epics[0];
    if (!sampleEpic.key || !sampleEpic.name || !sampleEpic.parentKey || !Array.isArray(sampleEpic.issueKeys)) {
      throw new Error('Epic missing required fields for Tab 2 display');
    }
    console.log(`✅ Epic structure valid for Tab 2 display`);

    // Validate we can map issues to their locations (for Tab 2)
    const allIssues = [];
    snapshot.sprints.forEach(sprint => {
      sprint.issues.forEach(issue => {
        allIssues.push({ ...issue, location: sprint.name, locationType: 'sprint' });
      });
    });
    snapshot.backlog.forEach(issue => {
      allIssues.push({ ...issue, location: 'Backlog', locationType: 'backlog' });
    });
    console.log(`✅ Issue location mapping: ${allIssues.length} issues mapped`);

    // Check for unassigned issues
    const unassignedIssues = allIssues.filter(issue => !issue.epicKey);
    console.log(`✅ Unassigned issues: ${unassignedIssues.length} detected`);

    // Validate epic-issue relationships
    const epicIssueMap = {};
    sampleInitiative.epics.forEach(epic => {
      epicIssueMap[epic.key] = epic.issueKeys;
    });

    const issuesInEpics = sampleInitiative.epics.reduce((sum, epic) => sum + epic.issueKeys.length, 0);
    console.log(`✅ Epic-issue relationships: ${issuesInEpics} issues linked to epics in "${sampleInitiative.name}"`);

    // Step 6: Verify planning workflow data
    console.log('\nStep 6: Verifying planning workflow data...');

    // Calculate capacity metrics
    const sprint1Points = sprint1.issues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
    console.log(`✅ Sprint 1 capacity calculation: ${sprint1Points} points`);

    // Check we have enough data to plan
    const totalBacklogPoints = snapshot.backlog.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
    console.log(`✅ Backlog for planning: ${snapshot.backlog.length} issues, ${totalBacklogPoints} points`);

    // Verify we can identify which initiatives/epics are in planning
    const epicsWithIssuesInSprint1 = [];
    snapshot.initiatives.forEach(init => {
      init.epics.forEach(epic => {
        const issuesInSprint = epic.issueKeys.filter(key => 
          sprint1.issues.some(issue => issue.key === key)
        );
        if (issuesInSprint.length > 0) {
          epicsWithIssuesInSprint1.push({ initiative: init.name, epic: epic.name, count: issuesInSprint.length });
        }
      });
    });
    console.log(`✅ Active epics in Sprint 1: ${epicsWithIssuesInSprint1.length} epics`);

    console.log('\n🎉 E2E TEST PASSED - All workflow steps validated\n');
    console.log('Workflow Summary:');
    console.log(`  1. Context loaded: ${boards.length} boards`);
    console.log(`  2. Board selected: ${targetBoard.name}`);
    console.log(`  3. Snapshot loaded: ${allIssues.length} total issues`);
    console.log(`  4. Tab 1 ready: ${snapshot.sprints.length} sprints, ${snapshot.backlog.length} backlog items`);
    console.log(`  5. Tab 2 ready: ${snapshot.initiatives.length} initiatives, ${totalEpics} epics`);
    console.log(`  6. Planning metrics: ${sprint1Points} pts in Sprint 1, ${unassignedIssues.length} unassigned`);

  } catch (error) {
    console.error('\n❌ E2E TEST FAILED');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testCompleteWorkflow();

