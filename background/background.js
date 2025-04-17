// Background script for the Bot Extension

// Global variables
let botInterval = null;
let betVariationInterval = null;
let delay = 1000; // Default delay
let selectedMatches = [];

// We'll only use single bets but with different player selections
const betVariations = ['Single Bets'];

// Keep track of previous selections to avoid duplicates
let previousSelections = [];

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log('Bot Extension installed');

  // Initialize default settings
  chrome.storage.local.set({
    isRunning: false,
    delay: 1000,
    selectedMatches: [],
    confirmedMatches: [],
    stakeAmount: 10,
    betVariationActive: false,
    lastVariationIndex: -1,
    betHistory: [],
    previousSelections: []
  });

  // Load previous selections from storage
  chrome.storage.local.get(['previousSelections'], (result) => {
    if (result.previousSelections) {
      previousSelections = result.previousSelections;
    }
  });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    console.log('Background received message:', message);

    if (message.action === 'startBot') {
      startBot(message.delay);
      sendResponse({ status: 'Bot started' });
    }
    else if (message.action === 'stopBot') {
      stopBot();
      sendResponse({ status: 'Bot stopped' });
    }
    else if (message.action === 'getStatus') {
      sendResponse({
        isRunning: botInterval !== null,
        delay: delay
      });
    }
    else if (message.action === 'matchesUpdated') {
      // Update our local copy of the matches
      selectedMatches = message.matches || [];

      // Update badge with count of selected matches
      updateBadge();

      sendResponse({ status: 'Matches updated' });
    }
    else if (message.action === 'startBetVariations') {
      // Start bet variations
      startBetVariations(message.matches, message.stake);
      sendResponse({ status: 'Bet variations started' });
    }
    else if (message.action === 'stopBetVariations') {
      // Stop bet variations
      stopBetVariations();
      sendResponse({ status: 'Bet variations stopped' });
    }
  } catch (error) {
    console.error('Error handling message in background script:', error);
    sendResponse({ error: error.message });
  }

  // Return true to indicate that we will send a response asynchronously
  return true;
});

// Update the extension badge with the count of selected matches
function updateBadge() {
  try {
    const count = selectedMatches.length;

    if (count > 0) {
      // Set badge text to the count
      chrome.action.setBadgeText({ text: count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    } else {
      // Clear badge when no matches
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('Error updating badge:', error);
    // Non-critical error, can be ignored
  }
}

// Start bet variations
async function startBetVariations(matches, stake) {
  try {
    // If already running, stop it first
    if (betVariationInterval) {
      stopBetVariations();
    }

    console.log(`Starting bet variations with ${matches.length} matches and $${stake} stake`);

    // Reset previous selections when starting a new session
    await chrome.storage.local.set({ previousSelections: [] });
    previousSelections = [];

    // Set bet variation active
    await chrome.storage.local.set({ betVariationActive: true });

    // Start the bet variation loop
    betVariationInterval = setInterval(async () => {
      try {
        // Check if variations are still active
        const status = await chrome.storage.local.get(['betVariationActive', 'confirmedMatches', 'previousSelections']);
        if (!status.betVariationActive) {
          stopBetVariations();
          return;
        }

        // Get the latest confirmed matches
        const currentMatches = status.confirmedMatches || matches;
        const currentPreviousSelections = status.previousSelections || [];

        if (currentMatches.length === 0) {
          console.log('No matches available for betting');
          return;
        }

        // Calculate total possible combinations
        const totalPossibleCombinations = calculateTotalPossibleCombinations(currentMatches);

        // Check if we've tried all possible combinations
        if (currentPreviousSelections.length >= totalPossibleCombinations) {
          console.log(`All possible combinations (${totalPossibleCombinations}) have been tried. Stopping bet variations.`);
          stopBetVariations();

          // Notify any open pages that all combinations have been tried
          chrome.runtime.sendMessage({
            action: 'allCombinationsTried',
            totalCombinations: totalPossibleCombinations
          });
          return;
        }

        // Always use Single Bets variation type
        const variationType = 'Single Bets';
        const variationIndex = 0;

        console.log(`Placing bet with random player selection (${currentPreviousSelections.length}/${totalPossibleCombinations} combinations tried)`);

        // Try to place a bet with the current matches
        // If it returns false, it means this combination was already used
        // We'll try again on the next interval
        const success = await placeBet(currentMatches, stake, variationType, variationIndex);

        if (success) {
          // Notify any open pages about the update
          chrome.runtime.sendMessage({
            action: 'betVariationUpdated',
            variationIndex: variationIndex
          });
        }
      } catch (error) {
        console.error('Error in bet variation interval:', error);
      }
    }, 15000); // Try a new random selection every 15 seconds
  } catch (error) {
    console.error('Error starting bet variations:', error);
  }
}

// Stop bet variations
function stopBetVariations() {
  if (betVariationInterval) {
    clearInterval(betVariationInterval);
    betVariationInterval = null;
    console.log('Bet variations stopped');

    // Set bet variation inactive
    chrome.storage.local.set({ betVariationActive: false });
  }
}

// Place a bet with player selection following the 60/40 rule
async function placeBet(allMatches, stake, variationType, variationIndex) {
  try {
    // Get previous selections from storage to avoid duplicates
    const storageResult = await chrome.storage.local.get(['previousSelections']);
    previousSelections = storageResult.previousSelections || [];

    // Filter out live matches
    const nonLiveMatches = allMatches.filter(match => !match.isLive);

    if (nonLiveMatches.length === 0) {
      console.log('No non-live matches available for betting');
      return false;
    }

    // Create a map of matches by matchId
    const matchesMap = {};

    // Process each match to create player pairs
    nonLiveMatches.forEach(match => {
      if (!matchesMap[match.matchId]) {
        // Initialize with the user's selected player
        matchesMap[match.matchId] = {
          userSelected: match,
          opposite: null
        };
      }
    });

    // For each match, create the opposite player selection
    Object.keys(matchesMap).forEach(matchId => {
      const userSelected = matchesMap[matchId].userSelected;

      // Create the opposite player data
      const oppositePlayer = {
        matchId: userSelected.matchId,
        tournament: userSelected.tournament,
        timeInfo: userSelected.timeInfo,
        team1: userSelected.team1,
        team2: userSelected.team2,
        selectedTeam: userSelected.opponentTeam, // Select the opposite player
        opponentTeam: userSelected.selectedTeam, // The original selected player becomes the opponent
        odds: userSelected.otherTeamOdds,
        otherTeamOdds: userSelected.odds,
        isFavorite: !userSelected.isFavorite, // Opposite favorite status
        isLive: userSelected.isLive,
        timestamp: Date.now()
      };

      matchesMap[matchId].opposite = oppositePlayer;
    });

    // Get unique match IDs
    const uniqueMatchIds = Object.keys(matchesMap);
    console.log(`Available non-live unique matches: ${uniqueMatchIds.length}`);

    if (uniqueMatchIds.length === 0) {
      console.log('No unique matches available for betting');
      return false;
    }

    // Determine how many matches should have favorites selected (60%)
    const favoritesToSelect = Math.round(uniqueMatchIds.length * 0.6);
    const underdogsToSelect = uniqueMatchIds.length - favoritesToSelect;

    console.log(`Selecting players from ${uniqueMatchIds.length} matches: ${favoritesToSelect} favorites (60%) and ${underdogsToSelect} underdogs (40%)`);

    // Shuffle the match IDs to randomize selection
    const shuffledMatchIds = shuffleArray([...uniqueMatchIds]);

    // Select players from each match
    const selectedMatches = [];

    // For each match, randomly decide whether to use the user's selection or the opposite player
    // This ensures we generate all possible combinations over time
    shuffledMatchIds.forEach((matchId, index) => {
      const matchData = matchesMap[matchId];
      const useUserSelection = Math.random() < 0.5; // 50% chance to use user's selection

      // For the first favoritesToSelect matches, we want to select favorites
      if (index < favoritesToSelect) {
        // We need a favorite player for this position
        if (matchData.userSelected.isFavorite && useUserSelection) {
          // User selected a favorite and we randomly chose to use it
          selectedMatches.push(matchData.userSelected);
        } else if (matchData.opposite.isFavorite) {
          // Opposite player is a favorite, use it
          selectedMatches.push(matchData.opposite);
        } else {
          // Neither is a favorite (shouldn't happen), use whatever we have
          selectedMatches.push(useUserSelection ? matchData.userSelected : matchData.opposite);
        }
      } else {
        // For the remaining matches, we want to select underdogs
        // We need an underdog player for this position
        if (!matchData.userSelected.isFavorite && useUserSelection) {
          // User selected an underdog and we randomly chose to use it
          selectedMatches.push(matchData.userSelected);
        } else if (!matchData.opposite.isFavorite) {
          // Opposite player is an underdog, use it
          selectedMatches.push(matchData.opposite);
        } else {
          // Neither is an underdog (shouldn't happen), use whatever we have
          selectedMatches.push(useUserSelection ? matchData.userSelected : matchData.opposite);
        }
      }
    });

    // Check if this exact combination has been used before
    const selectionKey = getSelectionKey(selectedMatches);

    // Get the user's original selections to compare against
    const userSelectionKey = getSelectionKey(nonLiveMatches);

    // Check if this combination matches the user's original selection
    if (selectionKey === userSelectionKey) {
      console.log('This combination matches the user\'s original selection, skipping...');
      return false; // Skip this combination
    }

    // Check if this combination has been tried before
    if (previousSelections.includes(selectionKey)) {
      console.log('This exact combination has been used before, skipping...');
      return false; // Skip this combination
    }

    // Calculate potential return based on odds
    const potentialReturn = calculatePotentialReturn(selectedMatches, stake, variationType);

    // Check if potential return exceeds threshold (650,000 units)
    if (potentialReturn > 650000) {
      console.log(`Potential return exceeds threshold: ${potentialReturn} > 650,000 units, skipping...`);
      return false; // Skip this combination
    }

    // Add this combination to previous selections
    previousSelections.push(selectionKey);
    await chrome.storage.local.set({ previousSelections });

    // Create a new bet entry
    const betId = Date.now().toString();
    const timestamp = Date.now();

    // Prepare simplified match data for storage
    const simplifiedMatches = selectedMatches.map(match => ({
      matchId: match.matchId,
      team1: match.team1 || 'Unknown Team 1',
      team2: match.team2 || 'Unknown Team 2',
      selectedTeam: match.selectedTeam || 'Unknown Selection',
      opponentTeam: match.opponentTeam || 'Unknown Opponent',
      odds: match.odds || '1.0',
      tournament: match.tournament || 'Unknown Tournament',
      isFavorite: match.isFavorite,
      isLive: match.isLive || false
    }));

    // We already calculated the potential return earlier
    // Just use it here for the bet object

    // Create bet object
    const bet = {
      betId,
      matches: simplifiedMatches,
      stake,
      variationType,
      variationIndex,
      potentialReturn,
      timestamp,
      result: 'pending' // pending, win, loss
    };

    // Add to bet history
    const result = await chrome.storage.local.get(['betHistory']);
    const betHistory = result.betHistory || [];
    betHistory.push(bet);

    // Save updated bet history
    await chrome.storage.local.set({ betHistory });

    // Notify any open pages about the update
    chrome.runtime.sendMessage({
      action: 'betHistoryUpdated',
      betHistory: betHistory
    });

    console.log(`Bet placed: ${variationType} with $${stake} stake, ${selectedMatches.length} matches`);
    return true;
  } catch (error) {
    console.error('Error placing bet:', error);
    return false;
  }
}

// Helper function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Helper function to generate a unique key for a selection of matches
function getSelectionKey(matches) {
  // Sort by matchId to ensure consistent order
  const sortedMatches = [...matches].sort((a, b) => a.matchId.localeCompare(b.matchId));

  // Create a map of matchId to selectedTeam to handle multiple players from the same match
  const matchSelections = {};
  sortedMatches.forEach(match => {
    matchSelections[match.matchId] = match.selectedTeam;
  });

  // Create a string of matchIds and selected teams
  return Object.entries(matchSelections)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([matchId, selectedTeam]) => `${matchId}:${selectedTeam}`)
    .join('|');
}

// Calculate potential return based on odds and variation
function calculatePotentialReturn(matches, stake, variationType) {
  // For single bets, we calculate the total potential return by summing individual returns
  // This is different from accumulators where odds are multiplied

  // Calculate the total potential return for all matches
  let totalPotentialReturn = 0;
  matches.forEach(match => {
    const odds = parseFloat(match.odds);
    if (!isNaN(odds)) {
      // For each match, calculate individual return (stake * odds)
      const individualReturn = stake * odds;
      totalPotentialReturn += individualReturn;
    }
  });

  return totalPotentialReturn;
}

// Helper function to calculate combinations C(n,k)
function calculateCombinations(n, k) {
  // If k is greater than n, return 0
  if (k > n) return 0;

  // If k is 0 or equal to n, return 1
  if (k === 0 || k === n) return 1;

  // Use the symmetry of combinations: C(n,k) = C(n,n-k)
  if (k > n - k) k = n - k;

  // Calculate C(n,k)
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result *= (n - (k - i));
    result /= i;
  }

  return Math.round(result);
}

// Calculate total possible combinations based on the 60/40 rule
function calculateTotalPossibleCombinations(matches) {
  // Filter out live matches as they are skipped in the betting algorithm
  const nonLiveMatches = matches.filter(match => !match.isLive);

  if (nonLiveMatches.length === 0) {
    return 0;
  }

  // Count favorites and underdogs
  const favorites = nonLiveMatches.filter(match => match.isFavorite);
  const underdogs = nonLiveMatches.filter(match => !match.isFavorite);

  // Calculate how many favorites and underdogs to select based on 60/40 rule
  const totalMatches = nonLiveMatches.length;
  const favoritesToSelect = Math.round(totalMatches * 0.6);
  const underdogsToSelect = totalMatches - favoritesToSelect;

  // Calculate total possible combinations based on the 60/40 rule
  // This is the number of ways to select favoritesToSelect from favorites
  // multiplied by the number of ways to select underdogsToSelect from underdogs
  let totalPossibleCombinations = 0;

  // If we have enough favorites and underdogs, calculate combinations
  if (favorites.length >= favoritesToSelect && underdogs.length >= underdogsToSelect) {
    // Calculate combinations using the formula: C(n,k) = n! / (k! * (n-k)!)
    // For favorites: C(favorites.length, favoritesToSelect)
    const favoritesCombinations = calculateCombinations(favorites.length, favoritesToSelect);

    // For underdogs: C(underdogs.length, underdogsToSelect)
    const underdogsCombinations = calculateCombinations(underdogs.length, underdogsToSelect);

    // Total combinations is the product of these two values
    totalPossibleCombinations = favoritesCombinations * underdogsCombinations;
  } else {
    // If we don't have enough favorites or underdogs, calculate based on what we have
    const maxFavoritesToSelect = Math.min(favoritesToSelect, favorites.length);
    const maxUnderdogsToSelect = Math.min(underdogsToSelect, underdogs.length);

    // Calculate combinations
    const favoritesCombinations = calculateCombinations(favorites.length, maxFavoritesToSelect);
    const underdogsCombinations = calculateCombinations(underdogs.length, maxUnderdogsToSelect);

    totalPossibleCombinations = favoritesCombinations * underdogsCombinations;
  }

  return totalPossibleCombinations;
}

// Start the bot automation
function startBot(newDelay) {
  // If already running, stop it first
  if (botInterval) {
    stopBot();
  }

  // Update delay if provided
  if (newDelay) {
    delay = newDelay;
  }

  console.log(`Starting bot with ${delay}ms delay`);

  // Start the automation loop
  botInterval = setInterval(async () => {
    try {
      // Get the active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (activeTab) {
        // Execute the bot action on the active tab
        chrome.tabs.sendMessage(activeTab.id, {
          action: 'performBotAction',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error in bot interval:', error);
    }
  }, delay);
}

// Stop the bot automation
function stopBot() {
  if (botInterval) {
    clearInterval(botInterval);
    botInterval = null;
    console.log('Bot stopped');
  }
}

// Listen for tab updates to check if we need to inject the content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if the bot is running
    chrome.storage.local.get(['isRunning'], (result) => {
      if (result.isRunning) {
        // Notify the content script that the bot is running
        chrome.tabs.sendMessage(tabId, { action: 'botStatus', isRunning: true });
      }
    });
  }
});
