// Test matches data for debugging
const testMatches = [
  {
    matchId: 'match1',
    tournament: 'ATP Tennis',
    timeInfo: 'In 2 hours',
    team1: 'Rafael Nadal',
    team2: 'Novak Djokovic',
    selectedTeam: 'Rafael Nadal',
    opponentTeam: 'Novak Djokovic',
    odds: '2.10',
    otherTeamOdds: '1.85',
    isFavorite: false,
    isLive: false,
    timestamp: Date.now()
  },
  {
    matchId: 'match2',
    tournament: 'WTA Tennis',
    timeInfo: 'Tomorrow',
    team1: 'Serena Williams',
    team2: 'Naomi Osaka',
    selectedTeam: 'Naomi Osaka',
    opponentTeam: 'Serena Williams',
    odds: '1.95',
    otherTeamOdds: '2.05',
    isFavorite: true,
    isLive: false,
    timestamp: Date.now()
  },
  {
    matchId: 'match3',
    tournament: 'ATP Tennis',
    timeInfo: 'Live',
    team1: 'Roger Federer',
    team2: 'Andy Murray',
    selectedTeam: 'Roger Federer',
    opponentTeam: 'Andy Murray',
    odds: '1.65',
    otherTeamOdds: '2.35',
    isFavorite: true,
    isLive: true,
    timestamp: Date.now()
  }
];

// Export the test data
if (typeof module !== 'undefined') {
  module.exports = { testMatches };
} 