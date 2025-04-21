// Test script for auto-bet-handler.js

// Mock the chrome API
global.chrome = {
  runtime: {
    onMessage: {
      addListener: () => {}
    },
    sendMessage: () => {}
  },
  tabs: {
    query: () => Promise.resolve([{ id: 1 }]),
    sendMessage: () => Promise.resolve({})
  },
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve()
    }
  }
};

// Import the functions from auto-bet-handler.js
// Since auto-bet-handler.js uses ES modules, we need to convert it for testing
const fs = require('fs');
const path = require('path');

// Read the auto-bet-handler.js file
const autoBetHandlerPath = path.join(__dirname, 'background', 'auto-bet-handler.js');
let autoBetHandlerCode = fs.readFileSync(autoBetHandlerPath, 'utf8');

// Convert ES module exports to CommonJS exports
autoBetHandlerCode = autoBetHandlerCode.replace(
  'export { isAutoBetting, MAX_AUTO_BETS, startAutoBetting, stopAutoBetting, terminateAutoBetting };',
  'module.exports = { isAutoBetting, MAX_AUTO_BETS, startAutoBetting, stopAutoBetting, terminateAutoBetting, generatePlayerCombinations, generateBalancedPlayerSelections };'
);

// Create a temporary file with the modified code
const tempFilePath = path.join(__dirname, 'temp-auto-bet-handler.js');
fs.writeFileSync(tempFilePath, autoBetHandlerCode);

// Now we can require the temporary file
const autoBetHandler = require('./temp-auto-bet-handler.js');

// Create mock match data
const createMockMatches = (count) => {
  const matches = [];
  
  for (let i = 1; i <= count; i++) {
    // Create favorite player
    matches.push({
      matchId: `match-${i}`,
      tournament: `Tournament ${i}`,
      timeInfo: `2023-05-${i < 10 ? '0' + i : i} 15:00`,
      team1: `Player ${i}A`,
      team2: `Player ${i}B`,
      selectedTeam: `Player ${i}A`,
      opponentTeam: `Player ${i}B`,
      odds: (1.5 + (i * 0.1)).toFixed(2),
      otherTeamOdds: (2.5 + (i * 0.1)).toFixed(2),
      isFavorite: true,
      isLive: false,
      timestamp: Date.now()
    });
    
    // Create underdog player
    matches.push({
      matchId: `match-${i}`,
      tournament: `Tournament ${i}`,
      timeInfo: `2023-05-${i < 10 ? '0' + i : i} 15:00`,
      team1: `Player ${i}A`,
      team2: `Player ${i}B`,
      selectedTeam: `Player ${i}B`,
      opponentTeam: `Player ${i}A`,
      odds: (2.5 + (i * 0.1)).toFixed(2),
      otherTeamOdds: (1.5 + (i * 0.1)).toFixed(2),
      isFavorite: false,
      isLive: false,
      timestamp: Date.now()
    });
  }
  
  return matches;
};

// Test the player combination generation
const testPlayerCombinations = () => {
  console.log('Testing player combination generation...');
  console.log('======================================');
  
  // Test with different numbers of matches
  const matchCounts = [3, 5, 10];
  
  for (const count of matchCounts) {
    console.log(`\nTesting with ${count} matches:`);
    console.log('---------------------------');
    
    const mockMatches = createMockMatches(count);
    console.log(`Created ${mockMatches.length} mock match entries (${count} matches with 2 players each)`);
    
    // Test generatePlayerCombinations
    console.log('\nTesting generatePlayerCombinations:');
    const stake = 10;
    const previousSelections = [];
    const maxCombinations = 5; // Limit to 5 combinations for display
    
    try {
      // Access the function from the module
      const generatePlayerCombinations = autoBetHandler.generatePlayerCombinations;
      
      if (typeof generatePlayerCombinations !== 'function') {
        console.error('generatePlayerCombinations is not a function. Make sure it is properly exported.');
        continue;
      }
      
      const result = generatePlayerCombinations(mockMatches, stake, previousSelections, maxCombinations);
      
      // Display statistics
      console.log('Combination Statistics:');
      console.log(`- Total matches: ${result.stats.totalMatches}`);
      console.log(`- Total possible combinations: ${result.stats.totalPossibleCombinations}`);
      console.log(`- Valid combinations (60/40 rule): ${result.stats.validPossibleCombinations}`);
      console.log(`- Generated combinations: ${result.stats.combinationsGenerated}`);
      
      // Display a sample of the combinations
      console.log('\nSample Combinations:');
      const sampleSize = Math.min(3, result.combinations.length);
      
      for (let i = 0; i < sampleSize; i++) {
        const combo = result.combinations[i];
        console.log(`\nCombination ${i + 1}:`);
        console.log(`- Favorites: ${combo.favoriteCount} (${(combo.favoriteCount / result.stats.totalMatches * 100).toFixed(1)}%)`);
        console.log(`- Underdogs: ${combo.underdogCount} (${(combo.underdogCount / result.stats.totalMatches * 100).toFixed(1)}%)`);
        console.log(`- Potential return: $${combo.potentialReturn.toFixed(2)}`);
        console.log('- Selected players:');
        
        combo.players.forEach(player => {
          console.log(`  * ${player.name} (${player.isFavorite ? 'Favorite' : 'Underdog'}) with odds ${player.odds}`);
        });
      }
      
      // Test generateBalancedPlayerSelections
      console.log('\nTesting generateBalancedPlayerSelections:');
      
      // Access the function from the module
      const generateBalancedPlayerSelections = autoBetHandler.generateBalancedPlayerSelections;
      
      if (typeof generateBalancedPlayerSelections !== 'function') {
        console.error('generateBalancedPlayerSelections is not a function. Make sure it is properly exported.');
        continue;
      }
      
      const selectedPlayers = generateBalancedPlayerSelections(mockMatches);
      
      // Display the selected players
      console.log(`\nSelected ${selectedPlayers.length} players:`);
      const favoritesCount = selectedPlayers.filter(p => p.isFavorite).length;
      const underdogsCount = selectedPlayers.length - favoritesCount;
      
      console.log(`- Favorites: ${favoritesCount} (${(favoritesCount / selectedPlayers.length * 100).toFixed(1)}%)`);
      console.log(`- Underdogs: ${underdogsCount} (${(underdogsCount / selectedPlayers.length * 100).toFixed(1)}%)`);
      
      console.log('\nSelected players:');
      selectedPlayers.forEach((player, index) => {
        console.log(`  ${index + 1}. ${player.selectedTeam} (${player.isFavorite ? 'Favorite' : 'Underdog'}) with odds ${player.odds}`);
      });
    } catch (error) {
      console.error('Error testing player combinations:', error);
    }
  }
  
  // Clean up the temporary file
  try {
    fs.unlinkSync(tempFilePath);
    console.log('\nCleaned up temporary file');
  } catch (error) {
    console.error('Error cleaning up temporary file:', error);
  }
};

// Run the tests
testPlayerCombinations();
