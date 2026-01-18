import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import SprintsBacklogTab from './SprintsBacklogTab';
import InitiativesEpicsTab from './InitiativesEpicsTab';
import ClickSelectionMenu from './ClickSelectionMenu';
import { DEFAULT_CAPACITY, SPRINT_GOAL_ROWS } from '../constants';
import { buildEpicToInitiativeMap } from '../utils/initiativeUtils';
import { 
  moveIssues, 
  assignEpic, 
  addPendingChange, 
  clearPendingChanges,
  updateCategory,
  updateStoryPoints
} from '../utils/snapshotUtils';

function PlanningView({ snapshot, selectedSprintId }) {
  const [sprintGoal, setSprintGoal] = useState('');
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY);
  const [activeTab, setActiveTab] = useState('sprints');
  const [localSnapshot, setLocalSnapshot] = useState(snapshot);
  const [selectedIssues, setSelectedIssues] = useState([]); // For multi-select
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [flashingIssues, setFlashingIssues] = useState([]); // Issues about to be moved
  const [pendingChanges, setPendingChanges] = useState([]); // Track all changes for save
  const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, success, error
  const [saveMessage, setSaveMessage] = useState('');

  // Sync localSnapshot when snapshot prop changes
  useEffect(() => {
    setLocalSnapshot(snapshot);
  }, [snapshot]);

  if (!localSnapshot) {
    return <div>No snapshot loaded</div>;
  }

  // Build epic → initiative mapping once (memoized)
  const epicToInitiative = useMemo(() => {
    return buildEpicToInitiativeMap(localSnapshot.initiatives);
  }, [localSnapshot.initiatives]);

  // Helper to find issue in snapshot
  const findIssueInSnapshot = (issueKey) => {
    // Check all sprints
    for (const sprint of localSnapshot.sprints) {
      const issue = sprint.issues.find(i => i.key === issueKey);
      if (issue) return issue;
    }
    // Check backlog
    return localSnapshot.backlog.find(i => i.key === issueKey) || null;
  };

  const handleCategoryChange = (issueKey, newCategory) => {
    // Use utility function to update category (with EE auto-assignment)
    const updatedSnapshot = updateCategory(localSnapshot, issueKey, newCategory);
    setLocalSnapshot(updatedSnapshot);
    
    // Track pending change for epic assignment if EE
    const eeConfig = localSnapshot.eeConfig;
    if (newCategory === 'ee' && eeConfig?.epicKey) {
      const issue = findIssueInSnapshot(issueKey);
      if (issue) {
        const updatedPendingChanges = addPendingChange(
          pendingChanges,
          issueKey,
          { epic: eeConfig.epicKey },
          issue.updated
        );
        setPendingChanges(updatedPendingChanges);
      }
    }
  };

  const handleStoryPointsChange = (issueKey, newPoints) => {
    // Use utility function to update story points
    const updatedSnapshot = updateStoryPoints(localSnapshot, issueKey, newPoints);
    setLocalSnapshot(updatedSnapshot);
    
    // Track in pending changes
    const updatedPendingChanges = addPendingChange(pendingChanges, issueKey, { storyPoints: newPoints });
    setPendingChanges(updatedPendingChanges);
  };

  // Handle issue selection (Cmd/Ctrl+Click for multi-select)
  const handleIssueClick = (issueKey, event) => {
    if (event.metaKey || event.ctrlKey) {
      // Multi-select: toggle selection
      setSelectedIssues(prev => {
        const newSelection = prev.includes(issueKey) 
          ? prev.filter(k => k !== issueKey)  // Deselect
          : [...prev, issueKey];              // Add to selection
        return newSelection;
      });
    } else {
      // Normal click: clear selection
      setSelectedIssues([]);
    }
  };

  // Handle right-click to show menu
  const handleIssueRightClick = (issueKey, event) => {
    event.preventDefault(); // Prevent browser context menu
    
    // If right-clicked issue is not selected, select only it
    if (!selectedIssues.includes(issueKey)) {
      setSelectedIssues([issueKey]);
    }
    
    // Show menu at cursor position
    setMenuPosition({ x: event.clientX, y: event.clientY });
    setMenuVisible(true);
  };

  // Handle move issues
  const handleMoveIssues = (target) => {
    // Track pending changes for each issue
    let updatedPendingChanges = pendingChanges;
    selectedIssues.forEach(issueKey => {
      const issue = findIssueInSnapshot(issueKey);
      if (issue) {
        updatedPendingChanges = addPendingChange(
          updatedPendingChanges,
          issueKey,
          { sprint: target === 'backlog' ? null : target },
          issue.updated
        );
      }
    });
    setPendingChanges(updatedPendingChanges);
    
    // Flash effect BEFORE moving
    setFlashingIssues(selectedIssues);
    
    // After 250ms, actually move them
    setTimeout(() => {
      const updatedSnapshot = moveIssues(localSnapshot, selectedIssues, target);
      setLocalSnapshot(updatedSnapshot);
      setFlashingIssues([]); // Clear flash
    }, 250);
    
    setSelectedIssues([]); // Clear selection immediately
  };

  // Handle assign epic
  const handleAssignEpic = (epicKey, epicName) => {
    // Track pending changes for each issue
    let updatedPendingChanges = pendingChanges;
    selectedIssues.forEach(issueKey => {
      const issue = findIssueInSnapshot(issueKey);
      if (issue) {
        updatedPendingChanges = addPendingChange(
          updatedPendingChanges,
          issueKey,
          { epic: epicKey },
          issue.updated
        );
      }
    });
    setPendingChanges(updatedPendingChanges);
    
    const updatedSnapshot = assignEpic(localSnapshot, selectedIssues, epicKey, epicName);
    setLocalSnapshot(updatedSnapshot);
    setSelectedIssues([]); // Clear selection after assignment
  };

  // Handle save changes
  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveMessage('');

    try {
      const response = await fetch('http://localhost:3001/api/changes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingChanges })
      });

      const data = await response.json();

      if (response.ok) {
        const { saved = [], conflicts = [], errors = [] } = data;
        const total = saved.length + conflicts.length + errors.length;
        
        if (conflicts.length > 0 || errors.length > 0) {
          // Partial success/failure
          setSaveStatus('error');
          const messages = [];
          if (saved.length > 0) messages.push(`${saved.length} saved`);
          if (conflicts.length > 0) messages.push(`${conflicts.length} conflicts`);
          if (errors.length > 0) messages.push(`${errors.length} errors`);
          setSaveMessage(messages.join(', '));
        } else {
          // Full success
          setSaveStatus('success');
          setSaveMessage(`All ${saved.length} changes saved successfully!`);
          setPendingChanges([]); // Clear pending changes
          
          // Hide success message after 2 seconds
          setTimeout(() => {
            setSaveStatus('idle');
            setSaveMessage('');
          }, 2000);
        }
      } else {
        setSaveStatus('error');
        setSaveMessage(data.error || 'Failed to save changes');
      }
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage('Network error: Unable to save changes');
    }
  };

  // Handle discard changes
  const handleDiscard = () => {
    setPendingChanges([]);
    setLocalSnapshot(snapshot); // Reset to original snapshot
    setSaveStatus('idle');
    setSaveMessage('');
  };

  const totalIssues = localSnapshot.sprints.reduce((sum, s) => sum + s.issues.length, 0) + localSnapshot.backlog.length;

  // Calculate category stats for selected sprint (memoized)
  const categoryStats = useMemo(() => {
    const selectedSprint = localSnapshot.sprints.find(s => s.id === selectedSprintId);
    const sprintIssues = selectedSprint?.issues || [];
    
    const categoryPoints = sprintIssues.reduce((acc, issue) => {
      const points = issue.storyPoints || 0;
      acc[issue.category] = (acc[issue.category] || 0) + points;
      return acc;
    }, { goal: 0, ee: 0, other: 0 });
    
    const totalPoints = categoryPoints.goal + categoryPoints.ee + categoryPoints.other;
    
    const categoryPercent = {
      goal: capacity > 0 ? Math.round((categoryPoints.goal / capacity) * 100) : 0,
      ee: capacity > 0 ? Math.round((categoryPoints.ee / capacity) * 100) : 0,
      other: capacity > 0 ? Math.round((categoryPoints.other / capacity) * 100) : 0
    };

    return { categoryPoints, categoryPercent };
  }, [localSnapshot.sprints, selectedSprintId, capacity]);

  const { categoryPoints, categoryPercent } = categoryStats;

  // Build flat list of all epics for menu
  const allEpics = useMemo(() => {
    const epics = [];
    localSnapshot.initiatives.forEach(initiative => {
      if (initiative.epics) {
        initiative.epics.forEach(epic => {
          epics.push({ key: epic.key, name: epic.name });
        });
      }
    });
    return epics;
  }, [localSnapshot.initiatives]);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Sprint Goal & Capacity - Side by Side Layout */}
      <div style={{ 
        marginBottom: '20px',
        display: 'flex',
        gap: '20px',
        alignItems: 'stretch'
      }}>
        {/* Sprint Goal Box (Left - 70%) */}
        <div style={{ 
          flex: '0 0 70%',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <label style={{ 
            fontWeight: 'bold', 
            display: 'block', 
            marginBottom: '12px',
            fontSize: '14px',
            color: '#555'
          }}>Sprint Goal:</label>
          <textarea
            value={sprintGoal}
            onChange={(e) => setSprintGoal(e.target.value)}
            placeholder="Enter sprint goal..."
            rows={SPRINT_GOAL_ROWS}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '13px',
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
              flex: 1
            }}
          />
        </div>

        {/* Capacity Box (Right - 30%) */}
        <div style={{ 
          flex: '0 0 28%',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <label style={{ 
            fontWeight: 'bold', 
            display: 'block',
            marginBottom: '12px',
            fontSize: '14px',
            color: '#555'
          }}>Capacity</label>
          
          {/* Capacity Input */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
              style={{
                width: '80px',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '24px',
                fontWeight: 'bold',
                textAlign: 'center'
              }}
            />
            <span style={{ marginLeft: '6px', color: '#666', fontSize: '14px' }}>pts</span>
          </div>

          {/* Capacity Bar with Tick Marks */}
          <div style={{ position: 'relative' }}>
            {/* Tick mark at 60% */}
            <div style={{
              position: 'absolute',
              left: '60%',
              top: '-6px',
              bottom: '-6px',
              width: '2px',
              backgroundColor: '#999',
              zIndex: 1
            }} />
            
            {/* Tick mark at 70% */}
            <div style={{
              position: 'absolute',
              left: '70%',
              top: '-6px',
              bottom: '-6px',
              width: '2px',
              backgroundColor: '#999',
              zIndex: 1
            }} />
            
            {/* Capacity Bar */}
            <div 
              style={{ 
                display: 'flex',
                height: '24px',
                borderRadius: '4px',
                overflow: 'visible',
                border: '1px solid #ccc',
                cursor: 'help',
                backgroundColor: '#f5f5f5',
                position: 'relative'
              }}
              title={`💰 Sprint Goal: ${categoryPercent.goal}%\n🔧 Eng Excellence: ${categoryPercent.ee}%\n🧩 Other Goal: ${categoryPercent.other}%\n\nSprint Goal ideally 60-70% with capacity for Engineering Excellence and other issues too`}
            >
              {/* Sprint Goal segment */}
              <div style={{
                width: `${categoryPercent.goal}%`,
                backgroundColor: categoryPercent.goal > 0 ? '#4caf50' : 'transparent',
                transition: 'width 0.3s ease',
                borderRadius: '3px'
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setActiveTab('sprints')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'sprints' ? '#4c7dff' : '#f6f6f6',
            color: activeTab === 'sprints' ? '#ffffff' : '#666',
            border: '1px solid #1e1e1e',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          Sprints & Backlog
        </button>
        <button
          onClick={() => setActiveTab('initiatives')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'initiatives' ? '#4c7dff' : '#f6f6f6',
            color: activeTab === 'initiatives' ? '#ffffff' : '#666',
            border: '1px solid #1e1e1e',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          Initiatives & Epics
        </button>
      </div>

      {/* Tab Content */}
      <div style={{
        backgroundColor: '#fafafa',
        border: '1px solid #ccc',
        borderRadius: '4px',
        minHeight: '500px'
      }}>
        {activeTab === 'sprints' ? (
          <SprintsBacklogTab 
            sprints={localSnapshot.sprints} 
            backlog={localSnapshot.backlog}
            initiatives={localSnapshot.initiatives}
            epicToInitiative={epicToInitiative}
            selectedSprintId={selectedSprintId}
            onCategoryChange={handleCategoryChange}
            onStoryPointsChange={handleStoryPointsChange}
            selectedIssues={selectedIssues}
            onIssueClick={handleIssueClick}
            onIssueRightClick={handleIssueRightClick}
            flashingIssues={flashingIssues}
          />
        ) : (
          <InitiativesEpicsTab 
            initiatives={localSnapshot.initiatives} 
            sprints={localSnapshot.sprints} 
            backlog={localSnapshot.backlog}
          />
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        {/* Pending Changes Counter */}
        {pendingChanges.length > 0 && (
          <div style={{
            marginBottom: '12px',
            padding: '12px',
            backgroundColor: '#fff3cd',
            border: '2px solid #ff9800',
            borderRadius: '6px',
            display: 'inline-block'
          }}>
            <span style={{ fontWeight: 'bold', color: '#856404' }}>
              📝 {pendingChanges.length} change{pendingChanges.length !== 1 ? 's' : ''} pending
            </span>
            <span style={{ marginLeft: '12px', fontSize: '12px', color: '#666' }}>
              (Not yet saved to Jira)
            </span>
          </div>
        )}
        
        <div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Back to Context Selection
          </button>
        </div>
      </div>

      {/* Click Selection Menu */}
      {menuVisible && selectedIssues.length > 0 && (
        <ClickSelectionMenu
          position={menuPosition}
          selectedCount={selectedIssues.length}
          sprints={localSnapshot.sprints}
          epics={allEpics}
          onMove={handleMoveIssues}
          onAssignEpic={handleAssignEpic}
          onClose={() => setMenuVisible(false)}
        />
      )}

      {/* Save Bar (Bottom Right) */}
      {pendingChanges.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#ffffff',
          border: '2px solid #ccc',
          borderRadius: '8px',
          padding: '16px 20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          zIndex: 1000
        }}>
          {/* Status Icon/Spinner */}
          {saveStatus === 'saving' && (
            <span style={{ fontSize: '20px' }}>⏳</span>
          )}
          {saveStatus === 'success' && (
            <span style={{ fontSize: '20px' }}>✅</span>
          )}
          {saveStatus === 'error' && (
            <span style={{ fontSize: '20px' }}>❌</span>
          )}
          
          {/* Message */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
              {saveStatus === 'saving' && 'Saving changes...'}
              {saveStatus === 'success' && 'Saved!'}
              {saveStatus === 'error' && 'Error'}
              {saveStatus === 'idle' && `${pendingChanges.length} pending change${pendingChanges.length !== 1 ? 's' : ''}`}
            </span>
            {saveMessage && (
              <span style={{ fontSize: '12px', color: saveStatus === 'error' ? '#d32f2f' : '#666' }}>
                {saveMessage}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          {saveStatus === 'idle' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDiscard}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#e0e0e0'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#f5f5f5'}
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#4caf50',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#45a049'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#4caf50'}
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

PlanningView.propTypes = {
  snapshot: PropTypes.shape({
    board: PropTypes.shape({
      id: PropTypes.number.isRequired,
      name: PropTypes.string.isRequired,
      projectKey: PropTypes.string.isRequired
    }).isRequired,
    sprints: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number.isRequired,
      name: PropTypes.string.isRequired,
      state: PropTypes.string.isRequired,
      issues: PropTypes.array.isRequired
    })).isRequired,
    backlog: PropTypes.array.isRequired,
    initiatives: PropTypes.array.isRequired,
    eeConfig: PropTypes.shape({
      initiativeKey: PropTypes.string,
      epicKey: PropTypes.string
    })
  }).isRequired,
  selectedSprintId: PropTypes.number.isRequired
};

export default PlanningView;

