// Direct test script to handle match display issues
(function() {
  // Execute immediately when loaded
  console.log('Direct test script loaded');
  
  // Test matches data (same as our other test data)
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
  
  // Add a direct display button
  function addDirectTestButton() {
    const button = document.createElement('button');
    button.textContent = 'Direct Test Display';
    button.style.position = 'absolute';
    button.style.top = '5px';
    button.style.left = '5px';
    button.style.fontSize = '10px';
    button.style.padding = '2px 5px';
    button.style.backgroundColor = '#673AB7';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '3px';
    button.style.zIndex = '9999';
    button.style.cursor = 'pointer';
    
    // Add click handler
    button.addEventListener('click', function() {
      directUpdateMatches();
    });
    
    document.body.appendChild(button);
  }
  
  // Direct update of the matches display
  function directUpdateMatches() {
    console.log('Direct test: updating matches display');
    
    // First check storage
    chrome.storage.local.get(['selectedMatches'], function(result) {
      // Use test matches or storage matches
      const matches = result.selectedMatches && result.selectedMatches.length > 0 
        ? result.selectedMatches 
        : testMatches;
      
      console.log('Direct test: using', matches.length, 'matches');
      
      // Get DOM elements
      const selectedMatchesList = document.getElementById('selectedMatchesList');
      const matchCountElement = document.getElementById('matchCount');
      
      if (!selectedMatchesList || !matchCountElement) {
        console.error('Direct test: required DOM elements not found');
        alert('Error: Required DOM elements not found!');
        return;
      }
      
      // Update count
      matchCountElement.textContent = matches.length;
      
      // Generate HTML
      let html = '';
      matches.forEach((match, index) => {
        html += `
          <div class="match-item">
            <div class="match-teams">${match.team1 || 'Team 1'} vs ${match.team2 || 'Team 2'}</div>
            <div class="match-odds">Selected: ${match.selectedTeam || 'Unknown'} (${match.odds || '0.00'})</div>
          </div>
        `;
      });
      
      // Update DOM
      selectedMatchesList.innerHTML = html;
      console.log('Direct test: matches display updated successfully');
      
      // Enable buttons
      const buttons = [
        document.getElementById('viewMatchesButton'),
        document.getElementById('clearSelectionsButton'),
        document.getElementById('confirmMatchesButton')
      ];
      
      buttons.forEach(button => {
        if (button) button.disabled = false;
      });
      
      // Show success message
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '50%';
      overlay.style.left = '50%';
      overlay.style.transform = 'translate(-50%, -50%)';
      overlay.style.padding = '10px 20px';
      overlay.style.backgroundColor = '#4CAF50';
      overlay.style.color = 'white';
      overlay.style.borderRadius = '4px';
      overlay.style.zIndex = '10000';
      overlay.textContent = 'Matches display updated!';
      
      document.body.appendChild(overlay);
      setTimeout(() => {
        document.body.removeChild(overlay);
      }, 2000);
    });
  }
  
  // Add button when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDirectTestButton);
  } else {
    addDirectTestButton();
  }
  
  // Also try to automatically update after a delay if no matches are displayed
  setTimeout(function() {
    const selectedMatchesList = document.getElementById('selectedMatchesList');
    if (selectedMatchesList && selectedMatchesList.innerHTML.includes('No matches selected')) {
      directUpdateMatches();
    }
  }, 1000);
})(); 