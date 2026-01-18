# Testing Guide

This project uses **Jest** for all unit tests. Tests are fast, run in isolation, and don't require a Jira connection.

---

## 📂 Test Structure

```
sprint-planner/
├── client/
│   ├── src/
│   │   └── utils/              # Code to test
│   └── tests/
│       ├── fixtures/           # Test data
│       └── unit/
│           └── utils/          # Tests mirror src/ structure
│
└── server/
    ├── *.js                    # Code to test
    └── tests/
        ├── fixtures/           # Mock API responses
        └── unit/               # Unit tests
```

---

## 🧪 Test Naming Convention

**Pattern:** `<filename>.test.js`

```
src/utils/adfConverter.js     → tests/unit/utils/adfConverter.test.js
server/jira-api.js            → tests/unit/jira-api.test.js
```

**Test names:** Describe behavior, not implementation
```javascript
✅ test('converts simple paragraph to markdown', ...)
✅ test('handles null input gracefully', ...)
❌ test('calls convertNode function', ...)
```

---

## 🚀 Running Tests

### All Tests
```bash
# Client tests
cd sprint-planner/client
npm test

# Server tests
cd sprint-planner/server
npm test
```

### Specific Test File
```bash
npm test -- adfConverter
npm test -- snapshotUtils
npm test -- jira-api
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### With Coverage
```bash
npm run test:coverage
```

---

## 📊 Current Test Coverage

| Module | Tests | Coverage |
|--------|-------|----------|
| **Client** | 62 | 100% (utils) |
| - adfConverter.js | 24 | ✅ |
| - snapshotUtils.js | 38 | ✅ |
| **Server** | 47 | 100% (business logic) |
| - jira-api.js | 27 | ✅ |
| - snapshot-loader.js | 20 | ✅ |
| **Total** | **109** | **All passing** |

---

## ✍️ Writing Tests

### Basic Pattern

```javascript
// tests/unit/utils/myUtil.test.js
import { myFunction } from '../../../src/utils/myUtil';

describe('myFunction()', () => {
  test('handles valid input', () => {
    const result = myFunction('test');
    expect(result).toBe('expected output');
  });
  
  test('handles null input', () => {
    const result = myFunction(null);
    expect(result).toBeNull();
  });
});
```

### Using Fixtures

Keep test data in `tests/fixtures/` for readability:

```javascript
import { sampleData } from '../../fixtures/myFixtures';

test('processes sample data', () => {
  const result = myFunction(sampleData.valid);
  expect(result).toBeDefined();
});
```

### Mocking Dependencies

```javascript
jest.mock('../../jira-api');
const jiraApi = require('../../jira-api');

beforeEach(() => {
  jest.clearAllMocks();
  jiraApi.getBoards.mockResolvedValue([]);
});
```

---

## 🎯 Test Quality Standards

Every test should:
- ✅ Test one behavior
- ✅ Be independent (no shared state)
- ✅ Have a descriptive name
- ✅ Cover edge cases
- ✅ Not mutate inputs (test immutability)

---

## 🐛 Common Issues

### `Cannot find module`
- Check import paths match file structure
- Ensure test file mirrors source file location

### `ReferenceError: jest is not defined`
- Run tests with `npm test`, not `node`
- Check `jest.config.cjs` exists

### Tests pass locally but fail in CI
- Check for hardcoded paths
- Ensure no dependencies on local state

---

## 📚 Related Docs

- **Test Data:** [TEST-DATA.md](./TEST-DATA.md) - Setting up Jira test data
- **Test Data Spec:** [TEST-DATA-SPEC.md](./TEST-DATA-SPEC.md) - Data structure specs

---

## 🤝 Contributing Tests

When adding new features:

1. **Write tests first** (TDD recommended)
2. **Mirror source structure** in tests/
3. **Create fixtures** for complex test data
4. **Verify 100% coverage** for new code
5. **Run all tests** before committing

```bash
# Before committing
npm test
```

---

## 🔮 Future Test Plans

- Integration tests for API endpoints
- E2E tests for full workflows
- React component tests (optional)

For now, unit tests provide solid coverage of all business logic.
