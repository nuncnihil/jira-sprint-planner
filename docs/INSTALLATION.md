# Installation & Deployment Guide

## 🚀 Quick Start (5 minutes)

Get the Jira Sprint Planning Tool up and running in under 5 minutes.

### Prerequisites

- **Node.js 22+** ([Download here](https://nodejs.org/))
- **Jira Cloud account** with API access
- **Jira API token** ([Create one here](https://id.atlassian.com/manage-profile/security/api-tokens))

### 1. Clone & Install

```bash
# Clone the repository
git clone <repository-url>
cd jira-sprint-planner

# Install dependencies for both server and client
cd sprint-planner/server && npm install && cd ../client && npm install && cd ..
```

### 2. Configure Jira

```bash
# Copy the example configuration
cp jira.env.example jira.env

# Edit jira.env with your Jira details
# Required: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
# Optional: JIRA_TEAM_ID (only for multi-team organizations)
```

**Example `jira.env` (minimal):**
```bash
export JIRA_BASE_URL="https://yourcompany.atlassian.net"
export JIRA_EMAIL="you@company.com"
export JIRA_API_TOKEN="ATATT3xFfGF0..."
```

**Example `jira.env` (with team and EE configuration):**
```bash
export JIRA_BASE_URL="https://yourcompany.atlassian.net"
export JIRA_EMAIL="you@company.com"
export JIRA_API_TOKEN="ATATT3xFfGF0..."
export JIRA_TEAM_ID="8b47fdd6-7558-490c-8331-f299b2c2c08a"
export JIRA_EE_INITIATIVE="Engineering Excellence"
export JIRA_EE_EPIC="Tech Debt & Quality"
export JIRA_EE_LABEL="engineering-excellence"
```

### 3. Start the Application

```bash
# Load environment variables
source jira.env

# Start server (in one terminal)
cd sprint-planner/server && npm start

# Start client (in another terminal)
cd sprint-planner/client && npm run dev
```

### 4. Open Browser

Navigate to `http://localhost:5174` and start planning your sprint!

---

## 🏭 Production Deployment

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose ports
EXPOSE 3001 5174

# Start both server and client
CMD ["npm", "run", "start:prod"]
```

### Environment Variables for Production

```bash
# Required
NODE_ENV=production
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=service-account@company.com
JIRA_API_TOKEN=ATATT3xFfGF0...
JIRA_PROJECT_KEY=PROJ
JIRA_PROJECT_ID=10001

# Optional
JIRA_TEAM_ID=your-team-id
JIRA_TEAM_NAME=your-team-name
JIRA_EE_INITIATIVE=PROJ-123
JIRA_EE_EPIC=PROJ-456
JIRA_EE_LABEL=engineering-excellence
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Serve client (React app)
    location / {
        proxy_pass http://localhost:5174;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Proxy API requests to server
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🧪 Development Setup

### Local Development

```bash
# Install all dependencies
npm run install:all

# Start development servers
npm run dev

# Run tests
npm test

# Run specific test suites
npm run test:server
npm run test:client
```

### Test Data Setup

```bash
# Create realistic test data
node scripts/create-test-data.js

# Run end-to-end tests
npm run test:e2e
```

---

## 🔧 Configuration Options

### Required Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `JIRA_BASE_URL` | Your Jira Cloud URL | `https://company.atlassian.net` |
| `JIRA_EMAIL` | Jira account email | `you@company.com` |
| `JIRA_API_TOKEN` | API token | `ATATT3xFfGF0...` |

### Optional Configuration

| Variable | Description | Default | Purpose |
|----------|-------------|---------|---------|
| `JIRA_TEAM_ID` | Team ID for multi-team orgs | - | Multi-team support |
| `JIRA_TEAM_NAME` | Team display name | - | Display purposes |
| `JIRA_EE_INITIATIVE` | Engineering Excellence initiative name | - | Auto-categorization |
| `JIRA_EE_EPIC` | Engineering Excellence epic name | - | Auto-categorization |
| `JIRA_EE_LABEL` | Label for EE issues | `engineering-excellence` | Auto-categorization |

### Engineering Excellence Auto-Categorization

**What it does:** Automatically categorizes issues as "Engineering Excellence" work for capacity planning.

**Why it matters:** Helps teams track the balance between:
- 💰 **Sprint Goal work** (directly supports sprint objectives)
- 🔧 **Engineering Excellence work** (tech debt, quality, tooling)
- 💰 **Other work** (ad-hoc, support)

#### How It Works

Issues are automatically tagged as EE if they match any of:
- **Epic match:** Issue belongs to the specified EE epic
- **Initiative match:** Issue belongs to an epic in the specified EE initiative
- **Label match:** Issue has the specified EE label

#### Example Configuration

```bash
export JIRA_EE_INITIATIVE="Engineering Excellence"
export JIRA_EE_EPIC="Tech Debt & Quality"
export JIRA_EE_LABEL="engineering-excellence"
```

#### What You'll See

After configuration and loading a snapshot, issues will be automatically categorized:

**Before EE Configuration:**
```
Sprint Goal: Implement user auth... | Capacity: 10/40 pts
💰 Goal Tasks: 10pts (100%) | 🔧 Eng Ex: 0pts (0%) | 💼 Other: 0pts (0%)
```

**After EE Configuration:**
```
Sprint Goal: Implement user auth... | Capacity: 10/40 pts
💰 Goal Tasks: 6pts (60%) | 🔧 Eng Ex: 3pts (30%) | 💼 Other: 1pts (10%)
```

**Issues with `"engineering-excellence"` label automatically appear in the 🔧 Engineering Excellence column.**

#### Visual Reference

See the UX wireframes for visual examples:
- `docs/project-lifecycle/ux/ux-option-4-goal-focused.svg` - Shows category icons (💰 🔧 💼)
- `docs/project-lifecycle/ux/wireframes/page-2-planning-view.svg` - Main planning interface

#### When to Configure

Configure EE auto-categorization if your team:
- Uses labels to track Engineering Excellence work
- Has dedicated epics/initiatives for tech debt and quality
- Wants automatic capacity tracking for different work types

**Tip:** Start with `JIRA_EE_LABEL` if your team already uses labels for EE work.

#### GitHub Release Requirements

**📸 Screenshots Needed:** For professional GitHub presentation, create these screenshots:

1. **`main-planning-interface.png`** - Full planning view showing three columns (💰 🔧 💼) with color coding
2. **`capacity-breakdown.png`** - Close-up of capacity percentages (e.g., "Goal: 60% | EE: 30% | Other: 10%")
3. **`ee-auto-categorization.png`** - Issues automatically appearing in 🔧 EE column after configuration
4. **`before-after-ee.png`** - Side-by-side showing uncategorized → categorized issues

**Place screenshots in:** `docs/screenshots/` directory (create if needed)

**Update README.md:** Add image references like:
```markdown
![Planning Interface](docs/screenshots/main-planning-interface.png)
![Capacity Tracking](docs/screenshots/capacity-breakdown.png)
```


### Verify Setup

**Test API Connection:**
```bash
curl http://localhost:3001/api/test
```

**Expected response:**
```json
{"status":"ok","message":"Sprint planner API is running"}
```

### Finding Configuration Values

**Jira Project ID & Key:**
1. Open your Jira project
2. Check the URL: `https://domain.atlassian.net/browse/PROJ-123`
3. `PROJ` = Project Key
4. Project ID can be found in Project Settings → Details

**Team ID (only needed for multi-team organizations):**
1. Go to `https://your-domain.atlassian.net/teams`
2. Click on your team name
3. Look at the URL: `your-domain.atlassian.net/teams/{TEAM_ID}/overview`
4. The `{TEAM_ID}` part is your team ID

**Alternative:** After setup, run `node scripts/inventory.js` to list all teams with their IDs

---

## 🐛 Troubleshooting

### Common Issues

**"Failed to fetch context"**
- Verify Jira credentials are correct
- Check API token is valid and not expired
- Ensure base URL includes `https://`

**"No teams found"**
- For multi-team organizations, configure `JIRA_TEAM_ID` with your specific team ID
- Single-team organizations don't need team configuration

**Port conflicts**
- Server runs on port 3001
- Client runs on port 5174 (or next available)
- Change ports in respective `package.json` files if needed

**Environment not loading**
- Ensure `jira.env` is in project root
- Use `source jira.env` to load variables
- Check variable export syntax

**"Operation not permitted" errors**
- The dotenv path may be hardcoded
- Ensure `jira.env` is at the project root
- Or update the path in `sprint-planner/server/index.js`

### Getting Help

- Check [SETUP.md](SETUP.md) for detailed configuration
- Review [TESTING.md](TESTING.md) for test setup
- Check server logs for API errors
- Verify Jira permissions for your account

---

## 📊 System Requirements

### Minimum Requirements
- **Node.js:** 22.0.0 or later
- **Memory:** 512MB RAM
- **Disk:** 100MB free space
- **Network:** Internet connection for Jira API

### Recommended Requirements
- **Node.js:** Latest LTS (22.x)
- **Memory:** 1GB RAM
- **CPU:** 2+ cores
- **Network:** Stable internet connection

---

## 🔒 Security Notes

- Never commit `jira.env` to version control
- Use service accounts for production deployments
- Rotate API tokens regularly
- Limit Jira account permissions to read/write necessary data only
- Use HTTPS in production environments