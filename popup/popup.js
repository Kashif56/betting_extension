// DOM Elements
const startStopButton = document.getElementById('startStopButton');
const statusText = document.getElementById('statusText');
const stakeAmountInput = document.getElementById('stakeAmount');
const favoritesCountInput = document.getElementById('favoritesCount');
const underdogsCountInput = document.getElementById('underdogsCount');
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


// Function to directly load and display matches from storage
function loadMatchesFromStorage() {
  console.log('Direct loading matches from storage...');

  // Make sure we have the DOM elements before proceeding
  if (!selectedMatchesList) {
    console.error('selectedMatchesList element not found in the DOM');
    selectedMatchesList = document.getElementById('selectedMatchesList');
    if (!selectedMatchesList) {
      console.error('CRITICAL ERROR: Cannot find selectedMatchesList element even after retry');
      return;
    }
  }

  if (!matchCountElement) {
    console.error('matchCountElement not found in the DOM');
    matchCountElement = document.getElementById('matchCount');
    if (!matchCountElement) {
      console.error('CRITICAL ERROR: Cannot find matchCount element even after retry');
    }
  }

  chrome.storage.local.get(['selectedMatches', 'confirmedMatches', 'isMatchesConfirmed'], (result) => {
    console.log('Direct storage load result:', result);

    // Update local variables with storage data
    if (result.selectedMatches) {
      selectedMatches = result.selectedMatches;
      console.log('Loaded selected matches:', selectedMatches.length);
      console.log('First match data:', selectedMatches.length > 0 ? JSON.stringify(selectedMatches[0]) : 'No matches');
    } else {
      console.warn('No selected matches found in storage');
      selectedMatches = [];
    }

    if (result.isMatchesConfirmed) {
      isMatchesConfirmed = result.isMatchesConfirmed;

      if (result.confirmedMatches) {
        confirmedMatches = result.confirmedMatches;
        console.log('Loaded confirmed matches:', confirmedMatches.length);
        console.log('First confirmed match data:', confirmedMatches.length > 0 ? JSON.stringify(confirmedMatches[0]) : 'No confirmed matches');
      } else {
        console.warn('No confirmed matches found in storage despite isMatchesConfirmed being true');
        confirmedMatches = [];
      }

      // Update UI to show confirmed status
      if (confirmMatchesButton) {
        confirmMatchesButton.textContent = 'Matches Confirmed';
        confirmMatchesButton.classList.add('confirmed');
      }
    } else {
      isMatchesConfirmed = false;
      confirmedMatches = [];
    }

    // Use the matches we've loaded to update the display
    const displayMatches = isMatchesConfirmed ? confirmedMatches : selectedMatches;
    console.log('Display matches count:', displayMatches.length);

    // Immediately update the UI
    updateUIWithMatches(displayMatches);

    // Force a second update after a short delay to handle any race conditions
    setTimeout(() => {
      console.log('Performing delayed UI update to ensure matches are displayed');
      updateUIWithMatches(isMatchesConfirmed ? confirmedMatches : selectedMatches);
    }, 500);
  });
}

// Make functions accessible to debug scripts
window.loadMatchesFromStorage = loadMatchesFromStorage;
window.updateUIWithMatches = updateUIWithMatches;

// Function to update UI with matches
function updateUIWithMatches(matches) {
  console.log('Directly updating UI with', matches ? matches.length : 0, 'matches');

  // Safety check for null or undefined matches
  if (!matches) {
    console.error('Matches array is null or undefined');
    matches = [];
  }

  // Make sure we have the DOM elements before proceeding
  if (!selectedMatchesList) {
    console.error('selectedMatchesList element not found in the DOM');
    selectedMatchesList = document.getElementById('selectedMatchesList');
    if (!selectedMatchesList) {
      console.error('CRITICAL ERROR: Cannot find selectedMatchesList element even after retry');
      return;
    }
  }

  if (!matchCountElement) {
    console.error('matchCountElement not found in the DOM');
    matchCountElement = document.getElementById('matchCount');
    if (!matchCountElement) {
      console.error('CRITICAL ERROR: Cannot find matchCount element even after retry');
    }
  }

  // Update count
  if (matchCountElement) {
    matchCountElement.textContent = matches.length;
    console.log(`Updated match count display to ${matches.length}`);
  }

  // Update matches list
  if (selectedMatchesList) {
    if (matches.length === 0) {
      selectedMatchesList.innerHTML = '<p class="no-matches">No matches selected</p>';
      console.log('Set empty matches message');

      // Disable buttons that require matches
      if (viewMatchesButton) viewMatchesButton.disabled = true;
      if (clearSelectionsButton) clearSelectionsButton.disabled = true;
      if (confirmMatchesButton) confirmMatchesButton.disabled = true;
    } else {
      // Enable buttons
      if (viewMatchesButton) viewMatchesButton.disabled = false;
      if (clearSelectionsButton) clearSelectionsButton.disabled = isMatchesConfirmed;
      if (confirmMatchesButton) confirmMatchesButton.disabled = false;

      console.log(`Displaying ${matches.length} matches in UI`);

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
          console.log(`Added match to display: ${team1} vs ${team2}, selected: ${selectedTeam}`);
        } catch (err) {
          console.error('Error processing match in direct UI update:', err, match);
        }
      });

      // If there are more than 5 matches, show count of remaining
      if (matches.length > 5) {
        html += `<div class="match-item">+ ${matches.length - 5} more matches...</div>`;
        console.log(`Added message for ${matches.length - 5} additional matches`);
      }

      // Safety check for empty HTML
      if (html === '') {
        html = '<p class="no-matches">Error displaying matches data</p>';
        console.error('Generated HTML was empty, using error message instead');
      }

      // Set the HTML content
      console.log('Setting HTML content for matches list');
      selectedMatchesList.innerHTML = html;

      // Verify the content was set correctly
      setTimeout(() => {
        const items = selectedMatchesList.querySelectorAll('.match-item');
        console.log(`Verification: Found ${items.length} match items in the DOM after update`);
      }, 0);
    }
  } else {
    console.error('CRITICAL ERROR: selectedMatchesList element not found when directly updating UI');
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

    // Add a listener for storage changes to update the UI when matches change
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        console.log('Storage changes detected:', changes);

        if (changes.selectedMatches || changes.confirmedMatches || changes.isMatchesConfirmed) {
          console.log('Match data changed in storage, updating UI...');
          // Reload matches from storage when they change
          loadMatchesFromStorage();
        }
      }
    });

    // Add event listeners for input validation
    if (favoritesCountInput && underdogsCountInput) {
      // Use a wrapper function for the async validateMatchCounts
      const validateMatchCountsWrapper = () => {
        // Call the non-async version for immediate UI feedback
        const oldValidateMatchCounts = function() {
          const favoritesCount = parseInt(favoritesCountInput.value) || 0;
          const underdogsCount = parseInt(underdogsCountInput.value) || 0;
          const totalCount = favoritesCount + underdogsCount;
          const matchCount = selectedMatches.length;

          // Show warning if counts don't match and there are matches selected
          if (matchCount > 0 && totalCount !== matchCount) {
            if (matchCountWarning) {
              matchCountWarning.style.display = 'block';
              matchCountWarning.textContent = `Total must equal selected matches count (${matchCount})`;
            }
            if (confirmMatchesButton) confirmMatchesButton.disabled = true;
            return false;
          } else {
            if (matchCountWarning) matchCountWarning.style.display = 'none';
            // Only enable the confirm button if we have matches
            if (confirmMatchesButton) confirmMatchesButton.disabled = matchCount === 0;
            return true;
          }
        };

        // Call the old function for immediate UI feedback
        oldValidateMatchCounts();

        // Also call the async version to store the values
        validateMatchCounts().catch(err => console.error('Error in async validateMatchCounts:', err));
      };

      favoritesCountInput.addEventListener('input', validateMatchCountsWrapper);
      underdogsCountInput.addEventListener('input', validateMatchCountsWrapper);
    }

    // Set up UI event listeners
    if (startStopButton) {
      startStopButton.addEventListener('click', toggleBot);
    }

    // Bet variations buttons event listeners removed

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

    // Add event listener for reset button
    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
      resetButton.addEventListener('click', resetExtension);
    }

    console.log('Popup initialized with UI elements:', {
      startStopButton: !!startStopButton,
      statusText: !!statusText,
      selectedMatchesList: !!selectedMatchesList,
      matchCountElement: !!matchCountElement,
      selectedMatches: selectedMatches.length
    });

    // Force a second load after a short delay to handle any race conditions
    setTimeout(() => {
      console.log('Performing delayed match load to ensure matches are displayed');
      loadMatchesFromStorage();
    }, 1000);

    // Debug button removed
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
    console.warn('Matches array is null or undefined');
    matches = [];
  }

  // Make sure we have the DOM elements before proceeding
  if (!selectedMatchesList) {
    console.error('selectedMatchesList element not found in the DOM');
    selectedMatchesList = document.getElementById('selectedMatchesList');
    if (!selectedMatchesList) {
      console.error('CRITICAL ERROR: Cannot find selectedMatchesList element even after retry');
      return;
    }
  }

  if (!matchCountElement) {
    console.error('matchCountElement not found in the DOM');
    matchCountElement = document.getElementById('matchCount');
    if (!matchCountElement) {
      console.error('CRITICAL ERROR: Cannot find matchCount element even after retry');
    }
  }

  // Use confirmed matches if they exist and matches are confirmed
  const displayMatches = isMatchesConfirmed ? confirmedMatches : matches;
  console.log('Display matches:', displayMatches.length, 'isMatchesConfirmed:', isMatchesConfirmed);

  // Update count
  if (matchCountElement) {
    matchCountElement.textContent = displayMatches.length;
    console.log(`Updated match count display to ${displayMatches.length}`);
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

      displayMatches.slice(0, 5).forEach((match, index) => {
        try {
          // Safety checks for incomplete match data
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
          console.log(`Added match to display: ${team1} vs ${team2}, selected: ${selectedTeam}`);
        } catch (err) {
          console.error('Error processing match data:', err, match);
        }
      });

      // If there are more than 5 matches, show count of remaining
      if (displayMatches.length > 5) {
        html += `<div class="match-item">+ ${displayMatches.length - 5} more matches...</div>`;
        console.log(`Added message for ${displayMatches.length - 5} additional matches`);
      }

      if (html === '') {
        html = '<p class="no-matches">Error displaying matches data</p>';
        console.error('Generated HTML was empty, using error message instead');
      }

      console.log('Generated HTML for matches:', html.substring(0, 100) + '...');
      selectedMatchesList.innerHTML = html;

      // Verify the content was set correctly
      setTimeout(() => {
        const items = selectedMatchesList.querySelectorAll('.match-item');
        console.log(`Verification: Found ${items.length} match items in the DOM after update`);
      }, 0);
    }
  } else {
    console.error('CRITICAL ERROR: selectedMatchesList element not found in the DOM');
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

// This function is replaced by the async version below and the wrapper in the event listeners
// Keeping this comment as a placeholder to avoid confusion

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
    }).catch(error => {
      console.error('Error opening matches page:', error);
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

      // Update the display to show unconfirmed status
      updateMatchesDisplay(selectedMatches);

      // Show notification
      showNotification('Matches unconfirmed', 'info');

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

    // Update the display to show confirmed status
    updateMatchesDisplay(confirmedMatches);

    // Show notification
    showNotification('Matches confirmed successfully', 'success');

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
    const confirmation = confirm('WARNING: This will place REAL BETS with REAL MONEY using the current settings. Are you absolutely sure you want to continue?');
    if (!confirmation) return;

    // Double confirmation for safety
    const secondConfirmation = confirm('FINAL WARNING: Real money will be used for these bets. Press OK to proceed with placing real bets, or Cancel to abort.');
    if (!secondConfirmation) return;

    // Validate the match counts first
    const isValid = await validateMatchCounts();
    if (!isValid) {
      return; // Stop if validation fails
    }

    // Get stake amount
    let stake = parseFloat(stakeAmountInput.value);
    if (isNaN(stake) || stake <= 0) {
      alert('Please enter a valid stake amount');
      return;
    }

    // Get matches to use - prefer confirmed matches if available
    const matchesToUse = confirmedMatches.length > 0 ? confirmedMatches : selectedMatches;

    // Check if we have enough matches
    if (matchesToUse.length < 2) {
      alert('Please select at least 2 matches for auto betting');
      return;
    }

    // Get favorites and underdogs counts
    // Use parseInt but don't use || operator which would replace 0 with 1
    const favoritesCount = parseInt(favoritesCountInput.value);
    const underdogsCount = parseInt(underdogsCountInput.value);

    // Check if the values are valid numbers
    if (isNaN(favoritesCount) || isNaN(underdogsCount)) {
      alert('Please enter valid numbers for favorites and underdogs counts');
      return;
    }

    // Calculate total possible combinations and display it
    await calculateAndDisplayTotalCombinations(matchesToUse, favoritesCount, underdogsCount);

    // Save settings
    await chrome.storage.local.set({
      stakeAmount: stake,
      favoritesCount,
      underdogsCount
    });

    // Update UI immediately to show we're starting

    // Show terminate button
    if (terminateAutoBettingButton) {
      startAutoBettingButton.style.display = 'none';
      terminateAutoBettingButton.style.display = 'inline-block';
    }

    // Start auto betting - pass the favorites and underdogs counts
    const response = await chrome.runtime.sendMessage({
      action: 'startAutoBetting',
      stake: stake,
      favoritesCount: favoritesCount,
      underdogsCount: underdogsCount
    });

    console.log('Auto betting response:', response);

    if (response && response.status === 'success') {
      console.log('Auto betting started successfully');
      showNotification('Real auto betting started - placing bets with real money');
      updateAutoBettingStatus(true);
    } else {
      console.error('Error starting auto betting:', response ? response.error : 'No response');
      showNotification('Error starting auto betting: ' + (response ? response.error : 'No response'));

      // Revert UI changes
      if (terminateAutoBettingButton) {
        terminateAutoBettingButton.style.display = 'none';
        startAutoBettingButton.style.display = 'inline-block';
      }
      // Status text update removed
      updateAutoBettingStatus(false);
    }
  } catch (error) {
    console.error('Error starting auto betting:', error);
    showNotification('Failed to start auto betting: ' + error.message);

    // Revert UI changes
    if (terminateAutoBettingButton) {
      terminateAutoBettingButton.style.display = 'none';
      startAutoBettingButton.style.display = 'inline-block';
    }
    updateAutoBettingStatus(false);
  }
}

// Function to calculate and display total possible combinations
async function calculateAndDisplayTotalCombinations(matches, favoritesCount, underdogsCount) {
  try {
    // Make a function call to the background script to calculate combinations
    const response = await chrome.runtime.sendMessage({
      action: 'calculateTotalCombinations',
      matches: matches,
      favoritesCount: favoritesCount,
      underdogsCount: underdogsCount
    });

    if (response && response.totalCombinations !== undefined) {
      return response.totalCombinations;
    } else {
      console.error('Failed to calculate total combinations');
      return 'Unknown';
    }
  } catch (error) {
    console.error('Error calculating total combinations:', error);
    return 'Unknown';
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
  try {
    isAutoBetting = isActive;

    // Update status display if available
    const autoBettingStatus = document.getElementById('autoBettingStatus');
    if (autoBettingStatus) {
      autoBettingStatus.textContent = isActive ? 'Active' : 'Inactive';
      autoBettingStatus.style.color = isActive ? '#4CAF50' : '#f44336';
    }

    // Update buttons
    if (startAutoBettingButton) {
      startAutoBettingButton.disabled = isActive;
    }

    // Update other interface elements based on auto betting status
    if (isActive) {
      // Disable other action buttons while auto betting is active
      if (startStopButton) startStopButton.disabled = true;
      if (confirmMatchesButton) confirmMatchesButton.disabled = true;
    } else {
      // Re-enable other buttons when auto betting stops
      if (startStopButton) startStopButton.disabled = isRunning;
      if (confirmMatchesButton && selectedMatches.length > 0) {
        confirmMatchesButton.disabled = false;
      }
    }

    console.log('Updated auto betting status UI:', isActive);
  } catch (error) {
    console.error('Error updating auto betting status UI:', error);
  }
}

function updateAutoBettingProgress(current, total) {
  // Progress element removed
  console.log(`Auto betting progress: ${current}/${total}`);
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

// Function to handle incoming messages from background script
function handleMessage(message) {
  try {
    if (!message.action) return;

    if (message.action === 'matchesUpdated') {
      // Handle updated matches list
      console.log('Received matchesUpdated message:', message);
      if (message.matches) {
        selectedMatches = message.matches;
        console.log(`Updated selectedMatches array with ${selectedMatches.length} matches`);

        // Update the display with the new matches
        updateMatchesDisplay(selectedMatches);

        // Also update the match count badge
        const matchCountBadge = document.getElementById('matchCount');
        if (matchCountBadge) {
          matchCountBadge.textContent = selectedMatches.length;
          console.log(`Updated match count badge to ${selectedMatches.length}`);
        }
      } else {
        console.warn('Received matchesUpdated message with no matches');
      }
    }
    else if (message.action === 'botStatusUpdated') {
      // Update bot status in UI
      isRunning = message.isRunning;
      updateStatus();
    }
    else if (message.action === 'autoBettingProgress') {
      console.log('Auto betting progress update:', message);

      // Update the auto betting progress in the UI
      if (terminateAutoBettingButton) {
        startAutoBettingButton.style.display = 'none';
        terminateAutoBettingButton.style.display = 'inline-block';
      }

      // Status text update removed

      // Update the current bet display
      showNotification('Real bet placed - preparing next bet');

      // Update simulation log with the latest bet details
      if (message.lastBet) {
        let simLogElement = document.getElementById('currentSimulation');

        // Create the element if it doesn't exist
        if (!simLogElement) {
          simLogElement = document.createElement('div');
          simLogElement.id = 'currentSimulation';
          simLogElement.className = 'current-simulation';

          const container = document.querySelector('.container');
          if (container) {
            container.appendChild(simLogElement);
          }
        }

        // Update the simulation log content
        simLogElement.innerHTML = `
          <h3>Current Bet: ${message.current}/${message.total}</h3>
          <p>Matches: ${message.lastBet.matches}</p>
          <p>Favorites: ${message.lastBet.favorites}, Underdogs: ${message.lastBet.underdogs}</p>
          <p>Potential Return: $${message.lastBet.potentialReturn.toFixed(2)}</p>
          <p>Status: ${message.lastBet.success ? 'Success' : 'Pending'}</p>
        `;
      }
    }
    else if (message.action === 'autoBettingCompleted') {
      console.log('Auto betting completed:', message);

      // Update UI to show completed state
      if (terminateAutoBettingButton) {
        terminateAutoBettingButton.style.display = 'none';
        startAutoBettingButton.style.display = 'inline-block';
      }

      // Progress text update removed

      // Show notification
      showNotification('Auto betting completed');

      // Add betting summary if available
      if (message.sessionInfo && message.sessionInfo.completedBets > 0) {
        // Create a simulation log element if it doesn't exist
        let simLogElement = document.getElementById('simulationLog');

        // Create the element if it doesn't exist
        if (!simLogElement) {
          simLogElement = document.createElement('div');
          simLogElement.id = 'simulationLog';
          simLogElement.className = 'simulation-log';

          const container = document.querySelector('.container');
          if (container) {
            container.appendChild(simLogElement);
          }
        }

        const completedBets = message.sessionInfo.completedBets;
        const favoritePercentage = message.sessionInfo.favoritePercentage.toFixed(1);

        // Update the simulation log content
        simLogElement.innerHTML = `
          <h3>Betting Summary</h3>
          <p>Completed ${completedBets} bets</p>
          <p>Average favorites percentage: ${favoritePercentage}%</p>
          <p>Click Start Auto Betting to run another betting session</p>
        `;
      }

      // Update auto betting status
      updateAutoBettingStatus(false);
    }
    else if (message.action === 'autoBettingFailed') {
      console.error('Auto betting failed:', message);

      // Update UI to show error state
      if (terminateAutoBettingButton) {
        terminateAutoBettingButton.style.display = 'none';
        startAutoBettingButton.style.display = 'inline-block';
      }

      // Update auto betting status
      updateAutoBettingStatus(false);

      // Show error notification
      const errorMessage = message.error || 'Unknown error';
      showNotification(`Auto betting failed: ${errorMessage}`);

      // Status text update removed
    }
    else if (message.action === 'successfulBet') {
      console.log('Successfully placed bet:', message);
      showNotification('Successfully placed bet');
    }
    else if (message.action === 'betError') {
      console.error('Error placing bet:', message);
      showNotification('Error placing bet: ' + message.error);
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
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

// Stop bet variations function removed

// Show notification
function showNotification(message, type = 'info') {
  try {
    if (!notification) {
      // Try to find or create the notification element if it doesn't exist
      notification = document.getElementById('notification');

      if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
      }
    }

    // Set message and display
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    // Add appropriate styling based on notification type
    if (type === 'error') {
      notification.style.backgroundColor = '#f44336';
    } else if (type === 'success') {
      notification.style.backgroundColor = '#4CAF50';
    } else {
      notification.style.backgroundColor = '#2196F3';
    }

    // Hide after 3 seconds
    setTimeout(() => {
      if (notification) notification.style.display = 'none';
    }, 3000);

    console.log(`Notification (${type}):`, message);
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

// Validate match counts function - used in input event handlers
async function validateMatchCounts() {
  if (!favoritesCountInput || !underdogsCountInput) return true;

  const favoritesCount = parseInt(favoritesCountInput.value) || 0;
  const underdogsCount = parseInt(underdogsCountInput.value) || 0;

  // Simple validation to ensure both inputs have non-negative values
  if (favoritesCount < 0 || underdogsCount < 0) {
    showNotification("Counts cannot be negative");
    return false;
  }

  // Get the number of selected matches
  const matchCount = selectedMatches.length;

  // Validate that the sum of favorites and underdogs equals the number of matches
  if (matchCount > 0 && (favoritesCount + underdogsCount) !== matchCount) {
    showNotification(`Favorites (${favoritesCount}) + Underdogs (${underdogsCount}) must equal total matches (${matchCount})`);
    return false;
  }

  // Store the validated counts in storage for other components to use
  await chrome.storage.local.set({
    favoritesCount: favoritesCount,
    underdogsCount: underdogsCount
  });

  console.log(`Validated and stored counts: Favorites=${favoritesCount}, Underdogs=${underdogsCount}`);
  return true;
}

// Start bet variations function removed

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

// Reset the extension
async function resetExtension() {
  try {
    // Show confirmation dialog
    const confirmation = confirm('Are you sure you want to reset the extension? This will clear all data and reload the page.');
    if (!confirmation) return;

    // First, stop any running processes
    if (isRunning) {
      await stopBot();
    }

    if (isAutoBetting) {
      await terminateAutoBetting();
    }

    // Send message to background script to reset
    chrome.runtime.sendMessage({ action: 'resetExtension' }, async () => {
      // Clear all stored data in chrome.storage.local
      await chrome.storage.local.clear();

      // Show notification
      showNotification('Extension reset successfully. Reloading page...', 'success');

      // Reset all state variables
      selectedMatches = [];
      confirmedMatches = [];
      isMatchesConfirmed = false;
      isAutoBetting = false;
      isRunning = false;

      // Reload the current page after a short delay
      setTimeout(() => {
        // Reload the current tab
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.reload(tabs[0].id);
          }
          // Also reload the popup
          location.reload();
        });
      }, 1500);
    });
  } catch (error) {
    console.error('Error resetting extension:', error);
    showNotification('Error resetting extension: ' + error.message, 'error');
  }
}
