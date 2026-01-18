# Test Data Management

## Overview

The test data system creates realistic, **intentionally messy** Jira data to simulate real sprint planning scenarios.

### Data Summary

- **5 Initiatives** (4 feature + 1 Engineering Excellence)
- **6 Epics** (intentionally incomplete - 50% removed)
- **~108 Issues** (Stories + Tasks) across 3 sprints + backlog
  - Sprint 1 (Future, to be planned): 13 issues
  - Sprint 2 (Future): 20 issues  
  - Sprint 3 (Future): 30 issues
  - Backlog: 45 issues
- **Many unassigned tickets** with hints in descriptions

### Philosophy

This data is **messy by design** to force realistic planning workflows:
- ❌ Not all epics exist (user must create them)
- ❌ Many tickets unassigned (user must organize)
- ✅ Descriptions include hints about intended epic/initiative
- ✅ Forces workflow: triage → organize → plan

---

## Scripts

All scripts are in the `scripts/` directory and require environment variables (see [SETUP.md](./SETUP.md)).

### Create Test Data

Creates all initiatives, epics, and issues with the `non-permanent-test-data` label.

```bash
node scripts/create-test-data.js
```

**What it creates:**
- 5 Initiatives
- 6 Epics (linked to initiatives)
- ~108 Issues with realistic titles
- Issues distributed across Sprint 1, 2, 3, and Backlog
- Auto-categorizes Engineering Excellence work

**Note:** Story points are NOT set at creation time (Jira screen restriction).

### Verify Test Data

Validates that Jira contains expected data structure.

```bash
# Basic checks (initiative/epics by name)
node scripts/verify-test-data.js

# Validate specific sprint contents
node scripts/verify-test-data.js --sprints "dynaform Sprint 2"

# Strict mode (fails if any Story/Task is missing an epic)
node scripts/verify-test-data.js --strict
```

### Purge Test Data

Deletes all issues with the `non-permanent-test-data` label.

**Preview first (recommended):**

```bash
node scripts/purge-by-label.js
```

**Delete after preview:**

```bash
node scripts/purge-by-label.js --yes
```

**How it works:**
- Uses JQL to find all issues with the label
- Deletes in correct order: Stories/Tasks → Epics → Initiatives
- Retries up to 5 times for dependency issues
- Shows detailed logging of what was/wasn't deleted

### Inventory (Read-Only)

Lists all current Jira entities without making changes.

```bash
node scripts/inventory.js
```

Shows:
- All boards
- All sprints (with issue counts)
- All initiatives
- All epics (with parent relationships)
- All stories/tasks (with epic assignments)

---

## Test Data Structure

### Initiatives & Epics

**Initiative 1: Internationalization**
- ✅ GCE Alignment *(exists)*
- ❌ Core Framework *(missing - user creates)*
- ❌ Approval Process *(missing - user creates)*

**Initiative 2: unified mobile**
- ❌ Cross-Platform Navigation *(missing)*
- ✅ Authentication & Security *(exists)*
- ❌ Performance Optimization *(missing)*

**Initiative 3: AI component builder**
- ❌ Schema & Parser *(missing)*
- ✅ Component Generation *(exists)*
- ❌ Preview & Management *(missing)*

**Initiative 4: server side rendering**
- ✅ SSR Infrastructure *(exists)*
- ❌ SEO & Metadata *(missing)*
- ❌ Caching & Performance *(missing)*

**Initiative 5: Engineering Excellence**
- ✅ Engineering Excellence *(exists)*

### Issue Distribution

**Sprint 1 (dynaform Sprint 1):** 13 issues
- 8 "carryover" tasks (i18n related, assigned to GCE Alignment epic)
- 5 unassigned tasks with description hints

**Sprint 2 (dynaform Sprint 2):** 20 issues
- Mix of Stories and Tasks
- Some assigned to existing epics, many unassigned
- Covers i18n, mobile, AI builder, SSR

**Sprint 3 (dynaform Sprint 3):** 30 issues
- Largest sprint
- Heavy emphasis on unassigned work
- Requires significant epic creation/assignment

**Backlog:** 45 issues
- Mostly unassigned
- Wide variety of work types
- Good source for pulling into sprints

### Engineering Excellence

All EE work is:
- Linked to "Engineering Excellence" initiative + epic
- Tagged with `eng-excellence` label
- Auto-categorized as `ee` category in the planner

Example EE tasks:
- "Set up automated dependency updates"
- "Implement code coverage tracking"
- "Add performance monitoring"

---

## Customization

### Change Test Label

Default label is `non-permanent-test-data`. Override with:

```bash
export JIRA_TESTDATA_LABEL="my-custom-label"
```

### Configure Engineering Excellence

Set these in `jira.env`:

```bash
export JIRA_EE_INITIATIVE="SP-XXX"  # Initiative key
export JIRA_EE_EPIC="SP-YYY"        # Epic key  
export JIRA_EE_LABEL="eng-excellence"  # Label
```

---

## Full Test Data Spec

For the complete specification including all issue titles and descriptions, see [`scripts/TEST-DATA-SPEC.md`](../scripts/TEST-DATA-SPEC.md).

---

## Workflow Example

```bash
# 1. Load environment
source jira.env

# 2. Check current state
node scripts/inventory.js

# 3. Purge old data (if any)
node scripts/purge-by-label.js --yes

# 4. Create fresh test data
node scripts/create-test-data.js

# 5. Verify it worked
node scripts/verify-test-data.js

# 6. Use the sprint planner!
cd sprint-planner/server && npm start
```

