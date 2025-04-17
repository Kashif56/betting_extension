// Match storage utility for the Bot Extension

/**
 * Class to handle storage and retrieval of selected matches
 */
class MatchStorage {
  /**
   * Initialize the match storage
   */
  constructor() {
    this.storageKey = 'selectedMatches';
  }

  /**
   * Save a selected match to storage
   * @param {Object} match - The match object to save
   * @returns {Promise<void>}
   */
  async saveMatch(match) {
    try {
      // Get existing matches
      const matches = await this.getMatches();
      
      // Check if match already exists (by matchId)
      const existingIndex = matches.findIndex(m => m.matchId === match.matchId);
      
      if (existingIndex >= 0) {
        // Update existing match
        matches[existingIndex] = match;
      } else {
        // Add new match
        matches.push(match);
      }
      
      // Save back to storage
      await chrome.storage.local.set({ [this.storageKey]: matches });
      
      return true;
    } catch (error) {
      console.error('Error saving match:', error);
      return false;
    }
  }

  /**
   * Remove a match from storage
   * @param {string} matchId - The ID of the match to remove
   * @returns {Promise<boolean>}
   */
  async removeMatch(matchId) {
    try {
      // Get existing matches
      const matches = await this.getMatches();
      
      // Filter out the match to remove
      const updatedMatches = matches.filter(match => match.matchId !== matchId);
      
      // Save back to storage
      await chrome.storage.local.set({ [this.storageKey]: updatedMatches });
      
      return true;
    } catch (error) {
      console.error('Error removing match:', error);
      return false;
    }
  }

  /**
   * Get all saved matches
   * @returns {Promise<Array>}
   */
  async getMatches() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      return result[this.storageKey] || [];
    } catch (error) {
      console.error('Error getting matches:', error);
      return [];
    }
  }

  /**
   * Clear all saved matches
   * @returns {Promise<boolean>}
   */
  async clearMatches() {
    try {
      await chrome.storage.local.set({ [this.storageKey]: [] });
      return true;
    } catch (error) {
      console.error('Error clearing matches:', error);
      return false;
    }
  }
}

// Export a singleton instance
const matchStorage = new MatchStorage();
export default matchStorage;
