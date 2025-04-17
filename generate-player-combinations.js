/**
 * Player Combination Generator
 *
 * This module generates unique player combinations from tennis matches following these rules:
 * - Exactly one player per match is selected
 * - 60% of selected players are favorites, 40% are underdogs
 * - No duplicate combinations
 * - Avoid combinations where all players are favorites or all are underdogs
 */

// Helper function to calculate binomial coefficient (n choose k)
function binomialCoefficient(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;

  let result = 1;
  for (let i = 1; i <= k; i++) {
    result *= (n - (i - 1));
    result /= i;
  }
  return Math.round(result);
}

/**
 * Calculate the total number of possible combinations that satisfy the 60/40 rule
 * @param {number} totalMatches - Total number of matches
 * @returns {number} - Number of valid combinations
 */
function calculateTotalValidCombinations(totalMatches) {
  // For the 60/40 rule, we need to select 60% favorites and 40% underdogs
  let favoritesToSelect = Math.round(totalMatches * 0.6);
  let underdogsToSelect = totalMatches - favoritesToSelect;

  // Ensure we have at least one of each type if possible
  if (favoritesToSelect === totalMatches && totalMatches > 1) {
    favoritesToSelect = totalMatches - 1;
    underdogsToSelect = 1;
  } else if (underdogsToSelect === totalMatches && totalMatches > 1) {
    underdogsToSelect = totalMatches - 1;
    favoritesToSelect = 1;
  }

  // Total possible combinations = 2^n (where n is the number of matches)
  const totalPossibleCombinations = Math.pow(2, totalMatches);

  // But we only want combinations that have exactly favoritesToSelect favorites
  // This is the binomial coefficient (n choose k) where n = totalMatches and k = favoritesToSelect
  const validCombinations = binomialCoefficient(totalMatches, favoritesToSelect);

  return validCombinations;
}

/**
 * Restructure matches data to group by match ID
 * @param {Array} matches - Array of match objects
 * @returns {Object} - Matches grouped by match ID
 */
function groupMatchesByID(matches) {
  // Filter out live matches
  const nonLiveMatches = matches.filter(match => !match.isLive);

  // Group matches by matchId
  const matchesById = {};
  nonLiveMatches.forEach(match => {
    if (!matchesById[match.matchId]) {
      matchesById[match.matchId] = {
        matchId: match.matchId,
        players: []
      };
    }

    // Add this player to the match
    matchesById[match.matchId].players.push({
      name: match.selectedTeam,
      isFavorite: match.isFavorite,
      odds: match.odds,
      matchData: match // Store the original match data for reference
    });
  });

  return matchesById;
}

/**
 * Generate a unique key for a combination of players
 * @param {Array} selectedPlayers - Array of selected player objects
 * @returns {string} - Unique key for this combination
 */
function getCombinationKey(selectedPlayers) {
  // Sort by matchId to ensure consistent order
  const sortedPlayers = [...selectedPlayers].sort((a, b) =>
    a.matchData.matchId.localeCompare(b.matchData.matchId)
  );

  // Create a string of matchIds and selected players
  return sortedPlayers
    .map(player => `${player.matchData.matchId}:${player.name}`)
    .join('|');
}

/**
 * Check if a combination satisfies the 60/40 rule
 * @param {Array} selectedPlayers - Array of selected player objects
 * @returns {boolean} - True if the combination is valid
 */
function isValid6040Combination(selectedPlayers) {
  const totalPlayers = selectedPlayers.length;
  if (totalPlayers === 0) return false;

  const favoriteCount = selectedPlayers.filter(player => player.isFavorite).length;
  const underdogCount = totalPlayers - favoriteCount;

  // Calculate the exact target counts
  let targetFavorites = Math.round(totalPlayers * 0.6);
  let targetUnderdogs = totalPlayers - targetFavorites;

  // Ensure we have at least one of each type if possible
  if (targetFavorites === totalPlayers && totalPlayers > 1) {
    targetFavorites = totalPlayers - 1;
    targetUnderdogs = 1;
  } else if (targetUnderdogs === totalPlayers && totalPlayers > 1) {
    targetUnderdogs = totalPlayers - 1;
    targetFavorites = 1;
  }

  // Check if the counts match the targets
  return favoriteCount === targetFavorites && underdogCount === targetUnderdogs;
}

/**
 * Calculate potential return for a combination
 * @param {Array} selectedPlayers - Array of selected player objects
 * @param {number} stake - Stake amount
 * @returns {number} - Potential return
 */
function calculatePotentialReturn(selectedPlayers, stake) {
  let totalPotentialReturn = 0;

  selectedPlayers.forEach(player => {
    const odds = parseFloat(player.odds);
    if (!isNaN(odds)) {
      const individualReturn = stake * odds;
      totalPotentialReturn += individualReturn;
    }
  });

  return totalPotentialReturn;
}

/**
 * Generate all valid player combinations
 * @param {Array} matches - Array of match objects
 * @param {number} stake - Stake amount
 * @param {Array} previousSelections - Array of previously used combination keys
 * @param {number} maxCombinations - Maximum number of combinations to generate (optional)
 * @returns {Object} - Object containing valid combinations and statistics
 */
function generatePlayerCombinations(matches, stake, previousSelections = [], maxCombinations = Infinity) {
  // Group matches by ID
  const matchesById = groupMatchesByID(matches);

  // Convert to array for easier processing
  const matchesArray = Object.values(matchesById);

  // Skip if no matches
  if (matchesArray.length === 0) {
    return {
      combinations: [],
      stats: {
        totalMatches: 0,
        totalPossibleCombinations: 0,
        validCombinations: 0,
        combinationsGenerated: 0,
        previouslyUsedCombinations: previousSelections.length,
        remainingCombinations: 0
      }
    };
  }

  // Calculate total possible combinations
  const totalMatches = matchesArray.length;
  const totalPossibleCombinations = Math.pow(2, totalMatches);
  const validPossibleCombinations = calculateTotalValidCombinations(totalMatches);

  // Log the calculation for debugging
  console.log(`Generating player combinations for ${totalMatches} matches:`);
  console.log(`- Total possible combinations: 2^${totalMatches} = ${totalPossibleCombinations}`);
  console.log(`- Valid combinations (60/40 rule): C(${totalMatches},${Math.round(totalMatches * 0.6)}) = ${validPossibleCombinations}`);
  console.log(`- Percentage of valid combinations: ${(validPossibleCombinations/totalPossibleCombinations*100).toFixed(2)}%`);

  // Set to track seen combinations
  const seen = new Set(previousSelections);

  // Array to store valid combinations
  const validCombinations = [];

  // Calculate target counts for favorites and underdogs
  // For small numbers of matches, we need to be careful with rounding
  let targetFavorites = Math.round(totalMatches * 0.6);
  let targetUnderdogs = totalMatches - targetFavorites;

  // Ensure we have at least one of each type if possible
  if (targetFavorites === totalMatches && totalMatches > 1) {
    targetFavorites = totalMatches - 1;
    targetUnderdogs = 1;
  } else if (targetUnderdogs === totalMatches && totalMatches > 1) {
    targetUnderdogs = totalMatches - 1;
    targetFavorites = 1;
  }

  // Generate all possible combinations using binary representation
  // We'll use a more efficient approach for large numbers of matches

  // If we have a small number of matches, we can generate all combinations
  if (totalMatches <= 20) { // Arbitrary threshold, adjust as needed
    // Generate all 2^n combinations
    for (let i = 0; i < totalPossibleCombinations && validCombinations.length < maxCombinations; i++) {
      const selectedPlayers = [];
      let favoriteCount = 0;

      // For each match, select one player based on the binary representation of i
      for (let j = 0; j < totalMatches; j++) {
        // Use bit j of number i to decide which player to select (0 or 1)
        const playerIndex = (i >> j) & 1;
        const player = matchesArray[j].players[playerIndex];

        selectedPlayers.push(player);

        if (player.isFavorite) {
          favoriteCount++;
        }
      }

      // Check if this combination satisfies the 60/40 rule
      if (favoriteCount === targetFavorites) {
        // Generate a unique key for this combination
        const combinationKey = getCombinationKey(selectedPlayers);

        // Check if this combination has been seen before
        if (!seen.has(combinationKey)) {
          // Calculate potential return
          const potentialReturn = calculatePotentialReturn(selectedPlayers, stake);

          // Check if potential return exceeds threshold
          if (potentialReturn <= 650000) {
            // Add to valid combinations
            validCombinations.push({
              players: selectedPlayers,
              key: combinationKey,
              favoriteCount,
              underdogCount: totalMatches - favoriteCount,
              potentialReturn
            });

            // Mark as seen
            seen.add(combinationKey);

            // Stop if we've reached the maximum
            if (validCombinations.length >= maxCombinations) {
              break;
            }
          }
        }
      }
    }
  } else {
    // For larger numbers of matches, we'll use a more targeted approach
    // This is a simplified implementation that generates random valid combinations

    // We'll try a limited number of random combinations
    const maxAttempts = Math.min(10000, validPossibleCombinations);

    for (let attempt = 0; attempt < maxAttempts && validCombinations.length < maxCombinations; attempt++) {
      const selectedPlayers = [];

      // Randomly select matches for favorites and underdogs
      const matchIndices = Array.from({ length: totalMatches }, (_, i) => i);
      shuffleArray(matchIndices);

      // Select favorites from the first targetFavorites matches
      for (let i = 0; i < targetFavorites; i++) {
        const matchIndex = matchIndices[i];
        const match = matchesArray[matchIndex];

        // Find the favorite player in this match
        const favoritePlayer = match.players.find(p => p.isFavorite);
        if (favoritePlayer) {
          selectedPlayers.push(favoritePlayer);
        } else {
          // If no favorite found (shouldn't happen), use the first player
          selectedPlayers.push(match.players[0]);
        }
      }

      // Select underdogs from the remaining matches
      for (let i = targetFavorites; i < totalMatches; i++) {
        const matchIndex = matchIndices[i];
        const match = matchesArray[matchIndex];

        // Find the underdog player in this match
        const underdogPlayer = match.players.find(p => !p.isFavorite);
        if (underdogPlayer) {
          selectedPlayers.push(underdogPlayer);
        } else {
          // If no underdog found (shouldn't happen), use the first player
          selectedPlayers.push(match.players[0]);
        }
      }

      // Generate a unique key for this combination
      const combinationKey = getCombinationKey(selectedPlayers);

      // Check if this combination has been seen before
      if (!seen.has(combinationKey)) {
        // Calculate potential return
        const potentialReturn = calculatePotentialReturn(selectedPlayers, stake);

        // Check if potential return exceeds threshold
        if (potentialReturn <= 650000) {
          // Add to valid combinations
          validCombinations.push({
            players: selectedPlayers,
            key: combinationKey,
            favoriteCount: targetFavorites,
            underdogCount: targetUnderdogs,
            potentialReturn
          });

          // Mark as seen
          seen.add(combinationKey);
        }
      }
    }
  }

  // Return the valid combinations and statistics
  return {
    combinations: validCombinations,
    stats: {
      totalMatches,
      totalPossibleCombinations,
      validPossibleCombinations,
      combinationsGenerated: validCombinations.length,
      previouslyUsedCombinations: previousSelections.length,
      remainingCombinations: validPossibleCombinations - seen.size
    }
  };
}

/**
 * Helper function to shuffle an array (Fisher-Yates algorithm)
 * @param {Array} array - Array to shuffle
 * @returns {Array} - Shuffled array
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Export the functions
module.exports = {
  generatePlayerCombinations,
  calculateTotalValidCombinations,
  groupMatchesByID,
  isValid6040Combination,
  calculatePotentialReturn
};
