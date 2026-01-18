import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { adfToMarkdown } from '../utils/adfConverter.js';

function InitiativesEpicsTab({ initiatives, sprints, backlog }) {
  // Initialize collapsed state: initiatives open (not in map), epics closed (in map)
  const [collapsed, setCollapsed] = useState(() => {
    const initial = {};
    initiatives.forEach(initiative => {
      initiative.epics.forEach(epic => {
        initial[`epic-${epic.key}`] = true; // Epics start collapsed
      });
    });
    return initial;
  });
  
  const [hoveredIssue, setHoveredIssue] = useState(null);
  const [expandedIssue, setExpandedIssue] = useState(null); // Track which issue's description is expanded
  const [comment, setComment] = useState('');

  const toggleCollapse = (id) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleDescription = (issueKey) => {
    // Close previous, open new (or close if clicking same issue)
    setExpandedIssue(prev => prev === issueKey ? null : issueKey);
    setComment(''); // Reset comment when toggling
  };

  const handleAddComment = (issueKey) => {
    if (!comment.trim()) return;
    
    // TODO: Add API call to post comment to Jira
    
    setComment('');
    setExpandedIssue(null); // Close after adding comment
  };

  // Build a map of issue key -> sprint/backlog location
  const issueLocationMap = {};
  sprints.forEach(sprint => {
    sprint.issues.forEach(issue => {
      issueLocationMap[issue.key] = { type: 'sprint', name: sprint.name, state: sprint.state };
    });
  });
  backlog.forEach(issue => {
    issueLocationMap[issue.key] = { type: 'backlog', name: 'Backlog' };
  });

  // Build a map of issue key -> issue details
  const issueDetailsMap = {};
  sprints.forEach(sprint => {
    sprint.issues.forEach(issue => {
      issueDetailsMap[issue.key] = issue;
    });
  });
  backlog.forEach(issue => {
    issueDetailsMap[issue.key] = issue;
  });

  // Collect unassigned issues (no epic)
  const unassignedIssues = [];
  sprints.forEach(sprint => {
    sprint.issues.forEach(issue => {
      if (!issue.epicKey) {
        unassignedIssues.push(issue);
      }
    });
  });
  backlog.forEach(issue => {
    if (!issue.epicKey) {
      unassignedIssues.push(issue);
    }
  });

  const calculateTotalPoints = (issues) => {
    return issues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
  };

  const renderIssue = (issue) => {
    const location = issueLocationMap[issue.key];
    const locationColor = location?.type === 'sprint' 
      ? (location.state === 'active' ? '#e8e8e8' : '#f0f0f0')
      : '#f5f5f5';
    const locationBorder = location?.type === 'sprint'
      ? (location.state === 'active' ? '#999' : '#bbb')
      : '#ccc';
    
    const isHovered = hoveredIssue === issue.key;
    const isExpanded = expandedIssue === issue.key;

    return (
      <div key={issue.key}>
        {/* Issue Row */}
        <div 
          onMouseEnter={() => setHoveredIssue(issue.key)}
          onMouseLeave={() => setHoveredIssue(null)}
          onClick={() => toggleDescription(issue.key)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 12px',
            margin: '3px 0',
            background: isExpanded ? '#e3f2fd' : (isHovered ? '#bbdefb' : '#ffffff'),
            border: isExpanded ? '2px solid #1976d2' : '1px solid #d0d0d0',
            borderRadius: '3px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'background 0.2s, border 0.2s'
          }}
        >
          <span style={{ width: '90px', fontWeight: 'bold', color: '#555', fontSize: '11px' }}>
            {issue.key}
          </span>
          <span style={{ flex: 1, marginRight: '12px', fontSize: '11px' }}>
            {issue.summary}
          </span>
          <span style={{ 
            width: '120px', 
            marginRight: '12px',
            padding: '2px 6px',
            backgroundColor: locationColor,
            border: `1px solid ${locationBorder}`,
            borderRadius: '2px',
            fontSize: '10px',
            textAlign: 'center'
          }}>
            {location?.name || 'Unknown'}
          </span>
          <span style={{ 
            width: '50px', 
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '11px',
            color: issue.storyPoints ? '#333' : '#999'
          }}>
            {issue.storyPoints || '-'}
          </span>
        </div>

        {/* Expanded Description & Comment */}
        {isExpanded && (
          <div style={{
            marginLeft: '20px',
            marginTop: '8px',
            marginBottom: '12px',
            padding: '16px',
            backgroundColor: '#f9f9f9',
            border: '2px solid #1976d2',
            borderRadius: '6px'
          }}>
            {/* Description */}
            <div style={{
              marginBottom: '16px',
              maxHeight: '300px',
              overflow: 'auto',
              padding: '12px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              fontSize: '13px',
              lineHeight: '1.6'
            }} className="markdown-inline">
              <strong style={{ display: 'block', marginBottom: '8px', color: '#333' }}>Description:</strong>
              <Markdown remarkPlugins={[remarkGfm]}>
                {adfToMarkdown(issue.description)}
              </Markdown>
            </div>

            {/* Comment Box */}
            <div>
              <label style={{ 
                display: 'block',
                marginBottom: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                Add Comment:
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Comment feature coming in V1.1 - For now, add comments directly in Jira"
                disabled={true}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  backgroundColor: '#f5f5f5',
                  color: '#666',
                  cursor: 'not-allowed'
                }}
              />
              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => toggleDescription(issue.key)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#f5f5f5',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Close
                </button>
                <button
                  onClick={() => handleAddComment(issue.key)}
                  disabled={true}
                  style={{
                    padding: '6px 16px',
                    backgroundColor: '#ccc',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'not-allowed',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  Add Comment (V1.1)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEpic = (epic, initiativeKey) => {
    const isCollapsed = collapsed[`epic-${epic.key}`];
    const epicIssues = epic.issueKeys.map(key => issueDetailsMap[key]).filter(Boolean);
    const totalPoints = calculateTotalPoints(epicIssues);

    return (
      <div key={epic.key} style={{ marginLeft: '20px', marginBottom: '8px' }}>
        <div 
          onClick={() => toggleCollapse(`epic-${epic.key}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: '#e8e8e8',
            border: '2px solid #999',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '13px'
          }}
        >
          <span>
            {isCollapsed ? '▶' : '▼'} {epic.name}
          </span>
          <span style={{ fontSize: '12px', color: '#555' }}>
            {epicIssues.length} issues - {totalPoints} pts
          </span>
        </div>
        
        {!isCollapsed && (
          <div style={{ padding: '8px 0', marginLeft: '20px' }}>
            {epicIssues.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#999', fontSize: '11px' }}>
                No issues in this epic
              </div>
            ) : (
              epicIssues.map(renderIssue)
            )}
          </div>
        )}
      </div>
    );
  };

  const renderInitiative = (initiative) => {
    const isCollapsed = collapsed[`initiative-${initiative.key}`];
    
    // Calculate total points across all epics
    let totalIssues = 0;
    let totalPoints = 0;
    initiative.epics.forEach(epic => {
      const epicIssues = epic.issueKeys.map(key => issueDetailsMap[key]).filter(Boolean);
      totalIssues += epicIssues.length;
      totalPoints += calculateTotalPoints(epicIssues);
    });

    return (
      <div key={initiative.key} style={{ marginBottom: '16px' }}>
        <div 
          onClick={() => toggleCollapse(`initiative-${initiative.key}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            backgroundColor: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          <span>
            {isCollapsed ? '▶' : '▼'} {initiative.name}
          </span>
          <span style={{ fontSize: '13px', color: '#333' }}>
            {initiative.epics.length} epics - {totalPoints} pts
          </span>
        </div>
        
        {!isCollapsed && (
          <div style={{ padding: '12px 0' }}>
            {initiative.epics.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                No epics in this initiative
              </div>
            ) : (
              initiative.epics.map(epic => renderEpic(epic, initiative.key))
            )}
          </div>
        )}
      </div>
    );
  };

  const renderUnassignedSection = () => {
    const isCollapsed = collapsed['unassigned'];
    const totalPoints = calculateTotalPoints(unassignedIssues);

    return (
      <div style={{ marginBottom: '16px' }}>
        <div 
          onClick={() => toggleCollapse('unassigned')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            backgroundColor: '#f0f0f0',
            border: '2px solid #aaa',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          <span>
            {isCollapsed ? '▶' : '▼'} Unassigned to Epic
          </span>
          <span style={{ fontSize: '13px', color: '#555' }}>
            {unassignedIssues.length} issues - {totalPoints} pts
          </span>
        </div>
        
        {!isCollapsed && (
          <div style={{ padding: '12px', backgroundColor: '#fafafa', borderRadius: '0 0 4px 4px' }}>
            {unassignedIssues.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                All issues are assigned to epics
              </div>
            ) : (
              unassignedIssues.map(renderIssue)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '16px' }}>
      <style>{`
        .markdown-inline table {
          border-collapse: collapse;
          margin: 8px 0;
          width: auto;
        }
        .markdown-inline table td,
        .markdown-inline table th {
          border: 1px solid #ddd;
          padding: 6px 10px;
        }
        .markdown-inline table th {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        .markdown-inline ul {
          list-style-type: none;
          padding-left: 0;
        }
        .markdown-inline li {
          margin: 4px 0;
        }
        .markdown-inline li input[type="checkbox"] {
          margin-right: 6px;
        }
        .markdown-inline blockquote {
          border-left: 4px solid #0052cc;
          padding-left: 10px;
          margin: 10px 0;
          background-color: #deebff;
          padding: 6px 10px;
        }
        .markdown-inline code {
          background-color: #f4f5f7;
          padding: 2px 5px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 12px;
        }
        .markdown-inline pre {
          background-color: #f4f5f7;
          padding: 10px;
          border-radius: 4px;
          overflow-x: auto;
        }
        .markdown-inline pre code {
          background: none;
          padding: 0;
        }
        .markdown-inline a {
          color: #0052cc;
          text-decoration: none;
        }
        .markdown-inline a:hover {
          text-decoration: underline;
        }
      `}</style>
      
      {initiatives.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
          No initiatives found
        </div>
      ) : (
        initiatives.map(renderInitiative)
      )}
      
      {renderUnassignedSection()}
    </div>
  );
}

export default InitiativesEpicsTab;

