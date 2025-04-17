// Test script for the player combination generator

const {
  generatePlayerCombinations,
  calculateTotalValidCombinations
} = require('./generate-player-combinations');

// Mock data for testing - using the same format as in test-player-selection.js
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
  },

  // Match 6 - Player K (favorite) vs Player L (underdog)
  {
    matchId: '6',
    team1: 'Player K',
    team2: 'Player L',
    selectedTeam: 'Player K',
    opponentTeam: 'Player L',
    odds: '1.6',
    otherTeamOdds: '2.2',
    isFavorite: true,
    isLive: false
  },
  {
    matchId: '6', // Same match ID
    team1: 'Player K',
    team2: 'Player L',
    selectedTeam: 'Player L',
    opponentTeam: 'Player K',
    odds: '2.2',
    otherTeamOdds: '1.6',
    isFavorite: false,
    isLive: false
  },

  // Match 7 - Player M (favorite) vs Player N (underdog)
  {
    matchId: '7',
    team1: 'Player M',
    team2: 'Player N',
    selectedTeam: 'Player M',
    opponentTeam: 'Player N',
    odds: '1.3',
    otherTeamOdds: '3.2',
    isFavorite: true,
    isLive: false
  },
  {
    matchId: '7', // Same match ID
    team1: 'Player M',
    team2: 'Player N',
    selectedTeam: 'Player N',
    opponentTeam: 'Player M',
    odds: '3.2',
    otherTeamOdds: '1.3',
    isFavorite: false,
    isLive: false
  },

  // Match 8 - Player O (favorite) vs Player P (underdog)
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
    matchId: '8', // Same match ID
    team1: 'Player O',
    team2: 'Player P',
    selectedTeam: 'Player P',
    opponentTeam: 'Player O',
    odds: '2.8',
    otherTeamOdds: '1.4',
    isFavorite: false,
    isLive: false
  },

  // Match 9 - Player Q (favorite) vs Player R (underdog)
  {
    matchId: '9',
    team1: 'Player Q',
    team2: 'Player R',
    selectedTeam: 'Player Q',
    opponentTeam: 'Player R',
    odds: '1.5',
    otherTeamOdds: '2.5',
    isFavorite: true,
    isLive: false
  },
  {
    matchId: '9', // Same match ID
    team1: 'Player Q',
    team2: 'Player R',
    selectedTeam: 'Player R',
    opponentTeam: 'Player Q',
    odds: '2.5',
    otherTeamOdds: '1.5',
    isFavorite: false,
    isLive: false
  },

  // Match 10 - Player S (favorite) vs Player T (underdog)
  {
    matchId: '10',
    team1: 'Player S',
    team2: 'Player T',
    selectedTeam: 'Player S',
    opponentTeam: 'Player T',
    odds: '1.7',
    otherTeamOdds: '2.1',
    isFavorite: true,
    isLive: false
  },
  {
    matchId: '10', // Same match ID
    team1: 'Player S',
    team2: 'Player T',
    selectedTeam: 'Player T',
    opponentTeam: 'Player S',
    odds: '2.1',
    otherTeamOdds: '1.7',
    isFavorite: false,
    isLive: false
  }
];

// Mock storage for testing
const previousSelections = [];

// Run the test
function runTest() {
  console.log('Running player combination generator test...');

  // Test with different stake amounts
  const stakeAmounts = [10, 100, 1000];

  for (const stake of stakeAmounts) {
    console.log(`\nTesting with stake amount: $${stake}`);

    // Generate combinations (limit to 10 for testing)
    const result = generatePlayerCombinations(mockMatches, stake, previousSelections, 10);

    // Log statistics
    console.log('Statistics:');
    console.log(`- Total matches: ${result.stats.totalMatches}`);
    console.log(`- Total possible combinations: ${result.stats.totalPossibleCombinations}`);
    console.log(`- Valid combinations (60/40 rule): ${result.stats.validPossibleCombinations}`);
    console.log(`- Combinations generated: ${result.stats.combinationsGenerated}`);
    console.log(`- Previously used combinations: ${result.stats.previouslyUsedCombinations}`);
    console.log(`- Remaining combinations: ${result.stats.remainingCombinations}`);

    // Log the first few combinations
    console.log('\nSample combinations:');
    const sampleSize = Math.min(3, result.combinations.length);

    for (let i = 0; i < sampleSize; i++) {
      const combo = result.combinations[i];
      console.log(`\nCombination ${i + 1}:`);
      console.log(`- Key: ${combo.key}`);
      console.log(`- Favorites: ${combo.favoriteCount} (${(combo.favoriteCount / result.stats.totalMatches * 100).toFixed(1)}%)`);
      console.log(`- Underdogs: ${combo.underdogCount} (${(combo.underdogCount / result.stats.totalMatches * 100).toFixed(1)}%)`);
      console.log(`- Potential return: $${combo.potentialReturn.toFixed(2)}`);
      console.log('- Selected players:');

      combo.players.forEach(player => {
        console.log(`  * ${player.name} (${player.isFavorite ? 'Favorite' : 'Underdog'}) with odds ${player.odds}`);
      });
    }

    // Add the generated combinations to previous selections for the next test
    result.combinations.forEach(combo => {
      previousSelections.push(combo.key);
    });

    console.log(`\nAdded ${result.combinations.length} combinations to previous selections.`);
  }

  // Test with a high stake to trigger the threshold check
  console.log('\nTesting with high stake to trigger threshold check:');
  const highStake = 100000;
  const highStakeResult = generatePlayerCombinations(mockMatches, highStake, previousSelections);

  console.log(`Generated ${highStakeResult.combinations.length} combinations with high stake.`);

  // Test duplicate prevention
  console.log('\nTesting duplicate prevention:');
  const duplicateResult = generatePlayerCombinations(mockMatches, 10, previousSelections);

  console.log(`Generated ${duplicateResult.combinations.length} new combinations after using ${previousSelections.length} previous combinations.`);

  // Test with a larger number of matches
  console.log('\nTesting theoretical calculation for larger number of matches:');
  for (let i = 5; i <= 20; i += 5) {
    const validCombinations = calculateTotalValidCombinations(i);
    const totalCombinations = Math.pow(2, i);
    console.log(`For ${i} matches: ${validCombinations} valid combinations out of ${totalCombinations} total (${(validCombinations / totalCombinations * 100).toFixed(2)}%)`);
  }
}

// Run the test
runTest();
