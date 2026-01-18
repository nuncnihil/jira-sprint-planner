import { useEffect } from 'react';
import PropTypes from 'prop-types';

function ClickSelectionMenu({ 
  position, 
  selectedCount,
  sprints,
  epics,
  onMove,
  onAssignEpic,
  onClose 
}) {
  // Smart positioning to keep menu on screen
  const menuWidth = 220;
  const menuHeight = 400; // Approximate max height
  
  let finalX = position.x;
  let finalY = position.y;
  
  // Check if menu would go off right edge
  if (finalX + menuWidth > window.innerWidth) {
    finalX = window.innerWidth - menuWidth - 10;
  }
  
  // Check if menu would go off bottom
  if (finalY + menuHeight > window.innerHeight) {
    finalY = position.y - menuHeight;
    // Make sure it's not off the top either
    if (finalY < 10) {
      finalY = 10;
    }
  }
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Check if click is outside the menu
      const menu = document.getElementById('click-selection-menu');
      if (menu && !menu.contains(e.target)) {
        onClose();
      }
    };
    
    // Add listener after a small delay to avoid immediate close
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);
  
  const handleMove = (target) => {
    onMove(target);
    onClose();
  };
  
  const handleEpicAssign = (epicKey, epicName) => {
    onAssignEpic(epicKey, epicName);
    onClose();
  };
  
  return (
    <div
      id="click-selection-menu"
      style={{
        position: 'fixed',
        top: finalY,
        left: finalX,
        backgroundColor: '#ffffff',
        border: '2px solid #333',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        minWidth: '220px',
        zIndex: 10000,
        fontSize: '14px'
      }}
    >
      {/* Move To Section */}
      <div style={{ padding: '8px 0' }}>
        <div style={{
          padding: '8px 16px',
          fontWeight: 'bold',
          fontSize: '12px',
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Move {selectedCount > 1 ? `${selectedCount} issues` : 'issue'} to...
        </div>
        
        {sprints.map(sprint => (
          <div
            key={sprint.id}
            onClick={() => handleMove(sprint.id)}
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              backgroundColor: '#ffffff',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
          >
            ▸ {sprint.name}
          </div>
        ))}
        
        <div
          onClick={() => handleMove('backlog')}
          style={{
            padding: '10px 16px',
            cursor: 'pointer',
            backgroundColor: '#ffffff',
            transition: 'background-color 0.15s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
        >
          ▸ Backlog
        </div>
      </div>
      
      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#ddd', margin: '4px 0' }} />
      
      {/* Assign Epic Section */}
      <div style={{ padding: '8px 0' }}>
        <div style={{
          padding: '8px 16px',
          fontWeight: 'bold',
          fontSize: '12px',
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Assign Epic...
        </div>
        
        {/* Scrollable epic list */}
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {epics.map(epic => (
          <div
            key={epic.key}
            onClick={() => handleEpicAssign(epic.key, epic.name)}
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              backgroundColor: '#ffffff',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
          >
            ▸ {epic.name}
          </div>
        ))}
        
        <div
          onClick={() => handleEpicAssign(null, '')}
          style={{
            padding: '10px 16px',
            cursor: 'pointer',
            backgroundColor: '#ffffff',
            fontStyle: 'italic',
            color: '#999',
            transition: 'background-color 0.15s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
        >
          ▸ [No Epic]
        </div>
        </div> {/* Close scrollable epic list */}
      </div>
    </div>
  );
}

ClickSelectionMenu.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired,
  selectedCount: PropTypes.number.isRequired,
  sprints: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired
  })).isRequired,
  epics: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
  })).isRequired,
  onMove: PropTypes.func.isRequired,
  onAssignEpic: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};

export default ClickSelectionMenu;

