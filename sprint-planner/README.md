# Sprint Planner

Fast, local-first sprint planning tool for Jira.

## Quick Start

### Server

```bash
cd server
npm install
source /path/to/jira.env
npm start
```

Runs on `http://localhost:3001`

### Client

```bash
cd client
npm install
npm run dev
```

**Runs on `http://localhost:5173`** ← ALWAYS verify this port before testing!

### Tests

```bash
cd server
npm test              # All tests
npm run test:api      # API tests only
npm run test:e2e      # E2E tests only
```

## Documentation

For complete documentation, see the main project **[README.md](../README.md)** and:

- **[Setup Guide](../docs/SETUP.md)** - Configuration and troubleshooting
- **[Architecture](../docs/ARCHITECTURE.md)** - System design
- **[API](../docs/API.md)** - API contracts
- **[Testing](../docs/testing/TESTING.md)** - Test documentation

## Structure

```
sprint-planner/
├── client/           # React + Vite frontend
├── server/           # Express API backend
└── .data/            # Local JSON snapshots (gitignored)
```

See component-specific READMEs:
- [client/README.md](client/README.md)
- [server/README.md](server/README.md)
