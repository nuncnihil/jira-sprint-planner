/**
 * Build epicKey → initiativeName mapping
 * @param {Array} initiatives - Array of initiative objects with nested epics
 * @returns {Object} Map of epicKey to initiativeName
 */
export function buildEpicToInitiativeMap(initiatives) {
  const map = {};
  initiatives.forEach(initiative => {
    if (initiative.epics) {
      initiative.epics.forEach(epic => {
        map[epic.key] = initiative.name;
      });
    }
  });
  return map;
}

