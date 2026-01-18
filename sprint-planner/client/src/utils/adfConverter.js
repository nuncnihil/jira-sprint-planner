/**
 * ADF (Atlassian Document Format) to Markdown Converter
 * 
 * Extracted from InitiativesEpicsTab.jsx (original lines 42-147)
 * 
 * Converts Jira ADF format to markdown for display
 * Handles: text, lists, tables, checkboxes, mentions, dates, emojis, panels, code blocks
 */

/**
 * Convert ADF to markdown for display
 * @param {Object|string|null} description - ADF object or plain text
 * @returns {string} Markdown formatted string
 */
export function adfToMarkdown(description) {
  if (!description) return '*No description*';
  if (typeof description === 'string') return description;
  if (!description.content || description.content.length === 0) return '*Empty*';
  
  const convertNode = (node, context = {}) => {
    if (!node) return '';
    
    switch (node.type) {
      case 'text':
        let text = node.text || '';
        if (node.marks) {
          node.marks.forEach(mark => {
            if (mark.type === 'strong') text = `**${text}**`;
            if (mark.type === 'em') text = `*${text}*`;
            if (mark.type === 'strike') text = `~~${text}~~`;
            if (mark.type === 'code') text = `\`${text}\``;
            if (mark.type === 'link') text = `[${text}](${mark.attrs?.href || ''})`;
          });
        }
        return text;
        
      case 'paragraph':
        return node.content ? node.content.map(n => convertNode(n, context)).join('') : '';
        
      case 'taskItem':
        const checked = node.attrs?.state === 'DONE' ? 'x' : ' ';
        const taskText = node.content ? node.content.map(n => convertNode(n, { inListItem: true })).join(' ') : '';
        return `- [${checked}] ${taskText}`;
        
      case 'taskList':
        return node.content ? node.content.map(n => convertNode(n, context)).join('\n') : '';
        
      case 'bulletList':
        return node.content ? node.content.map(n => {
          const text = convertNode(n, { inListItem: true });
          return `- ${text}`;
        }).join('\n') : '';
        
      case 'orderedList':
        return node.content ? node.content.map((n, idx) => {
          const text = convertNode(n, { inListItem: true });
          return `${idx + 1}. ${text}`;
        }).join('\n') : '';
        
      case 'listItem':
        return node.content ? node.content.map(n => convertNode(n, { inListItem: true })).join(' ') : '';
        
      case 'table':
        if (!node.content || node.content.length === 0) return '';
        const rows = node.content.map(row => convertNode(row, { inTable: true }));
        if (rows.length > 0 && node.content.length > 0) {
          const firstRowCellCount = node.content[0].content ? node.content[0].content.length : 0;
          const separator = '| ' + Array(firstRowCellCount).fill('---').join(' | ') + ' |';
          rows.splice(1, 0, separator);
        }
        return rows.join('\n');
        
      case 'tableRow':
        if (!node.content) return '';
        const cells = node.content.map(cell => convertNode(cell, { inTable: true }));
        return '| ' + cells.join(' | ') + ' |';
        
      case 'tableCell':
      case 'tableHeader':
        return node.content ? node.content.map(n => convertNode(n, { inTable: true })).join(' ').trim() : '';
        
      case 'panel':
        const panelType = node.attrs?.panelType || 'info';
        const panelContent = node.content ? node.content.map(n => convertNode(n, context)).join('\n') : '';
        return `> **${panelType.toUpperCase()}**\n> ${panelContent.split('\n').join('\n> ')}`;
        
      case 'codeBlock':
        const code = node.content ? node.content.map(n => convertNode(n, context)).join('') : '';
        const lang = node.attrs?.language || '';
        return `\`\`\`${lang}\n${code}\n\`\`\``;
        
      case 'inlineCard':
        const cardUrl = node.attrs?.url || '';
        return cardUrl ? `[Link](${cardUrl})` : '';
        
      case 'mention':
        return node.attrs?.text || '@user';
        
      case 'date':
        if (node.attrs?.timestamp) {
          const date = new Date(parseInt(node.attrs.timestamp));
          return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        return '';
        
      case 'emoji':
        if (node.attrs?.text) return node.attrs.text;
        if (node.attrs?.shortName) return `:${node.attrs.shortName}:`;
        return '';
        
      default:
        if (node.content) {
          return node.content.map(n => convertNode(n, context)).join('');
        }
        return '';
    }
  };

  return description.content.map(node => convertNode(node)).join('\n\n');
}

/**
 * Convert markdown to ADF (basic implementation for comments)
 * @param {string} markdown - Markdown text
 * @returns {Object} ADF object
 */
export function markdownToAdf(markdown) {
  // Basic implementation - just wrap in paragraph
  // This can be enhanced later for more complex markdown parsing
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: markdown
          }
        ]
      }
    ]
  };
}
