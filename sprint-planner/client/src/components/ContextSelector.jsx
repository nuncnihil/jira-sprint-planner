import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001';

function ContextSelector({ onSnapshotLoaded }) {
  const [boards, setBoards] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [project, setProject] = useState(null);
  const [selected, setSelected] = useState({ board: '', sprint: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch project and boards in parallel
    Promise.all([
      fetch(`${API_BASE}/api/project`).then(res => res.json()),
      fetch(`${API_BASE}/api/context`).then(res => res.json())
    ])
      .then(([projectData, contextData]) => {
        setProject(projectData.project);
        setBoards(contextData.boards);
        setLoading(false);
      })
      .catch(err => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selected.board) {
      fetch(`${API_BASE}/api/sprints/${selected.board}`)
        .then(res => res.json())
        .then(data => setSprints(data.sprints))
        .catch(err => {});
    } else {
      setSprints([]);
      setSelected(prev => ({ ...prev, sprint: '' }));
    }
  }, [selected.board]);

  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  const handleLoad = async () => {
    setLoadingSnapshot(true);
    
    try {
      const response = await fetch(`${API_BASE}/api/snapshot/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: parseInt(selected.board),
          sprintId: parseInt(selected.sprint)
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to load snapshot');
      }
      
      const data = await response.json();
      
      // Pass snapshot and sprintId to parent via callback
      if (typeof onSnapshotLoaded === 'function') {
        onSnapshotLoaded(data.snapshot, parseInt(selected.sprint));
      }
      
    } catch (error) {
      alert('Failed to load snapshot: ' + error.message);
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const isLoadDisabled = !selected.board || !selected.sprint || loadingSnapshot;

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: '600px', padding: '20px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: '600', textAlign: 'center' }}>
        Sprint Setup
        {project && (
          <div style={{ fontSize: '14px', fontWeight: '400', color: '#666', marginTop: '4px' }}>
            Project: {project.name} ({project.key})
          </div>
        )}
      </h2>

      <div style={{ marginBottom: '16px', textAlign: 'center' }}>
        <label>
          Board:
          <select 
            value={selected.board} 
            onChange={e => setSelected({ ...selected, board: e.target.value })}
            style={{ marginLeft: '8px', width: '300px' }}
          >
            <option value="">Select board</option>
            {boards.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <label>
          Sprint:
          <select 
            value={selected.sprint} 
            onChange={e => setSelected({ ...selected, sprint: e.target.value })} 
            disabled={!selected.board}
            style={{ marginLeft: '8px', width: '300px' }}
          >
            <option value="">Select sprint</option>
            {sprints.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.state})</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button
          onClick={handleLoad}
          disabled={isLoadDisabled}
          style={{
            padding: '10px 24px',
            backgroundColor: isLoadDisabled ? '#ccc' : '#1976d2',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoadDisabled ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {loadingSnapshot ? 'Loading...' : 'Start Planning'}
        </button>
      </div>
    </div>
  );
}

export default ContextSelector;

