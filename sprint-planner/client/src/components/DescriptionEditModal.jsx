import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function DescriptionEditModal({ issue, onClose }) {
  const [description, setDescription] = useState('');
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Convert ADF to markdown for viewing
    try {
      if (issue.description) {
        if (typeof issue.description === 'string') {
          setDescription(issue.description);
        } else {
          // It's an ADF object - convert to markdown for display
          const plainText = adfToPlainText(issue.description);
          setDescription(plainText);
        }
      } else {
        setDescription('*No description*');
      }
    } catch (error) {
      setDescription('Error loading description');
    }
  }, [issue]);

  // ADF to markdown converter with proper formatting
  const adfToPlainText = (adf) => {
    if (!adf) return '';
    
    // If it's already a string, return it
    if (typeof adf === 'string') return adf;
    
    // If it's not an object with content, return empty
    if (!adf.content) return '';
    
    const convertNode = (node, context = {}) => {
      if (!node) return '';
      
      switch (node.type) {
        case 'text':
          let text = node.text || '';
          // Apply marks (bold, italic, strikethrough, etc.)
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
          const paraText = node.content ? node.content.map(n => convertNode(n, context)).join('') : '';
          // Don't add extra newline if inside a list item
          return context.inListItem ? paraText : paraText;
          
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
          
        case 'heading':
          const level = node.attrs?.level || 1;
          const headingText = node.content ? node.content.map(n => convertNode(n, context)).join('') : '';
          return `${'#'.repeat(level)} ${headingText}`;
          
        case 'codeBlock':
          const code = node.content ? node.content.map(n => convertNode(n, context)).join('') : '';
          const lang = node.attrs?.language || '';
          return `\`\`\`${lang}\n${code}\n\`\`\``;
          
        case 'table':
          if (!node.content || node.content.length === 0) return '';
          const rows = node.content.map(row => convertNode(row, { inTable: true }));
          // Add markdown table separator after first row (header)
          if (rows.length > 0 && node.content.length > 0) {
            // Count columns from first row's actual cell count
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
          // Info/warning/error panels - extract content
          const panelType = node.attrs?.panelType || 'info';
          const panelContent = node.content ? node.content.map(n => convertNode(n, context)).join('\n') : '';
          return `> **${panelType.toUpperCase()}**\n> ${panelContent.split('\n').join('\n> ')}`;
          
        case 'mediaSingle':
          // Media wrapper
          return node.content ? node.content.map(n => convertNode(n, context)).join('') : '';
          
        case 'media':
          const url = node.attrs?.url || node.attrs?.id || '';
          const alt = node.attrs?.alt || 'image';
          // If we have an ID but no URL, it's a Jira attachment
          if (!node.attrs?.url && node.attrs?.id) {
            return `![${alt}](attachment:${node.attrs.id})`;
          }
          return url ? `![${alt}](${url})` : '';
          
        case 'hardBreak':
          return '  \n'; // Two spaces + newline for markdown hard break
          
        case 'rule':
          return '---';
          
        case 'inlineCard':
          // Jira inline card (embedded link)
          const cardUrl = node.attrs?.url || '';
          return cardUrl ? `[Link](${cardUrl})` : '';
          
        case 'mention':
          // User mention - display as @username
          return node.attrs?.text || '@user';
          
        case 'date':
          // Date node - convert timestamp to readable format
          if (node.attrs?.timestamp) {
            const date = new Date(parseInt(node.attrs.timestamp));
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          }
          return '';
          
        case 'emoji':
          // Emoji node - try to get unicode or fallback to shortName
          if (node.attrs?.text) return node.attrs.text; // Unicode emoji
          if (node.attrs?.shortName) return `:${node.attrs.shortName}:`; // Fallback to :emoji:
          return '';
          
        default:
          // Recursively process content if present
          if (node.content) {
            return node.content.map(n => convertNode(n, context)).join('');
          }
          return '';
      }
    };

    return adf.content.map(node => convertNode(node)).join('\n\n');
  };

  // Convert plain text (with markdown-like syntax) back to ADF
  const plainTextToAdf = (text) => {
    if (!text || text.trim() === '') {
      return null;
    }

    const lines = text.split('\n');
    const content = [];
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      
      // Skip empty lines
      if (line.trim() === '') {
        i++;
        continue;
      }
      
      // Checkbox items: [x] or [ ]
      const checkboxMatch = line.match(/^\[([ x])\]\s*(.*)$/);
      if (checkboxMatch) {
        const tasks = [];
        while (i < lines.length && lines[i].match(/^\[([ x])\]/)) {
          const match = lines[i].match(/^\[([ x])\]\s*(.*)$/);
          tasks.push({
            type: 'taskItem',
            attrs: { state: match[1] === 'x' ? 'DONE' : 'TODO', localId: `task-${i}` },
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: match[2] }]
            }]
          });
          i++;
        }
        content.push({ type: 'taskList', attrs: { localId: `list-${i}` }, content: tasks });
        continue;
      }
      
      // Bullet list: • or -
      const bulletMatch = line.match(/^[•\-]\s+(.*)$/);
      if (bulletMatch) {
        const items = [];
        while (i < lines.length && lines[i].match(/^[•\-]\s+/)) {
          const match = lines[i].match(/^[•\-]\s+(.*)$/);
          items.push({
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: match[1] }]
            }]
          });
          i++;
        }
        content.push({ type: 'bulletList', content: items });
        continue;
      }
      
      // Numbered list: 1. 2. etc.
      const numberMatch = line.match(/^\d+\.\s+(.*)$/);
      if (numberMatch) {
        const items = [];
        while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
          const match = lines[i].match(/^\d+\.\s+(.*)$/);
          items.push({
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: match[1] }]
            }]
          });
          i++;
        }
        content.push({ type: 'orderedList', content: items });
        continue;
      }
      
      // Regular paragraph
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line }]
      });
      i++;
    }
    
    return {
      version: 1,
      type: 'doc',
      content: content.length > 0 ? content : [{ type: 'paragraph', content: [] }]
    };
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    
    setIsSaving(true);
    // TODO: Add API call to post comment to Jira
    setIsSaving(false);
    setComment('');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        width: '700px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Description</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
              {issue.key}: {issue.summary}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              width: '30px',
              height: '30px'
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: '20px',
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Description (read-only) */}
          <div>
            <div style={{
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              padding: '16px',
              backgroundColor: '#fafafa',
              maxHeight: '300px',
              overflow: 'auto',
              lineHeight: '1.6',
              fontSize: '14px'
            }} className="markdown-view">
              <style>{`
                .markdown-view table {
                  border-collapse: collapse;
                  margin: 12px 0;
                  width: auto;
                }
                .markdown-view table td,
                .markdown-view table th {
                  border: 1px solid #ddd;
                  padding: 8px 12px;
                }
                .markdown-view table th {
                  background-color: #f0f0f0;
                  font-weight: bold;
                }
                .markdown-view ul {
                  list-style-type: none;
                  padding-left: 0;
                }
                .markdown-view li {
                  margin: 6px 0;
                }
                .markdown-view li input[type="checkbox"] {
                  margin-right: 8px;
                }
                .markdown-view blockquote {
                  border-left: 4px solid #0052cc;
                  padding-left: 12px;
                  margin: 12px 0;
                  background-color: #deebff;
                  padding: 8px 12px;
                }
                .markdown-view code {
                  background-color: #f4f5f7;
                  padding: 2px 6px;
                  border-radius: 3px;
                  font-family: monospace;
                  font-size: 13px;
                }
                .markdown-view pre {
                  background-color: #f4f5f7;
                  padding: 12px;
                  border-radius: 4px;
                  overflow-x: auto;
                }
                .markdown-view pre code {
                  background: none;
                  padding: 0;
                }
                .markdown-view a {
                  color: #0052cc;
                  text-decoration: none;
                }
                .markdown-view a:hover {
                  text-decoration: underline;
                }
                .markdown-view img {
                  max-width: 100%;
                  height: auto;
                  margin: 12px 0;
                }
                .markdown-view h1, .markdown-view h2, .markdown-view h3 {
                  margin-top: 16px;
                  margin-bottom: 8px;
                }
              `}</style>
              <Markdown remarkPlugins={[remarkGfm]}>{description}</Markdown>
            </div>
          </div>

          {/* Comment Section */}
          <div>
            <label style={{ 
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              Add Comment
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comment feature coming in V1.1 - For now, add comments directly in Jira"
              disabled={true}
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '12px',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                backgroundColor: '#f5f5f5',
                color: '#666',
                cursor: 'not-allowed'
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            disabled={isSaving}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            Close
          </button>
          <button
            onClick={handleAddComment}
            disabled={true}
            style={{
              padding: '8px 20px',
              backgroundColor: '#ccc',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'not-allowed',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            Add Comment (V1.1)
          </button>
        </div>
      </div>
    </div>
  );
}

DescriptionEditModal.propTypes = {
  issue: PropTypes.shape({
    key: PropTypes.string.isRequired,
    summary: PropTypes.string.isRequired,
    description: PropTypes.oneOfType([PropTypes.object, PropTypes.string])
  }).isRequired,
  onClose: PropTypes.func.isRequired
};

export default DescriptionEditModal;
