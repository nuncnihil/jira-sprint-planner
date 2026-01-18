import { useState } from 'react'
import './App.css'
import ContextSelector from './components/ContextSelector'
import PlanningView from './components/PlanningView'

function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [selectedSprintId, setSelectedSprintId] = useState(null);

  const handleSnapshotLoaded = (loadedSnapshot, sprintId) => {
    setSnapshot(loadedSnapshot);
    setSelectedSprintId(sprintId);
  };

  return (
    <div>
      <h1>Sprint Planner</h1>
      {snapshot ? (
        <PlanningView snapshot={snapshot} selectedSprintId={selectedSprintId} />
      ) : (
        <ContextSelector onSnapshotLoaded={handleSnapshotLoaded} />
      )}
    </div>
  )
}

export default App
