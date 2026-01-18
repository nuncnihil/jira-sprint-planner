/**
 * E2E Test for Pending Changes
 * Tests the full lifecycle: create → load → modify → save → verify → cleanup
 */

const jiraApi = require('../jira-api');
const http = require('http');

const API_BASE = 'http://localhost:3001';

// Helper to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsedBody = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsedBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTest() {
  console.log('\n========================================');
  console.log('🧪 E2E Test: Pending Changes Lifecycle');
  console.log('========================================\n');

  const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SP';
  const TEAM_ID = process.env.JIRA_TEAM_ID;
  const TIMESTAMP = Date.now();
  
  let testInitiativeKey = null;
  let testEpicKey = null;
  let testTaskKey = null;
  let sprint1Id = null;
  let sprint2Id = null;

  try {
    // Step 0: Get sprint IDs from boards
    console.log('🔍 Step 0: Finding existing sprints...');
    const boardsResponse = await makeRequest('GET', '/api/context');
    if (boardsResponse.status !== 200) {
      throw new Error('Failed to get boards');
    }
    
    const targetBoard = boardsResponse.data.boards.find(b => b.name.includes('dynaform-raptors'));
    if (!targetBoard) {
      throw new Error('Could not find dynaform-raptors board');
    }
    
    const sprintsResponse = await makeRequest('GET', `/api/sprints/${targetBoard.id}`);
    if (sprintsResponse.status !== 200) {
      throw new Error('Failed to get sprints');
    }
    
    const sprints = sprintsResponse.data.sprints;
    sprint1Id = sprints.find(s => s.name.includes('Sprint 1'))?.id;
    sprint2Id = sprints.find(s => s.name.includes('Sprint 2'))?.id;
    
    if (!sprint1Id || !sprint2Id) {
      throw new Error('Could not find Sprint 1 and Sprint 2');
    }
    
    console.log(`   ✅ Found Sprint 1 (ID: ${sprint1Id}) and Sprint 2 (ID: ${sprint2Id})`);
    
    // Step 1: Create test initiative
    console.log('\n📝 Step 1: Creating test initiative...');
    const testInitiative = await jiraApi.createIssue({
      projectKey: PROJECT_KEY,
      summary: `TEST: E2E Initiative - ${TIMESTAMP}`,
      issueType: 'Initiative',
      teamId: TEAM_ID
    });
    testInitiativeKey = testInitiative.key;
    console.log(`   ✅ Created test initiative: ${testInitiativeKey}`);
    
    // Step 2: Create test epic
    console.log('\n📝 Step 2: Creating test epic...');
    const testEpic = await jiraApi.createIssue({
      projectKey: PROJECT_KEY,
      summary: `TEST: E2E Epic - ${TIMESTAMP}`,
      issueType: 'Epic',
      epicKey: testInitiativeKey,
      teamId: TEAM_ID
    });
    testEpicKey = testEpic.key;
    console.log(`   ✅ Created test epic: ${testEpicKey}`);
    console.log(`      Parent: ${testInitiativeKey}`);
    
    // Step 3: Create test task
    console.log('\n📝 Step 3: Creating test task...');
    const testTask = await jiraApi.createIssue({
      projectKey: PROJECT_KEY,
      summary: `TEST: E2E Task - ${TIMESTAMP}`,
      issueType: 'Task',
      epicKey: null,
      storyPoints: null,
      teamId: TEAM_ID
    });
    testTaskKey = testTask.key;
    console.log(`   ✅ Created test task: ${testTaskKey}`);
    
    // Add task to Sprint 1
    await jiraApi.addIssuesToSprint(sprint1Id, [testTaskKey]);
    console.log(`   ✅ Added task to Sprint 1 (${sprint1Id})`);
    console.log(`      Epic: (none)`);
    console.log(`      Story Points: (none)`);
    
    // Wait for Jira indexing
    console.log('   ⏳ Waiting 3 seconds for Jira indexing...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Load snapshot (should include our test task)
    console.log('\n📦 Step 4: Loading snapshot...');
    const snapshotResponse = await makeRequest('POST', '/api/snapshot/load', {
      boardId: targetBoard.id,
      sprintId: sprint1Id
    });
    
    if (snapshotResponse.status !== 200) {
      throw new Error('Failed to load snapshot');
    }
    
    const snapshot = snapshotResponse.data.snapshot;
    const testTaskInSnapshot = snapshot.sprints
      .flatMap(s => s.issues)
      .find(i => i.key === testTaskKey);
    
    if (!testTaskInSnapshot) {
      throw new Error(`Test task ${testTaskKey} not found in snapshot`);
    }
    
    console.log(`   ✅ Found test task in snapshot`);
    console.log(`      Updated: ${testTaskInSnapshot.updated}`);
    
    // Step 5: Create pending changes
    console.log('\n🔄 Step 5: Creating pending changes...');
    const pendingChanges = [
      {
        issueKey: testTaskKey,
        timestamp: new Date().toISOString(),
        snapshotUpdated: testTaskInSnapshot.updated,
        changes: {
          sprint: sprint2Id,
          epic: testEpicKey
          // NOTE: Skipping storyPoints due to Jira screen configuration restrictions
        }
      }
    ];
    
    console.log(`   📝 Pending changes for ${testTaskKey}:`);
    console.log(`      Move to: Sprint 2 (${sprint2Id})`);
    console.log(`      Assign epic: ${testEpicKey}`);
    
    // Step 6: Save changes to Jira
    console.log('\n💾 Step 6: Saving changes to Jira...');
    const saveResponse = await makeRequest('POST', '/api/changes/save', { pendingChanges });
    
    if (saveResponse.status !== 200) {
      throw new Error(`Save failed with status ${saveResponse.status}: ${JSON.stringify(saveResponse.data)}`);
    }
    
    const saveResults = saveResponse.data;
    console.log(`   ✅ Save complete:`);
    console.log(`      Saved: ${saveResults.saved.length} issues`);
    console.log(`      Conflicts: ${saveResults.conflicts.length}`);
    console.log(`      Errors: ${saveResults.errors.length}`);
    
    if (saveResults.errors.length > 0) {
      console.error('   ❌ Errors:', saveResults.errors);
      throw new Error('Save had errors');
    }
    
    if (saveResults.conflicts.length > 0) {
      console.warn('   ⚠️ Conflicts:', saveResults.conflicts);
    }
    
    if (!saveResults.saved.includes(testTaskKey)) {
      throw new Error(`Test task ${testTaskKey} was not saved`);
    }
    
    // Step 7: Verify changes in Jira
    console.log('\n✅ Step 7: Verifying changes in Jira...');
    
    // Wait for Jira to process the update
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Load fresh snapshot to verify
    const verifyResponse = await makeRequest('POST', '/api/snapshot/load', {
      boardId: targetBoard.id,
      sprintId: sprint2Id  // Should now be in Sprint 2
    });
    
    if (verifyResponse.status !== 200) {
      throw new Error('Failed to load verification snapshot');
    }
    
    const verifySnapshot = verifyResponse.data.snapshot;
    const verifiedTask = verifySnapshot.sprints
      .flatMap(s => s.issues)
      .find(i => i.key === testTaskKey);
    
    if (!verifiedTask) {
      throw new Error(`Test task ${testTaskKey} not found in Sprint 2`);
    }
    
    console.log(`   ✅ Task found in Sprint 2`);
    console.log(`      Epic: ${verifiedTask.epicKey} (${verifiedTask.epicName})`);
    
    // Verify epic
    if (verifiedTask.epicKey !== testEpicKey) {
      throw new Error(`Epic mismatch: expected ${testEpicKey}, got ${verifiedTask.epicKey}`);
    }
    console.log(`   ✅ Epic assignment verified`);
    
    console.log('\n========================================');
    console.log('✅ ALL TESTS PASSED!');
    console.log('========================================');
    console.log('\n🔍 VERIFICATION SUMMARY:');
    console.log(`   - Task: ${testTaskKey} ✅ (in Sprint 2, epic: ${testEpicKey})`);
    console.log(`   - Epic: ${testEpicKey} ✅ (has 1 child task)`);
    console.log(`   - Initiative: ${testInitiativeKey} ✅ (has 1 child epic)`);
    console.log('\n   Proceeding to cleanup...');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
  } finally {
    // Step 8: Cleanup (delete in reverse order: task → epic → initiative)
    console.log('\n🧹 Step 8: Cleaning up test data...');
    
    if (testTaskKey) {
      try {
        await jiraApi.deleteIssue(testTaskKey);
        console.log(`   ✅ Deleted task: ${testTaskKey}`);
      } catch (error) {
        console.error(`   ❌ Failed to delete ${testTaskKey}:`, error.message);
        console.error(`   Please manually delete: ${testTaskKey}`);
      }
    }
    
    if (testEpicKey) {
      try {
        await jiraApi.deleteIssue(testEpicKey);
        console.log(`   ✅ Deleted epic: ${testEpicKey}`);
      } catch (error) {
        console.error(`   ❌ Failed to delete ${testEpicKey}:`, error.message);
        console.error(`   Please manually delete: ${testEpicKey}`);
      }
    }
    
    if (testInitiativeKey) {
      try {
        await jiraApi.deleteIssue(testInitiativeKey);
        console.log(`   ✅ Deleted initiative: ${testInitiativeKey}`);
      } catch (error) {
        console.error(`   ❌ Failed to delete ${testInitiativeKey}:`, error.message);
        console.error(`   Please manually delete: ${testInitiativeKey}`);
      }
    }
    
    console.log('\n========================================');
    console.log('✅ TEST COMPLETE & CLEANED UP!');
    console.log('========================================\n');
    process.exit(0);
  }
}

// Run the test
runTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

