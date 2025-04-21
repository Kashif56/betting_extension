// Test script to verify background.js changes
console.log('Starting test for background.js changes');

// Sample match data
const sampleMatches = [
  {
    matchId: '725ba981-1fc6-4d34-8a05-010316bcc390',
    tournament: 'Unknown Tournament',
    timeInfo: '',
    team1: 'Valentin Royer',
    team2: 'Taro Daniel',
    selectedTeam: 'Taro Daniel',
    opponentTeam: 'Valentin Royer',
    odds: '3.30',
    otherTeamOdds: '1.30',
    isFavorite: false,
    isLive: false,
    timestamp: 1745229719535
  },
  {
    matchId: 'ac2a7b82-f0d3-4511-b70f-14ab7630b93d',
    tournament: 'Unknown Tournament',
    timeInfo: '',
    team1: 'Roman Andres Burruchaga',
    team2: 'Vit Kopriva',
    selectedTeam: 'Vit Kopriva',
    opponentTeam: 'Roman Andres Burruchaga',
    odds: '1.40',
    otherTeamOdds: '2.75',
    isFavorite: true,
    isLive: false,
    timestamp: 1745229725136
  }
];

// Test function to calculate local combinations
function calculateLocalCombinations(matches, favoritesCount, underdogsCount) {
  console.log(`Calculating local combinations for ${matches.length} matches, ${favoritesCount} favorites, ${underdogsCount} underdogs`);
  
  // Filter out live matches
  const nonLiveMatches = matches.filter(match => !match.isLive);
  console.log(`Non-live matches: ${nonLiveMatches.length}`);
  
  // Get unique match IDs
  const uniqueMatchIds = new Set();
  nonLiveMatches.forEach(match => {
    uniqueMatchIds.add(match.matchId);
  });
  console.log(`Unique match IDs: ${uniqueMatchIds.size}`);
  
  // Calculate combinations
  const totalUniqueMatches = uniqueMatchIds.size;
  
  // Check if valid
  if (favoritesCount + underdogsCount > totalUniqueMatches) {
    console.log(`Invalid selection: favoritesCount (${favoritesCount}) + underdogsCount (${underdogsCount}) exceeds available matches (${totalUniqueMatches})`);
    return 0;
  }
  
  // Calculate combinations
  const totalPossibleCombinations = calculateCombinations(totalUniqueMatches, favoritesCount);
  console.log(`Total possible combinations: ${totalPossibleCombinations}`);
  
  return totalPossibleCombinations;
}

// Helper function to calculate combinations
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

// Test the function
console.log('\n--- Test 1: Calculate Local Combinations ---');
const result1 = calculateLocalCombinations(sampleMatches, 1, 1);
console.log(`Result: ${result1}`);

console.log('\n--- Test 2: Calculate Local Combinations with Invalid Input ---');
const result2 = calculateLocalCombinations(sampleMatches, 2, 1);
console.log(`Result: ${result2}`);

console.log('\n--- Test 3: Calculate Local Combinations with Live Matches ---');
const liveMatches = [
  ...sampleMatches,
  {
    matchId: 'live-match-id',
    tournament: 'Live Tournament',
    timeInfo: '',
    team1: 'Live Player 1',
    team2: 'Live Player 2',
    selectedTeam: 'Live Player 1',
    opponentTeam: 'Live Player 2',
    odds: '2.00',
    otherTeamOdds: '1.80',
    isFavorite: false,
    isLive: true,
    timestamp: 1745229725136
  }
];
const result3 = calculateLocalCombinations(liveMatches, 1, 1);
console.log(`Result: ${result3}`);

console.log('\nTest completed');
