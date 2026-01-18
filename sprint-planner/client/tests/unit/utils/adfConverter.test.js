/**
 * Tests for adfToMarkdown function
 * 
 * Extracted from InitiativesEpicsTab.jsx to utils/adfConverter.js
 * Testing the pure utility function (no React dependencies)
 */

import { adfToMarkdown } from '../../../src/utils/adfConverter.js';
import { adfSamples } from '../../fixtures/adfSamples.js';

describe('adfToMarkdown - Pure Utility Function', () => {
  
  describe('Edge Cases', () => {
    test('returns default message for null description', () => {
      expect(adfToMarkdown(null)).toBe('*No description*');
    });

    test('returns default message for undefined description', () => {
      expect(adfToMarkdown(undefined)).toBe('*No description*');
    });

    test('returns string description as-is', () => {
      expect(adfToMarkdown('Plain text string')).toBe('Plain text string');
    });

    test('returns empty message for doc with no content', () => {
      expect(adfToMarkdown(adfSamples.emptyDoc)).toBe('*Empty*');
    });

    test('returns empty message for doc without content property', () => {
      expect(adfToMarkdown(adfSamples.noContent)).toBe('*Empty*');
    });
  });

  describe('Simple Text', () => {
    test('converts simple paragraph to markdown', () => {
      const result = adfToMarkdown(adfSamples.simpleParagraph);
      expect(result).toBe('Hello world');
    });
  });

  describe('Formatted Text', () => {
    test('converts bold text to markdown', () => {
      const result = adfToMarkdown(adfSamples.boldText);
      expect(result).toBe('**Bold text**');
    });

    test('converts italic text to markdown', () => {
      const result = adfToMarkdown(adfSamples.italicText);
      expect(result).toBe('*Italic text*');
    });

    test('converts strikethrough text to markdown', () => {
      const result = adfToMarkdown(adfSamples.strikethrough);
      expect(result).toBe('~~Strikethrough~~');
    });

    test('converts inline code to markdown', () => {
      const result = adfToMarkdown(adfSamples.inlineCode);
      expect(result).toBe('`console.log()`');
    });
  });

  describe('Links', () => {
    test('converts link to markdown', () => {
      const result = adfToMarkdown(adfSamples.link);
      expect(result).toBe('[Click here](https://example.com)');
    });

    test('converts inlineCard to markdown link', () => {
      const result = adfToMarkdown(adfSamples.inlineCard);
      expect(result).toBe('[Link](https://example.com/page)');
    });
  });

  describe('Lists', () => {
    test('converts bullet list to markdown', () => {
      const result = adfToMarkdown(adfSamples.bulletList);
      expect(result).toContain('- Item 1');
      expect(result).toContain('- Item 2');
    });

    test('converts ordered list to markdown', () => {
      const result = adfToMarkdown(adfSamples.orderedList);
      expect(result).toContain('1. First');
      expect(result).toContain('2. Second');
    });
  });

  describe('Task Lists (Checkboxes)', () => {
    test('converts checked task to markdown checkbox', () => {
      const result = adfToMarkdown(adfSamples.taskList);
      expect(result).toContain('- [x] Completed task');
    });

    test('converts unchecked task to markdown checkbox', () => {
      const result = adfToMarkdown(adfSamples.taskList);
      expect(result).toContain('- [ ] Pending task');
    });
  });

  describe('Tables', () => {
    test('converts table to markdown', () => {
      const result = adfToMarkdown(adfSamples.table);
      
      // Should have header row
      expect(result).toContain('| Name | Age |');
      
      // Should have separator
      expect(result).toContain('| --- | --- |');
      
      // Should have data row
      expect(result).toContain('| John | 30 |');
    });
  });

  describe('Code Blocks', () => {
    test('converts code block to markdown', () => {
      const result = adfToMarkdown(adfSamples.codeBlock);
      
      expect(result).toContain('```javascript');
      expect(result).toContain('const x = 10;');
      expect(result).toContain('console.log(x);');
      expect(result).toContain('```');
    });
  });

  describe('Panels (Info Boxes)', () => {
    test('converts panel to markdown blockquote', () => {
      const result = adfToMarkdown(adfSamples.panel);
      
      expect(result).toContain('> **INFO**');
      expect(result).toContain('> Important information');
    });
  });

  describe('Special Content', () => {
    test('converts mention to @user format', () => {
      const result = adfToMarkdown(adfSamples.mention);
      expect(result).toContain('@john.doe');
    });

    test('converts date timestamp to readable format', () => {
      const result = adfToMarkdown(adfSamples.date);
      // Should contain a date in format like "Dec 20, 2021"
      expect(result).toMatch(/[A-Z][a-z]{2} \d{1,2}, \d{4}/);
    });

    test('converts emoji to text representation', () => {
      const result = adfToMarkdown(adfSamples.emoji);
      expect(result).toBe('👍');
    });
  });

  describe('Complex Mixed Content', () => {
    test('converts complex mixed document correctly', () => {
      const result = adfToMarkdown(adfSamples.complexMixed);
      
      // Should have paragraph with bold text
      expect(result).toContain('**complex**');
      
      // Should have completed checkbox
      expect(result).toContain('- [x] Task 1');
      
      // Should have unchecked checkbox
      expect(result).toContain('- [ ] Task 2');
      
      // Should have bullet list
      expect(result).toContain('- Point 1');
      expect(result).toContain('- Point 2');
      
      // Should have link
      expect(result).toContain('[link](https://example.com)');
      
      // Should have table
      expect(result).toContain('| Col 1 | Col 2 |');
      expect(result).toContain('| --- | --- |');
      expect(result).toContain('| Data 1 | Data 2 |');
    });
  });

  describe('Regression Tests (Real Jira Examples)', () => {
    test('handles Jira description with checkboxes, link, and table', () => {
      // This is based on the real example the user showed in conversation
      const jiraExample = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { state: 'DONE' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Complete setup' }] }]
              },
              {
                type: 'taskItem',
                attrs: { state: 'TODO' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Review code' }] }]
              }
            ]
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Check the ', marks: [] },
              { type: 'text', text: 'documentation', marks: [{ type: 'link', attrs: { href: 'https://docs.example.com' } }] }
            ]
          },
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step one' }] }]
              },
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step two' }] }]
              }
            ]
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Feature' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Status' }] }] }
                ]
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Auth' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done' }] }] }
                ]
              }
            ]
          }
        ]
      };

      const result = adfToMarkdown(jiraExample);

      // Verify all parts are converted
      expect(result).toContain('- [x] Complete setup');
      expect(result).toContain('- [ ] Review code');
      expect(result).toContain('[documentation](https://docs.example.com)');
      expect(result).toContain('1. Step one');
      expect(result).toContain('2. Step two');
      expect(result).toContain('| Feature | Status |');
      expect(result).toContain('| Auth | Done |');
    });
  });
});
