/**
 * Sample ADF (Atlassian Document Format) objects for testing
 * These represent real-world Jira description formats
 */

export const adfSamples = {
  // Simple text
  simpleParagraph: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello world' }]
    }]
  },

  // Formatted text
  boldText: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'Bold text',
        marks: [{ type: 'strong' }]
      }]
    }]
  },

  italicText: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'Italic text',
        marks: [{ type: 'em' }]
      }]
    }]
  },

  strikethrough: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'Strikethrough',
        marks: [{ type: 'strike' }]
      }]
    }]
  },

  inlineCode: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'console.log()',
        marks: [{ type: 'code' }]
      }]
    }]
  },

  // Link
  link: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'Click here',
        marks: [{ type: 'link', attrs: { href: 'https://example.com' } }]
      }]
    }]
  },

  // Lists
  bulletList: {
    type: 'doc',
    content: [{
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }]
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }]
        }
      ]
    }]
  },

  orderedList: {
    type: 'doc',
    content: [{
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }]
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }]
        }
      ]
    }]
  },

  // Task list (checkboxes)
  taskList: {
    type: 'doc',
    content: [{
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { state: 'DONE' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Completed task' }] }]
        },
        {
          type: 'taskItem',
          attrs: { state: 'TODO' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pending task' }] }]
        }
      ]
    }]
  },

  // Table
  table: {
    type: 'doc',
    content: [{
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Age' }] }] }
          ]
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'John' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '30' }] }] }
          ]
        }
      ]
    }]
  },

  // Code block
  codeBlock: {
    type: 'doc',
    content: [{
      type: 'codeBlock',
      attrs: { language: 'javascript' },
      content: [{ type: 'text', text: 'const x = 10;\nconsole.log(x);' }]
    }]
  },

  // Panel (info box)
  panel: {
    type: 'doc',
    content: [{
      type: 'panel',
      attrs: { panelType: 'info' },
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Important information' }]
      }]
    }]
  },

  // Inline card (link)
  inlineCard: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{
        type: 'inlineCard',
        attrs: { url: 'https://example.com/page' }
      }]
    }]
  },

  // Mention
  mention: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{
        type: 'mention',
        attrs: { text: '@john.doe' }
      }]
    }]
  },

  // Date
  date: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{
        type: 'date',
        attrs: { timestamp: '1640000000000' }
      }]
    }]
  },

  // Emoji
  emoji: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{
        type: 'emoji',
        attrs: { text: '👍', shortName: 'thumbsup' }
      }]
    }]
  },

  // Edge cases
  nullDescription: null,
  stringDescription: 'Plain text string',
  emptyDoc: {
    type: 'doc',
    content: []
  },
  noContent: {
    type: 'doc'
  },

  // Complex mixed content (like real Jira)
  complexMixed: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'This is a ', marks: [] }, { type: 'text', text: 'complex', marks: [{ type: 'strong' }] }, { type: 'text', text: ' example' }]
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { state: 'DONE' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task 1' }] }]
          },
          {
            type: 'taskItem',
            attrs: { state: 'TODO' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task 2' }] }]
          }
        ]
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Point 1' }] }]
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Point 2 with ', marks: [] }, { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }] }]
          }
        ]
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 1' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 2' }] }] }
            ]
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Data 1' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Data 2' }] }] }
            ]
          }
        ]
      }
    ]
  }
};
