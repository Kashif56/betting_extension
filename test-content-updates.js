// Test script to verify content.js updates
console.log('Starting test for content.js updates');

// Mock the chrome API
const chrome = {
  runtime: {
    onMessage: {
      addListener: (callback) => {
        // Store the callback for later use
        chrome.runtime.messageCallback = callback;
      },
      messageCallback: null
    },
    sendMessage: (message, callback) => {
      console.log('Message sent to background:', message);
      if (callback) callback({ status: 'success' });
    }
  },
  storage: {
    local: {
      get: (keys, callback) => {
        // Mock storage data
        const data = {
          selectedMatches: [],
          isMatchesConfirmed: false,
          confirmedMatches: []
        };
        callback(data);
      },
      set: (data, callback) => {
        console.log('Data saved to storage:', data);
        if (callback) callback();
      }
    }
  },
  tabs: {
    query: () => Promise.resolve([{ id: 1 }]),
    sendMessage: (tabId, message, callback) => {
      console.log('Message sent to tab:', message);
      if (callback) callback({ status: 'success' });
    }
  }
};

// Mock document
const document = {
  documentElement: {
    hasAttribute: (attr) => attr === 'data-auto-betting-in-progress',
    setAttribute: (attr, value) => console.log(`Set attribute ${attr}=${value}`),
    removeAttribute: (attr) => console.log(`Removed attribute ${attr}`)
  },
  querySelector: () => null,
  querySelectorAll: () => []
};

// Mock window
const window = {
  addEventListener: () => {}
};

// Mock the global selectedMatches array
let selectedMatches = [];

// Mock the saveMatchData function
async function saveMatchData(matchData, updateGlobalArray = true) {
  try {
    console.log('saveMatchData called with:', { matchData, updateGlobalArray });
    
    // Check if we should update the global selectedMatches array
    if (updateGlobalArray) {
      // Add or update the match data in the global array
      const existingIndex = selectedMatches.findIndex(match =>
        match.matchId === matchData.matchId &&
        match.selectedTeam === matchData.selectedTeam
      );

      if (existingIndex >= 0) {
        // Update existing match data
        selectedMatches[existingIndex] = matchData;
        console.log('Updated existing match data in selectedMatches');
      } else {
        // Add new match data
        selectedMatches.push(matchData);
        console.log('Added new match data to selectedMatches');
      }
    }

    // Send the updated matches to the background script
    // Always include the current selections in the global array
    chrome.runtime.sendMessage({
      action: 'matchesUpdated',
      matches: selectedMatches
    });

    // Also save to storage
    await chrome.storage.local.set({ selectedMatches });
  } catch (error) {
    console.error('Error saving match data:', error);
  }
}

// Mock the handleMatchSelection function
function handleMatchSelection(button) {
  try {
    console.log('handleMatchSelection called with button:', button);
    
    // Mock match data
    const matchData = {
      matchId: button.matchId,
      tournament: 'Test Tournament',
      timeInfo: '',
      team1: button.team1,
      team2: button.team2,
      selectedTeam: button.selectedTeam,
      opponentTeam: button.opponentTeam,
      odds: button.odds,
      otherTeamOdds: button.otherTeamOdds,
      isFavorite: button.isFavorite,
      isLive: false,
      timestamp: Date.now()
    };

    // Check if this is an auto-betting selection
    const isAutoBetting = document.documentElement.hasAttribute('data-auto-betting-in-progress');

    // Always update the global array, even during auto-betting
    // This ensures selectedMatches is always up to date with the current UI state
    saveMatchData(matchData, true);

    console.log(`Match selected: ${matchData.selectedTeam} (Auto-betting: ${isAutoBetting})`);
  } catch (error) {
    console.error('Error handling match selection:', error);
  }
}

// Mock the selectSpecificPlayer function
async function selectSpecificPlayer(matchElement, matchId, targetTeam) {
  try {
    console.log(`selectSpecificPlayer called with matchId: ${matchId}, targetTeam: ${targetTeam}`);
    
    // Mock button click
    console.log(`Clicked button for team ${targetTeam}`);
    
    // Mock match data
    const matchData = {
      matchId,
      tournament: 'Test Tournament',
      timeInfo: '',
      team1: matchElement.team1,
      team2: matchElement.team2,
      selectedTeam: targetTeam,
      opponentTeam: targetTeam === matchElement.team1 ? matchElement.team2 : matchElement.team1,
      odds: targetTeam === matchElement.team1 ? matchElement.odds1 : matchElement.odds2,
      otherTeamOdds: targetTeam === matchElement.team1 ? matchElement.odds2 : matchElement.odds1,
      isFavorite: (targetTeam === matchElement.team1 && parseFloat(matchElement.odds1) < parseFloat(matchElement.odds2)) ||
                 (targetTeam === matchElement.team2 && parseFloat(matchElement.odds2) < parseFloat(matchElement.odds1)),
      isLive: false,
      timestamp: Date.now()
    };
    
    // Update the global selectedMatches array with this selection
    const existingIndex = selectedMatches.findIndex(match => match.matchId === matchId);
    if (existingIndex >= 0) {
      // Replace the existing match data
      selectedMatches[existingIndex] = matchData;
      console.log('Updated existing match data in selectedMatches');
    } else {
      // Add new match data
      selectedMatches.push(matchData);
      console.log('Added new match data to selectedMatches');
    }
    
    // Send the updated matches to the background script
    chrome.runtime.sendMessage({
      action: 'matchesUpdated',
      matches: selectedMatches
    });
    
    console.log(`Updated selectedMatches array with new selection: ${matchData.selectedTeam}`);
    
    return true;
  } catch (error) {
    console.error(`Error selecting specific player for match ${matchId}:`, error);
    return false;
  }
}

// Test 1: Manual selection
console.log('\n--- Test 1: Manual Selection ---');
document.documentElement.hasAttribute = () => false;
handleMatchSelection({
  matchId: 'match1',
  team1: 'Team A',
  team2: 'Team B',
  selectedTeam: 'Team A',
  opponentTeam: 'Team B',
  odds: '1.5',
  otherTeamOdds: '2.5',
  isFavorite: true
});

// Test 2: Auto-betting selection
console.log('\n--- Test 2: Auto-betting Selection ---');
document.documentElement.hasAttribute = (attr) => attr === 'data-auto-betting-in-progress';
handleMatchSelection({
  matchId: 'match2',
  team1: 'Team C',
  team2: 'Team D',
  selectedTeam: 'Team D',
  opponentTeam: 'Team C',
  odds: '3.0',
  otherTeamOdds: '1.4',
  isFavorite: false
});

// Test 3: Select specific player during auto-betting
console.log('\n--- Test 3: Select Specific Player ---');
selectSpecificPlayer({
  team1: 'Valentin Royer',
  team2: 'Taro Daniel',
  odds1: '1.30',
  odds2: '3.30'
}, 'match3', 'Taro Daniel');

// Test 4: Select another player for the same match
console.log('\n--- Test 4: Select Different Player for Same Match ---');
selectSpecificPlayer({
  team1: 'Valentin Royer',
  team2: 'Taro Daniel',
  odds1: '1.30',
  odds2: '3.30'
}, 'match3', 'Valentin Royer');

// Print final state of selectedMatches
console.log('\n--- Final state of selectedMatches ---');
console.log(JSON.stringify(selectedMatches, null, 2));

console.log('\nTest completed');
