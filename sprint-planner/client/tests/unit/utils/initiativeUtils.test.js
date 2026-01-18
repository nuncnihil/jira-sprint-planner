/**
 * Tests for initiative utilities
 * 
 * Testing buildEpicToInitiativeMap() which builds a map of epicKey → initiativeName
 */

import { buildEpicToInitiativeMap } from '../../../src/utils/initiativeUtils.js';

describe('initiativeUtils', () => {
  
  describe('buildEpicToInitiativeMap()', () => {
    
    test('builds map from initiatives with epics', () => {
      const initiatives = [
        {
          key: 'INIT-1',
          name: 'Platform Modernization',
          epics: [
            { key: 'EPIC-10', name: 'API Refactor' },
            { key: 'EPIC-11', name: 'Database Migration' }
          ]
        },
        {
          key: 'INIT-2',
          name: 'Customer Experience',
          epics: [
            { key: 'EPIC-20', name: 'New Dashboard' },
            { key: 'EPIC-21', name: 'Mobile App' }
          ]
        }
      ];
      
      const result = buildEpicToInitiativeMap(initiatives);
      
      expect(result).toEqual({
        'EPIC-10': 'Platform Modernization',
        'EPIC-11': 'Platform Modernization',
        'EPIC-20': 'Customer Experience',
        'EPIC-21': 'Customer Experience'
      });
    });
    
    test('handles empty initiatives array', () => {
      const initiatives = [];
      
      const result = buildEpicToInitiativeMap(initiatives);
      
      expect(result).toEqual({});
    });
    
    test('handles initiatives with no epics property', () => {
      const initiatives = [
        {
          key: 'INIT-1',
          name: 'Platform Modernization'
          // No epics property
        },
        {
          key: 'INIT-2',
          name: 'Customer Experience',
          epics: [
            { key: 'EPIC-20', name: 'New Dashboard' }
          ]
        }
      ];
      
      const result = buildEpicToInitiativeMap(initiatives);
      
      expect(result).toEqual({
        'EPIC-20': 'Customer Experience'
      });
    });
    
    test('handles initiatives with empty epics array', () => {
      const initiatives = [
        {
          key: 'INIT-1',
          name: 'Platform Modernization',
          epics: []
        },
        {
          key: 'INIT-2',
          name: 'Customer Experience',
          epics: [
            { key: 'EPIC-20', name: 'New Dashboard' }
          ]
        }
      ];
      
      const result = buildEpicToInitiativeMap(initiatives);
      
      expect(result).toEqual({
        'EPIC-20': 'Customer Experience'
      });
    });
    
    test('handles initiatives with null epics', () => {
      const initiatives = [
        {
          key: 'INIT-1',
          name: 'Platform Modernization',
          epics: null
        },
        {
          key: 'INIT-2',
          name: 'Customer Experience',
          epics: [
            { key: 'EPIC-20', name: 'New Dashboard' }
          ]
        }
      ];
      
      const result = buildEpicToInitiativeMap(initiatives);
      
      expect(result).toEqual({
        'EPIC-20': 'Customer Experience'
      });
    });
    
    test('handles single initiative with single epic', () => {
      const initiatives = [
        {
          key: 'INIT-1',
          name: 'Quick Win',
          epics: [
            { key: 'EPIC-1', name: 'Solo Epic' }
          ]
        }
      ];
      
      const result = buildEpicToInitiativeMap(initiatives);
      
      expect(result).toEqual({
        'EPIC-1': 'Quick Win'
      });
    });
    
    test('handles initiatives with many epics', () => {
      const initiatives = [
        {
          key: 'INIT-1',
          name: 'Large Initiative',
          epics: [
            { key: 'EPIC-1', name: 'Epic 1' },
            { key: 'EPIC-2', name: 'Epic 2' },
            { key: 'EPIC-3', name: 'Epic 3' },
            { key: 'EPIC-4', name: 'Epic 4' },
            { key: 'EPIC-5', name: 'Epic 5' }
          ]
        }
      ];
      
      const result = buildEpicToInitiativeMap(initiatives);
      
      expect(result).toEqual({
        'EPIC-1': 'Large Initiative',
        'EPIC-2': 'Large Initiative',
        'EPIC-3': 'Large Initiative',
        'EPIC-4': 'Large Initiative',
        'EPIC-5': 'Large Initiative'
      });
    });
    
    test('preserves epic key casing and special characters', () => {
      const initiatives = [
        {
          key: 'INIT-1',
          name: 'Special Keys',
          epics: [
            { key: 'EPIC-ABC', name: 'Uppercase' },
            { key: 'epic-xyz', name: 'Lowercase' },
            { key: 'PROJ-123', name: 'Different prefix' },
            { key: 'SP_10', name: 'Underscore' }
          ]
        }
      ];
      
      const result = buildEpicToInitiativeMap(initiatives);
      
      expect(result).toEqual({
        'EPIC-ABC': 'Special Keys',
        'epic-xyz': 'Special Keys',
        'PROJ-123': 'Special Keys',
        'SP_10': 'Special Keys'
      });
    });
    
    test('handles real-world Jira snapshot structure', () => {
      // Based on baseSnapshot from fixtures
      const initiatives = [
        {
          key: 'SP-1',
          name: 'Initiative 1',
          epics: [
            { key: 'SP-10', name: 'Epic 1' },
            { key: 'SP-11', name: 'Epic 2' }
          ]
        },
        {
          key: 'SP-2',
          name: 'Engineering Excellence',
          epics: [
            { key: 'SP-20', name: 'EE Epic' }
          ]
        }
      ];
      
      const result = buildEpicToInitiativeMap(initiatives);
      
      expect(result).toEqual({
        'SP-10': 'Initiative 1',
        'SP-11': 'Initiative 1',
        'SP-20': 'Engineering Excellence'
      });
    });
    
    test('last initiative wins if same epic key appears twice (edge case)', () => {
      // This shouldn't happen in practice, but testing the behavior
      const initiatives = [
        {
          key: 'INIT-1',
          name: 'First Initiative',
          epics: [
            { key: 'EPIC-DUP', name: 'Epic A' }
          ]
        },
        {
          key: 'INIT-2',
          name: 'Second Initiative',
          epics: [
            { key: 'EPIC-DUP', name: 'Epic B' }
          ]
        }
      ];
      
      const result = buildEpicToInitiativeMap(initiatives);
      
      // Second occurrence should overwrite first
      expect(result['EPIC-DUP']).toBe('Second Initiative');
    });
    
    test('handles initiatives with undefined epics property gracefully', () => {
      const initiatives = [
        {
          key: 'INIT-1',
          name: 'No Epics'
          // epics is undefined
        }
      ];
      
      const result = buildEpicToInitiativeMap(initiatives);
      
      expect(result).toEqual({});
    });
    
    test('does not mutate input initiatives array', () => {
      const initiatives = [
        {
          key: 'INIT-1',
          name: 'Platform Modernization',
          epics: [
            { key: 'EPIC-10', name: 'API Refactor' }
          ]
        }
      ];
      
      const originalJSON = JSON.stringify(initiatives);
      
      buildEpicToInitiativeMap(initiatives);
      
      expect(JSON.stringify(initiatives)).toBe(originalJSON);
    });
    
  });
  
});
