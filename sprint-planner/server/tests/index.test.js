/**
 * Integration tests for server/index.js endpoints
 * 
 * Prerequisites:
 * - Server must be running (npm start)
 * - jira.env must be loaded with valid credentials
 * 
 * Usage: node index.test.js
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

async function testContextAPI() {
  console.log('=== Testing GET /api/context ===\n');

  try {
    const response = await makeRequest('/api/context');

    // Check status
    if (response.status !== 200) {
      console.error(`❌ FAIL: Expected status 200, got ${response.status}`);
      console.error('Response:', response.data);
      process.exit(1);
    }
    console.log('✅ Status: 200 OK');

    // Check structure
    const { boards } = response.data;

    if (!Array.isArray(boards)) {
      console.error('❌ FAIL: boards is not an array');
      process.exit(1);
    }
    console.log(`✅ boards: array with ${boards.length} items`);

    // Check board structure
    if (boards.length > 0) {
      const board = boards[0];
      if (!board.id || !board.name || !board.type) {
        console.error('❌ FAIL: board missing required fields (id, name, type)');
        console.error('Got:', board);
        process.exit(1);
      }
      console.log(`✅ board structure: {id: ${board.id}, name: "${board.name}", type: "${board.type}"}`);
    }

    console.log('\n✅ ALL CONTEXT TESTS PASSED\n');

  } catch (error) {
    console.error('❌ FAIL: Request failed');
    console.error(error.message);
    process.exit(1);
  }
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

    const req = require('http').request(options, (res) => {
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

async function testSnapshotLoad() {
  console.log('=== Testing POST /api/snapshot/load ===\n');

  try {
    const response = await makePostRequest('/api/snapshot/load', {
      boardId: 4,
      sprintId: 36
    });

    // Check status
    if (response.status !== 200) {
      console.error(`❌ FAIL: Expected status 200, got ${response.status}`);
      console.error('Response:', response.data);
      process.exit(1);
    }
    console.log('✅ Status: 200 OK');

    // Check structure
    const { snapshot } = response.data;

    if (!snapshot) {
      console.error('❌ FAIL: response missing snapshot');
      process.exit(1);
    }
    console.log('✅ snapshot: present');

    // Check board
    if (!snapshot.board || !snapshot.board.id || !snapshot.board.name || !snapshot.board.projectKey) {
      console.error('❌ FAIL: board missing required fields');
      console.error('Got:', snapshot.board);
      process.exit(1);
    }
    console.log(`✅ board: {id: ${snapshot.board.id}, name: "${snapshot.board.name}", projectKey: "${snapshot.board.projectKey}"}`);

    // Check sprints
    if (!Array.isArray(snapshot.sprints)) {
      console.error('❌ FAIL: sprints is not an array');
      process.exit(1);
    }
    console.log(`✅ sprints: array with ${snapshot.sprints.length} items`);

    // Check sprint structure
    if (snapshot.sprints.length > 0) {
      const sprint = snapshot.sprints[0];
      if (!sprint.id || !sprint.name || !sprint.state || !Array.isArray(sprint.issues)) {
        console.error('❌ FAIL: sprint missing required fields');
        console.error('Got:', sprint);
        process.exit(1);
      }
      console.log(`✅ sprint structure: {id: ${sprint.id}, name: "${sprint.name}", state: "${sprint.state}", issues: ${sprint.issues.length}}`);
    }

    // Check backlog
    if (!Array.isArray(snapshot.backlog)) {
      console.error('❌ FAIL: backlog is not an array');
      process.exit(1);
    }
    console.log(`✅ backlog: array with ${snapshot.backlog.length} items`);

    // Check initiatives
    if (!Array.isArray(snapshot.initiatives)) {
      console.error('❌ FAIL: initiatives is not an array');
      process.exit(1);
    }
    console.log(`✅ initiatives: array with ${snapshot.initiatives.length} items`);

    // Check initiative structure
    if (snapshot.initiatives.length > 0) {
      const init = snapshot.initiatives[0];
      if (!init.key || !init.name || !Array.isArray(init.epics)) {
        console.error('❌ FAIL: initiative missing required fields');
        console.error('Got:', init);
        process.exit(1);
      }
      console.log(`✅ initiative structure: {key: "${init.key}", name: "${init.name}", epics: ${init.epics.length}}`);
    }

    // Check issue structure
    const allIssues = [];
    snapshot.sprints.forEach(sprint => allIssues.push(...sprint.issues));
    allIssues.push(...snapshot.backlog);

    if (allIssues.length > 0) {
      const issue = allIssues[0];
      if (!issue.key || !issue.summary || !issue.type) {
        console.error('❌ FAIL: issue missing required fields (key, summary, type)');
        console.error('Got:', issue);
        process.exit(1);
      }
      console.log(`✅ issue structure: {key: "${issue.key}", type: "${issue.type}", summary: "${issue.summary.substring(0, 30)}..."}`);
    }

    // Check epic structure
    const allEpics = [];
    snapshot.initiatives.forEach(init => allEpics.push(...init.epics));
    
    if (allEpics.length > 0) {
      const epic = allEpics[0];
      if (!epic.key || !epic.name || !epic.parentKey || !Array.isArray(epic.issueKeys)) {
        console.error('❌ FAIL: epic missing required fields (key, name, parentKey, issueKeys)');
        console.error('Got:', epic);
        process.exit(1);
      }
      console.log(`✅ epic structure: {key: "${epic.key}", name: "${epic.name}", parentKey: "${epic.parentKey}", issues: ${epic.issueKeys.length}}`);
    }

    // Validate initiative-epic relationships
    let epicRelationshipsValid = true;
    snapshot.initiatives.forEach(init => {
      init.epics.forEach(epic => {
        if (epic.parentKey !== init.key) {
          console.error(`❌ FAIL: Epic ${epic.key} parent mismatch: parentKey="${epic.parentKey}" but initiative is "${init.key}"`);
          epicRelationshipsValid = false;
        }
      });
    });
    if (epicRelationshipsValid) {
      console.log('✅ initiative-epic relationships: valid');
    } else {
      process.exit(1);
    }

    // Check for unassigned issues (no epic)
    const unassignedIssues = allIssues.filter(issue => !issue.epicKey);
    console.log(`✅ unassigned issues: ${unassignedIssues.length} found`);

    // Validate epic-issue mappings
    const allEpicKeys = new Set(allEpics.map(e => e.key));
    let epicIssueRelationshipsValid = true;
    allIssues.forEach(issue => {
      if (issue.epicKey && !allEpicKeys.has(issue.epicKey)) {
        console.error(`❌ FAIL: Issue ${issue.key} references epic ${issue.epicKey} which is not in initiatives`);
        epicIssueRelationshipsValid = false;
      }
    });
    if (epicIssueRelationshipsValid) {
      console.log('✅ epic-issue relationships: valid');
    } else {
      process.exit(1);
    }

    // Validate expected test data
    const expectedInitiatives = ['Internationalization', 'unified mobile', 'AI component builder', 'server side rendering'];
    const actualInitiativeNames = snapshot.initiatives.map(i => i.name);
    const missingInitiatives = expectedInitiatives.filter(name => !actualInitiativeNames.includes(name));
    
    if (missingInitiatives.length > 0) {
      console.error(`❌ FAIL: Missing expected initiatives: ${missingInitiatives.join(', ')}`);
      process.exit(1);
    }
    console.log('✅ expected initiatives: all present');

    console.log('\n✅ ALL SNAPSHOT TESTS PASSED\n');
    console.log('Summary:');
    console.log(`  - ${snapshot.sprints.length} sprints loaded`);
    console.log(`  - ${snapshot.backlog.length} backlog issues`);
    console.log(`  - ${snapshot.initiatives.length} initiatives`);
    console.log(`  - ${allEpics.length} epics total`);
    const totalIssues = snapshot.sprints.reduce((sum, s) => sum + s.issues.length, 0) + snapshot.backlog.length;
    console.log(`  - ${totalIssues} total issues`);
    console.log(`  - ${unassignedIssues.length} unassigned to epic`);

  } catch (error) {
    console.error('❌ FAIL: Request failed');
    console.error(error.message);
    process.exit(1);
  }
}

async function runTests() {
  await testContextAPI();
  await testSnapshotLoad();
  console.log('\n🎉 ALL TESTS PASSED\n');
}

runTests();

