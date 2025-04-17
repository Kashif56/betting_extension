// Test script for the betting selection algorithm

// Mock data for testing
const mockMatches = [
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
  },
  {
    matchId: '5',
    team1: 'Player I',
    team2: 'Player J',
    selectedTeam: 'Player J',
    opponentTeam: 'Player I',
    odds: '4.0',
    otherTeamOdds: '1.2',
    isFavorite: false,
    isLive: false
  },
  {
    matchId: '6',
    team1: 'Player K',
    team2: 'Player L',
    selectedTeam: 'Player K',
    opponentTeam: 'Player L',
    odds: '1.6',
    otherTeamOdds: '2.3',
    isFavorite: true,
    isLive: false
  },
  {
    matchId: '7',
    team1: 'Player M',
    team2: 'Player N',
    selectedTeam: 'Player N',
    opponentTeam: 'Player M',
    odds: '2.8',
    otherTeamOdds: '1.5',
    isFavorite: false,
    isLive: false
  },
  {
    matchId: '8',
    team1: 'Player O',
    team2: 'Player P',
    selectedTeam: 'Player O',
    opponentTeam: 'Player P',
    odds: '1.4',
    otherTeamOdds: '2.8',
    isFavorite: true,
    isLive: false
  },
  {
    matchId: '9',
    team1: 'Player Q',
    team2: 'Player R',
    selectedTeam: 'Player Q',
    opponentTeam: 'Player R',
    odds: '1.7',
    otherTeamOdds: '2.2',
    isFavorite: true,
    isLive: false
  },
  {
    matchId: '10',
    team1: 'Player S',
    team2: 'Player T',
    selectedTeam: 'Player T',
    opponentTeam: 'Player S',
    odds: '3.5',
    otherTeamOdds: '1.3',
    isFavorite: false,
    isLive: false
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
  // Create a string of matchIds and selected teams
  return sortedMatches.map(m => `${m.matchId}:${m.selectedTeam}`).join('|');
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

// Place a bet with random player selection following the 60/40 rule
async function placeBet(allMatches, stake) {
  try {
    // Filter out live matches
    const nonLiveMatches = allMatches.filter(match => !match.isLive);
    
    if (nonLiveMatches.length === 0) {
      console.log('No non-live matches available for betting');
      return false;
    }
    
    // Categorize matches as favorites and underdogs
    const favorites = nonLiveMatches.filter(match => match.isFavorite);
    const underdogs = nonLiveMatches.filter(match => !match.isFavorite);

    console.log(`Available non-live matches: ${nonLiveMatches.length} (${favorites.length} favorites, ${underdogs.length} underdogs)`);

    // Use all available matches
    const totalToSelect = nonLiveMatches.length;

    // Calculate how many favorites and underdogs to select based on 60/40 rule
    let favoritesToSelect = Math.round(totalToSelect * 0.6);
    let underdogsToSelect = totalToSelect - favoritesToSelect;

    // Adjust if we don't have enough of either category
    if (favoritesToSelect > favorites.length) {
      underdogsToSelect += (favoritesToSelect - favorites.length);
      favoritesToSelect = favorites.length;
    }

    if (underdogsToSelect > underdogs.length) {
      favoritesToSelect += (underdogsToSelect - underdogs.length);
      underdogsToSelect = underdogs.length;
    }

    console.log(`Selecting ${favoritesToSelect} favorites (60%) and ${underdogsToSelect} underdogs (40%)`);

    // Randomly select favorites and underdogs
    const shuffledFavorites = shuffleArray([...favorites]);
    const shuffledUnderdogs = shuffleArray([...underdogs]);

    const selectedFavorites = shuffledFavorites.slice(0, favoritesToSelect);
    const selectedUnderdogs = shuffledUnderdogs.slice(0, underdogsToSelect);

    // Combine selections
    const selectedMatches = [...selectedFavorites, ...selectedUnderdogs];

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
      console.log(`- ${match.selectedTeam} (${match.isFavorite ? 'Favorite' : 'Underdog'}) with odds ${match.odds}`);
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

// Run the test
async function runTest() {
  console.log('Running betting algorithm test...');
  console.log('Mock matches:', mockMatches);

  // Test with different stake amounts
  const stakeAmounts = [10, 100, 1000];

  for (const stake of stakeAmounts) {
    console.log(`\nTesting with stake amount: $${stake}`);
    
    // Try to place a bet
    const success = await placeBet(mockMatches, stake);
    
    if (success) {
      console.log('Bet placed successfully!');
    } else {
      console.log('Failed to place bet.');
    }
  }

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
