/**
 * Unit tests for snapshot.js
 * Tests file I/O operations for snapshot persistence
 */

// Mock fs module completely
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
  unlinkSync: jest.fn()
}));

// Import mocked modules
const fs = require('fs');
const path = require('path');
const {
  saveSnapshot,
  loadSnapshot,
  deleteSnapshot
} = require('../../snapshot');

describe('snapshot.js - File I/O Operations', () => {
  
  const SNAPSHOT_DIR = path.join(__dirname, '../../.data');
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date.now() to return consistent timestamp for testing
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-01-16T10:30:00.000Z');
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  // ============================================================================
  // saveSnapshot()
  // ============================================================================
  
  describe('saveSnapshot()', () => {
    
    test('saves snapshot to file with timestamp', () => {
      const testData = {
        sprints: [{ id: 1, name: 'Sprint 1' }],
        backlog: [],
        initiatives: []
      };
      
      const result = saveSnapshot(testData);
      
      expect(result).toBe('snapshot-2026-01-16T10-30-00-000Z.json');
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      
      const expectedPath = path.join(SNAPSHOT_DIR, 'snapshot-2026-01-16T10-30-00-000Z.json');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedPath,
        expect.any(String)
      );
    });
    
    test('adds createdAt metadata to snapshot', () => {
      const testData = {
        sprints: [],
        backlog: []
      };
      
      saveSnapshot(testData);
      
      const writeCall = fs.writeFileSync.mock.calls[0];
      const savedData = JSON.parse(writeCall[1]);
      
      expect(savedData).toHaveProperty('createdAt', '2026-01-16T10:30:00.000Z');
      expect(savedData).toHaveProperty('sprints', []);
      expect(savedData).toHaveProperty('backlog', []);
    });
    
    test('preserves all original data fields', () => {
      const testData = {
        sprints: [{ id: 36, name: 'Sprint 1' }],
        backlog: [{ key: 'SP-100' }],
        initiatives: [{ key: 'SP-1', name: 'Init 1' }],
        eeConfig: { initiativeKey: 'SP-2' },
        boardId: 123,
        customField: 'preserved'
      };
      
      saveSnapshot(testData);
      
      const writeCall = fs.writeFileSync.mock.calls[0];
      const savedData = JSON.parse(writeCall[1]);
      
      expect(savedData.sprints).toEqual(testData.sprints);
      expect(savedData.backlog).toEqual(testData.backlog);
      expect(savedData.initiatives).toEqual(testData.initiatives);
      expect(savedData.eeConfig).toEqual(testData.eeConfig);
      expect(savedData.boardId).toBe(123);
      expect(savedData.customField).toBe('preserved');
    });
    
    test('formats JSON with 2-space indentation', () => {
      const testData = { sprints: [], backlog: [] };
      
      saveSnapshot(testData);
      
      const writeCall = fs.writeFileSync.mock.calls[0];
      const jsonString = writeCall[1];
      
      // Check for pretty-printing (should have newlines and spaces)
      expect(jsonString).toContain('\n');
      expect(jsonString).toContain('  ');
    });
    
    test('handles empty snapshot data', () => {
      const testData = {};
      
      const result = saveSnapshot(testData);
      
      expect(result).toBe('snapshot-2026-01-16T10-30-00-000Z.json');
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      
      const writeCall = fs.writeFileSync.mock.calls[0];
      const savedData = JSON.parse(writeCall[1]);
      
      expect(savedData).toHaveProperty('createdAt');
    });
    
    test('handles snapshot with nested data structures', () => {
      const testData = {
        sprints: [
          {
            id: 36,
            name: 'Sprint 1',
            issues: [
              {
                key: 'SP-100',
                summary: 'Task 1',
                description: { type: 'doc', content: [] }
              }
            ]
          }
        ]
      };
      
      saveSnapshot(testData);
      
      const writeCall = fs.writeFileSync.mock.calls[0];
      const savedData = JSON.parse(writeCall[1]);
      
      expect(savedData.sprints[0].issues[0].description).toEqual({ type: 'doc', content: [] });
    });
    
    test('returns only filename without directory path', () => {
      const result = saveSnapshot({ test: 'data' });
      
      expect(result).not.toContain('/');
      expect(result).not.toContain('\\');
      expect(result).toMatch(/^snapshot-.*\.json$/);
    });
    
  });
  
  // ============================================================================
  // loadSnapshot()
  // ============================================================================
  
  describe('loadSnapshot()', () => {
    
    test('loads most recent snapshot file', () => {
      fs.readdirSync.mockReturnValue([
        'snapshot-2026-01-15T10-00-00-000Z.json',
        'snapshot-2026-01-16T10-00-00-000Z.json', // Most recent
        'snapshot-2026-01-14T10-00-00-000Z.json',
        'other-file.json'
      ]);
      
      const snapshotData = {
        sprints: [{ id: 36 }],
        createdAt: '2026-01-16T10:00:00.000Z'
      };
      
      fs.readFileSync.mockReturnValue(JSON.stringify(snapshotData));
      
      const result = loadSnapshot();
      
      expect(result).toEqual(snapshotData);
      expect(fs.readdirSync).toHaveBeenCalledWith(SNAPSHOT_DIR);
      
      const expectedPath = path.join(SNAPSHOT_DIR, 'snapshot-2026-01-16T10-00-00-000Z.json');
      expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf8');
    });
    
    test('returns null when no snapshot files exist', () => {
      fs.readdirSync.mockReturnValue([
        'other-file.json',
        'README.md'
      ]);
      
      const result = loadSnapshot();
      
      expect(result).toBeNull();
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });
    
    test('returns null when directory is empty', () => {
      fs.readdirSync.mockReturnValue([]);
      
      const result = loadSnapshot();
      
      expect(result).toBeNull();
    });
    
    test('filters non-snapshot files correctly', () => {
      fs.readdirSync.mockReturnValue([
        'snapshot-2026-01-16T10-00-00-000Z.json', // Valid
        'backup-snapshot.json',                    // Invalid (no prefix match)
        'snapshot-old.txt',                        // Invalid (wrong extension)
        '.DS_Store',                               // Invalid
        'data.json'                                // Invalid
      ]);
      
      const snapshotData = { sprints: [] };
      fs.readFileSync.mockReturnValue(JSON.stringify(snapshotData));
      
      const result = loadSnapshot();
      
      expect(result).toEqual(snapshotData);
      
      // Should only read the valid snapshot file
      const expectedPath = path.join(SNAPSHOT_DIR, 'snapshot-2026-01-16T10-00-00-000Z.json');
      expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf8');
    });
    
    test('sorts files and loads most recent (reverse alphabetical)', () => {
      fs.readdirSync.mockReturnValue([
        'snapshot-2026-01-10T10-00-00-000Z.json',
        'snapshot-2026-01-20T10-00-00-000Z.json', // Most recent
        'snapshot-2026-01-15T10-00-00-000Z.json'
      ]);
      
      const snapshotData = { date: '2026-01-20' };
      fs.readFileSync.mockReturnValue(JSON.stringify(snapshotData));
      
      loadSnapshot();
      
      const expectedPath = path.join(SNAPSHOT_DIR, 'snapshot-2026-01-20T10-00-00-000Z.json');
      expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf8');
    });
    
    test('parses JSON correctly', () => {
      fs.readdirSync.mockReturnValue(['snapshot-2026-01-16T10-00-00-000Z.json']);
      
      const complexData = {
        sprints: [
          {
            id: 36,
            name: 'Sprint 1',
            issues: [
              { key: 'SP-100', storyPoints: 5 }
            ]
          }
        ],
        backlog: [],
        initiatives: [
          {
            key: 'SP-1',
            name: 'Initiative 1',
            epics: [{ key: 'SP-10' }]
          }
        ],
        eeConfig: { initiativeKey: 'SP-2', epicKey: 'SP-20' },
        createdAt: '2026-01-16T10:00:00.000Z'
      };
      
      fs.readFileSync.mockReturnValue(JSON.stringify(complexData));
      
      const result = loadSnapshot();
      
      expect(result).toEqual(complexData);
      expect(result.sprints).toHaveLength(1);
      expect(result.sprints[0].issues).toHaveLength(1);
      expect(result.initiatives[0].epics).toHaveLength(1);
    });
    
    test('handles snapshot with only metadata', () => {
      fs.readdirSync.mockReturnValue(['snapshot-2026-01-16T10-00-00-000Z.json']);
      
      const minimalData = {
        createdAt: '2026-01-16T10:00:00.000Z'
      };
      
      fs.readFileSync.mockReturnValue(JSON.stringify(minimalData));
      
      const result = loadSnapshot();
      
      expect(result).toEqual(minimalData);
    });
    
    test('handles snapshot file with unicode characters', () => {
      fs.readdirSync.mockReturnValue(['snapshot-2026-01-16T10-00-00-000Z.json']);
      
      const dataWithUnicode = {
        sprints: [
          { id: 1, name: 'Sprint 1 🚀' }
        ],
        initiatives: [
          { key: 'SP-1', name: 'Amélioration' }
        ]
      };
      
      fs.readFileSync.mockReturnValue(JSON.stringify(dataWithUnicode));
      
      const result = loadSnapshot();
      
      expect(result.sprints[0].name).toBe('Sprint 1 🚀');
      expect(result.initiatives[0].name).toBe('Amélioration');
    });
    
  });
  
  // ============================================================================
  // deleteSnapshot()
  // ============================================================================
  
  describe('deleteSnapshot()', () => {
    
    test('deletes most recent snapshot file', () => {
      fs.readdirSync.mockReturnValue([
        'snapshot-2026-01-15T10-00-00-000Z.json',
        'snapshot-2026-01-16T10-00-00-000Z.json', // Most recent - should be deleted
        'snapshot-2026-01-14T10-00-00-000Z.json'
      ]);
      
      const result = deleteSnapshot();
      
      expect(result).toBe(true);
      expect(fs.readdirSync).toHaveBeenCalledWith(SNAPSHOT_DIR);
      
      const expectedPath = path.join(SNAPSHOT_DIR, 'snapshot-2026-01-16T10-00-00-000Z.json');
      expect(fs.unlinkSync).toHaveBeenCalledWith(expectedPath);
      expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    });
    
    test('returns false when no snapshot files exist', () => {
      fs.readdirSync.mockReturnValue([
        'other-file.json',
        'README.md'
      ]);
      
      const result = deleteSnapshot();
      
      expect(result).toBe(false);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
    
    test('returns false when directory is empty', () => {
      fs.readdirSync.mockReturnValue([]);
      
      const result = deleteSnapshot();
      
      expect(result).toBe(false);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
    
    test('filters and deletes only valid snapshot files', () => {
      fs.readdirSync.mockReturnValue([
        'snapshot-2026-01-16T10-00-00-000Z.json', // Valid - should be deleted
        'backup-snapshot.json',                    // Invalid
        'snapshot-old.txt',                        // Invalid
        '.DS_Store'                                // Invalid
      ]);
      
      const result = deleteSnapshot();
      
      expect(result).toBe(true);
      
      const expectedPath = path.join(SNAPSHOT_DIR, 'snapshot-2026-01-16T10-00-00-000Z.json');
      expect(fs.unlinkSync).toHaveBeenCalledWith(expectedPath);
      expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    });
    
    test('sorts files and deletes most recent (reverse alphabetical)', () => {
      fs.readdirSync.mockReturnValue([
        'snapshot-2026-01-10T10-00-00-000Z.json',
        'snapshot-2026-01-20T10-00-00-000Z.json', // Most recent
        'snapshot-2026-01-15T10-00-00-000Z.json'
      ]);
      
      deleteSnapshot();
      
      const expectedPath = path.join(SNAPSHOT_DIR, 'snapshot-2026-01-20T10-00-00-000Z.json');
      expect(fs.unlinkSync).toHaveBeenCalledWith(expectedPath);
    });
    
    test('deletes only one file (most recent)', () => {
      fs.readdirSync.mockReturnValue([
        'snapshot-2026-01-15T10-00-00-000Z.json',
        'snapshot-2026-01-16T10-00-00-000Z.json',
        'snapshot-2026-01-17T10-00-00-000Z.json'  // Most recent
      ]);
      
      deleteSnapshot();
      
      // Should only delete once
      expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
      
      const expectedPath = path.join(SNAPSHOT_DIR, 'snapshot-2026-01-17T10-00-00-000Z.json');
      expect(fs.unlinkSync).toHaveBeenCalledWith(expectedPath);
    });
    
    test('handles single snapshot file', () => {
      fs.readdirSync.mockReturnValue([
        'snapshot-2026-01-16T10-00-00-000Z.json'
      ]);
      
      const result = deleteSnapshot();
      
      expect(result).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    });
    
  });
  
  // ============================================================================
  // Integration Scenarios
  // ============================================================================
  
  describe('Integration scenarios', () => {
    
    test('save-then-load workflow', () => {
      const testData = {
        sprints: [{ id: 36, name: 'Sprint 1' }],
        backlog: [{ key: 'SP-100' }]
      };
      
      // Save
      const filename = saveSnapshot(testData);
      expect(filename).toBe('snapshot-2026-01-16T10-30-00-000Z.json');
      
      // Setup for load
      fs.readdirSync.mockReturnValue([filename]);
      const writeCall = fs.writeFileSync.mock.calls[0];
      fs.readFileSync.mockReturnValue(writeCall[1]); // Return what was written
      
      // Load
      const loaded = loadSnapshot();
      
      expect(loaded.sprints).toEqual(testData.sprints);
      expect(loaded.backlog).toEqual(testData.backlog);
      expect(loaded).toHaveProperty('createdAt');
    });
    
    test('save-then-delete workflow', () => {
      const testData = { test: 'data' };
      
      // Save
      const filename = saveSnapshot(testData);
      
      // Setup for delete
      fs.readdirSync.mockReturnValue([filename]);
      
      // Delete
      const deleted = deleteSnapshot();
      
      expect(deleted).toBe(true);
      
      const expectedPath = path.join(SNAPSHOT_DIR, filename);
      expect(fs.unlinkSync).toHaveBeenCalledWith(expectedPath);
    });
    
    test('multiple saves create different filenames', () => {
      jest.spyOn(Date.prototype, 'toISOString')
        .mockReturnValueOnce('2026-01-16T10-00-00-000Z')
        .mockReturnValueOnce('2026-01-16T10-00-00-000Z')
        .mockReturnValueOnce('2026-01-16T11-00-00-000Z')
        .mockReturnValueOnce('2026-01-16T11-00-00-000Z');
      
      const filename1 = saveSnapshot({ version: 1 });
      const filename2 = saveSnapshot({ version: 2 });
      
      expect(filename1).toBe('snapshot-2026-01-16T10-00-00-000Z.json');
      expect(filename2).toBe('snapshot-2026-01-16T11-00-00-000Z.json');
      expect(filename1).not.toBe(filename2);
    });
    
  });
  
});
