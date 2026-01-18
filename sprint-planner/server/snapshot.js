const fs = require('fs');
const path = require('path');

const SNAPSHOT_DIR = path.join(__dirname, '.data');

/**
 * Save snapshot to local file
 * @param {object} data - Snapshot data
 * @returns {string} Snapshot filename
 */
function saveSnapshot(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `snapshot-${timestamp}.json`;
  const filepath = path.join(SNAPSHOT_DIR, filename);
  
  const snapshotWithMeta = {
    ...data,
    createdAt: new Date().toISOString()
  };
  
  fs.writeFileSync(filepath, JSON.stringify(snapshotWithMeta, null, 2));
  
  return filename;
}

/**
 * Load most recent snapshot
 * @returns {object|null} Snapshot data or null if none exists
 */
function loadSnapshot() {
  const files = fs.readdirSync(SNAPSHOT_DIR)
    .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    return null;
  }
  
  const filepath = path.join(SNAPSHOT_DIR, files[0]);
  const data = fs.readFileSync(filepath, 'utf8');
  
  return JSON.parse(data);
}

/**
 * Delete most recent snapshot
 * @returns {boolean} True if deleted, false if none existed
 */
function deleteSnapshot() {
  const files = fs.readdirSync(SNAPSHOT_DIR)
    .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    return false;
  }
  
  const filepath = path.join(SNAPSHOT_DIR, files[0]);
  fs.unlinkSync(filepath);
  
  return true;
}

module.exports = {
  saveSnapshot,
  loadSnapshot,
  deleteSnapshot
};

