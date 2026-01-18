/**
 * Jira Custom Field Discovery
 * Dynamically discovers custom field IDs by querying Jira's field API.
 * This makes the tool portable across different Jira instances.
 */

/**
 * Discover custom field IDs for Story Points, Team, and Sprint
 * @param {Object} jiraClient - Jira client instance
 * @returns {Promise<Object>} Field IDs: { storyPoints, team, sprint }
 */
async function discoverCustomFields(jiraClient) {
  console.log('🔍 Discovering custom field IDs from Jira...');
  
  const response = await jiraClient.request('GET', '/rest/api/3/field');
  
  const fields = {
    storyPoints: null,
    team: null,
    sprint: null
  };
  
  // First pass: collect all candidates
  const storyPointCandidates = [];
  
  for (const field of response) {
    if (!field.custom) continue; // Skip non-custom fields
    
    const nameLower = field.name.toLowerCase();
    
    // Story Points - type "number", name contains "story" and "point"
    if (nameLower.includes('story') && 
        nameLower.includes('point') && 
        field.schema?.type === 'number') {
      storyPointCandidates.push({ id: field.id, name: field.name, nameLower });
    }
  }
  
  // Prefer the one WITHOUT "estimate" (e.g., "Story Points" over "Story point estimate")
  if (storyPointCandidates.length > 0) {
    const preferredCandidate = storyPointCandidates.find(c => !c.nameLower.includes('estimate')) 
                               || storyPointCandidates[0];
    fields.storyPoints = preferredCandidate.id;
    console.log(`   ✅ Found Story Points: ${preferredCandidate.id} (${preferredCandidate.name})`);
  }
  
  // Continue with other fields
  for (const field of response) {
    if (!field.custom) continue;
    
    const nameLower = field.name.toLowerCase();
    
    // Team - name contains "team"
    if (!fields.team && 
        nameLower.includes('team')) {
      fields.team = field.id;
      console.log(`   ✅ Found Team: ${field.id} (${field.name})`);
    }
    
    // Sprint - type "array", name contains "sprint"
    if (!fields.sprint && 
        nameLower.includes('sprint') && 
        field.schema?.type === 'array') {
      fields.sprint = field.id;
      console.log(`   ✅ Found Sprint: ${field.id} (${field.name})`);
    }
  }
  
  // Validate all required fields were found
  const missing = [];
  if (!fields.storyPoints) missing.push('Story Points');
  if (!fields.team) missing.push('Team');
  if (!fields.sprint) missing.push('Sprint');
  
  if (missing.length > 0) {
    console.warn(`   ⚠️  Could not find custom fields: ${missing.join(', ')}`);
    console.warn('   Please ensure these fields exist in your Jira instance.');
  }
  
  return fields;
}

// Cache for discovered field IDs (per Jira client instance)
let cachedFieldIds = null;

/**
 * Get field IDs with caching and fallback to hardcoded defaults
 * @param {Object} jiraClient - Jira client instance
 * @returns {Promise<Object>} Field IDs with fallbacks
 */
async function getFieldIds(jiraClient) {
  // Return cached values if available
  if (cachedFieldIds) {
    return cachedFieldIds;
  }
  
  // Discover field IDs
  const discovered = await discoverCustomFields(jiraClient);
  
  // Fallback to common defaults if discovery failed
  cachedFieldIds = {
    storyPoints: discovered.storyPoints || 'customfield_10036',
    team: discovered.team || 'customfield_10001',
    sprint: discovered.sprint || 'customfield_10020'
  };
  
  console.log('📋 Using field IDs:', cachedFieldIds);
  
  return cachedFieldIds;
}

/**
 * Clear cached field IDs (useful for testing)
 */
function clearCache() {
  cachedFieldIds = null;
}

module.exports = {
  discoverCustomFields,
  getFieldIds,
  clearCache
};

