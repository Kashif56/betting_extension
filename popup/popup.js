// DOM Elements
const startStopButton = document.getElementById('startStopButton');
const statusText = document.getElementById('statusText');
const stakeAmountInput = document.getElementById('stakeAmount');
const favoritesCountInput = document.getElementById('favoritesCount');
const underdogsCountInput = document.getElementById('underdogsCount');
const variationStatus = document.getElementById('variationStatus');
const startBetVariationsButton = document.getElementById('startBetVariationsButton');
const stopBetVariationsButton = document.getElementById('stopBetVariationsButton');
const startAutoBettingButton = document.getElementById('startAutoBettingButton');
const terminateAutoBettingButton = document.getElementById('terminateAutoBettingButton');
const settingsButton = document.getElementById('settingsButton');
const notification = document.getElementById('notification');
const matchCountElement = document.getElementById('matchCount');
const selectedMatchesList = document.getElementById('selectedMatchesList');
const clearSelectionsButton = document.getElementById('clearSelectionsButton');
const viewMatchesButton = document.getElementById('viewMatchesButton');
const confirmMatchesButton = document.getElementById('confirmMatchesButton');
const viewBetLogButton = document.getElementById('viewBetLogButton');

// Initial state
let isRunning = false;
let selectedMatches = [];
let confirmedMatches = [];
let isAutoBetting = false;
let maxAutoBets = 5; // Default, will be updated from background
let isMatchesConfirmed = false;

// Betting variations types
const betVariations = ['Single Bets', 'Multi Bets'];

// Function to directly load and display matches from storage
function loadMatchesFromStorage() {
  console.log('Direct loading matches from storage...');
  
  chrome.storage.local.get(['selectedMatches', 'confirmedMatches', 'isMatchesConfirmed'], (result) => {
    console.log('Direct storage load result:', result);
    
    // Update local variables with storage data
    if (result.selectedMatches) {
      selectedMatches = result.selectedMatches;
      console.log('Loaded selected matches:', selectedMatches.length);
    }
    
    if (result.isMatchesConfirmed) {
      isMatchesConfirmed = result.isMatchesConfirmed;
      
      if (result.confirmedMatches) {
        confirmedMatches = result.confirmedMatches;
        console.log('Loaded confirmed matches:', confirmedMatches.length);
      }
      
      // Update UI to show confirmed status
      if (confirmMatchesButton) {
        confirmMatchesButton.textContent = 'Matches Confirmed';
        confirmMatchesButton.classList.add('confirmed');
      }
    }
    
    // Use the matches we've loaded to update the display
    const displayMatches = isMatchesConfirmed ? confirmedMatches : selectedMatches;
    console.log('Display matches count:', displayMatches.length);
    
    // Immediately update the UI
    updateUIWithMatches(displayMatches);
  });
}

// Make functions accessible to debug scripts
window.loadMatchesFromStorage = loadMatchesFromStorage;
window.updateUIWithMatches = updateUIWithMatches;

// Function to update UI with matches
function updateUIWithMatches(matches) {
  console.log('Directly updating UI with', matches.length, 'matches');
  
  // Update count
  if (matchCountElement) {
    matchCountElement.textContent = matches.length;
  }
  
  // Update matches list
  if (selectedMatchesList) {
    if (matches.length === 0) {
      selectedMatchesList.innerHTML = '<p class="no-matches">No matches selected</p>';
      
      // Disable buttons that require matches
      if (viewMatchesButton) viewMatchesButton.disabled = true;
      if (clearSelectionsButton) clearSelectionsButton.disabled = true;
      if (confirmMatchesButton) confirmMatchesButton.disabled = true;
    } else {
      // Enable buttons
      if (viewMatchesButton) viewMatchesButton.disabled = false;
      if (clearSelectionsButton) clearSelectionsButton.disabled = isMatchesConfirmed;
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
          const status = isMatchesConfirmed ? '<span class="confirmed-badge">Confirmed</span>' : '';
          
          html += `
            <div class="match-item" data-match-id="${match.matchId || index}">
              <div class="match-teams">${team1} vs ${team2} ${status}</div>
              <div class="match-odds">Selected: ${selectedTeam} (${odds})</div>
            </div>
          `;
        } catch (err) {
          console.error('Error processing match in direct UI update:', err, match);
        }
      });
      
      // If there are more than 5 matches, show count of remaining
      if (matches.length > 5) {
        html += `<div class="match-item">+ ${matches.length - 5} more matches...</div>`;
      }
      
      // Safety check for empty HTML
      if (html === '') {
        html = '<p class="no-matches">Error displaying matches data</p>';
      }
      
      // Set the HTML content
      selectedMatchesList.innerHTML = html;
    }
  } else {
    console.error('selectedMatchesList element not found when directly updating UI');
  }
}

// Load saved settings
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('DOM loaded, initializing popup...');
    
    // First thing - directly load matches from storage
    loadMatchesFromStorage();
    
    // Load stake amount setting
    const result = await chrome.storage.local.get(['stakeAmount', 'confirmedMatches', 'isMatchesConfirmed', 'selectedMatches']);
    console.log('Loaded settings from storage:', result);
    
    if (result.stakeAmount && stakeAmountInput) {
      stakeAmountInput.value = result.stakeAmount;
    }
    
    // Check if the bot is currently running
    const status = await chrome.storage.local.get(['isRunning']);
    if (status.isRunning) {
      isRunning = true;
      updateBotStatus(isRunning);
    }
    
    // Check auto betting status
    checkAutoBettingStatus();

    // Listen for match updates
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Add event listeners for input validation
    if (favoritesCountInput && underdogsCountInput) {
      favoritesCountInput.addEventListener('input', validateMatchCounts);
      underdogsCountInput.addEventListener('input', validateMatchCounts);
    }

    // Set up UI event listeners
    if (startStopButton) {
      startStopButton.addEventListener('click', toggleBot);
    }
    
    if (startBetVariationsButton) {
      startBetVariationsButton.addEventListener('click', startBetVariations);
    }
    
    if (stopBetVariationsButton) {
      stopBetVariationsButton.addEventListener('click', stopBetVariations);
    }
    
    if (startAutoBettingButton) {
      startAutoBettingButton.addEventListener('click', startAutoBetting);
    }
    
    if (terminateAutoBettingButton) {
      terminateAutoBettingButton.addEventListener('click', terminateAutoBetting);
    }
    
    if (settingsButton) {
      settingsButton.addEventListener('click', openSettings);
    }
    
    // Add listeners for match-related buttons
    if (clearSelectionsButton) {
      clearSelectionsButton.addEventListener('click', clearSelections);
    }
    
    if (viewMatchesButton) {
      viewMatchesButton.addEventListener('click', viewMatchDetails);
    }
    
    if (confirmMatchesButton) {
      confirmMatchesButton.addEventListener('click', confirmMatches);
    }
    
    // Add event listener for view bet log button
    if (viewBetLogButton) {
      viewBetLogButton.addEventListener('click', openBetLogPage);
    }
    
    console.log('Popup initialized with UI elements:', {
      startStopButton: !!startStopButton,
      statusText: !!statusText,
      selectedMatchesList: !!selectedMatchesList,
      matchCountElement: !!matchCountElement,
      selectedMatches: selectedMatches.length
    });
    
    // Add a reload button for debugging
    const debugReloadButton = document.createElement('button');
    debugReloadButton.textContent = 'Reload Matches';
    debugReloadButton.style.position = 'absolute';
    debugReloadButton.style.top = '5px';
    debugReloadButton.style.right = '5px';
    debugReloadButton.style.fontSize = '10px';
    debugReloadButton.style.padding = '2px 5px';
    debugReloadButton.style.backgroundColor = '#FF9800';
    debugReloadButton.style.color = 'white';
    debugReloadButton.style.border = 'none';
    debugReloadButton.style.borderRadius = '3px';
    debugReloadButton.style.cursor = 'pointer';
    debugReloadButton.addEventListener('click', loadMatchesFromStorage);
    document.body.appendChild(debugReloadButton);
  } catch (error) {
    console.error('Error loading settings:', error);
  }
});

// Functions
async function startBot() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot start bot');
      return;
    }

    isRunning = true;
    updateStatus();

    // Save the running state
    await chrome.storage.local.set({ isRunning: true });

    // Send message to background script to start the bot with error handling
    chrome.runtime.sendMessage(
      { action: 'startBot', delay: parseInt(delayInput.value) },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending start message:', chrome.runtime.lastError);
          return;
        }
        console.log('Bot started response:', response);
      }
    );

    console.log('Bot start request sent');
  } catch (error) {
    console.error('Error starting bot:', error);
  }
}

async function stopBot() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot stop bot');
      return;
    }

    isRunning = false;
    updateStatus();

    // Save the running state
    await chrome.storage.local.set({ isRunning: false });

    // Send message to background script to stop the bot with error handling
    chrome.runtime.sendMessage(
      { action: 'stopBot' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending stop message:', chrome.runtime.lastError);
          return;
        }
        console.log('Bot stopped response:', response);
      }
    );

    console.log('Bot stop request sent');
  } catch (error) {
    console.error('Error stopping bot:', error);
  }
}

async function saveSettings() {
  try {
    const delay = parseInt(delayInput.value);
    const stakeAmount = parseFloat(stakeAmountInput.value);
    await chrome.storage.local.set({ delay, stakeAmount });

    // Show a temporary success message
    saveSettingsBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveSettingsBtn.textContent = 'Save Settings';
    }, 1500);

    console.log('Settings saved');
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

function updateStatus() {
  statusText.textContent = isRunning ? 'Running' : 'Inactive';
  statusText.style.color = isRunning ? '#4CAF50' : '#f44336';
  startBtn.disabled = isRunning;
  stopBtn.disabled = !isRunning;
}

// Load selected matches from storage
async function loadSelectedMatches() {
  try {
    console.log('Loading selected matches from storage...');
    
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.error('Extension context invalid, cannot load matches');
      return;
    }

    const result = await chrome.storage.local.get(['selectedMatches']);
    console.log('Loaded matches from storage:', result);
    
    if (result.selectedMatches) {
      selectedMatches = result.selectedMatches;
      console.log(`Loaded ${selectedMatches.length} matches from storage`);
    } else {
      selectedMatches = [];
      console.log('No matches found in storage');
    }
    
    // Update the UI with the loaded matches
    updateMatchesDisplay(selectedMatches);
    
    return selectedMatches;
  } catch (error) {
    console.error('Error loading selected matches:', error);
    return [];
  }
}

// Update the matches display in the popup
function updateMatchesDisplay(matches) {
  console.log('Updating matches display with', matches ? matches.length : 0, 'matches');
  
  // Safety check for null or undefined matches
  if (!matches) {
    matches = [];
  }
  
  // Use confirmed matches if they exist and matches are confirmed
  const displayMatches = isMatchesConfirmed ? confirmedMatches : matches;
  
  // Update count
  if (matchCountElement) {
    matchCountElement.textContent = displayMatches.length;
  }
  
  // Update matches list
  if (selectedMatchesList) {
    console.log('Updating selectedMatchesList element');
    
    if (!displayMatches || displayMatches.length === 0) {
      selectedMatchesList.innerHTML = '<p class="no-matches">No matches selected</p>';
      
      // Disable buttons that require matches
      if (viewMatchesButton) viewMatchesButton.disabled = true;
      if (clearSelectionsButton) clearSelectionsButton.disabled = true;
      if (confirmMatchesButton) confirmMatchesButton.disabled = true;
      
      console.log('No matches to display');
    } else {
      // Enable buttons
      if (viewMatchesButton) viewMatchesButton.disabled = false;
      if (clearSelectionsButton) clearSelectionsButton.disabled = isMatchesConfirmed;
      if (confirmMatchesButton) confirmMatchesButton.disabled = false;
      
      console.log('Displaying', displayMatches.length, 'matches');
      
      // Display matches
      let html = '';
      
      displayMatches.slice(0, 5).forEach(match => {
        try {
          // Safety checks for incomplete match data
          const team1 = match.team1 || 'Unknown Team 1';
          const team2 = match.team2 || 'Unknown Team 2';
          const selectedTeam = match.selectedTeam || 'Unknown Selection';
          const odds = match.odds || '0.00';
          const status = isMatchesConfirmed ? '<span class="confirmed-badge">Confirmed</span>' : '';
          
          html += `
            <div class="match-item">
              <div class="match-teams">${team1} vs ${team2} ${status}</div>
              <div class="match-odds">Selected: ${selectedTeam} (${odds})</div>
            </div>
          `;
        } catch (err) {
          console.error('Error processing match data:', err, match);
        }
      });
      
      // If there are more than 5 matches, show count of remaining
      if (displayMatches.length > 5) {
        html += `<div class="match-item">+ ${displayMatches.length - 5} more matches...</div>`;
      }
      
      if (html === '') {
        html = '<p class="no-matches">Error displaying matches data</p>';
      }
      
      console.log('Generated HTML for matches:', html.substring(0, 100) + '...');
      selectedMatchesList.innerHTML = html;
    }
  } else {
    console.error('selectedMatchesList element not found in the DOM');
  }
}

// Clear all selections
async function clearSelections() {
  try {
    // If matches are confirmed, don't allow clearing
    if (isMatchesConfirmed) {
      showNotification('Unconfirm matches before clearing selections.');
      return;
    }
    
    // Clear selected matches
    selectedMatches = [];
    await chrome.storage.local.set({ selectedMatches: [] });
    
    // Update display
    updateMatchesDisplay([]);
    
    // Notify background script to update badge
    chrome.runtime.sendMessage({ action: 'matchesUpdated', matches: [] });
    
    console.log('Selections cleared');
  } catch (error) {
    console.error('Error clearing selections:', error);
  }
}

// View match details
function viewMatchDetails() {
  try {
    // Open the matches page in a new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL('pages/selected-matches.html')
    });
  } catch (error) {
    console.error('Error opening match details:', error);
    showNotification(`Error: ${error.message}`);
  }
}

// Validate that favorites + underdogs equals total match count
function validateMatchCounts() {
  const favoritesCount = parseInt(favoritesCountInput.value) || 0;
  const underdogsCount = parseInt(underdogsCountInput.value) || 0;
  const totalCount = favoritesCount + underdogsCount;
  const matchCount = selectedMatches.length;
  
  // Show warning if counts don't match and there are matches selected
  if (matchCount > 0 && totalCount !== matchCount) {
    matchCountWarning.style.display = 'block';
    matchCountWarning.textContent = `Total must equal selected matches count (${matchCount})`;
    confirmMatchesBtn.disabled = true;
    return false;
  } else {
    matchCountWarning.style.display = 'none';
    // Only enable the confirm button if we have matches
    confirmMatchesBtn.disabled = matchCount === 0;
    return true;
  }
}

// Check if the current favorite and underdog counts are valid
function isValidMatchCounts() {
  const favoritesCount = parseInt(favoritesCountInput.value) || 0;
  const underdogsCount = parseInt(underdogsCountInput.value) || 0;
  const totalCount = favoritesCount + underdogsCount;
  return totalCount === selectedMatches.length;
}

// Open the selected matches page
function openMatchesPage() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot open matches page');
      return;
    }

    chrome.tabs.create({
      url: chrome.runtime.getURL('pages/selected-matches.html')
    }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('Error opening matches page:', chrome.runtime.lastError);
      }
    });
  } catch (error) {
    console.error('Error opening matches page:', error);
  }
}

// Confirm matches - lock them so they don't change
async function confirmMatches() {
  try {
    // Check if matches are already confirmed
    if (isMatchesConfirmed) {
      // Allow unconfirming matches
      isMatchesConfirmed = false;
      confirmedMatches = [];
      
      // Update button appearance
      confirmMatchesButton.textContent = 'Confirm Matches';
      confirmMatchesButton.classList.remove('confirmed');
      
      // Save confirmed matches status
      await chrome.storage.local.set({ 
        isMatchesConfirmed: false, 
        confirmedMatches: [] 
      });
      
      console.log('Matches unconfirmed');
      return;
    }
    
    // Get the current selected matches
    const result = await chrome.storage.local.get(['selectedMatches']);
    const currentMatches = result.selectedMatches || [];
    
    if (currentMatches.length === 0) {
      showNotification('No matches selected to confirm.');
      return;
    }
    
    // Confirm the matches
    isMatchesConfirmed = true;
    confirmedMatches = [...currentMatches];
    
    // Update button appearance
    confirmMatchesButton.textContent = 'Matches Confirmed';
    confirmMatchesButton.classList.add('confirmed');
    
    // Save confirmed matches status
    await chrome.storage.local.set({ 
      isMatchesConfirmed: true, 
      confirmedMatches: confirmedMatches 
    });
    
    // Notify background script about confirmed matches for badge update
    chrome.runtime.sendMessage({ 
      action: 'matchesConfirmed', 
      matches: confirmedMatches 
    });
    
    console.log('Matches confirmed:', confirmedMatches.length);
  } catch (error) {
    console.error('Error confirming matches:', error);
  }
}

// Re-select previously confirmed matches
async function reselectPreviousMatches() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot re-select matches');
      return;
    }

    // Get previously confirmed match IDs
    const result = await chrome.storage.local.get(['previouslyConfirmedMatchIds']);
    const matchIds = result.previouslyConfirmedMatchIds || [];

    if (matchIds.length === 0) {
      alert('No previously confirmed matches found to re-select.');
      return;
    }

    // Get the currently active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting active tab:', chrome.runtime.lastError);
        return;
      }

      if (tabs.length === 0) {
        alert('Please navigate to the betting site to re-select matches.');
        return;
      }

      const activeTab = tabs[0];

      // Send message to content script to re-select matches
      chrome.tabs.sendMessage(activeTab.id, {
        action: 'reselectMatches',
        matchIds: matchIds
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending re-select message:', chrome.runtime.lastError);
          alert('Error communicating with the page. Please make sure you are on the betting site.');
          return;
        }

        if (response && response.status === 'started') {
          // Show indication that re-selection has started
          alert('Match re-selection process has started. Please wait while matches are being selected...');
        } else if (response && response.error) {
          alert(`Error: ${response.error}`);
        }
      });
    });
  } catch (error) {
    console.error('Error re-selecting matches:', error);
    alert('Error re-selecting matches. Please try again.');
  }
}

// Auto Betting Functions
async function startAutoBetting() {
  try {
    // Check if we have confirmed matches
    const useConfirmedMatches = isMatchesConfirmed && confirmedMatches.length > 0;
    const validMatches = useConfirmedMatches ? confirmedMatches : selectedMatches;
    
    if (validMatches.length === 0) {
      showNotification('No matches selected for auto betting');
      return;
    }
    
    // Get stake amount
    const stakeAmount = parseFloat(stakeAmountInput.value);
    if (isNaN(stakeAmount) || stakeAmount <= 0) {
      showNotification('Please enter a valid stake amount');
      return;
    }
    
    // If using confirmed matches, ensure they're set in storage
    if (useConfirmedMatches) {
      await chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs.length > 0) {
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'setConfirmedMatches',
            matches: confirmedMatches
          });
        }
      });
    }
    
    // Send message to background script to start auto betting
    chrome.runtime.sendMessage(
      { action: 'startAutoBetting', stake: stakeAmount },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error starting auto betting:', chrome.runtime.lastError);
          showNotification('Error starting auto betting');
          return;
        }
        
        console.log('Auto betting started response:', response);
        if (response && response.status === 'success') {
          showNotification('Auto betting started');
          
          // Show terminate button
          if (terminateAutoBettingButton) {
            startAutoBettingButton.style.display = 'none';
            terminateAutoBettingButton.style.display = 'inline-block';
          }
        } else if (response && response.status === 'already_running') {
          showNotification('Auto betting already in progress');
        } else {
          showNotification(`Error: ${response?.error || 'Unknown error'}`);
        }
      }
    );
  } catch (error) {
    console.error('Error starting auto betting:', error);
    showNotification('Error starting auto betting');
  }
}

async function stopAutoBetting() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot stop auto betting');
      return;
    }
    
    // Stop auto betting
    const response = await chrome.runtime.sendMessage({
      action: 'stopAutoBetting'
    });
    
    if (response.status === 'success') {
      updateAutoBettingStatus(false);
      console.log('Auto betting stopped:', response.result);
    } else {
      alert(`Failed to stop auto betting: ${response.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error stopping auto betting:', error);
    alert(`Error stopping auto betting: ${error.message}`);
  }
}

function updateAutoBettingStatus(isActive) {
  isAutoBetting = isActive;
  autoBettingStatus.textContent = isActive ? 'Active' : 'Inactive';
  autoBettingStatus.style.color = isActive ? '#4CAF50' : '#f44336';
  startAutoBettingBtn.disabled = isActive;
  stopAutoBettingBtn.disabled = !isActive;
  
  // Also disable/enable other buttons based on auto betting status
  if (isActive) {
    startBtn.disabled = true;
    confirmMatchesBtn.disabled = true;
    reselectPreviousBtn.disabled = true;
  } else {
    startBtn.disabled = isRunning;
    confirmMatchesBtn.disabled = !selectedMatches.length || !isValidMatchCounts();
    reselectPreviousBtn.disabled = false; // Enable if there are previous matches
  }
}

function updateAutoBettingProgress(current, total) {
  autoBettingProgress.textContent = `${current}/${total}`;
}

async function checkAutoBettingStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getAutoBettingStatus'
    });
    
    if (response.status === 'success') {
      isAutoBetting = response.isAutoBetting;
      maxAutoBets = response.maxAutoBets || 5;
      updateAutoBettingStatus(isAutoBetting);
      
      if (isAutoBetting && response.sessionInfo) {
        updateAutoBettingProgress(
          response.sessionInfo.completedBets || 0, 
          response.sessionInfo.totalBets || maxAutoBets
        );
      }
    }
  } catch (error) {
    console.error('Error checking auto betting status:', error);
  }
}

// Handle messages from background script
function handleMessage(message) {
  console.log('Popup received message:', message);
  
  if (message.action === 'matchesUpdated') {
    // Only update if matches are not confirmed
    if (!isMatchesConfirmed) {
      selectedMatches = message.matches || [];
      updateMatchesDisplay(selectedMatches);
    }
  } 
  else if (message.action === 'botStatusChanged') {
    isRunning = message.isRunning;
    updateBotStatus(isRunning);
  }
  else if (message.action === 'autoBettingStarted') {
    if (terminateAutoBettingButton) {
      startAutoBettingButton.style.display = 'none';
      terminateAutoBettingButton.style.display = 'inline-block';
    }
    showNotification('Auto betting simulation started');
  }
  else if (message.action === 'autoBettingCompleted') {
    if (terminateAutoBettingButton) {
      terminateAutoBettingButton.style.display = 'none';
      startAutoBettingButton.style.display = 'inline-block';
    }
    
    const simulationText = message.sessionInfo?.simulationMode ? 'Simulation' : '';
    showNotification(`${simulationText} Auto betting completed`);
    
    // Add simulation summary if available
    if (message.sessionInfo) {
      const completedBets = message.sessionInfo.completedBets || 0;
      const favPercent = message.sessionInfo.favoritePercentage || 0;
      
      // Create a simulation log element if it doesn't exist
      let simLogElement = document.getElementById('simulationLog');
      if (!simLogElement) {
        simLogElement = document.createElement('div');
        simLogElement.id = 'simulationLog';
        simLogElement.className = 'simulation-log';
        
        // Add it after the action section
        const actionSections = document.querySelectorAll('.action-section');
        if (actionSections.length > 0) {
          actionSections[actionSections.length - 1].after(simLogElement);
        } else {
          document.querySelector('.container').appendChild(simLogElement);
        }
      }
      
      // Update the simulation log content
      simLogElement.innerHTML = `
        <h3>Simulation Summary</h3>
        <p>Completed ${completedBets} simulated bets</p>
        <p>Average selections: ${favPercent.toFixed(1)}% favorites</p>
        <p>Click Start Auto Betting to run another simulation</p>
      `;
    }
  }
  else if (message.action === 'autoBettingFailed') {
    if (terminateAutoBettingButton) {
      terminateAutoBettingButton.style.display = 'none';
      startAutoBettingButton.style.display = 'inline-block';
    }
    
    const simulationText = message.simulationMode ? 'Simulation' : '';
    const errorMessage = message.error || 'Unknown error';
    showNotification(`${simulationText} Auto betting failed: ${errorMessage}`);
  }
  else if (message.action === 'autoBettingProgress') {
    // Update progress display
    updateAutoBettingProgress(message.current, message.total);
    
    // Update simulation log with the latest bet details
    if (message.lastBet) {
      let simLogElement = document.getElementById('currentSimulation');
      if (!simLogElement) {
        simLogElement = document.createElement('div');
        simLogElement.id = 'currentSimulation';
        simLogElement.className = 'current-simulation';
        
        // Add it after the action section
        const actionSections = document.querySelectorAll('.action-section');
        if (actionSections.length > 0) {
          actionSections[actionSections.length - 1].after(simLogElement);
        } else {
          document.querySelector('.container').appendChild(simLogElement);
        }
      }
      
      // Format the potential return with thousand separators
      const formattedReturn = message.lastBet.potentialReturn ? 
        message.lastBet.potentialReturn.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : 
        '0.00';
      
      // Update the simulation log content
      simLogElement.innerHTML = `
        <h3>Current Simulation: ${message.current}/${message.total}</h3>
        <p>Selected ${message.lastBet.matches} matches</p>
        <p>Breakdown: ${message.lastBet.favorites} favorites (${Math.round(message.lastBet.favorites/message.lastBet.matches*100)}%) / 
           ${message.lastBet.underdogs} underdogs (${Math.round(message.lastBet.underdogs/message.lastBet.matches*100)}%)</p>
        <p>Potential return: $${formattedReturn}</p>
      `;
    }
  }
  
  return true;
}

// Toggle bot status
async function toggleBot() {
  try {
    console.log('toggleBot function called');
    const response = await chrome.runtime.sendMessage({ action: 'toggleBot' });
    console.log('Toggle response:', response);
    
    if (response && response.status === 'success') {
      // Update UI
      updateBotStatus(response.isRunning);
      
      // Send message to all open tabs about the bot status change
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        try {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'botStatus', 
            isRunning: response.isRunning 
          }).catch(err => {
            console.log(`Non-critical error sending message to tab ${tab.id}:`, err);
          });
        } catch (err) {
          console.log(`Non-critical error sending message to tab ${tab.id}:`, err);
        }
      }
    } else {
      console.error('Error toggling bot:', response ? response.error : 'No response');
      showNotification('Error toggling bot status');
    }
  } catch (error) {
    console.error('Error in toggleBot function:', error);
    showNotification(`Error: ${error.message}`);
  }
}

// Update the UI based on bot status
async function updateBotStatus(isRunning = null) {
  try {
    console.log('updateBotStatus called with:', isRunning);
    
    if (isRunning === null) {
      // Get status from background script
      const response = await chrome.runtime.sendMessage({ action: 'getBotStatus' });
      console.log('getBotStatus response:', response);
      
      if (response && response.status === 'success') {
        isRunning = response.isRunning;
      } else {
        console.error('Error getting bot status');
        return;
      }
    }
    
    if (startStopButton && statusText) {
      startStopButton.textContent = isRunning ? 'Stop Bot' : 'Start Bot';
      startStopButton.className = isRunning ? 'button stop' : 'button start';
      statusText.textContent = isRunning ? 'Bot is running' : 'Bot is stopped';
      
      console.log('Updated UI with bot status:', isRunning);
    } else {
      console.error('UI elements not found:', { button: !!startStopButton, statusText: !!statusText });
    }
  } catch (error) {
    console.error('Error updating bot status:', error);
  }
}

// Stop bet variations
async function stopBetVariations() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'stopBetVariations' });
    
    if (response && response.status === 'success') {
      document.getElementById('startBetVariationsButton').disabled = false;
      document.getElementById('stopBetVariationsButton').disabled = true;
      document.getElementById('variationStatus').textContent = 'Variations stopped';
      
      showNotification('Bet variations stopped');
    } else {
      showNotification(`Error: ${response.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error stopping bet variations:', error);
    showNotification(`Error: ${error.message}`);
  }
}

// Show notification
function showNotification(message) {
  if (!notification) return;
  
  notification.textContent = message;
  notification.style.display = 'block';
  
  // Hide after 3 seconds
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

// Validate match counts function - used in input event handlers
function validateMatchCounts() {
  if (!favoritesCountInput || !underdogsCountInput) return true;
  
  const favoritesCount = parseInt(favoritesCountInput.value) || 0;
  const underdogsCount = parseInt(underdogsCountInput.value) || 0;
  
  // Simple validation to ensure both inputs have non-negative values
  if (favoritesCount < 0 || underdogsCount < 0) {
    showNotification("Counts cannot be negative");
    return false;
  }
  
  // More complex validation can be added here if needed
  console.log(`Validated counts: Favorites=${favoritesCount}, Underdogs=${underdogsCount}`);
  return true;
}

// Start bet variations
async function startBetVariations() {
  try {
    // Get favorites and underdogs counts
    const favoritesCount = parseInt(favoritesCountInput.value) || 0;
    const underdogsCount = parseInt(underdogsCountInput.value) || 0;
    
    // Get stake amount
    const stake = parseFloat(stakeAmountInput.value) || 0.10;
    
    const response = await chrome.runtime.sendMessage({ 
      action: 'startBetVariations',
      favoritesCount: favoritesCount,
      underdogsCount: underdogsCount,
      stake: stake
    });
    
    if (response && response.status === 'success') {
      if (startBetVariationsButton) startBetVariationsButton.disabled = true;
      if (stopBetVariationsButton) stopBetVariationsButton.disabled = false;
      if (variationStatus) variationStatus.textContent = 'Variations running...';
      
      showNotification('Bet variations started');
    } else {
      showNotification(`Error: ${response.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error starting bet variations:', error);
    showNotification(`Error: ${error.message}`);
  }
}

// Open settings page
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// Terminate auto betting (force stop)
async function terminateAutoBetting() {
  try {
    chrome.runtime.sendMessage(
      { action: 'terminateAutoBetting' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error terminating auto betting:', chrome.runtime.lastError);
          showNotification('Error terminating auto betting');
          return;
        }
        
        console.log('Auto betting terminated response:', response);
        showNotification('Auto betting terminated');
        
        // Update UI
        if (terminateAutoBettingButton) {
          terminateAutoBettingButton.style.display = 'none';
          startAutoBettingButton.style.display = 'inline-block';
        }
      }
    );
  } catch (error) {
    console.error('Error terminating auto betting:', error);
    showNotification('Error terminating auto betting');
  }
}

// Open the bet log page
function openBetLogPage() {
  chrome.runtime.sendMessage({ action: 'openBetLog' });
}
