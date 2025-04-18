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
    favoritesCount: 2,
    underdogsCount: 2,
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
      // Start bet variations with favorites and underdogs counts
      startBetVariations(message.matches, message.stake, message.favoritesCount, message.underdogsCount);
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
async function startBetVariations(matches, stake, favoritesCount, underdogsCount) {
  try {
    // If already running, stop it first
    if (betVariationInterval) {
      stopBetVariations();
    }

    console.log(`Starting bet variations with ${matches.length} matches, $${stake} stake, ${favoritesCount} favorites, ${underdogsCount} underdogs`);

    // Reset previous selections when starting a new session
    await chrome.storage.local.set({ previousSelections: [] });
    previousSelections = [];

    // Initialize a counter for failed attempts
    let failedAttempts = 0;

    // Set bet variation active
    await chrome.storage.local.set({ betVariationActive: true });

    // Start the bet variation loop
    betVariationInterval = setInterval(async () => {
      try {
        // Check if variations are still active
        const status = await chrome.storage.local.get(['betVariationActive', 'confirmedMatches', 'previousSelections', 'favoritesCount', 'underdogsCount']);
        if (!status.betVariationActive) {
          stopBetVariations();
          return;
        }

        // Get the latest confirmed matches and settings
        const currentMatches = status.confirmedMatches || matches;
        const currentPreviousSelections = status.previousSelections || [];
        const currentFavoritesCount = status.favoritesCount || favoritesCount;
        const currentUnderdogsCount = status.underdogsCount || underdogsCount;

        if (currentMatches.length === 0) {
          console.log('No matches available for betting');
          return;
        }

        // Calculate total possible combinations using user-specified counts
        const totalPossibleCombinations = calculateTotalPossibleCombinations(currentMatches, currentFavoritesCount, currentUnderdogsCount);

        // Log detailed information about the current state
        const nonLiveMatches = currentMatches.filter(match => !match.isLive);
        const favorites = nonLiveMatches.filter(match => match.isFavorite);
        const underdogs = nonLiveMatches.filter(match => !match.isFavorite);
        console.log(`Current state: ${nonLiveMatches.length} non-live matches (${favorites.length} favorites, ${underdogs.length} underdogs)`);
        console.log(`Target selection: ${currentFavoritesCount} favorites, ${currentUnderdogsCount} underdogs`);
        console.log(`Combinations tried: ${currentPreviousSelections.length} out of ${totalPossibleCombinations} possible`);

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
          // Reset failed attempts counter on success
          failedAttempts = 0;

          // Notify any open pages about the update
          chrome.runtime.sendMessage({
            action: 'betVariationUpdated',
            variationIndex: variationIndex
          });
        } else {
          // Increment failed attempts counter
          failedAttempts++;
          console.log(`Failed attempt #${failedAttempts} to generate a unique combination`);

          // If we've had too many failed attempts in a row, it might mean we're stuck
          if (failedAttempts >= 10) {
            console.log(`Had ${failedAttempts} failed attempts in a row. This might indicate we've tried all practical combinations.`);
            console.log(`Current combinations tried: ${currentPreviousSelections.length} out of ${totalPossibleCombinations} theoretical combinations.`);

            // Reset the counter to avoid stopping too early
            failedAttempts = 0;
          }
        }
      } catch (error) {
        console.error('Error in bet variation interval:', error);
      }
    }, 5000); // Every 5 seconds
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

// Place a bet with player selection using user-specified favorites and underdogs counts
async function placeBet(allMatches, stake, variationType, variationIndex) {
  try {
    // Get previous selections and user settings from storage
    const storageResult = await chrome.storage.local.get(['previousSelections', 'favoritesCount', 'underdogsCount']);
    previousSelections = storageResult.previousSelections || [];
    const userFavoritesCount = storageResult.favoritesCount || 0;
    const userUnderdogsCount = storageResult.underdogsCount || 0;
    
    // If user hasn't specified counts, use default values
    const targetFavoritesCount = userFavoritesCount > 0 ? userFavoritesCount : 2;
    const targetUnderdogsCount = userUnderdogsCount > 0 ? userUnderdogsCount : 2;
    
    // Total matches to select
    const totalMatchesToSelect = targetFavoritesCount + targetUnderdogsCount;
    
    console.log(`Target selection: ${targetFavoritesCount} favorites and ${targetUnderdogsCount} underdogs (total: ${totalMatchesToSelect} matches)`);

    // Filter out live matches
    const nonLiveMatches = allMatches.filter(match => !match.isLive);

    if (nonLiveMatches.length === 0) {
      console.log('No non-live matches available for betting');
      return false;
    }

    // Create a map of matches by matchId
    const matchesMap = {};

    // Process each match to create player pairs and determine odds-based favorite status
    nonLiveMatches.forEach(match => {
      if (!matchesMap[match.matchId]) {
        // Get odds and determine favorite status
        const selectedOdds = parseFloat(match.odds);
        const opponentOdds = parseFloat(match.otherTeamOdds);
        
        let favoriteSelection, underdogSelection;
        
        // Check for valid odds
        if (!isNaN(selectedOdds) && !isNaN(opponentOdds)) {
          // User's selection is favorite if odds are lower than opponent
          if (selectedOdds < opponentOdds) {
            // User selected the favorite
            match.isFavorite = true;
            favoriteSelection = match;
            
            // Create the opposite player (underdog)
            underdogSelection = {
              matchId: match.matchId,
              tournament: match.tournament,
              timeInfo: match.timeInfo,
              team1: match.team1,
              team2: match.team2,
              selectedTeam: match.opponentTeam,
              opponentTeam: match.selectedTeam,
              odds: match.otherTeamOdds,
              otherTeamOdds: match.odds,
              isFavorite: false,
              isLive: match.isLive,
              timestamp: Date.now()
            };
          } else {
            // User selected the underdog
            match.isFavorite = false;
            underdogSelection = match;
            
            // Create the opposite player (favorite)
            favoriteSelection = {
              matchId: match.matchId,
              tournament: match.tournament,
              timeInfo: match.timeInfo,
              team1: match.team1,
              team2: match.team2,
              selectedTeam: match.opponentTeam,
              opponentTeam: match.selectedTeam,
              odds: match.otherTeamOdds,
              otherTeamOdds: match.odds,
              isFavorite: true,
              isLive: match.isLive,
              timestamp: Date.now()
            };
          }
          
          // Store both selections
          matchesMap[match.matchId] = {
            favorite: favoriteSelection,
            underdog: underdogSelection
          };
        }
      }
    });

    // Get unique match IDs
    const uniqueMatchIds = Object.keys(matchesMap);
    console.log(`Available non-live unique matches: ${uniqueMatchIds.length}`);

    if (uniqueMatchIds.length < totalMatchesToSelect) {
      console.log(`Not enough matches available for betting. Need ${totalMatchesToSelect}, have ${uniqueMatchIds.length}`);
      return false;
    }

    // Shuffle the match IDs to randomize selection
    const shuffledMatchIds = shuffleArray([...uniqueMatchIds]);
    
    // Select a subset of matches to use in this bet
    const selectedMatchIds = shuffledMatchIds.slice(0, totalMatchesToSelect);
    
    // Randomly decide which matches will use favorites and which will use underdogs
    shuffleArray(selectedMatchIds);
    
    // First N matches will use favorites, remaining will use underdogs
    const favoriteMatchIds = selectedMatchIds.slice(0, targetFavoritesCount);
    const underdogMatchIds = selectedMatchIds.slice(targetFavoritesCount, totalMatchesToSelect);
    
    // Create the final selection of players
    const selectedMatches = [];
    
    // Add favorite players
    favoriteMatchIds.forEach(matchId => {
      selectedMatches.push(matchesMap[matchId].favorite);
    });
    
    // Add underdog players
    underdogMatchIds.forEach(matchId => {
      selectedMatches.push(matchesMap[matchId].underdog);
    });
    
    // Shuffle the final selection to mix favorites and underdogs
    shuffleArray(selectedMatches);

    // Check if this exact combination has been used before
    const selectionKey = getSelectionKey(selectedMatches);

    // Check if this combination has been tried before
    if (previousSelections.includes(selectionKey)) {
      console.log(`This exact combination has been used before, skipping... (${previousSelections.length} combinations tried so far)`);
      return false; // Skip this combination
    }

    // Log the current combination details
    const favoriteCount = selectedMatches.filter(match => match.isFavorite).length;
    const underdogCount = selectedMatches.length - favoriteCount;
    console.log(`Generated combination with ${favoriteCount} favorites and ${underdogCount} underdogs from ${totalMatchesToSelect} unique matches`);
    console.log(`Current combination key: ${selectionKey.substring(0, 50)}...`);

    // Calculate potential return based on odds
    const potentialReturn = calculatePotentialReturn(selectedMatches, stake, variationType);

    // Check if potential return exceeds threshold (650,000 units) as per PRD
    if (potentialReturn > 650000) {
      console.log(`Potential return exceeds threshold: ${potentialReturn} > 650,000 units, skipping...`);
      
      // Add this combination to previous selections even though we're skipping it
      // This prevents trying this high-return combination again
      previousSelections.push(selectionKey);
      await chrome.storage.local.set({ previousSelections });
      
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

    // Create bet object
    const bet = {
      betId,
      matches: simplifiedMatches,
      stake,
      variationType,
      variationIndex,
      potentialReturn,
      timestamp,
      result: 'pending', // pending, win, loss
      favoriteCount,
      underdogCount
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

    console.log(`Bet placed: ${variationType} with $${stake} stake, ${selectedMatches.length} matches (${favoriteCount} favorites, ${underdogCount} underdogs)`);
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

  // Calculate C(n,k) using a more numerically stable method
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result *= (n - (i - 1));
    result /= i;
  }

  return Math.round(result);
}

// Calculate total possible combinations based on user-specified counts
function calculateTotalPossibleCombinations(matches, favoritesCount, underdogsCount) {
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
  
  // The total of favorites and underdogs must not exceed the number of matches
  if (favoritesCount + underdogsCount > totalUniqueMatches) {
    console.log(`Invalid selection: favoritesCount (${favoritesCount}) + underdogsCount (${underdogsCount}) exceeds available matches (${totalUniqueMatches})`);
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
