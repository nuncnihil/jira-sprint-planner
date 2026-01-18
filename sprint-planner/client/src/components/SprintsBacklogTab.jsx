import { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { COLOR_FAMILIES, EPIC_SHADE_INDICES } from '../constants';

function SprintsBacklogTab({ sprints, backlog, initiatives, epicToInitiative, selectedSprintId, onCategoryChange, onStoryPointsChange, selectedIssues, onIssueClick, onIssueRightClick, flashingIssues }) {
  // Color family system for initiatives and epics
  const { initiativeColors, epicColors } = useMemo(() => {
    // Map each initiative to a color family
    const initiativeColorMap = {};
    initiatives.forEach((initiative, index) => {
      const family = COLOR_FAMILIES[index % COLOR_FAMILIES.length];
      initiativeColorMap[initiative.name] = {
        color: family.initiative,
        shades: family.shades
      };
    });
    
    // Map each epic to a shade based on its position within the initiative
    const epicColorMap = {};
    initiatives.forEach(initiative => {
      const colorFamily = initiativeColorMap[initiative.name];
      if (colorFamily && initiative.epics) {
        initiative.epics.forEach((epic, index) => {
          const shadeIndex = EPIC_SHADE_INDICES[index % EPIC_SHADE_INDICES.length];
          epicColorMap[epic.key] = colorFamily.shades[shadeIndex];
        });
      }
    });
    
    return { initiativeColors: initiativeColorMap, epicColors: epicColorMap };
  }, [initiatives]);

  // Initialize collapsed state - only selected sprint is expanded
  const initialCollapsed = useMemo(() => {
    const state = { backlog: true };
    sprints.forEach(sprint => {
      state[`sprint-${sprint.id}`] = sprint.id !== selectedSprintId;
    });
    return state;
  }, [sprints, selectedSprintId]);

  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openCategoryDropdown) {
        setOpenCategoryDropdown(null);
      }
    };
    
    if (openCategoryDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openCategoryDropdown]);

  const toggleCollapse = (id) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const calculateTotalPoints = (issues) => {
    return issues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
  };

  // Sort issues by initiative → epic → unassigned last
  const sortIssues = (issues) => {
    return [...issues].sort((a, b) => {
      const aInitiative = a.epicKey ? epicToInitiative[a.epicKey] || '' : '';
      const bInitiative = b.epicKey ? epicToInitiative[b.epicKey] || '' : '';
      const aEpic = a.epicName || '';
      const bEpic = b.epicName || '';
      
      // Unassigned (no epic) goes to bottom
      if (!a.epicKey && b.epicKey) return 1;
      if (a.epicKey && !b.epicKey) return -1;
      
      // Sort by initiative
      if (aInitiative !== bInitiative) {
        return aInitiative.localeCompare(bInitiative);
      }
      
      // Then by epic
      return aEpic.localeCompare(bEpic);
    });
  };

  const renderColumnHeaders = () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '8px 12px',
      marginBottom: '8px',
      backgroundColor: '#e0e0e0',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 'bold',
      color: '#555',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    }}>
      <span style={{ width: '160px', marginRight: '12px' }}>Initiative</span>
      <span style={{ width: '180px', marginRight: '12px' }}>Epic</span>
      <span style={{ flex: 1, marginRight: '12px' }}>Summary</span>
      <span style={{ width: '60px', textAlign: 'center' }}>Pts</span>
      <span style={{ width: '100px', textAlign: 'center', marginRight: '12px' }}>Status</span>
      <span style={{ width: '50px', textAlign: 'center' }}>Value</span>
    </div>
  );

  const renderIssue = (issue) => {
    const initiativeName = issue.epicKey ? epicToInitiative[issue.epicKey] || '' : '';
    const initiativeColorData = initiativeName ? initiativeColors[initiativeName] : null;
    const initiativeColor = initiativeColorData ? initiativeColorData.color : null;
    
    const epicColor = issue.epicKey ? epicColors[issue.epicKey] : null;
    // Darken the epic color for border (use initiative color as darker border)
    const epicBorderColor = initiativeColor || '#999';
    
    const truncatedInitiative = initiativeName.length > 30 
      ? initiativeName.substring(0, 30) + '...' 
      : initiativeName;
    
    const categoryIcons = {
      goal: '💰',
      ee: '🔧',
      other: '🧩'
    };
    
    const isDropdownOpen = openCategoryDropdown === issue.key;
    
    const handleCategoryChange = (e) => {
      if (onCategoryChange) {
        onCategoryChange(issue.key, e.target.value);
      }
      setOpenCategoryDropdown(null); // Close dropdown after selection
    };
    
    const toggleDropdown = (e) => {
      e.stopPropagation();
      setOpenCategoryDropdown(isDropdownOpen ? null : issue.key);
    };
    
    const isSelected = selectedIssues.includes(issue.key);
    const isFlashing = flashingIssues.includes(issue.key);
    
    return (
      <div 
        key={issue.key}
        onClick={(e) => {
          if (onIssueClick) {
            onIssueClick(issue.key, e);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault(); // Prevent browser context menu FIRST
          e.stopPropagation();
          if (onIssueRightClick) {
            onIssueRightClick(issue.key, e);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          margin: '4px 0',
          backgroundColor: isFlashing ? '#ffccbc' : (isSelected ? '#e3f2fd' : '#ffffff'),
          border: isFlashing ? '2px solid #ff5722' : (isSelected ? '2px solid #2196f3' : '1px solid #d0d0d0'),
          borderRadius: '4px',
          fontSize: '13px',
          cursor: 'pointer',
          opacity: isFlashing ? 1 : 1,
          transition: isFlashing ? 'all 0.1s ease' : 'all 0.15s ease'
        }}
      >
        {/* Initiative Badge */}
        {initiativeName ? (
          <span style={{ 
            width: '160px', 
            marginRight: '12px',
            padding: '4px 10px',
            backgroundColor: initiativeColor || '#9e9e9e',
            border: `1px solid ${initiativeColor || '#757575'}`,
            color: '#ffffff',
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: '600',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {truncatedInitiative}
          </span>
        ) : (
          <span style={{ 
            width: '160px', 
            marginRight: '12px',
            fontSize: '12px',
            color: '#999'
          }}>
            -
          </span>
        )}

        {/* Epic Badge */}
        {issue.epicName ? (
          <span style={{ 
            width: '180px', 
            marginRight: '12px',
            padding: '4px 10px',
            backgroundColor: epicColor || '#e0e0e0',
            border: `2px solid ${epicBorderColor}`,
            color: '#333333',
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: '600',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {issue.epicName}
          </span>
        ) : (
          <span style={{ 
            width: '180px', 
            marginRight: '12px',
            padding: '4px 10px',
            backgroundColor: 'transparent',
            color: '#999',
            fontSize: '11px'
          }}>
            No Epic
          </span>
        )}

        {/* Summary */}
        <span style={{ flex: 1, marginRight: '12px' }}>
          {issue.summary}
        </span>
        <input
          type="number"
          value={issue.storyPoints || ''}
          onChange={(e) => {
            const newValue = e.target.value === '' ? null : parseInt(e.target.value);
            if (onStoryPointsChange) {
              onStoryPointsChange(issue.key, newValue);
            }
          }}
          placeholder="-"
          style={{ 
            width: '50px', 
            textAlign: 'center',
            fontWeight: 'bold',
            color: issue.storyPoints ? '#555' : '#999',
            border: '1px solid #ddd',
            borderRadius: '3px',
            padding: '2px 4px',
            fontSize: '13px'
          }}
        />
        <span style={{ 
          width: '100px',
          textAlign: 'center',
          padding: '2px 8px',
          backgroundColor: '#f5f5f5',
          borderRadius: '3px',
          fontSize: '11px',
          marginRight: '12px'
        }}>
          {issue.status}
        </span>
        
        {/* Category Icon & Dropdown */}
        <div style={{ 
          position: 'relative',
          display: 'flex', 
          alignItems: 'center', 
          width: '50px',
          minWidth: '50px',
          maxWidth: '50px'
        }}>
          <span 
            onClick={toggleDropdown}
            style={{ 
              fontSize: '24px', 
              lineHeight: '1',
              cursor: 'pointer',
              opacity: isDropdownOpen ? 1 : 0.8,
              transition: 'opacity 0.2s',
              display: 'inline-block',
              transform: issue.category === 'goal' ? 'scale(1.2)' :
                         issue.category === 'ee' ? 'scaleX(1.3)' : 
                         issue.category === 'other' ? 'scale(1.0)' : 
                         'none'
            }}
            onMouseEnter={(e) => e.target.style.opacity = 1}
            onMouseLeave={(e) => e.target.style.opacity = isDropdownOpen ? 1 : 0.8}
          >
            {categoryIcons[issue.category] || '💰'}
          </span>
          
          {isDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '4px',
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                borderRadius: '3px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 10,
                overflow: 'hidden',
                minWidth: '110px'
              }}
            >
              <div
                onClick={(e) => { e.stopPropagation(); handleCategoryChange({ target: { value: 'goal' } }); }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  backgroundColor: issue.category === 'goal' ? '#e8f5e9' : '#fff',
                  borderBottom: '1px solid #ccc',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.backgroundColor = issue.category === 'goal' ? '#e8f5e9' : '#fff'}
              >
                Sprint Goal
              </div>
              <div
                onClick={(e) => { e.stopPropagation(); handleCategoryChange({ target: { value: 'ee' } }); }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  backgroundColor: issue.category === 'ee' ? '#e3f2fd' : '#fff',
                  borderBottom: '1px solid #ccc',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.backgroundColor = issue.category === 'ee' ? '#e3f2fd' : '#fff'}
              >
                EE
              </div>
              <div
                onClick={(e) => { e.stopPropagation(); handleCategoryChange({ target: { value: 'other' } }); }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  backgroundColor: issue.category === 'other' ? '#fafafa' : '#fff',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.backgroundColor = issue.category === 'other' ? '#fafafa' : '#fff'}
              >
                Other Goal
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSprintSection = (sprint) => {
    const isCollapsed = collapsed[`sprint-${sprint.id}`];
    const totalPoints = calculateTotalPoints(sprint.issues);
    const isSelectedSprint = sprint.id === selectedSprintId;

    return (
      <div 
        key={sprint.id} 
        style={{ 
          marginBottom: '16px',
          border: isSelectedSprint ? '1px solid #a5d6a7' : '1px solid #e0e0e0',
          borderRadius: '4px'
        }}
      >
        <div 
          onClick={() => toggleCollapse(`sprint-${sprint.id}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            backgroundColor: isSelectedSprint ? '#e8f5e9' : '#f5f5f5',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isCollapsed ? '▶' : '▼'} {sprint.name} ({sprint.state})
            {isSelectedSprint && (
              <span style={{
                padding: '2px 8px',
                backgroundColor: '#4caf50',
                color: 'white',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                PLANNING
              </span>
            )}
          </span>
          <span style={{ fontSize: '13px', color: '#2e7d32' }}>
            {sprint.issues.length} issues - {totalPoints} pts
          </span>
        </div>
        
        {!isCollapsed && (
          <div style={{ padding: '12px', backgroundColor: '#fafafa', borderRadius: '0 0 4px 4px' }}>
            {sprint.issues.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                No issues in this sprint
              </div>
            ) : (
              <>
                {renderColumnHeaders()}
                {sortIssues(sprint.issues).map(renderIssue)}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderBacklogSection = () => {
    const isCollapsed = collapsed['backlog'];
    const totalPoints = calculateTotalPoints(backlog);

    return (
      <div 
        style={{ 
          marginBottom: '16px',
          border: '1px solid #e0e0e0',
          borderRadius: '4px'
        }}
      >
        <div 
          onClick={() => toggleCollapse('backlog')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          <span>
            {isCollapsed ? '▶' : '▼'} Backlog
          </span>
          <span style={{ fontSize: '13px', color: '#666' }}>
            {backlog.length} issues - {totalPoints} pts
          </span>
        </div>
        
        {!isCollapsed && (
          <div style={{ padding: '12px', backgroundColor: '#fafafa', borderRadius: '0 0 4px 4px' }}>
            {backlog.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                No backlog issues
              </div>
            ) : (
              <>
                {renderColumnHeaders()}
                {sortIssues(backlog).map(renderIssue)}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // Sort sprints - selected sprint first, then others
  const sortedSprints = useMemo(() => {
    return [...sprints].sort((a, b) => {
      if (a.id === selectedSprintId) return -1;
      if (b.id === selectedSprintId) return 1;
      return a.id - b.id;
    });
  }, [sprints, selectedSprintId]);

  return (
    <div style={{ padding: '16px' }}>
      {sortedSprints.map(renderSprintSection)}
      {renderBacklogSection()}
    </div>
  );
}

SprintsBacklogTab.propTypes = {
  sprints: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    state: PropTypes.string.isRequired,
    issues: PropTypes.array.isRequired
  })).isRequired,
  backlog: PropTypes.array.isRequired,
  initiatives: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    epics: PropTypes.array
  })).isRequired,
  epicToInitiative: PropTypes.object.isRequired,
  selectedSprintId: PropTypes.number.isRequired,
  onCategoryChange: PropTypes.func.isRequired,
  onStoryPointsChange: PropTypes.func.isRequired,
  selectedIssues: PropTypes.arrayOf(PropTypes.string).isRequired,
  onIssueClick: PropTypes.func.isRequired,
  onIssueRightClick: PropTypes.func.isRequired,
  flashingIssues: PropTypes.arrayOf(PropTypes.string).isRequired
};

export default SprintsBacklogTab;

