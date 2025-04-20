// Auto Bet Handler
// This module handles automatically reselecting matches with different players and placing bets

// Configuration constants
const STAKE_AMOUNT = 0.10; // Default stake amount in USD
const DELAY_BETWEEN_ATTEMPTS = 2000; // Delay between attempts in ms
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
  failedBets: []
};

// Export variables and functions for use in background.js
export { isAutoBetting, MAX_AUTO_BETS, startAutoBetting, stopAutoBetting, terminateAutoBetting };

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
    const userFavoritesCount = message.favoritesCount || 0;
    const userUnderdogsCount = message.underdogsCount || 0;
    
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
      failedBets: []
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

    // Calculate total possible combinations
    if (favoritesCount > 0 && underdogsCount > 0) {
      // Use our own implementation directly instead of messaging
      totalPossibleCombinations = calculateTotalPossibleCombinations(
        response.matches, 
        favoritesCount, 
        underdogsCount
      );
      
      // Ensure we have a reasonable number (at least 1)
      if (totalPossibleCombinations <= 0) {
        totalPossibleCombinations = Math.min(MAX_AUTO_BETS, response.matches.length * 2);
        console.log(`Invalid combination result, using fallback: ${totalPossibleCombinations}`);
      } else {
        console.log(`Calculated total possible combinations: ${totalPossibleCombinations}`);
      }
    } else {
      // Use default if counts not provided
      totalPossibleCombinations = MAX_AUTO_BETS;
      console.log(`Using default max auto bets: ${totalPossibleCombinations}`);
    }

    // Generate alternative selections with balanced favorites/underdogs ratio
    autoBetSession.alternativeSelections = generateBalancedPlayerSelections(response.matches);
    
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

// Generate selections with balanced favorites/underdogs ratio
function generateBalancedPlayerSelections(originalMatches) {
  // Create a map of matches by matchId with both player options
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

  // Get all match IDs
  const matchIds = Object.keys(matchesMap);
  
  // Filter out live matches
  const nonLiveMatchIds = matchIds.filter(matchId => !matchesMap[matchId].favorite.isLive);
  
  if (nonLiveMatchIds.length === 0) {
    console.log('No non-live matches available for betting');
    return [];
  }
  
  // Determine how many matches should have favorites selected (60%)
  const shuffledMatchIds = shuffleArray(nonLiveMatchIds);
  const favoritesToSelect = Math.round(shuffledMatchIds.length * FAVORITES_RATIO);
  
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
  // Get all match IDs
  const matchIds = matches.map(match => match.matchId);
  
  try {
    // Loop until we've simulated all bets or reached the total possible combinations
    while (isAutoBetting && currentAutoBetCount < totalPossibleCombinations) {
      console.log(`SIMULATION: Auto bet ${currentAutoBetCount + 1} of ${totalPossibleCombinations}`);
      console.log(`SIMULATION: Using stake amount: ${stakeAmount}`);
      
      // 1. Clear existing selections
      console.log('SIMULATION: Clearing any existing selections');
      await chrome.tabs.sendMessage(tabId, { action: 'clearSelections' });
      
      // For each new bet, re-shuffle the selections to get different combinations
      if (currentAutoBetCount > 0) {
        // Generate new selections with 60/40 ratio for subsequent bets
        console.log('SIMULATION: Generating new player selections with 60/40 favorites/underdogs ratio');
        autoBetSession.alternativeSelections = generateBalancedPlayerSelections(autoBetSession.originalSelections);
        matches = autoBetSession.alternativeSelections.filter(match => !match.isLive);
      }
      
      // Log the selected match details for this simulation
      console.log('SIMULATION: Selected match details:');
      matches.forEach((match, index) => {
        console.log(`  Match ${index + 1}: ${match.team1} vs ${match.team2}`);
        console.log(`    - Selected: ${match.selectedTeam} (Odds: ${match.odds})`);
        console.log(`    - Type: ${match.isFavorite ? 'FAVORITE' : 'UNDERDOG'}`);
      });
      
      // Count favorites vs underdogs
      const favoritesCount = matches.filter(m => m.isFavorite).length;
      const underdogsCount = matches.length - favoritesCount;
      console.log(`SIMULATION: Selection breakdown - ${favoritesCount} favorites (${Math.round(favoritesCount/matches.length*100)}%) and ${underdogsCount} underdogs (${Math.round(underdogsCount/matches.length*100)}%)`);
      
      // 2. Select new matches with balanced player selection
      console.log('SIMULATION: Selecting players on the page');
      const reselectionResult = await chrome.tabs.sendMessage(tabId, { 
        action: 'reselectMatches', 
        matchIds: matches.map(match => match.matchId),
        playerSelections: matches.map(match => ({
          matchId: match.matchId,
          selectedTeam: match.selectedTeam
        }))
      });
      
      console.log('SIMULATION: Reselection result:', reselectionResult);
      
      if (!reselectionResult || reselectionResult.status !== 'started') {
        console.error('SIMULATION ERROR: Failed to reselect matches');
        throw new Error('Failed to reselect matches');
      }
      
      // Calculate theoretical return
      const totalOdds = matches.reduce((acc, match) => acc * parseFloat(match.odds), 1);
      const potentialReturn = stakeAmount * totalOdds;
      console.log(`SIMULATION: Total combined odds: ${totalOdds.toFixed(2)}`);
      console.log(`SIMULATION: Potential return: ${potentialReturn.toFixed(2)} (stake: ${stakeAmount})`);
      
      // 3. SIMULATION - Instead of placing bet, just record what would have happened
      console.log('SIMULATION: [NOT PLACING ACTUAL BET] - Just simulating selection');
      
      // Wait a moment to simulate the bet slip interaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 4. Record the result as a success since we're just simulating
      autoBetSession.completedBets.push({
        timestamp: Date.now(),
        stake: stakeAmount,
        simulated: true,
        potentialReturn: potentialReturn,
        totalOdds: totalOdds,
        matches: matches.map(match => ({
          matchId: match.matchId,
          selectedTeam: match.selectedTeam,
          odds: match.odds,
          isFavorite: match.isFavorite
        }))
      });
      
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
          favorites: favoritesCount,
          underdogs: underdogsCount
        }
      });
      
      console.log(`SIMULATION: Completed simulation ${currentAutoBetCount} of ${totalPossibleCombinations}`);
      console.log('---------------------------------------');
      
      // 6. Delay before next attempt
      console.log(`SIMULATION: Waiting ${DELAY_BETWEEN_ATTEMPTS}ms before next simulation`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_ATTEMPTS));
    }
    
    console.log('SIMULATION: Auto betting simulation completed');
    console.log('SIMULATION SUMMARY:');
    console.log(`- Total simulations: ${autoBetSession.completedBets.length}`);
    console.log(`- Original selections: ${autoBetSession.originalSelections.length} matches`);
    
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
        simulationMode: true
      }
    });
    
  } catch (error) {
    console.error('SIMULATION ERROR: Error in auto betting process:', error);
    isAutoBetting = false;
    
    // Notify any listeners that auto betting has failed
    chrome.runtime.sendMessage({
      action: 'autoBettingFailed',
      error: error.message,
      simulationMode: true
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