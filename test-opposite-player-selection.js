// Test script for the updated betting selection algorithm that selects opposite players

// Mock data for testing - user's selected players for each match
const mockMatches = [
  // Match 1 - User selected Player A
  {
    matchId: '1',
    team1: 'Player A',
    team2: 'Player B',
    selectedTeam: 'Player A',
    opponentTeam: 'Player B',
    odds: '1.5',
    otherTeamOdds: '2.5',
    isFavorite: true,
    isLive: false
  },
  
  // Match 2 - User selected Player C
  {
    matchId: '2',
    team1: 'Player C',
    team2: 'Player D',
    selectedTeam: 'Player C',
    opponentTeam: 'Player D',
    odds: '1.8',
    otherTeamOdds: '2.0',
    isFavorite: true,
    isLive: false
  },
  
  // Match 3 - User selected Player F (underdog)
  {
    matchId: '3',
    team1: 'Player E',
    team2: 'Player F',
    selectedTeam: 'Player F',
    opponentTeam: 'Player E',
    odds: '3.0',
    otherTeamOdds: '1.4',
    isFavorite: false,
    isLive: false
  },
  
  // Match 4 - User selected Player G (live match)
  {
    matchId: '4',
    team1: 'Player G',
    team2: 'Player H',
    selectedTeam: 'Player G',
    opponentTeam: 'Player H',
    odds: '1.3',
    otherTeamOdds: '3.5',
    isFavorite: true,
    isLive: true // This is a live match and should be skipped
  }
];

// Mock storage for testing
const storage = {
  previousSelections: []
};

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
function calculatePotentialReturn(matches, stake) {
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

// Place a bet with player selection following the 60/40 rule
async function placeBet(allMatches, stake) {
  try {
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
    
    // First, select favorites from the first set of matches
    for (let i = 0; i < favoritesToSelect && i < shuffledMatchIds.length; i++) {
      const matchId = shuffledMatchIds[i];
      const matchData = matchesMap[matchId];
      
      // Select the player that is a favorite (either the user's selection or the opposite)
      if (matchData.userSelected.isFavorite) {
        selectedMatches.push(matchData.userSelected);
      } else if (matchData.opposite.isFavorite) {
        selectedMatches.push(matchData.opposite);
      }
      // If neither is a favorite (shouldn't happen), use the user's selection as fallback
      else {
        selectedMatches.push(matchData.userSelected);
      }
    }
    
    // Then, select underdogs from the remaining matches
    for (let i = favoritesToSelect; i < shuffledMatchIds.length; i++) {
      const matchId = shuffledMatchIds[i];
      const matchData = matchesMap[matchId];
      
      // Select the player that is an underdog (either the user's selection or the opposite)
      if (!matchData.userSelected.isFavorite) {
        selectedMatches.push(matchData.userSelected);
      } else if (!matchData.opposite.isFavorite) {
        selectedMatches.push(matchData.opposite);
      }
      // If neither is an underdog (shouldn't happen), use the user's selection as fallback
      else {
        selectedMatches.push(matchData.userSelected);
      }
    }

    // Check if this exact combination has been used before
    const selectionKey = getSelectionKey(selectedMatches);
    if (storage.previousSelections.includes(selectionKey)) {
      console.log('This exact combination has been used before, skipping...');
      return false; // Skip this combination
    }
    
    // Calculate potential return based on odds
    const potentialReturn = calculatePotentialReturn(selectedMatches, stake);
    
    // Check if potential return exceeds threshold (650,000 units)
    if (potentialReturn > 650000) {
      console.log(`Potential return exceeds threshold: ${potentialReturn} > 650,000 units, skipping...`);
      return false; // Skip this combination
    }

    // Add this combination to previous selections
    storage.previousSelections.push(selectionKey);

    // Log the selected matches
    console.log('Selected matches:');
    selectedMatches.forEach(match => {
      // Determine if this is the user's original selection or the opposite
      const isUserSelection = matchesMap[match.matchId].userSelected.selectedTeam === match.selectedTeam;
      console.log(`- Match ${match.matchId}: ${match.selectedTeam} (${match.isFavorite ? 'Favorite' : 'Underdog'}) with odds ${match.odds} - ${isUserSelection ? 'User Selected' : 'Opposite Player'}`);
    });

    // Log the potential return
    console.log(`Potential return: ${potentialReturn}`);

    // Count favorites and underdogs
    const favoriteCount = selectedMatches.filter(m => m.isFavorite).length;
    const underdogCount = selectedMatches.length - favoriteCount;
    console.log(`Selected ${favoriteCount} favorites (${(favoriteCount / selectedMatches.length * 100).toFixed(1)}%) and ${underdogCount} underdogs (${(underdogCount / selectedMatches.length * 100).toFixed(1)}%)`);

    return true;
  } catch (error) {
    console.error('Error placing bet:', error);
    return false;
  }
}

// Run multiple tests to generate different combinations
async function runMultipleTests(numTests) {
  console.log(`Running ${numTests} tests to generate different combinations...`);
  
  for (let i = 0; i < numTests; i++) {
    console.log(`\n--- Test #${i+1} ---`);
    const success = await placeBet(mockMatches, 10);
    
    if (success) {
      console.log('Bet placed successfully!');
    } else {
      console.log('Failed to place bet.');
    }
  }
}

// Run the test
async function runTest() {
  console.log('Running updated betting algorithm test with opposite player selection...');
  console.log('User selected matches:', mockMatches);

  // Run multiple tests to generate different combinations
  await runMultipleTests(5);

  // Test with a high stake to trigger the threshold check
  console.log('\nTesting with high stake to trigger threshold check:');
  const highStake = 100000;
  const highStakeSuccess = await placeBet(mockMatches, highStake);
  
  if (highStakeSuccess) {
    console.log('High stake bet placed successfully!');
  } else {
    console.log('High stake bet rejected as expected.');
  }

  // Test duplicate combination prevention
  console.log('\nTesting duplicate combination prevention:');
  const duplicateSuccess = await placeBet(mockMatches, 10);
  
  if (duplicateSuccess) {
    console.log('Duplicate bet placed successfully! This should not happen.');
  } else {
    console.log('Duplicate bet rejected as expected.');
  }
}

// Run the test
runTest();
