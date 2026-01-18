# Jira Scripts

Command-line utilities for working with Jira.

---

## 📋 Overview

This directory contains CLI scripts for:
- **General Utilities** - Explore and manage Jira
- **Test Data Management** - Create, verify, and clean test data

---

## 🛠️ Setup

### 1. Configure `jira.env`
Create a `jira.env` file in the project root (see `jira.env.example`):
```bash
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=SP
JIRA_TEAM_ID=team-123
JIRA_BOARD_NAME=your-board-name
```

### 2. Load Environment Variables
```bash
source scripts/load-jira-env.sh
```

---

## 📜 Available Scripts

### General Utilities

#### `inventory.js`
Explore your Jira instance - list boards, sprints, initiatives, epics, and issues.

**Usage:**
```bash
node scripts/inventory.js
```

**Output:**
- All boards
- All sprints per board
- All initiatives with epics
- All issues with sprint/epic assignments

---

### Test Data Management

#### `create-test-data.js`
Create a complete set of test data in Jira for testing the sprint planner.

**What it creates:**
- 4 Initiatives
- 12 Epics (3 per initiative)
- 75 Issues (stories/tasks) across sprints and backlog
- Proper parent-child relationships

**Usage:**
```bash
node scripts/create-test-data.js
```

**Note:** Requires test sprints to exist in Jira first.

---

#### `verify-test-data.js`
Verify that test data exists and is properly configured.

**Usage:**
```bash
node scripts/verify-test-data.js
```

**Checks:**
- Target board exists
- Expected initiatives exist
- Expected epics exist with correct parents
- Sprint issue counts match expectations
- Epic assignments are valid

---

#### `purge-by-label.js`
Delete all test data from Jira by label.

**Usage:**
```bash
node scripts/purge-by-label.js
```

**What it deletes:**
- All issues with label `bmad-test-data`
- Confirmation prompt before deletion

**⚠️ Warning:** This is destructive! Use only for test data cleanup.

---

## 🔄 Common Workflows

### Setting Up Test Environment
```bash
# 1. Load environment
source scripts/load-jira-env.sh

# 2. Create test data
node scripts/create-test-data.js

# 3. Verify it was created
node scripts/verify-test-data.js
```

### Cleaning Up Test Data
```bash
# Load environment
source scripts/load-jira-env.sh

# Purge all test data
node scripts/purge-by-label.js
```

### Exploring Your Jira
```bash
# Load environment
source scripts/load-jira-env.sh

# See everything
node scripts/inventory.js
```

---

## 📚 Related Documentation

- **Test Data Specification:** [../docs/TEST-DATA-SPEC.md](../docs/TEST-DATA-SPEC.md)
- **Testing Guide:** [../docs/TESTING.md](../docs/TESTING.md)
- **Configuration Guide:** [../docs/CONFIGURATION.md](../docs/CONFIGURATION.md)

---

## 🧪 For Developers

### Adding New Scripts

1. Create your script in this directory
2. Use the Jira client utilities from `../jira/`
3. Load environment with `load-jira-env.sh` or `env-loader.js`
4. Document it in this README

### Example Script Template
```javascript
#!/usr/bin/env node

const { makeJiraClient } = require('../jira/client');
const { loadJiraConfig } = require('../jira/config');

async function main() {
  const config = loadJiraConfig();
  const jira = makeJiraClient(config);
  
  // Your script logic here
}

main().catch(console.error);
```

---

## 🔧 Script Dependencies

All scripts depend on:
- `../jira/client.js` - Jira REST API client
- `../jira/config.js` - Configuration loader
- `../jira/field-resolver.js` - Custom field discovery
- `../jira/env-loader.js` - Environment variable loader (Node.js)
- `load-jira-env.sh` - Environment variable loader (shell)

---

## ⚠️ Important Notes

1. **Never commit `jira.env`** - Contains sensitive credentials
2. **Test data label** - All test data is tagged with `bmad-test-data`
3. **Rate limits** - Be mindful when creating/deleting many issues
4. **Idempotency** - Scripts can be run multiple times safely

---

## 🆘 Troubleshooting

### "jira.env not found"
- Ensure `jira.env` exists in project root
- Or set `JIRA_ENV_FILE` environment variable

### "Unauthorized" errors
- Check your API token is valid
- Verify email matches your Atlassian account

### "Board not found"
- Update `JIRA_BOARD_NAME` in jira.env
- Run `inventory.js` to see available boards

### "Custom field not found"
- Field resolver will auto-discover custom field IDs
- Ensure field names match your Jira instance
- Check field-resolver.js for supported fields
