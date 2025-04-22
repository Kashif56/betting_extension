// Auto Bet Handler
// This module handles automatically reselecting matches with different players and placing bets

// Configuration constants
const STAKE_AMOUNT = 0.10; // Default stake amount in USD
const DELAY_BETWEEN_ATTEMPTS = 500; // Delay between attempts in ms (reduced by 75%)
const MAX_RETRIES = 3; // Maximum number of retries for operations
const MAX_AUTO_BETS = 5; // Default number of auto bets if total combinations is not calculated
const FAVORITES_RATIO = 0.6; // Ratio of favorites to select (60%)

// State variables
let isAutoBetting = false;
let currentAutoBetCount = 0;
let totalPossibleCombinations = MAX_AUTO_BETS; // This will be updated with calculated value
let autoBetSession = {
  sessionId: null,
  originalSelections: [],
  alternativeSelections: [],
  completedBets: [],
  failedBets: [],
  usedCombinationKeys: new Set() // Track all used combination keys to prevent duplicates
};

// Export variables and functions for use in background.js
export {
  isAutoBetting,
  MAX_AUTO_BETS,
  startAutoBetting,
  stopAutoBetting,
  terminateAutoBetting,
  generateAndDisplayAllCombinations,
  calculateTotalPossibleCombinations
};

// Initialize the module
function init() {
  console.log('Auto Bet Handler initialized');
  // Add listeners for messages from content script or popup
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Handle incoming messages
function handleMessage(message, sender, sendResponse) {
  if (message.action === 'startAutoBetting') {
    // Get user-specified favorites and underdogs counts if provided
    // Don't use || operator which would replace 0 with 0
    const userFavoritesCount = message.favoritesCount !== undefined ? message.favoritesCount : 0;
    const userUnderdogsCount = message.underdogsCount !== undefined ? message.underdogsCount : 0;

    console.log(`Starting auto betting with user-specified counts: ${userFavoritesCount} favorites, ${userUnderdogsCount} underdogs`);

    startAutoBetting(message.stake || STAKE_AMOUNT, userFavoritesCount, userUnderdogsCount)
      .then(result => sendResponse({ status: 'success', result }))
      .catch(error => sendResponse({ status: 'error', error: error.message }));
    return true; // Keep channel open for async response
  }
  else if (message.action === 'stopAutoBetting') {
    stopAutoBetting()
      .then(result => sendResponse({ status: 'success', result }))
      .catch(error => sendResponse({ status: 'error', error: error.message }));
    return true; // Keep channel open for async response
  }
  else if (message.action === 'terminateAutoBetting') {
    terminateAutoBetting()
      .then(result => sendResponse({ status: 'success', result }))
      .catch(error => sendResponse({ status: 'error', error: error.message }));
    return true; // Keep channel open for async response
  }
  else if (message.action === 'getAutoBettingStatus') {
    sendResponse({
      isAutoBetting,
      currentAutoBetCount,
      maxAutoBets: totalPossibleCombinations,
      sessionInfo: {
        sessionId: autoBetSession.sessionId,
        completedBets: autoBetSession.completedBets.length,
        failedBets: autoBetSession.failedBets.length,
        originalSelections: autoBetSession.originalSelections.length,
        alternativeSelections: autoBetSession.alternativeSelections.length
      }
    });
    return true;
  }
}

// Calculate total possible combinations for the selection
function calculateTotalPossibleCombinations(matches, favoritesCount, underdogsCount) {
  try {
    // Filter out live matches as they are skipped in the betting algorithm
    const nonLiveMatches = matches.filter(match => !match.isLive);

    if (nonLiveMatches.length === 0) {
      return 0;
    }

    // Get unique match IDs to avoid counting the same match twice
    const uniqueMatchIds = new Set();
    nonLiveMatches.forEach(match => {
      uniqueMatchIds.add(match.matchId);
    });

    // Total number of unique matches
    const totalUniqueMatches = uniqueMatchIds.size;

    // If specific counts are provided, use them
    // Check if at least one of the counts is specified (could be 0)
    if (favoritesCount !== undefined || underdogsCount !== undefined) {
      // If one count is specified but the other is not, calculate the other
      if (favoritesCount !== undefined && underdogsCount === undefined) {
        underdogsCount = totalUniqueMatches - favoritesCount;
      } else if (favoritesCount === undefined && underdogsCount !== undefined) {
        favoritesCount = totalUniqueMatches - underdogsCount;
      }

      // The total of favorites and underdogs must equal the number of matches
      if (favoritesCount + underdogsCount !== totalUniqueMatches) {
        console.log(`Invalid selection: favoritesCount (${favoritesCount}) + underdogsCount (${underdogsCount}) must equal available matches (${totalUniqueMatches})`);
        return 0;
      }

      // We need to select which matches will use favorites and which will use underdogs
      // This is a simple combination problem: C(totalUniqueMatches, favoritesCount)
      // Since once we choose which matches use favorites, the rest must use underdogs
      const totalPossibleCombinations = calculateCombinations(totalUniqueMatches, favoritesCount);

      // Log the calculation details
      console.log(`Calculating total possible combinations for ${totalUniqueMatches} unique matches:`);
      console.log(`- Target favorites: ${favoritesCount}, Target underdogs: ${underdogsCount}`);
      console.log(`- Valid combinations: C(${totalUniqueMatches},${favoritesCount}) = ${totalPossibleCombinations}`);

      return totalPossibleCombinations;
    } else {
      // If no specific counts provided, use the 60/40 rule
      // Use our more advanced calculation
      const validCombinations = calculateTotalValidCombinations(totalUniqueMatches);

      console.log(`Calculating total possible combinations for ${totalUniqueMatches} unique matches using 60/40 rule:`);
      console.log(`- Valid combinations: ${validCombinations}`);

      return validCombinations;
    }
  } catch (error) {
    console.error('Error calculating combinations:', error);
    return MAX_AUTO_BETS;
  }
}

// Helper function to calculate combinations C(n,k)
function calculateCombinations(n, k) {
  // If k is greater than n, return 0
  if (k > n) return 0;

  // If k is 0 or equal to n, return 1
  if (k === 0 || k === n) return 1;

  // Use the symmetry of combinations: C(n,k) = C(n,n-k)
  if (k > n - k) k = n - k;

  // Calculate C(n,k) using a more numerically stable method
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result *= (n - (i - 1));
    result /= i;
  }

  return Math.round(result);
}

/**
 * Generate and display all possible bet combinations for the given matches
 * @param {Array} matches - Array of match objects
 * @param {number} favoritesCount - Number of favorites to select (optional)
 * @param {number} underdogsCount - Number of underdogs to select (optional)
 * @param {Array} previousSelections - Array of previously used combination keys (optional)
 * @returns {Object} - Object containing all valid combinations
 */
function generateAndDisplayAllCombinations(matches, favoritesCount = 0, underdogsCount = 0, previousSelections = []) {
  console.log('\n=== GENERATING ALL POSSIBLE BET COMBINATIONS ===');
  console.log(`Input: ${matches.length} matches, ${favoritesCount} favorites, ${underdogsCount} underdogs`);

  // Calculate total possible combinations
  let totalPossibleCombos;
  // Check if at least one of the counts is specified (could be 0)
  if (favoritesCount !== undefined || underdogsCount !== undefined) {
    // Use specific favorites/underdogs count
    totalPossibleCombos = calculateTotalPossibleCombinations(
      matches,
      favoritesCount,
      underdogsCount
    );
  } else {
    // Use 60/40 rule
    const totalMatches = matches.length;
    const targetFavorites = Math.round(totalMatches * FAVORITES_RATIO);
    totalPossibleCombos = binomialCoefficient(totalMatches, targetFavorites);
  }

  console.log(`Total possible combinations: ${totalPossibleCombos}`);

  // Generate all combinations
  console.log(`Using ${previousSelections.length} previous selections to avoid duplicates`);
  const result = generatePlayerCombinations(matches, STAKE_AMOUNT, previousSelections, Math.min(100, totalPossibleCombos), favoritesCount, underdogsCount);

  console.log(`Generated ${result.combinations.length} combinations out of ${totalPossibleCombos} possible`);
  console.log('\n=== SAMPLE OF GENERATED COMBINATIONS ===');

  // Display a sample of the combinations (up to 10)
  const sampleSize = Math.min(10, result.combinations.length);
  for (let i = 0; i < sampleSize; i++) {
    const combo = result.combinations[i];
    console.log(`\nCombination ${i + 1}:`);
    console.log(`- Favorites: ${combo.favoriteCount}, Underdogs: ${combo.underdogCount}`);
    console.log(`- Potential Return: ${combo.potentialReturn.toFixed(2)}`);
    console.log('- Selected Players:');
    combo.players.forEach((player, idx) => {
      console.log(`  ${idx + 1}. ${player.name} (${player.isFavorite ? 'Favorite' : 'Underdog'}) with odds ${player.odds}`);
      console.log(`     Match ID: ${player.matchData.matchId}`);
    });
  }

  console.log('\n=== END OF COMBINATIONS SAMPLE ===\n');

  return result;
}

// Start the auto betting process
async function startAutoBetting(stakeAmount = STAKE_AMOUNT, favoritesCount = 0, underdogsCount = 0) {
  if (isAutoBetting) {
    console.log('Auto betting already in progress');
    return { status: 'already_running' };
  }

  try {
    isAutoBetting = true;
    currentAutoBetCount = 0;

    // Reset session data
    autoBetSession = {
      sessionId: Date.now().toString(),
      originalSelections: [],
      alternativeSelections: [],
      completedBets: [],
      failedBets: [],
      allCombinations: [], // Store all generated combinations
      usedCombinationKeys: new Set() // Reset the set of used combination keys
    };

    // Get active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      throw new Error('No active tab found');
    }

    // Retrieve currently selected matches from content script
    const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'getSelectedMatches' });
    if (!response || !response.matches || response.matches.length === 0) {
      throw new Error('No matches selected');
    }

    // Store original selections
    autoBetSession.originalSelections = response.matches;
    console.log(`Retrieved ${response.matches.length} selected matches`);
    console.log('Original match data:');
    response.matches.forEach((match, index) => {
      console.log(`Match ${index + 1}: ${match.team1} vs ${match.team2}`);
      console.log(`  - Selected: ${match.selectedTeam} (Odds: ${match.odds})`);
      console.log(`  - Opponent: ${match.opponentTeam} (Odds: ${match.otherTeamOdds})`);
      console.log(`  - Is Favorite: ${match.isFavorite}`);
      console.log(`  - Match ID: ${match.matchId}`);
    });

    // Get previous selections to avoid duplicates
    let previousSelections = [];
    if (autoBetSession && autoBetSession.completedBets) {
      // Extract keys from completed bets to avoid duplicates
      previousSelections = autoBetSession.completedBets.map(bet => {
        // Create a key from the match IDs and selected teams
        return bet.matches.map(m => `${m.matchId}:${m.selectedTeam}`).sort().join('|');
      });
    }
    console.log(`Found ${previousSelections.length} previous bet combinations to avoid duplicates`);

    // Generate and display all possible bet combinations
    console.log(`Generating combinations with user-specified counts: ${favoritesCount} favorites, ${underdogsCount} underdogs`);
    const combinationsResult = generateAndDisplayAllCombinations(response.matches, favoritesCount, underdogsCount, previousSelections);

    // Store all combinations for reference
    autoBetSession.allCombinations = combinationsResult.combinations;

    // Calculate total possible combinations
    // Check if at least one of the counts is specified (could be 0)
    if (favoritesCount !== undefined || underdogsCount !== undefined) {
      // Use our own implementation directly instead of messaging
      totalPossibleCombinations = calculateTotalPossibleCombinations(
        response.matches,
        favoritesCount,
        underdogsCount
      );
      console.log(`Using user-specified counts: ${favoritesCount} favorites, ${underdogsCount} underdogs - total possible combinations: ${totalPossibleCombinations}`);
    } else {
      // Use our advanced implementation with 60/40 rule
      // Use the stats from the combinations result
      totalPossibleCombinations = combinationsResult.stats.validPossibleCombinations;
      console.log(`Using advanced combination generator - total possible combinations: ${totalPossibleCombinations}`);
    }

    // Ensure we have a reasonable number (at least 1)
    if (totalPossibleCombinations <= 0) {
      totalPossibleCombinations = Math.min(MAX_AUTO_BETS, response.matches.length * 2);
      console.log(`Invalid combination result, using fallback: ${totalPossibleCombinations}`);
    } else {
      console.log(`Calculated total possible combinations: ${totalPossibleCombinations}`);
    }

    // Generate alternative selections with balanced favorites/underdogs ratio
    autoBetSession.alternativeSelections = generateBalancedPlayerSelections(response.matches, favoritesCount, underdogsCount);

    // Generate a key for this initial combination and add it to the used combinations set
    const initialCombinationKey = autoBetSession.alternativeSelections
      .map(match => `${match.matchId}:${match.selectedTeam}`)
      .sort()
      .join('|');

    // Add to used combinations set to prevent duplicates
    autoBetSession.usedCombinationKeys.add(initialCombinationKey);
    console.log(`Added initial combination key to used combinations: ${initialCombinationKey.substring(0, 50)}...`);

    // Log the first set of selections that will be used
    console.log('\n=== FIRST BET COMBINATION TO BE USED ===');
    console.log('Selected match details:');
    autoBetSession.alternativeSelections.forEach((match, index) => {
      console.log(`  Match ${index + 1}: ${match.team1} vs ${match.team2}`);
      console.log(`    - Selected: ${match.selectedTeam} (Odds: ${match.odds})`);
      console.log(`    - Type: ${match.isFavorite ? 'FAVORITE' : 'UNDERDOG'}`);
      console.log(`    - Match ID: ${match.matchId}`);
    });

    // Count favorites vs underdogs
    const selectedFavoritesCount = autoBetSession.alternativeSelections.filter(m => m.isFavorite).length;
    const selectedUnderdogsCount = autoBetSession.alternativeSelections.length - selectedFavoritesCount;
    console.log(`Selection breakdown - ${selectedFavoritesCount} favorites (${Math.round(selectedFavoritesCount/autoBetSession.alternativeSelections.length*100)}%) and ${selectedUnderdogsCount} underdogs (${Math.round(selectedUnderdogsCount/autoBetSession.alternativeSelections.length*100)}%)`);
    console.log('=== END OF FIRST BET COMBINATION ===\n');

    // Show toast notification that betting is starting
    await chrome.tabs.sendMessage(activeTab.id, {
      action: 'showToast',
      message: `Starting auto betting with ${totalPossibleCombinations} combinations`,
      type: 'info',
      duration: 8000
    });

    // Start the auto bet process
    return await processAutoBets(activeTab.id, stakeAmount);
  } catch (error) {
    console.error('Error starting auto betting:', error);
    isAutoBetting = false;
    return { status: 'error', error: error.message };
  }
}

// Stop the auto betting process
async function stopAutoBetting() {
  if (!isAutoBetting) {
    return { status: 'not_running' };
  }

  isAutoBetting = false;

  return {
    status: 'stopped',
    sessionInfo: {
      sessionId: autoBetSession.sessionId,
      completedBets: autoBetSession.completedBets.length,
      failedBets: autoBetSession.failedBets.length
    }
  };
}

// Immediately terminate the auto betting process
async function terminateAutoBetting() {
  console.log('Forcefully terminating auto betting process');

  // Force stop the auto betting
  isAutoBetting = false;

  // Notify any open tabs about the termination
  try {
    // Get all tabs
    const tabs = await chrome.tabs.query({});

    // Find betting site tabs
    for (const tab of tabs) {
      try {
        // Send message to terminate any ongoing operations
        await chrome.tabs.sendMessage(tab.id, { action: 'autoBettingTerminated' });
      } catch (error) {
        // Ignore errors for tabs that don't have our content script
      }
    }

    // Notify UI
    chrome.runtime.sendMessage({
      action: 'autoBettingFailed',
      error: 'Auto betting terminated by user'
    });

    return {
      status: 'terminated',
      sessionInfo: {
        sessionId: autoBetSession.sessionId,
        completedBets: autoBetSession.completedBets.length,
        failedBets: autoBetSession.failedBets.length
      }
    };
  } catch (error) {
    console.error('Error terminating auto betting:', error);
    throw error;
  }
}

// Helper function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

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
  // Log this for debugging purposes
  console.log(`Total possible combinations (2^${totalMatches}): ${Math.pow(2, totalMatches)}`);

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
  // Validate input
  if (!matches || !Array.isArray(matches)) {
    console.error('Invalid matches array:', matches);
    return {};
  }

  // Filter out invalid matches and live matches
  const validMatches = matches.filter(match => {
    if (!match) {
      console.warn('Undefined match found in matches array');
      return false;
    }

    if (!match.matchId) {
      console.warn('Match missing matchId:', match);
      return false;
    }

    if (!match.selectedTeam) {
      console.warn('Match missing selectedTeam:', match);
      return false;
    }

    if (match.isLive) {
      console.log(`Skipping live match: ${match.matchId}`);
      return false;
    }

    return true;
  });

  console.log(`Filtered ${matches.length} matches to ${validMatches.length} valid non-live matches`);

  // Group matches by matchId
  const matchesById = {};
  validMatches.forEach(match => {
    if (!matchesById[match.matchId]) {
      matchesById[match.matchId] = {
        matchId: match.matchId,
        players: []
      };
    }

    // Add this player to the match
    matchesById[match.matchId].players.push({
      name: match.selectedTeam,
      isFavorite: match.isFavorite !== undefined ? match.isFavorite : false, // Default to false if undefined
      odds: match.odds || '2.0', // Default odds if missing
      matchData: match // Store the original match data for reference
    });

    // If we have opponent team info but only one player, add the opponent as well
    if (matchesById[match.matchId].players.length === 1 && match.opponentTeam) {
      console.log(`Adding missing opponent ${match.opponentTeam} for match ${match.matchId}`);

      // Create opponent player data
      const opponentPlayer = {
        name: match.opponentTeam,
        isFavorite: !match.isFavorite, // Opposite of the selected player
        odds: match.otherTeamOdds || '2.0', // Use other team odds if available
        matchData: {
          ...match,
          selectedTeam: match.opponentTeam,
          opponentTeam: match.selectedTeam,
          odds: match.otherTeamOdds || '2.0',
          otherTeamOdds: match.odds || '2.0',
          isFavorite: !match.isFavorite
        }
      };

      // Add the opponent player
      matchesById[match.matchId].players.push(opponentPlayer);
    }
  });

  // Log any matches that still only have one player
  Object.keys(matchesById).forEach(matchId => {
    if (matchesById[matchId].players.length < 2) {
      console.warn(`Match ${matchId} still only has ${matchesById[matchId].players.length} player(s) after processing`);
    }
  });

  return matchesById;
}

/**
 * Generate a unique key for a combination of players
 * @param {Array} selectedPlayers - Array of selected player objects
 * @returns {string} - Unique key for this combination
 */
function getCombinationKey(selectedPlayers) {
  // Validate input
  if (!selectedPlayers || !Array.isArray(selectedPlayers) || selectedPlayers.length === 0) {
    console.error('Invalid selectedPlayers array:', selectedPlayers);
    throw new Error('Invalid selectedPlayers array');
  }

  // Filter out any undefined or invalid players
  const validPlayers = selectedPlayers.filter(player => {
    if (!player) {
      console.warn('Undefined player found in selectedPlayers array');
      return false;
    }
    if (!player.matchData || !player.matchData.matchId) {
      console.warn('Player missing matchData or matchId:', player);
      return false;
    }
    if (!player.name) {
      console.warn('Player missing name:', player);
      return false;
    }
    return true;
  });

  if (validPlayers.length === 0) {
    console.error('No valid players found in selectedPlayers array');
    throw new Error('No valid players found');
  }

  // Sort by matchId to ensure consistent order
  const sortedPlayers = [...validPlayers].sort((a, b) =>
    a.matchData.matchId.localeCompare(b.matchData.matchId)
  );

  // Create a string of matchIds and selected players
  return sortedPlayers
    .map(player => `${player.matchData.matchId}:${player.name}`)
    .join('|');
}

/**
 * Calculate potential return for a combination
 * @param {Array} selectedPlayers - Array of selected player objects
 * @param {number} stake - Stake amount
 * @returns {number} - Potential return
 */
function calculatePotentialReturn(selectedPlayers, stake) {
  // Validate input
  if (!selectedPlayers || !Array.isArray(selectedPlayers)) {
    console.error('Invalid selectedPlayers array:', selectedPlayers);
    return 0;
  }

  if (selectedPlayers.length === 0) {
    console.warn('Empty selectedPlayers array');
    return 0;
  }

  if (isNaN(stake) || stake <= 0) {
    console.warn(`Invalid stake amount: ${stake}, using default 10`);
    stake = 10;
  }

  let totalPotentialReturn = 0;

  selectedPlayers.forEach(player => {
    if (!player) {
      console.warn('Undefined player found in selectedPlayers array');
      return;
    }

    const odds = parseFloat(player.odds);
    if (!isNaN(odds)) {
      const individualReturn = stake * odds;
      totalPotentialReturn += individualReturn;
    } else {
      console.warn(`Invalid odds for player: ${player.name || 'unknown'}, using default 2.0`);
      totalPotentialReturn += stake * 2.0; // Use a default odds value
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
 * @param {number} favoritesCount - Number of favorites to select (optional)
 * @param {number} underdogsCount - Number of underdogs to select (optional)
 * @returns {Object} - Object containing valid combinations and statistics
 */
function generatePlayerCombinations(matches, stake = STAKE_AMOUNT, previousSelections = [], maxCombinations = Infinity, favoritesCount = 0, underdogsCount = 0) {
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
  // Check if specific counts were provided in the function parameters
  let targetFavorites, targetUnderdogs;

  // Use the function parameters directly if provided
  if (favoritesCount !== undefined || underdogsCount !== undefined) {
    // If one count is specified but the other is not, calculate the other
    if (favoritesCount !== undefined && underdogsCount === undefined) {
      targetFavorites = favoritesCount;
      targetUnderdogs = totalMatches - targetFavorites;
    } else if (favoritesCount === undefined && underdogsCount !== undefined) {
      targetUnderdogs = underdogsCount;
      targetFavorites = totalMatches - targetUnderdogs;
    } else {
      // Both counts are specified
      targetFavorites = favoritesCount;
      targetUnderdogs = underdogsCount;
    }

    // Validate that the counts add up to the total matches
    if (targetFavorites + targetUnderdogs !== totalMatches) {
      console.log(`Warning: favoritesCount (${targetFavorites}) + underdogsCount (${targetUnderdogs}) must equal total matches (${totalMatches}). Adjusting...`);
      // Adjust the counts to match the total
      if (targetFavorites > totalMatches) {
        targetFavorites = totalMatches;
        targetUnderdogs = 0;
      } else if (targetUnderdogs > totalMatches) {
        targetUnderdogs = totalMatches;
        targetFavorites = 0;
      } else {
        // Proportionally adjust both counts
        const ratio = targetFavorites / (targetFavorites + targetUnderdogs);
        targetFavorites = Math.round(totalMatches * ratio);
        targetUnderdogs = totalMatches - targetFavorites;
      }
    }

    console.log(`Using user-specified counts: ${targetFavorites} favorites and ${targetUnderdogs} underdogs`);
  } else {
    // If no valid counts were provided, use the default 60/40 ratio
    targetFavorites = Math.round(totalMatches * FAVORITES_RATIO);
    targetUnderdogs = totalMatches - targetFavorites;
    console.log(`Using default 60/40 ratio: ${targetFavorites} favorites (${Math.round(targetFavorites/totalMatches*100)}%) and ${targetUnderdogs} underdogs (${Math.round(targetUnderdogs/totalMatches*100)}%)`);

    // Ensure we have at least one of each type if possible
    if (targetFavorites === totalMatches && totalMatches > 1) {
      targetFavorites = totalMatches - 1;
      targetUnderdogs = 1;
    } else if (targetUnderdogs === totalMatches && totalMatches > 1) {
      targetUnderdogs = totalMatches - 1;
      targetFavorites = 1;
    }
  }

  // Generate all possible combinations using binary representation
  // We'll use a more efficient approach for large numbers of matches

  // If we have a small number of matches, we can generate all combinations
  if (totalMatches <= 30) { // Arbitrary threshold, adjust as needed
    // Generate all 2^n combinations
    for (let i = 0; i < totalPossibleCombinations && validCombinations.length < maxCombinations; i++) {
      const selectedPlayers = [];
      let favoriteCount = 0;

      // For each match, select one player based on the binary representation of i
      for (let j = 0; j < totalMatches; j++) {
        // Use bit j of number i to decide which player to select (0 or 1)
        let actualPlayerIndex = (i >> j) & 1;

        // Make sure we don't try to access a player that doesn't exist
        // Some matches might only have one player in the array
        if (actualPlayerIndex >= matchesArray[j].players.length) {
          console.log(`Warning: Trying to access player at index ${actualPlayerIndex} but match ${matchesArray[j].matchId} only has ${matchesArray[j].players.length} players`);
          // If we only have one player, always use that player regardless of the playerIndex
          if (matchesArray[j].players.length === 1) {
            console.log(`Using the only available player for match ${matchesArray[j].matchId}`);
            actualPlayerIndex = 0; // Force to use the only available player
          } else {
            // Skip this combination if we have no players
            favoriteCount = -1; // This will make the combination invalid
            break;
          }
        }

        const player = matchesArray[j].players[actualPlayerIndex];

        // Check if player is defined before using it
        if (!player) {
          console.log(`Warning: Player at index ${actualPlayerIndex} is undefined for match ${matchesArray[j].matchId}`);
          // Skip this combination
          favoriteCount = -1; // This will make the combination invalid
          break;
        }

        selectedPlayers.push(player);

        if (player.isFavorite) {
          favoriteCount++;
        }
      }

      // Check if this combination satisfies the target favorites count
      if (favoriteCount === targetFavorites) {
        // Generate a unique key for this combination
        const combinationKey = getCombinationKey(selectedPlayers);

        // Check if this combination has been seen before
        if (!seen.has(combinationKey)) {
          // Calculate potential return
          const potentialReturn = calculatePotentialReturn(selectedPlayers, stake);

          // Check if potential return exceeds threshold
          if (potentialReturn <= 250000) {
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

        // Check if match has players
        if (!match.players || match.players.length === 0) {
          console.log(`Warning: Match ${match.matchId} has no players, skipping this combination`);
          // Skip this combination
          selectedPlayers = []; // Clear the array to indicate an invalid combination
          break;
        }

        // Find the favorite player in this match
        const favoritePlayer = match.players.find(p => p.isFavorite);
        if (favoritePlayer) {
          selectedPlayers.push(favoritePlayer);
        } else if (match.players.length > 0) {
          // If no favorite found, use the first player and mark it as a favorite
          console.log(`Warning: No favorite player found for match ${match.matchId}, using first player as fallback`);
          // Create a copy of the player and mark it as a favorite
          const player = {...match.players[0], isFavorite: true};
          // Also update the matchData
          if (player.matchData) {
            player.matchData = {...player.matchData, isFavorite: true};
          }
          selectedPlayers.push(player);
        } else {
          console.log(`Warning: Match ${match.matchId} has no players, skipping this combination`);
          // Skip this combination
          selectedPlayers = []; // Clear the array to indicate an invalid combination
          break;
        }
      }

      // Select underdogs from the remaining matches
      for (let i = targetFavorites; i < totalMatches; i++) {
        const matchIndex = matchIndices[i];
        const match = matchesArray[matchIndex];

        // Check if match has players
        if (!match.players || match.players.length === 0) {
          console.log(`Warning: Match ${match.matchId} has no players, skipping this combination`);
          // Skip this combination
          selectedPlayers = []; // Clear the array to indicate an invalid combination
          break;
        }

        // Find the underdog player in this match
        const underdogPlayer = match.players.find(p => !p.isFavorite);
        if (underdogPlayer) {
          selectedPlayers.push(underdogPlayer);
        } else if (match.players.length > 0) {
          // If no underdog found, use the first player and mark it as an underdog
          console.log(`Warning: No underdog player found for match ${match.matchId}, using first player as fallback`);
          // Create a copy of the player and mark it as an underdog
          const player = {...match.players[0], isFavorite: false};
          // Also update the matchData
          if (player.matchData) {
            player.matchData = {...player.matchData, isFavorite: false};
          }
          selectedPlayers.push(player);
        } else {
          console.log(`Warning: Match ${match.matchId} has no players, skipping this combination`);
          // Skip this combination
          selectedPlayers = []; // Clear the array to indicate an invalid combination
          break;
        }
      }

      // Skip if we have an invalid combination (empty array)
      if (selectedPlayers.length === 0) {
        console.log('Skipping invalid combination (empty array)');
        continue;
      }

      // Generate a unique key for this combination
      try {
        const combinationKey = getCombinationKey(selectedPlayers);

        // Check if this combination has been seen before
        if (!seen.has(combinationKey)) {
          // Calculate potential return
          const potentialReturn = calculatePotentialReturn(selectedPlayers, stake);

          // Check if potential return exceeds threshold
          if (potentialReturn <= 250000) {
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
      } catch (error) {
        console.error('Error processing combination:', error);
        console.log('Problematic players array:', JSON.stringify(selectedPlayers));
        // Continue to the next attempt
        continue;
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


function generateBalancedPlayerSelections(originalMatches, favoritesCount = 0, underdogsCount = 0) {
  const matchesMap = {};

  // Process each match to create player pairs
  originalMatches.forEach(match => {
    if (!matchesMap[match.matchId]) {
      // Create entry for this match with both player options
      const userSelected = match;

      // Create the opposite player data
      const oppositePlayer = {
        matchId: userSelected.matchId,
        tournament: userSelected.tournament,
        timeInfo: userSelected.timeInfo,
        team1: userSelected.team1,
        team2: userSelected.team2,
        selectedTeam: userSelected.opponentTeam,
        opponentTeam: userSelected.selectedTeam,
        odds: userSelected.otherTeamOdds,
        otherTeamOdds: userSelected.odds,
        isFavorite: !userSelected.isFavorite,
        isLive: userSelected.isLive,
        timestamp: Date.now()
      };

      matchesMap[match.matchId] = {
        favorite: userSelected.isFavorite ? userSelected : oppositePlayer,
        underdog: userSelected.isFavorite ? oppositePlayer : userSelected
      };
    }
  });

  // Check if we have any previous bet combinations to avoid duplicates
  let previousSelections = [];
  if (autoBetSession && autoBetSession.completedBets) {
    // Extract keys from completed bets to avoid duplicates
    previousSelections = autoBetSession.completedBets.map(bet => {
      // Create a key from the match IDs and selected teams
      return bet.matches.map(m => `${m.matchId}:${m.selectedTeam}`).sort().join('|');
    });
  }

  // Use the advanced combination generator with error handling
  try {
    console.log(`Generating player combinations for ${originalMatches.length} matches`);
    console.log(`Using specified counts: ${favoritesCount} favorites, ${underdogsCount} underdogs`);

    // Log a sample of the matches for debugging
    if (originalMatches.length > 0) {
      console.log('Sample match data:');
      console.log(JSON.stringify(originalMatches[0]));
    }

    const result = generatePlayerCombinations(originalMatches, STAKE_AMOUNT, previousSelections, 1, favoritesCount, underdogsCount);

    // If we have valid combinations, use the first one
    if (result.combinations && result.combinations.length > 0) {
      console.log(`Generated ${result.combinations.length} valid combinations`);
      console.log(`Stats: ${JSON.stringify(result.stats)}`);

      // Extract the player data from the first combination
      const selectedPlayers = result.combinations[0].players.map(player => player.matchData);

      // Log the selection details
      const favoritesCount = selectedPlayers.filter(p => p.isFavorite).length;
      const underdogsCount = selectedPlayers.length - favoritesCount;

      console.log(`Selected ${selectedPlayers.length} players with ${favoritesCount} favorites (${Math.round(favoritesCount / selectedPlayers.length * 100)}%) and ${underdogsCount} underdogs (${Math.round(underdogsCount / selectedPlayers.length * 100)}%)`);

      return selectedPlayers;
    }
  } catch (error) {
    console.error('Error in generatePlayerCombinations:', error);
    console.log('Falling back to original method due to error');
  }

  // Fallback to the original method if no valid combinations were found
  console.log('No valid combinations found, falling back to original method');

  // Get all match IDs
  const matchIds = Object.keys(matchesMap);

  // Filter out live matches
  const nonLiveMatchIds = matchIds.filter(matchId => !matchesMap[matchId].favorite.isLive);

  if (nonLiveMatchIds.length === 0) {
    console.log('No non-live matches available for betting');
    return [];
  }

  // Determine how many matches should have favorites selected
  const shuffledMatchIds = shuffleArray(nonLiveMatchIds);

  // Use user-specified counts if provided, otherwise use the 60/40 ratio
  let favoritesToSelect;
  // Check if both counts are defined (could be 0) and their sum equals the number of matches
  if (favoritesCount !== undefined && underdogsCount !== undefined &&
      (favoritesCount + underdogsCount) === shuffledMatchIds.length) {
    favoritesToSelect = favoritesCount;
    console.log(`Using user-specified counts: ${favoritesToSelect} favorites and ${shuffledMatchIds.length - favoritesToSelect} underdogs`);
  } else {
    favoritesToSelect = Math.round(shuffledMatchIds.length * FAVORITES_RATIO);
    console.log(`Using default 60/40 ratio: ${favoritesToSelect} favorites and ${shuffledMatchIds.length - favoritesToSelect} underdogs`);
  }

  // Select players from each match based on 60/40 ratio
  const selectedPlayers = [];

  // First, select favorites from the first set of matches (60%)
  for (let i = 0; i < favoritesToSelect && i < shuffledMatchIds.length; i++) {
    const matchId = shuffledMatchIds[i];
    selectedPlayers.push(matchesMap[matchId].favorite);
  }

  // Then, select underdogs from the remaining matches (40%)
  for (let i = favoritesToSelect; i < shuffledMatchIds.length; i++) {
    const matchId = shuffledMatchIds[i];
    selectedPlayers.push(matchesMap[matchId].underdog);
  }

  console.log(`Generated ${selectedPlayers.length} selections with ${favoritesToSelect} favorites (${Math.round(favoritesToSelect / selectedPlayers.length * 100)}%) and ${selectedPlayers.length - favoritesToSelect} underdogs (${Math.round((selectedPlayers.length - favoritesToSelect) / selectedPlayers.length * 100)}%)`);

  return selectedPlayers;
}

// Process auto bets sequentially
async function processAutoBets(tabId, stakeAmount) {
  // Check if we have alternative selections
  if (autoBetSession.alternativeSelections.length === 0) {
    return { status: 'no_alternatives' };
  }

  // Filter out live matches as they may have changed
  const nonLiveMatches = autoBetSession.alternativeSelections.filter(match => !match.isLive);

  if (nonLiveMatches.length === 0) {
    return { status: 'all_matches_live' };
  }

  // Start betting loop (will run in background)
  processBetLoop(tabId, nonLiveMatches, stakeAmount);

  return {
    status: 'started',
    matchCount: nonLiveMatches.length,
    maxCombinations: totalPossibleCombinations
  };
}

// Process bets in a loop
async function processBetLoop(tabId, matches, stakeAmount) {
  // Get all match IDs (for logging purposes)
  // const matchIds = matches.map(match => match.matchId);

  try {
    // Loop until we've placed all bets or reached the total possible combinations
    while (isAutoBetting && currentAutoBetCount < totalPossibleCombinations) {
      console.log(`Auto bet ${currentAutoBetCount + 1} of ${totalPossibleCombinations}`);
      console.log(`Using stake amount: ${stakeAmount}`);

      // 1. Clear existing selections
      console.log('Clearing any existing selections');
      await chrome.tabs.sendMessage(tabId, { action: 'clearSelections' });

      // For each new bet, re-shuffle the selections to get different combinations
      if (currentAutoBetCount > 0) {
        // Get user-specified favorites and underdogs counts from storage
        const storedSettings = await chrome.storage.local.get(['favoritesCount', 'underdogsCount']);
        const userFavoritesCount = storedSettings.favoritesCount || 0;
        const userUnderdogsCount = storedSettings.underdogsCount || 0;

        // Generate new selections with user-specified counts or 60/40 ratio for subsequent bets
        console.log('\n=== GENERATING NEW PLAYER SELECTIONS FOR BET #' + (currentAutoBetCount + 1) + ' ===');
        console.log(`Using counts from storage: ${userFavoritesCount} favorites, ${userUnderdogsCount} underdogs`);

        // Try to generate a unique combination (not used before)
        let maxAttempts = 10; // Limit the number of attempts to avoid infinite loops
        let uniqueCombinationFound = false;
        let newSelections = [];

        while (!uniqueCombinationFound && maxAttempts > 0) {
          newSelections = generateBalancedPlayerSelections(autoBetSession.originalSelections, userFavoritesCount, userUnderdogsCount);

          // Generate a key for this combination
          const selectionKey = newSelections
            .map(match => `${match.matchId}:${match.selectedTeam}`)
            .sort()
            .join('|');

          // Check if this combination has been used before
          if (!autoBetSession.usedCombinationKeys.has(selectionKey)) {
            uniqueCombinationFound = true;
            console.log(`Found unique combination (not used before): ${selectionKey.substring(0, 50)}...`);
          } else {
            console.log(`Combination already used, trying again... (${maxAttempts - 1} attempts remaining)`);
            maxAttempts--;
          }
        }

        if (!uniqueCombinationFound) {
          console.log('WARNING: Could not find a unique combination after multiple attempts.');
          console.log('This may indicate that all possible combinations have been used.');
        }

        autoBetSession.alternativeSelections = newSelections;
        matches = autoBetSession.alternativeSelections.filter(match => !match.isLive);
      }

      // Log the selected match details for this bet
      console.log('\n=== CURRENT BET COMBINATION ===');
      console.log('Selected match details:');
      matches.forEach((match, index) => {
        console.log(`  Match ${index + 1}: ${match.team1} vs ${match.team2}`);
        console.log(`    - Selected: ${match.selectedTeam} (Odds: ${match.odds})`);
        console.log(`    - Type: ${match.isFavorite ? 'FAVORITE' : 'UNDERDOG'}`);
        console.log(`    - Match ID: ${match.matchId}`);
      });

      // Count favorites vs underdogs
      const selectedFavoritesCount = matches.filter(m => m.isFavorite).length;
      const selectedUnderdogsCount = matches.length - selectedFavoritesCount;
      console.log(`Selection breakdown - ${selectedFavoritesCount} favorites (${Math.round(selectedFavoritesCount/matches.length*100)}%) and ${selectedUnderdogsCount} underdogs (${Math.round(selectedUnderdogsCount/matches.length*100)}%)`);
      console.log('=== END OF CURRENT BET COMBINATION ===\n');

      // Create a detailed log of what we're sending to the content script
      console.log('\n=== SENDING TO CONTENT SCRIPT ===');
      console.log('Action: reselectMatches');
      console.log('Match IDs:', matches.map(match => match.matchId));
      console.log('Player Selections:');
      matches.forEach((match, index) => {
        console.log(`  ${index + 1}. Match ID: ${match.matchId}, Selected Team: ${match.selectedTeam}`);
      });
      console.log('=== END OF CONTENT SCRIPT DATA ===\n');

      // 2. Select new matches with balanced player selection
      console.log('Selecting players on the page');
      const reselectionResult = await chrome.tabs.sendMessage(tabId, {
        action: 'reselectMatches',
        matchIds: matches.map(match => match.matchId),
        playerSelections: matches.map(match => ({
          matchId: match.matchId,
          selectedTeam: match.selectedTeam
        }))
      });

      console.log('Reselection result:', reselectionResult);

      if (!reselectionResult || reselectionResult.status !== 'started') {
        console.error('ERROR: Failed to reselect matches');
        throw new Error('Failed to reselect matches');
      }

      // Check if the content script reported any verification issues
      if (reselectionResult.allSelectionsCorrect === false) {
        console.error('SELECTION VERIFICATION FAILED: Content script reported mismatches');
        console.error('Verification details:', reselectionResult.verificationDetails);

        // We'll continue anyway, but log the issue
        console.warn('Continuing with bet despite verification issues - the content script has forced the correct team names');
      } else if (reselectionResult.allSelectionsCorrect === true) {
        console.log('SELECTION VERIFICATION PASSED: Content script confirmed all selections match');
      }

      // Request the current selected matches from content script to verify selections
      console.log('\n=== VERIFYING SELECTIONS IN CONTENT SCRIPT ===');
      try {
        const verificationResponse = await chrome.tabs.sendMessage(tabId, { action: 'getSelectedMatches' });
        if (verificationResponse && verificationResponse.matches) {
          console.log(`Content script has ${verificationResponse.matches.length} selected matches:`);
          verificationResponse.matches.forEach((match, index) => {
            console.log(`  Match ${index + 1}: ${match.team1} vs ${match.team2}`);
            console.log(`    - Selected: ${match.selectedTeam} (Odds: ${match.odds})`);
            console.log(`    - Type: ${match.isFavorite ? 'FAVORITE' : 'UNDERDOG'}`);
            console.log(`    - Match ID: ${match.matchId}`);
          });

          // Compare with what we sent
          console.log('\nComparing with what we sent:');
          const matchesById = {};
          matches.forEach(match => {
            matchesById[match.matchId] = match;
          });

          let mismatchFound = false;
          verificationResponse.matches.forEach(match => {
            const originalMatch = matchesById[match.matchId];
            if (originalMatch) {
              if (originalMatch.selectedTeam !== match.selectedTeam) {
                console.error(`MISMATCH for match ${match.matchId}: Sent ${originalMatch.selectedTeam} but got ${match.selectedTeam}`);
                mismatchFound = true;
              } else {
                console.log(`MATCH for ${match.matchId}: ${match.selectedTeam}`);
              }
            } else {
              console.warn(`Match ${match.matchId} not found in original selection`);
            }
          });

          if (mismatchFound) {
            console.error('SELECTION MISMATCH DETECTED! The content script has different selections than what we sent.');
            console.warn('This should not happen with the improved selection algorithm. Continuing anyway as the content script has forced the correct team names.');
          } else {
            console.log('All selections match what we sent. Proceeding with bet.');
          }
        } else {
          console.warn('Could not verify selections - no response from content script');
        }
      } catch (verificationError) {
        console.error('Error verifying selections:', verificationError);
      }
      console.log('=== END OF SELECTION VERIFICATION ===\n');

      // Calculate theoretical return
      const totalOdds = matches.reduce((acc, match) => acc * parseFloat(match.odds), 1);
      const potentialReturn = stakeAmount * totalOdds;
      console.log(`Total combined odds: ${totalOdds.toFixed(2)}`);
      console.log(`Potential return: ${potentialReturn.toFixed(2)} (stake: ${stakeAmount})`);

      // Generate a key for this combination and add it to the used combinations set
      const currentCombinationKey = matches
        .map(match => `${match.matchId}:${match.selectedTeam}`)
        .sort()
        .join('|');

      // Add to used combinations set to prevent duplicates
      autoBetSession.usedCombinationKeys.add(currentCombinationKey);
      console.log(`Added combination key to used combinations: ${currentCombinationKey.substring(0, 50)}...`);
      console.log(`Total unique combinations used so far: ${autoBetSession.usedCombinationKeys.size}`);

      // 3. PLACE ACTUAL BET instead of just simulating
      console.log('PLACING REAL BET with stake amount:', stakeAmount);

      // Call the placeBetInBetSlip function to place the actual bet
      const betResult = await placeBetInBetSlip(tabId, stakeAmount);

      // 4. Record the result
      if (betResult.success) {
        console.log('Successfully placed bet!');
        autoBetSession.completedBets.push({
          timestamp: Date.now(),
          stake: stakeAmount,
          simulated: false,
          potentialReturn: potentialReturn,
          totalOdds: totalOdds,
          matches: matches.map(match => ({
            matchId: match.matchId,
            selectedTeam: match.selectedTeam,
            odds: match.odds,
            isFavorite: match.isFavorite
          }))
        });
      } else if (betResult.skipped && betResult.reason === 'high_return') {
        console.log('Bet was skipped due to high estimated return (exceeds $250,000)');
        autoBetSession.failedBets.push({
          timestamp: Date.now(),
          error: 'Skipped: Estimated return exceeds $250,000',
          skipped: true,
          reason: 'high_return',
          stake: stakeAmount,
          matches: matches.map(match => ({
            matchId: match.matchId,
            selectedTeam: match.selectedTeam,
            odds: match.odds,
            isFavorite: match.isFavorite
          }))
        });

        // Log the skipped bet
        await logBetCombination(
          matches,
          stakeAmount,
          'Single Bets',
          matches,
          potentialReturn,
          'skipped',
          0
        );
      } else {
        console.error('Failed to place bet:', betResult.error);
        autoBetSession.failedBets.push({
          timestamp: Date.now(),
          error: betResult.error,
          stake: stakeAmount,
          matches: matches.map(match => ({
            matchId: match.matchId,
            selectedTeam: match.selectedTeam
          }))
        });
      }

      // 5. Increment counter
      currentAutoBetCount++;

      // Notify about progress
      chrome.runtime.sendMessage({
        action: 'autoBettingProgress',
        current: currentAutoBetCount,
        total: totalPossibleCombinations,
        lastBet: {
          potentialReturn: potentialReturn,
          matches: matches.length,
          favorites: 0,
          underdogs: 0,
          success: betResult.success
        }
      });

      // Show toast notification about progress
      try {
        // Calculate remaining combinations
        const remainingCombinations = totalPossibleCombinations - currentAutoBetCount;

        // Show toast with progress information
        await chrome.tabs.sendMessage(tabId, {
          action: 'showToast',
          message: betResult.success ?
            `Bet ${currentAutoBetCount} of ${totalPossibleCombinations} placed successfully. ${remainingCombinations} combinations remaining.` :
            betResult.skipped ?
              `Bet ${currentAutoBetCount} of ${totalPossibleCombinations} skipped (high return). ${remainingCombinations} combinations remaining.` :
              `Bet ${currentAutoBetCount} of ${totalPossibleCombinations} failed. ${remainingCombinations} combinations remaining.`,
          type: betResult.success ? 'success' : betResult.skipped ? 'warning' : 'error',
          duration: 5000
        });
      } catch (error) {
        console.error('Error showing progress toast:', error);
      }

      console.log(`Completed bet ${currentAutoBetCount} of ${totalPossibleCombinations}`);
      console.log('---------------------------------------');

      // 6. Delay before next attempt
      console.log(`Waiting ${DELAY_BETWEEN_ATTEMPTS}ms before next bet`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_ATTEMPTS));
    }

    console.log('Auto betting completed');
    console.log('BETTING SUMMARY:');
    console.log(`- Total successful bets: ${autoBetSession.completedBets.length}`);
    console.log(`- Total failed bets: ${autoBetSession.failedBets.length}`);
    console.log(`- Original selections: ${autoBetSession.originalSelections.length} matches`);

    // Show toast notification that betting is completed
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        await chrome.tabs.sendMessage(activeTab.id, {
          action: 'showToast',
          message: `Auto betting completed: ${autoBetSession.completedBets.length} successful, ${autoBetSession.failedBets.length} failed`,
          type: 'success',
          duration: 10000
        });
      }
    } catch (error) {
      console.error('Error showing completion toast:', error);
    }

    // Calculate average stats
    const favoritePercentage = autoBetSession.completedBets.reduce((acc, bet) => {
      const favorites = bet.matches.filter(m => m.isFavorite).length;
      return acc + (favorites / bet.matches.length);
    }, 0) / autoBetSession.completedBets.length * 100;

    console.log(`- Average favorites percentage: ${favoritePercentage.toFixed(1)}%`);

    isAutoBetting = false;

    // Notify any listeners that auto betting has completed
    chrome.runtime.sendMessage({
      action: 'autoBettingCompleted',
      sessionInfo: {
        sessionId: autoBetSession.sessionId,
        completedBets: autoBetSession.completedBets.length,
        failedBets: autoBetSession.failedBets.length,
        favoritePercentage: favoritePercentage,
        simulationMode: false
      }
    });

  } catch (error) {
    console.error('ERROR: Error in auto betting process:', error);
    isAutoBetting = false;

    // Notify any listeners that auto betting has failed
    chrome.runtime.sendMessage({
      action: 'autoBettingFailed',
      error: error.message,
      simulationMode: false
    });
  }
}

// Place bet in betslip
async function placeBetInBetSlip(tabId, stakeAmount) {
  try {
    // 1. Wait for bet slip to be available
    const waitResult = await chrome.tabs.sendMessage(tabId, { action: 'waitForBetSlip' });
    if (!waitResult.success) {
      throw new Error('Bet slip not found: ' + (waitResult.error || 'Unknown error'));
    }

    // 2. Navigate to MultiBet section
    const navResult = await chrome.tabs.sendMessage(tabId, { action: 'navigateToMultiBet' });
    if (!navResult.success) {
      throw new Error('Failed to navigate to MultiBet section: ' + (navResult.error || 'Unknown error'));
    }

    // 3. Enter stake amount
    const stakeResult = await chrome.tabs.sendMessage(tabId, {
      action: 'enterStakeAmount',
      amount: stakeAmount.toString()
    });
    if (!stakeResult.success) {
      throw new Error('Failed to enter stake amount: ' + (stakeResult.error || 'Unknown error'));
    }

    // 4. Click "Place Bets" button
    const placeResult = await chrome.tabs.sendMessage(tabId, { action: 'clickPlaceBets' });

    // Check if the bet was skipped due to high estimated return
    if (placeResult === false) {
      console.log('Bet was skipped due to high estimated return');
      return { success: false, skipped: true, reason: 'high_return' };
    }

    if (!placeResult.success) {
      throw new Error('Failed to place bet: ' + (placeResult.error || 'Unknown error'));
    }

    // If we get here, all steps succeeded
    console.log('Successfully placed bet with stake amount:', stakeAmount);
    return { success: true };

  } catch (error) {
    console.error('Error placing bet in bet slip:', error);
    return { success: false, error: error.message };
  }
}

// Initialize
init();