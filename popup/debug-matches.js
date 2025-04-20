// Debug script to add test matches directly to the storage
document.addEventListener('DOMContentLoaded', async () => {
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

  // Wait for DOM to be fully loaded (popup.js might be still initializing)
  setTimeout(() => {
    // Add debug button to the page
    const container = document.querySelector('.container');
    
    // Create debug section
    const debugSection = document.createElement('div');
    debugSection.className = 'debug-section';
    debugSection.style.marginTop = '20px';
    debugSection.style.borderTop = '1px dashed #ccc';
    debugSection.style.paddingTop = '10px';
    
    // Create title
    const debugTitle = document.createElement('h3');
    debugTitle.textContent = 'Debug & Testing';
    debugTitle.style.fontSize = '14px';
    debugTitle.style.color = '#673AB7';
    debugSection.appendChild(debugTitle);
    
    // Create debug buttons container
    const debugButtons = document.createElement('div');
    debugButtons.style.display = 'flex';
    debugButtons.style.gap = '10px';
    debugButtons.style.marginBottom = '10px';
    
    // Load test matches button
    const loadTestButton = document.createElement('button');
    loadTestButton.textContent = 'Load Test Matches';
    loadTestButton.className = 'button action';
    loadTestButton.style.backgroundColor = '#673AB7';
    loadTestButton.style.flex = '1';
    
    // Check DOM elements button
    const checkDomButton = document.createElement('button');
    checkDomButton.textContent = 'Check DOM Elements';
    checkDomButton.className = 'button action';
    checkDomButton.style.backgroundColor = '#009688';
    checkDomButton.style.flex = '1';
    
    // Clear storage button
    const clearStorageButton = document.createElement('button');
    clearStorageButton.textContent = 'Clear Storage';
    clearStorageButton.className = 'button action';
    clearStorageButton.style.backgroundColor = '#F44336';
    clearStorageButton.style.flex = '1';
    
    // Add buttons to container
    debugButtons.appendChild(loadTestButton);
    debugButtons.appendChild(checkDomButton);
    debugButtons.appendChild(clearStorageButton);
    debugSection.appendChild(debugButtons);
    
    // Create debug info area
    const debugInfo = document.createElement('pre');
    debugInfo.id = 'debugInfo';
    debugInfo.style.background = '#f5f5f5';
    debugInfo.style.padding = '10px';
    debugInfo.style.borderRadius = '4px';
    debugInfo.style.fontSize = '12px';
    debugInfo.style.color = '#333';
    debugInfo.style.maxHeight = '200px';
    debugInfo.style.overflow = 'auto';
    debugInfo.style.whiteSpace = 'pre-wrap';
    debugInfo.textContent = 'Debug info will appear here...';
    debugSection.appendChild(debugInfo);
    
    // Add debug section to page
    container.appendChild(debugSection);
  
    // Add event listener for the load test matches button
    loadTestButton.addEventListener('click', async () => {
      try {
        // Save test matches to storage
        await chrome.storage.local.set({ selectedMatches: testMatches });
        debugInfo.textContent = `Test matches saved to storage: ${testMatches.length} matches`;
        
        // Try to access the direct update function from popup.js
        if (typeof window.loadMatchesFromStorage === 'function') {
          window.loadMatchesFromStorage();
          debugInfo.textContent += '\nUsing direct loadMatchesFromStorage function';
        } else {
          // Direct UI update from here
          directUpdateUI(testMatches);
          debugInfo.textContent += '\nUsing direct UI update from debug script';
        }
      } catch (error) {
        debugInfo.textContent = `Error saving test matches: ${error.message}`;
        console.error('Error saving test matches:', error);
      }
    });
    
    // Add event listener for the check DOM button
    checkDomButton.addEventListener('click', () => {
      const selectedMatchesList = document.getElementById('selectedMatchesList');
      const matchCountElement = document.getElementById('matchCount');
      
      let info = 'DOM Element Check:\n';
      info += `selectedMatchesList: ${selectedMatchesList ? 'Found' : 'NOT FOUND'}\n`;
      if (selectedMatchesList) {
        info += `- innerHTML length: ${selectedMatchesList.innerHTML.length}\n`;
        info += `- children count: ${selectedMatchesList.children.length}\n`;
        info += `- content: ${selectedMatchesList.innerHTML.substring(0, 100)}...\n`;
      }
      
      info += `matchCountElement: ${matchCountElement ? 'Found' : 'NOT FOUND'}\n`;
      if (matchCountElement) {
        info += `- textContent: ${matchCountElement.textContent}\n`;
      }
      
      info += '\nStorage Variables:\n';
      chrome.storage.local.get(['selectedMatches', 'confirmedMatches', 'isMatchesConfirmed'], result => {
        info += `- storage.selectedMatches: ${result.selectedMatches ? result.selectedMatches.length + ' matches' : 'None'}\n`;
        info += `- storage.confirmedMatches: ${result.confirmedMatches ? result.confirmedMatches.length + ' matches' : 'None'}\n`;
        info += `- storage.isMatchesConfirmed: ${result.isMatchesConfirmed ? 'true' : 'false'}\n`;
        
        // Add functions check
        info += '\nFunctions Availability:\n';
        info += `- window.loadMatchesFromStorage: ${typeof window.loadMatchesFromStorage === 'function' ? 'Available' : 'Not Available'}\n`;
        info += `- window.updateUIWithMatches: ${typeof window.updateUIWithMatches === 'function' ? 'Available' : 'Not Available'}\n`;
        
        debugInfo.textContent = info;
      });
    });
    
    // Add event listener for the clear storage button
    clearStorageButton.addEventListener('click', async () => {
      try {
        // Clear selected and confirmed matches from storage
        await chrome.storage.local.set({ 
          selectedMatches: [],
          confirmedMatches: [],
          isMatchesConfirmed: false
        });
        
        debugInfo.textContent = 'Storage cleared. Updating UI...';
        
        // Try to access the direct update function from popup.js
        if (typeof window.loadMatchesFromStorage === 'function') {
          window.loadMatchesFromStorage();
        } else {
          // Direct UI update from here
          directUpdateUI([]);
        }
      } catch (error) {
        debugInfo.textContent = `Error clearing storage: ${error.message}`;
        console.error('Error clearing storage:', error);
      }
    });
    
    // Check if we should attempt to directly load matches
    chrome.storage.local.get(['selectedMatches'], result => {
      if (result.selectedMatches && result.selectedMatches.length > 0) {
        debugInfo.textContent = `Found ${result.selectedMatches.length} matches in storage. Click "Check DOM Elements" to verify display.`;
        
        // Only try direct update if the UI shows no matches
        const selectedMatchesList = document.getElementById('selectedMatchesList');
        if (selectedMatchesList && selectedMatchesList.querySelector('.no-matches')) {
          directUpdateUI(result.selectedMatches);
        }
      }
    });
  }, 500); // Wait 500ms to ensure popup.js has initialized
});

// Direct UI update function
function directUpdateUI(matches) {
  console.log('Debug script directly updating UI with', matches.length, 'matches');
  
  // Get UI elements
  const selectedMatchesList = document.getElementById('selectedMatchesList');
  const matchCountElement = document.getElementById('matchCount');
  
  if (!selectedMatchesList || !matchCountElement) {
    console.error('Required DOM elements not found for direct UI update');
    return;
  }
  
  // Update count
  matchCountElement.textContent = matches.length;
  
  // Update matches list
  if (matches.length === 0) {
    selectedMatchesList.innerHTML = '<p class="no-matches">No matches selected</p>';
    
    // Disable buttons that require matches
    const viewMatchesButton = document.getElementById('viewMatchesButton');
    const clearSelectionsButton = document.getElementById('clearSelectionsButton');
    const confirmMatchesButton = document.getElementById('confirmMatchesButton');
    
    if (viewMatchesButton) viewMatchesButton.disabled = true;
    if (clearSelectionsButton) clearSelectionsButton.disabled = true;
    if (confirmMatchesButton) confirmMatchesButton.disabled = true;
  } else {
    // Enable buttons
    const viewMatchesButton = document.getElementById('viewMatchesButton');
    const clearSelectionsButton = document.getElementById('clearSelectionsButton');
    const confirmMatchesButton = document.getElementById('confirmMatchesButton');
    
    if (viewMatchesButton) viewMatchesButton.disabled = false;
    if (clearSelectionsButton) clearSelectionsButton.disabled = false;
    if (confirmMatchesButton) confirmMatchesButton.disabled = false;
    
    // Display matches
    let html = '';
    
    matches.slice(0, 5).forEach((match, index) => {
      try {
        // Safety checks for match data
        const team1 = match.team1 || 'Unknown Team 1';
        const team2 = match.team2 || 'Unknown Team 2';
        const selectedTeam = match.selectedTeam || 'Unknown Selection';
        const odds = match.odds || '0.00';
        
        html += `
          <div class="match-item" data-match-id="${match.matchId || index}">
            <div class="match-teams">${team1} vs ${team2}</div>
            <div class="match-odds">Selected: ${selectedTeam} (${odds})</div>
          </div>
        `;
      } catch (err) {
        console.error('Error processing match in debug UI update:', err, match);
      }
    });
    
    // If there are more than 5 matches, show count of remaining
    if (matches.length > 5) {
      html += `<div class="match-item">+ ${matches.length - 5} more matches...</div>`;
    }
    
    // Set the HTML content
    selectedMatchesList.innerHTML = html;
    
    console.log('Directly updated UI with matches from debug script');
  }
} 