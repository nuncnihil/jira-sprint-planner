# Sprint Planner API Design

## GET /api/context

### Purpose
Returns boards available to the authenticated user for context selection.

**Note:** 
- Team is deployment-time configuration (via `JIRA_TEAM_ID` env var), not runtime selection
- Project is derived from selected board when loading snapshot

### Response Structure

```json
{
  "boards": [
    {
      "id": 1,
      "name": "dynaform-raptors-board",
      "type": "scrum"
    }
  ]
}
```

### Jira API Calls Made

| Data | Jira Endpoint | Notes |
|------|---------------|-------|
| Boards | `GET /rest/agile/1.0/board` | Returns all Agile boards accessible to user |

### Implementation Flow

```
Client           index.js           jira-api.js        Jira API
  |                 |                    |                 |
  |--GET /context-->|                    |                 |
  |                 |                    |                 |
  |                 |--getBoards()------>|                 |
  |                 |                    |--GET /board---->|
  |                 |                    |<--boards[]-----|
  |                 |<--boards[]---------|                 |
  |                 |                    |                 |
  |<--{boards}------|                    |                 |
```

### File Responsibilities

**`index.js`**:
- Receives `GET /api/context` request
- Calls `jira-api.getBoards()`
- Returns boards to client

**`jira-api.js`**:
- Imports `../../jira/client.js` for HTTP calls
- Exports `getBoards()` - calls Jira `/rest/agile/1.0/board`, transforms to `{id, name, type}`
- Returns clean, minimal data structures

### Data Transformation

**Jira returns verbose data** - we'll simplify to only what we need:

#### Projects (from Jira)
```json
{
  "id": "10000",
  "key": "SP",
  "name": "Sprint Planning",
  "avatarUrls": {...},
  "projectCategory": {...},
  "simplified": false,
  // ... many other fields
}
```

**→ Transform to:**
```json
{
  "id": "10000",
  "key": "SP",
  "name": "Sprint Planning"
}
```

#### Boards (from Jira)
```json
{
  "id": 1,
  "self": "https://...",
  "name": "dynaform-raptors-board",
  "type": "scrum",
  "location": {...}
}
```

**→ Transform to:**
```json
{
  "id": 1,
  "name": "dynaform-raptors-board",
  "type": "scrum"
}
```

---

## GET /api/sprints/:boardId

### Purpose
Returns sprints for a selected board (called after user selects board).

### Request
- URL param: `boardId` (e.g., `/api/sprints/1`)

### Response Structure

```json
{
  "sprints": [
    {
      "id": 1,
      "name": "dynaform Sprint 1",
      "state": "active",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-14T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "dynaform Sprint 2",
      "state": "future"
    },
    {
      "id": 3,
      "name": "dynaform Sprint 3",
      "state": "future"
    }
  ]
}
```

### Jira API Call

| Data | Jira Endpoint | Notes |
|------|---------------|-------|
| Sprints | `GET /rest/agile/1.0/board/{boardId}/sprint` | Returns all sprints for board |

### States
- `active` - Currently running sprint
- `future` - Planned sprints
- `closed` - Completed sprints

---

## POST /api/snapshot/load

### Purpose
Fetches all data needed for sprint planning from Jira, creates a local snapshot, and returns it to the client for fast manipulation.

**Note:** This is called when user clicks "Load" button after selecting board and sprint.

### Request

#### Request bodyapplication/json

```json
{
  "boardId": 4,
  "sprintId": 36
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `boardId` | integer | Yes | Board ID selected by user |
| `sprintId` | integer | Yes | Sprint ID being planned |

### Response Structure

```json
{
  "snapshot": {
    "board": {
      "id": 4,
      "name": "dynaform-raptors-board",
      "projectKey": "SP"
    },
    "sprints": [
      {
        "id": 36,
        "name": "dynaform Sprint 1",
        "state": "active",
        "issues": [
          {
            "key": "SP-42",
            "type": "Story",
            "summary": "User login flow",
            "epicKey": "SP-20",
            "epicName": "Auth Epic",
            "storyPoints": 3,
            "status": "To Do"
          }
        ]
      },
      {
        "id": 37,
        "name": "dynaform Sprint 2",
        "state": "future",
        "issues": []
      }
    ],
    "backlog": [
      {
        "key": "SP-68",
        "type": "Task",
        "summary": "Export reports to PDF",
        "epicKey": null,
        "epicName": null,
        "storyPoints": null,
        "status": "To Do"
      }
    ],
    "initiatives": [
      {
        "key": "SP-19",
        "name": "Internationalization",
        "epics": [
          {
            "key": "SP-20",
            "name": "GCE Alignment",
            "issueKeys": ["SP-42", "SP-43"]
          }
        ]
      }
    ],
    "createdAt": "2026-01-08T19:30:00.000Z"
  }
}
```

### Jira API Calls Made

The server makes multiple Jira API calls to assemble the snapshot:

| Data | Jira Endpoint | Notes |
|------|---------------|-------|
| Board details | `GET /rest/agile/1.0/board/{boardId}` | Get board info including project |
| All sprints | `GET /rest/agile/1.0/board/{boardId}/sprint` | Get all sprints (active + future) |
| Sprint issues | `GET /rest/agile/1.0/sprint/{sprintId}/issue` | For each sprint, fetch issues |
| Backlog issues | `GET /rest/agile/1.0/board/{boardId}/backlog` | Get unassigned issues |
| Initiatives | `GET /rest/api/3/search?jql=...` | JQL: `project={projectKey} AND type=Initiative AND team={teamId}` |
| Epics | `GET /rest/api/3/search?jql=...` | JQL: `parent IN ({initiativeKeys})` |

### Implementation Flow

```
Client          index.js         jira-api.js         Jira API          snapshot.js
  |                |                  |                   |                  |
  |--POST /load--->|                  |                   |                  |
  |  {boardId,     |                  |                   |                  |
  |   sprintId}    |                  |                   |                  |
  |                |                  |                   |                  |
  |                |--getBoardDetails(boardId)----------->|                  |
  |                |<--{id, name, projectKey}-------------|                  |
  |                |                  |                   |                  |
  |                |--getAllSprints(boardId)------------->|                  |
  |                |<--sprints[]-------------------------|                  |
  |                |                  |                   |                  |
  |                |--getSprintIssues(sprintId)---------->|                  |
  |                |<--issues[]---------------------------|                  |
  |                |  (repeat for each sprint)            |                  |
  |                |                  |                   |                  |
  |                |--getBacklog(boardId)---------------->|                  |
  |                |<--backlogIssues[]-------------------|                  |
  |                |                  |                   |                  |
  |                |--getInitiatives(projectKey, teamId)->|                  |
  |                |<--initiatives[]----------------------|                  |
  |                |                  |                   |                  |
  |                |--getEpicsForInitiatives(keys)------->|                  |
  |                |<--epics[]----------------------------|                  |
  |                |                  |                   |                  |
  |                |--saveSnapshot(data)------------------------------------>|
  |                |<--saved to .data/{timestamp}.json-----------------------|
  |                |                  |                   |                  |
  |<--{snapshot}---|                  |                   |                  |
```

### File Responsibilities

**`index.js`**:
- Receives `POST /api/snapshot/load` with `{boardId, sprintId}`
- Orchestrates all data fetching via `jira-api.js`
- Calls `snapshot.saveSnapshot()` to persist locally
- Returns complete snapshot to client

**`jira-api.js`**:
- Exports `getBoardDetails(boardId)` - fetches board + derives project
- Exports `getAllSprints(boardId)` - fetches all sprints for board
- Exports `getSprintIssues(sprintId)` - fetches issues in a sprint
- Exports `getBacklog(boardId)` - fetches unassigned issues
- Exports `getInitiatives(projectKey, teamId)` - JQL search for team initiatives
- Exports `getEpicsForInitiatives(initiativeKeys)` - fetches child epics
- All functions transform Jira responses to clean structures

**`snapshot.js`**:
- Exports `saveSnapshot(data)` - writes JSON to `.data/` directory
- Exports `loadSnapshot(id)` - reads JSON from `.data/` directory
- Exports `deleteSnapshot(id)` - removes snapshot file

### Local Storage

Snapshots are stored in `.data/` directory (gitignored):

```
.data/
├── snapshot-2026-01-08T19-30-00.json
└── .gitkeep
```

**Filename format:** `snapshot-{ISO8601-timestamp}.json`

### Data Transformation Notes

**Issue fields extracted:**
- `key` - Issue key (e.g., "SP-42")
- `type` - Issue type (Story, Task, Bug)
- `summary` - Title
- `epicKey` - Parent epic key (or null)
- `epicName` - Parent epic name (or null)
- `storyPoints` - customfield_10036 (or null)
- `status` - Current status name

**Team filtering:**
- Initiatives filtered by `customfield_10001 = JIRA_TEAM_ID` (from config)
- Only epics under those initiatives are included
- Issues may reference epics not in snapshot (display as "Unknown Epic")

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "details": "Additional context (optional)"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (e.g., invalid boardId)
- `500` - Server error (Jira API failed)

---

## Summary

**Use Case 1: Context Selection**

**`GET /api/context`**
- Returns: `{boards[]}`
- Used: On page load to populate board dropdown
- Note: Team configured via env var, not runtime selection

**`GET /api/sprints/:boardId`**
- Returns: `{sprints[]}`
- Used: When user selects a board to populate sprint dropdown

**Use Case 2: Load Snapshot**

**`POST /api/snapshot/load`**
- Receives: `{boardId, sprintId}`
- Returns: Complete snapshot `{board, sprints[], backlog[], initiatives[]}`
- Used: When user clicks "Load" to begin planning
- Fetches all data from Jira, saves locally, returns to client
- Enables fast local manipulation before bulk sync

All endpoints abstract Jira's complexity and return only what the UI needs.

