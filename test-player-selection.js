// Test script for the updated betting selection algorithm

// Mock data for testing - now with both players for each match
const mockMatches = [
  // Match 1 - Player A (favorite) vs Player B (underdog)
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
    matchId: '1', // Same match ID
    team1: 'Player A',
    team2: 'Player B',
    selectedTeam: 'Player B',
    opponentTeam: 'Player A',
    odds: '2.5',
    otherTeamOdds: '1.5',
    isFavorite: false,
    isLive: false
  },

  // Match 2 - Player C (favorite) vs Player D (underdog)
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
    matchId: '2', // Same match ID
    team1: 'Player C',
    team2: 'Player D',
    selectedTeam: 'Player D',
    opponentTeam: 'Player C',
    odds: '2.0',
    otherTeamOdds: '1.8',
    isFavorite: false,
    isLive: false
  },

  // Match 3 - Player E (favorite) vs Player F (underdog)
  {
    matchId: '3',
    team1: 'Player E',
    team2: 'Player F',
    selectedTeam: 'Player E',
    opponentTeam: 'Player F',
    odds: '1.4',
    otherTeamOdds: '3.0',
    isFavorite: true,
    isLive: false
  },
  {
    matchId: '3', // Same match ID
    team1: 'Player E',
    team2: 'Player F',
    selectedTeam: 'Player F',
    opponentTeam: 'Player E',
    odds: '3.0',
    otherTeamOdds: '1.4',
    isFavorite: false,
    isLive: false
  },

  // Match 4 - Player G (favorite) vs Player H (underdog) - LIVE match
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
    matchId: '4', // Same match ID
    team1: 'Player G',
    team2: 'Player H',
    selectedTeam: 'Player H',
    opponentTeam: 'Player G',
    odds: '3.5',
    otherTeamOdds: '1.3',
    isFavorite: false,
    isLive: true // This is a live match and should be skipped
  },

  // Match 5 - Player I (favorite) vs Player J (underdog)
  {
    matchId: '5',
    team1: 'Player I',
    team2: 'Player J',
    selectedTeam: 'Player I',
    opponentTeam: 'Player J',
    odds: '1.2',
    otherTeamOdds: '4.0',
    isFavorite: true,
    isLive: false
  },
  {
    matchId: '5', // Same match ID
    team1: 'Player I',
    team2: 'Player J',
    selectedTeam: 'Player J',
    opponentTeam: 'Player I',
    odds: '4.0',
    otherTeamOdds: '1.2',
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

// Place a bet with random player selection following the 60/40 rule
async function placeBet(allMatches, stake) {
  try {
    // Filter out live matches
    const nonLiveMatches = allMatches.filter(match => !match.isLive);

    if (nonLiveMatches.length === 0) {
      console.log('No non-live matches available for betting');
      return false;
    }

    // Group matches by matchId to handle cases where both players from a match might be in the list
    const matchesById = {};
    nonLiveMatches.forEach(match => {
      if (!matchesById[match.matchId]) {
        matchesById[match.matchId] = [];
      }
      matchesById[match.matchId].push(match);
    });

    // Get unique match IDs
    const uniqueMatchIds = Object.keys(matchesById);
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
      const matchOptions = matchesById[matchId];

      // Find the favorite player in this match
      const favoritePlayer = matchOptions.find(player => player.isFavorite);
      const underdogPlayer = matchOptions.find(player => !player.isFavorite);

      // If we have both options, select the favorite
      if (favoritePlayer) {
        selectedMatches.push(favoritePlayer);
      }
      // If no favorite is found but we have an underdog, use that as fallback
      else if (underdogPlayer) {
        selectedMatches.push(underdogPlayer);
      }
      // If neither is found (shouldn't happen), skip this match
    }

    // Then, select underdogs from the remaining matches
    for (let i = favoritesToSelect; i < shuffledMatchIds.length; i++) {
      const matchId = shuffledMatchIds[i];
      const matchOptions = matchesById[matchId];

      // Find the underdog player in this match
      const underdogPlayer = matchOptions.find(player => !player.isFavorite);
      const favoritePlayer = matchOptions.find(player => player.isFavorite);

      // If we have both options, select the underdog
      if (underdogPlayer) {
        selectedMatches.push(underdogPlayer);
      }
      // If no underdog is found but we have a favorite, use that as fallback
      else if (favoritePlayer) {
        selectedMatches.push(favoritePlayer);
      }
      // If neither is found (shouldn't happen), skip this match
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
      console.log(`- Match ${match.matchId}: ${match.selectedTeam} (${match.isFavorite ? 'Favorite' : 'Underdog'}) with odds ${match.odds}`);
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
  console.log('Running updated betting algorithm test...');
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
