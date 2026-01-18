# Sprint Planner - Architecture

## Overview
Local-first sprint planning tool with snapshot-based Jira integration. Built with React (Vite) frontend and Node.js (Express) backend.

**Status:** V1.0.0 Released
**Last Updated:** 2026-01-18  

---

## System Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (React + Vite)                    │
│  ┌────────────────┐              ┌─────────────────────┐    │
│  │ ContextSelector │ ──────────▶ │   PlanningView      │    │
│  │  Board+Sprint   │              │  ┌──────┬──────┐   │    │
│  └────────────────┘              │  │ Tab1 │ Tab2 │   │    │
│                                   │  └──────┴──────┘   │    │
│                                   └─────────────────────┘    │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/JSON
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Server (Express + Node.js)                      │
│  ┌──────────────────────────────────────────────────┐       │
│  │  API Endpoints                                   │       │
│  │  • GET  /api/project                             │       │
│  │  • GET  /api/context                             │       │
│  │  • GET  /api/sprints/:boardId                    │       │
│  │  • POST /api/snapshot/load                       │       │
│  │  • POST /api/changes/save                        │       │
│  └──────────────────────────────────────────────────┘       │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Jira API Integration (REST v3 + Agile v1.0)     │       │
│  └──────────────────────────────────────────────────┘       │
└───────────────────────────┬─────────────────────────────────┘
                            │ API Calls
                            ▼
                     ┌─────────────┐
                     │  Jira Cloud │
                     └─────────────┘
```

**See:** `docs/design/architecture/system-overview.svg`

---

## Actual Structure

```
sprint-planner/
├── server/
│   ├── index.js              # Express server entry point
│   ├── jira-api.js           # Jira API wrapper
│   ├── snapshot.js           # Snapshot file management
│   ├── snapshot-loader.js    # Orchestrates snapshot loading
│   ├── logger.js             # Structured logging
│   ├── constants.js          # Server constants (PORT, etc.)
│   └── .data/                # Local snapshots (gitignored)
│       └── .gitkeep
│
├── client/
│   ├── index.html            # SPA entry point
│   ├── src/
│   │   ├── App.jsx           # Root component
│   │   ├── main.jsx          # Vite entry
│   │   ├── components/
│   │   │   ├── ContextSelector.jsx      # Board + Sprint selection
│   │   │   ├── PlanningView.jsx         # Main planning interface
│   │   │   ├── SprintsBacklogTab.jsx    # Tab 1: Sprint issues
│   │   │   └── InitiativesEpicsTab.jsx  # Tab 2: Initiative hierarchy
│   │   ├── utils/
│   │   │   └── initiativeUtils.js       # Epic→Initiative mapping
│   │   └── constants.js      # UI constants (colors, spacing)
│   ├── package.json
│   └── vite.config.js
│
├── tests/
│   ├── index.test.js         # API endpoint tests
│   └── planning-view.test.js # E2E workflow tests
│
└── README.md
```

---

## Technology Stack

### Backend
- **Node.js + Express**: Lightweight HTTP server
- **File-based storage**: JSON snapshots in `.data/` (gitignored)
- **Jira APIs**: REST API v3, Agile API v1.0, Teams API
- **Structured logging**: Custom logger module

### Frontend
- **React 19.2.0**: Component-based UI
- **Vite 5.4.21**: Fast dev server and build tool
- **@vitejs/plugin-react 4.7.0**: React plugin for Vite
- **PropTypes**: Runtime type validation
- **Material Design Colors**: Initiative/epic color families
- **useMemo**: Performance optimization for expensive calculations

### Data Flow
1. **Load**: `POST /api/snapshot/load` → Fetch all data from Jira → Save locally
2. **Manipulate**: React state updates (instant, local)
3. **Persist**: `POST /api/changes/save` → Bulk write changes back to Jira

---

## Core Design Patterns

### 1. Snapshot-Based Architecture

**Problem:** Jira UI is slow for bulk operations.

**Solution:** Load all planning data once, work locally, persist later.

```
User → Select Context → Load Snapshot → Local Manipulation → Bulk Persist to Jira
```

**Benefits:**
- Fast local operations (no API latency)
- Offline-capable
- Reduces API rate limit concerns
- Bulk persistence reduces total API calls

### 2. Color Family System

**Problem:** Hard to see initiative/epic relationships in long lists.

**Solution:** Assign each initiative a Material Design color family, epics get shades.

```javascript
// 8 color families (blue, purple, orange, green, cyan, red, indigo, teal)
Initiative "Internationalization" → Green family
  ├─ Epic "GCE Alignment"    → Light green (shade 1)
  ├─ Epic "Core Framework"   → Medium green (shade 2)
  └─ Epic "Approval Process" → Darker green (shade 3)
```

**Benefits:**
- Visual hierarchy without reading text
- Fast pattern recognition
- Scalable (8 families × 3 shades = 24 distinct epic colors)

**See:** `docs/design/ux-iterations/option2-five-epics.svg`

### 3. Category Management

**Problem:** Teams need to balance sprint capacity across work types.

**Solution:** Auto-tag issues as "Sprint Goal", "Engineering Excellence", or "Other".

```javascript
// Auto-categorization on snapshot load
if (issue.epicKey === config.eeEpic) → category = 'ee'
else if (issue.labels.includes(config.eeLabel)) → category = 'ee'
else → category = 'other' (user can override to 'goal')
```

**UI displays:**
- Icon per category (💰 goal, 🔧 EE, 💰 other)
- Percentage breakdown (e.g., 60% goal, 30% EE, 10% other)
- Visual feedback on capacity allocation

### 4. Unidirectional Data Flow

**React state hierarchy:**

```
App (snapshot, selectedSprintId)
 ├─ ContextSelector → loads snapshot → onSnapshotLoaded()
 └─ PlanningView (snapshot as prop)
     ├─ SprintsBacklogTab (sprints, backlog, initiatives)
     └─ InitiativesEpicsTab (initiatives, sprints, backlog)
```

**Benefits:**
- Single source of truth
- Predictable state updates
- Easy to reason about data flow

**See:** `docs/design/architecture/component-hierarchy.svg`

---

## API Endpoints

### `GET /api/project`
Returns configured project information for display in the UI.

**Response:**
```json
{
  "project": {
    "id": "10001",
    "key": "SP",
    "name": "Sprint Planning",
    "projectTypeKey": "software"
  }
}
```

### `GET /api/context`
Returns all boards accessible to the user.

**Response:**
```json
{
  "boards": [
    { "id": 1, "name": "Dynaform Raptors" }
  ]
}
```

### `GET /api/sprints/:boardId`
Returns all sprints for a board (active, future, closed).

**Response:**
```json
{
  "sprints": [
    { "id": 5, "name": "Sprint 1", "state": "active" }
  ]
}
```

### `POST /api/snapshot/load`
Loads full planning snapshot from Jira.

**Request:**
```json
{
  "boardId": 1,
  "sprintId": 5
}
```

**Response:**
```json
{
  "snapshot": {
    "board": { "id": 1, "name": "Dynaform Raptors", "projectKey": "SP" },
    "sprints": [
      {
        "id": 5,
        "name": "Sprint 1",
        "state": "active",
        "issues": [...]
      }
    ],
    "backlog": [...],
    "initiatives": [
      {
        "key": "SP-100",
        "name": "Internationalization",
        "epics": [
          {
            "key": "SP-101",
            "name": "GCE Alignment",
            "parentKey": "SP-100",
            "issueKeys": ["SP-1", "SP-2"]
          }
        ]
      }
    ]
  },
  "createdAt": "2026-01-10T12:00:00Z"
}
```

**Processing steps:**
1. Fetch board details
2. Fetch all sprints (with issues)
3. Fetch backlog
4. Fetch initiatives (filtered by team)
5. Fetch epics for initiatives
6. Build initiative tree (nested epics with issue keys)
7. Auto-categorize issues (EE tagging)
8. Save snapshot to `.data/snapshot.json`
9. Return snapshot to client

**See:** `docs/design/architecture/snapshot-data-flow.svg`

---

## Key Technical Decisions

### 1. Why Snapshot vs. Real-Time Sync?

| Approach | Pros | Cons |
|----------|------|------|
| **Real-time** | Always up-to-date | API latency per action, rate limits, complex sync |
| **Snapshot** | Fast local ops, offline-capable | Stale data, conflict potential |

**Decision:** Snapshot for POC. Planning sessions are time-bound (30-60 min), stale data is acceptable. Real-time sync adds complexity without clear value for this use case.

### 2. Why React vs. Vanilla JS?

| Approach | Pros | Cons |
|----------|------|------|
| **Vanilla JS** | No build step, simple | Manual DOM updates, verbose |
| **React** | Declarative, component reuse, ecosystem | Build tooling, bundle size |

**Decision:** React. UI complexity (collapsible sections, color-coded badges, category dropdowns) benefits from declarative rendering. Vite minimizes build overhead.

### 3. Why Material Design Color Families?

**Requirements:**
- Need distinct colors for 5-8 initiatives
- Need 3-5 shades per initiative for epics
- Must be accessible (contrast, colorblind-friendly)

**Decision:** Material Design provides pre-tested color families with excellent accessibility and visual consistency.

### 4. Why Auto-Categorize on Load?

**Alternative:** User manually categorizes every issue.

**Problem:** Bulk categorization is tedious, especially for ~100+ issues.

**Decision:** Auto-tag Engineering Excellence work based on epic/label, user can override. Reduces initial categorization time from 15 minutes to < 2 minutes.

---

## Performance Considerations

### Backend Optimizations
1. **Parallel API calls**: Fetch sprints, backlog, initiatives simultaneously
2. **Single snapshot file**: No per-user storage, simple file I/O
3. **Minimal processing**: Build initiative tree in O(n), categorize in single pass

### Frontend Optimizations
1. **useMemo**: Expensive calculations (color mapping, sorting) memoized
2. **Collapsible sections**: Render only visible issues (reduces DOM nodes)
3. **No unnecessary re-renders**: PropTypes + React.memo (future)

### Current Metrics
- Snapshot load time: ~2-3 seconds (for ~113 issues)
- Local UI interactions: < 50ms
- Memory footprint: ~5MB (snapshot + React runtime)

---

## Testing Strategy

**Test categories:**
- **API tests** (`tests/index.test.js`): Endpoint validation
- **E2E tests** (`tests/planning-view.test.js`): Full workflow validation

**Test data:** Realistic, messy data (50% unassigned epics, description hints) in `data-mgt/`

**See:** `docs/TESTING.md` for full strategy

