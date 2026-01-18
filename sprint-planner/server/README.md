# Sprint Planner Server

Minimal Express API server for sprint planning tool.

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

Server runs on `http://localhost:3001`

## Prerequisites

Jira environment variables must be loaded:

```bash
source /Users/lshaw/src/bmad/_bmad-output/jira-assist/scripts/load-jira-env.sh
```

## Test

```bash
# Health check
curl http://localhost:3001/api/test

# Run all tests (API + E2E)
npm test

# Run only API integration tests
npm run test:api
# or: node tests/index.test.js

# Run only E2E workflow tests
npm run test:e2e
# or: node tests/e2e.test.js
```

### What the tests validate

**API Tests (`tests/index.test.js`):**
- ✅ GET /api/context returns boards
- ✅ POST /api/snapshot/load returns complete snapshot
- ✅ Issue structure (key, summary, type, epicKey, storyPoints, status)
- ✅ Epic structure (key, name, parentKey, issueKeys)
- ✅ Initiative-epic relationships
- ✅ Epic-issue relationships
- ✅ Expected test data initiatives present
- ✅ Unassigned issues detection

**E2E Tests (`tests/e2e.test.js`):**
- ✅ Complete workflow: context → board selection → snapshot load
- ✅ Tab 1 data requirements (sprints, backlog, issue display)
- ✅ Tab 2 data requirements (initiatives, epics, issue locations)
- ✅ Capacity calculations
- ✅ Planning metrics (points, unassigned issues, active epics)

## Endpoints

### `GET /api/test`
Health check endpoint.

**Response:**
```json
{"status":"ok","message":"Sprint planner API is running"}
```

### `GET /api/context`
Returns projects and boards for context selection.

**Note:** Team is configured via `JIRA_TEAM_ID` environment variable.

**Response:**
```json
{
  "projects": [{"id": "10000", "key": "SP", "name": "Sprint Planning"}],
  "boards": [{"id": 1, "name": "dynaform-raptors-board", "type": "scrum"}]
}
```

### `GET /api/sprints/:boardId`
Returns sprints for a specific board.

**Response:**
```json
{
  "sprints": [
    {"id": 1, "name": "Sprint 1", "state": "active", "startDate": "...", "endDate": "..."}
  ]
}
```

### `POST /api/snapshot/load`
Fetches all data from Jira for sprint planning and creates a local snapshot.

**Request:**
```json
{
  "boardId": 4,
  "sprintId": 36
}
```

**Response:**
```json
{
  "snapshot": {
    "board": {"id": 4, "name": "dynaform-raptors-board", "projectKey": "SP"},
    "sprints": [
      {"id": 36, "name": "Sprint 1", "state": "active", "issues": [...]}
    ],
    "backlog": [...],
    "initiatives": [
      {"key": "SP-385", "name": "Internationalization", "epics": [...]}
    ],
    "createdAt": "2026-01-08T..."
  }
}
```

**What it fetches:**
- Board details and project
- All sprints (active + future) with their issues
- Backlog issues
- Initiatives (filtered by configured team)
- Epics (children of initiatives)

**Snapshot saved to:** `.data/snapshot-{timestamp}.json`

