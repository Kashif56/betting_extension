# Player Combination Generator

This module generates unique player combinations from tennis matches following specific rules.

## Features

- Selects exactly one player per match
- Maintains a 60/40 ratio of favorites to underdogs
- Avoids duplicate combinations
- Rejects combinations with excessive potential payouts
- Provides statistics about total possible combinations

## Implementation Details

### Data Structure

Each match is represented as:

```javascript
{
  matchId: '1',
  players: [
    { name: "Player A", isFavorite: true, odds: 1.5 },
    { name: "Player B", isFavorite: false, odds: 2.5 }
  ]
}
```

### Algorithm

1. **Preprocessing**:
   - Filter out live matches
   - Group players by match ID
   - Calculate target counts for favorites and underdogs

2. **Combination Generation**:
   - For small numbers of matches (≤ 20), generate all 2^n combinations
   - For larger numbers, use a targeted random approach
   - Use binary representation to select one player from each match

3. **Filtering**:
   - Apply the 60/40 rule (with rounding for small numbers of matches)
   - Check for duplicate combinations
   - Verify potential return is below threshold

4. **Statistics**:
   - Calculate total possible combinations (2^n)
   - Calculate valid combinations that satisfy the 60/40 rule
   - Track previously used combinations

## Usage

```javascript
const { generatePlayerCombinations } = require('./generate-player-combinations');

// Generate combinations
const result = generatePlayerCombinations(matches, stake, previousSelections, maxCombinations);

// Access the combinations
const combinations = result.combinations;

// Access statistics
const stats = result.stats;
console.log(`Total possible: ${stats.totalPossibleCombinations}`);
console.log(`Valid (60/40 rule): ${stats.validPossibleCombinations}`);
console.log(`Generated: ${stats.combinationsGenerated}`);
console.log(`Remaining: ${stats.remainingCombinations}`);
```

## Mathematical Notes

- For n matches, there are 2^n total possible combinations
- The number of valid combinations (satisfying the 60/40 rule) is calculated using the binomial coefficient:
  - C(n, k) where n is the total matches and k is the number of favorites to select (60% of n)
- For 20 matches, there are 1,048,576 total combinations, but only 125,970 valid combinations (12%)

## Performance Considerations

- For large numbers of matches (> 20), generating all combinations becomes impractical
- The implementation uses a more efficient approach for large numbers of matches
- Early pruning is used to avoid generating invalid combinations
