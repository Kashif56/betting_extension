// DOM Elements
const startStopButton = document.getElementById('startStopButton');
const statusText = document.getElementById('statusText');
const stakeAmountInput = document.getElementById('stakeAmount');
const favoritesCountInput = document.getElementById('favoritesCount');
const underdogsCountInput = document.getElementById('underdogsCount');
const startAutoBettingButton = document.getElementById('startAutoBettingButton');
const terminateAutoBettingButton = document.getElementById('terminateAutoBettingButton');
const stopBettingButton = document.getElementById('stopBettingButton');
const settingsButton = document.getElementById('settingsButton');
const notification = document.getElementById('notification');
let matchCountElement = document.getElementById('matchCount');
let selectedMatchesList = document.getElementById('selectedMatchesList');
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


// Function to update UI with matches
function updateUIWithMatches(matches) {
  console.log('Directly updating UI with', matches ? matches.length : 0, 'matches');

  // Safety check for null or undefined matches
  if (!matches) {
    console.error('Matches array is null or undefined');
    matches = [];
  }

  // IMPORTANT: Make a copy of the matches array to avoid reference issues
  matches = [...matches];

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
    matchCountElement.textContent = matches.length.toString();
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

      // IMPORTANT: Save the matches to global variables to ensure they're not lost
      if (matches.length > 0) {
        if (isMatchesConfirmed) {
          confirmedMatches = [...matches];
        } else {
          selectedMatches = [...matches];
        }

        // Also save to sessionStorage for persistence
        try {
          if (isMatchesConfirmed) {
            sessionStorage.setItem('preservedConfirmedMatches', JSON.stringify(matches));
          } else {
            sessionStorage.setItem('preservedSelectedMatches', JSON.stringify(matches));
          }
          sessionStorage.setItem('preservedIsMatchesConfirmed', JSON.stringify(isMatchesConfirmed));
        } catch (e) {
          console.error('Error saving matches to sessionStorage:', e);
        }
      }

      // Verify the content was set correctly
      setTimeout(() => {
        const items = selectedMatchesList.querySelectorAll('.match-item');
        console.log(`Verification: Found ${items.length} match items in the DOM after update`);

        // If no items were rendered but we have matches, try again
        if (items.length === 0 && matches.length > 0) {
          console.error('CRITICAL: No match items rendered despite having matches. Trying emergency update...');

          // Emergency direct DOM update
          let emergencyHtml = '';
          matches.slice(0, 5).forEach((match, index) => {
            const team1 = match.team1 || 'Unknown Team 1';
            const team2 = match.team2 || 'Unknown Team 2';
            const selectedTeam = match.selectedTeam || 'Unknown Selection';
            const odds = match.odds || '0.00';

            emergencyHtml += `
              <div class="match-item" data-match-id="${match.matchId || index}">
                <div class="match-teams">${team1} vs ${team2}</div>
                <div class="match-odds">Selected: ${selectedTeam} (${odds})</div>
              </div>
            `;
          });

          if (matches.length > 5) {
            emergencyHtml += `<div class="match-item">+ ${matches.length - 5} more matches...</div>`;
          }

          selectedMatchesList.innerHTML = emergencyHtml;
          console.log('Emergency DOM update completed');
        }
      }, 50);
    }
  } else {
    console.error('CRITICAL ERROR: selectedMatchesList element not found when directly updating UI');
  }
}

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

  // Debug: Log all storage data to help diagnose issues
  chrome.storage.local.get(null, (allData) => {
    console.log('All storage data:', allData);
  });

  chrome.storage.local.get(['selectedMatches', 'confirmedMatches', 'isMatchesConfirmed'], (result) => {
    console.log('Direct storage load result:', result);

    // Update local variables with storage data
    if (result.selectedMatches) {
      // Make sure we're creating a new array to avoid reference issues
      selectedMatches = [...result.selectedMatches];
      console.log('Loaded selected matches:', selectedMatches.length);
      console.log('First match data:', selectedMatches.length > 0 ? JSON.stringify(selectedMatches[0]) : 'No matches');
    } else {
      console.warn('No selected matches found in storage');
      selectedMatches = [];
    }

    if (result.isMatchesConfirmed) {
      isMatchesConfirmed = result.isMatchesConfirmed;

      if (result.confirmedMatches) {
        // Make sure we're creating a new array to avoid reference issues
        confirmedMatches = [...result.confirmedMatches];
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

    // Make the variables available for debugging
    // @ts-ignore - These are for debugging purposes
    window.selectedMatchesDebug = [...selectedMatches];
    // @ts-ignore - These are for debugging purposes
    window.confirmedMatchesDebug = [...confirmedMatches];
    // @ts-ignore - These are for debugging purposes
    window.isMatchesConfirmedDebug = isMatchesConfirmed;

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

// Debug function to force reload matches from storage
function debugForceReloadMatches() {
  console.log('DEBUG: Force reloading matches from storage');

  // First check sessionStorage for preserved matches
  console.log('Checking sessionStorage for preserved matches...');
  try {
    const preservedSelectedMatches = sessionStorage.getItem('preservedSelectedMatches');
    const preservedConfirmedMatches = sessionStorage.getItem('preservedConfirmedMatches');
    const preservedIsMatchesConfirmed = sessionStorage.getItem('preservedIsMatchesConfirmed');

    console.log('SessionStorage data:');
    console.log('- preservedSelectedMatches:', preservedSelectedMatches ? JSON.parse(preservedSelectedMatches).length : 0);
    console.log('- preservedConfirmedMatches:', preservedConfirmedMatches ? JSON.parse(preservedConfirmedMatches).length : 0);
    console.log('- preservedIsMatchesConfirmed:', preservedIsMatchesConfirmed);
  } catch (e) {
    console.error('Error checking sessionStorage:', e);
  }

  // Get all storage data
  chrome.storage.local.get(null, (allData) => {
    console.log('All chrome.storage.local data:', allData);

    // Extract matches
    const storedSelectedMatches = allData.selectedMatches || [];
    const storedConfirmedMatches = allData.confirmedMatches || [];
    const storedIsMatchesConfirmed = allData.isMatchesConfirmed || false;

    console.log('Selected matches in storage:', storedSelectedMatches.length);
    if (storedSelectedMatches.length > 0) {
      console.log('First match in storage:', JSON.stringify(storedSelectedMatches[0]));
    }
    console.log('Confirmed matches in storage:', storedConfirmedMatches.length);
    console.log('Is matches confirmed in storage:', storedIsMatchesConfirmed);

    // Check in-memory matches
    console.log('Current in-memory matches:');
    console.log('- selectedMatches:', selectedMatches ? selectedMatches.length : 0);
    console.log('- confirmedMatches:', confirmedMatches ? confirmedMatches.length : 0);
    console.log('- isMatchesConfirmed:', isMatchesConfirmed);

    // Use the best available matches (prefer in-memory, then storage)
    const finalSelectedMatches = selectedMatches.length > 0 ? selectedMatches : storedSelectedMatches;
    const finalConfirmedMatches = confirmedMatches.length > 0 ? confirmedMatches : storedConfirmedMatches;
    const finalIsMatchesConfirmed = isMatchesConfirmed !== undefined ? isMatchesConfirmed : storedIsMatchesConfirmed;

    // Update global variables directly
    selectedMatches = finalSelectedMatches;
    confirmedMatches = finalConfirmedMatches;
    isMatchesConfirmed = finalIsMatchesConfirmed;

    // Update debug variables
    // @ts-ignore - These are for debugging purposes
    window.selectedMatchesDebug = finalSelectedMatches;
    // @ts-ignore - These are for debugging purposes
    window.confirmedMatchesDebug = finalConfirmedMatches;
    // @ts-ignore - These are for debugging purposes
    window.isMatchesConfirmedDebug = finalIsMatchesConfirmed;

    // Force update UI
    const displayMatches = isMatchesConfirmed ? confirmedMatches : selectedMatches;
    console.log('Display matches count:', displayMatches.length);

    // Force clear and update the UI
    if (selectedMatchesList) {
      // First clear the list
      selectedMatchesList.innerHTML = '';

      // Then update with matches
      updateUIWithMatches(displayMatches);
    } else {
      console.error('selectedMatchesList element not found');
      // Try to get the element again
      const listElement = document.getElementById('selectedMatchesList');
      if (listElement) {
        selectedMatchesList = listElement;
        updateUIWithMatches(displayMatches);
      } else {
        showNotification('Error: Could not find matches list element', 'error');
      }
    }

    // Update match count
    if (matchCountElement) {
      matchCountElement.textContent = displayMatches.length.toString();
    } else {
      console.error('matchCountElement not found');
      // Try to get the element again
      const countElement = document.getElementById('matchCount');
      if (countElement) {
        matchCountElement = countElement;
        matchCountElement.textContent = displayMatches.length.toString();
      }
    }

    // Save the matches back to storage to ensure consistency
    chrome.storage.local.set({
      selectedMatches: selectedMatches,
      confirmedMatches: confirmedMatches,
      isMatchesConfirmed: isMatchesConfirmed
    }, () => {
      console.log('Saved matches back to storage for consistency');
    });

    // Also preserve in sessionStorage
    preserveMatches();

    // Show notification
    showNotification(`Loaded ${displayMatches.length} matches from storage`, 'info');
  });
}

// Make functions accessible to debug scripts
window.loadMatchesFromStorage = loadMatchesFromStorage;
window.updateUIWithMatches = updateUIWithMatches;
window.debugForceReloadMatches = debugForceReloadMatches;

// Add event listener for when the popup is about to close
window.addEventListener('beforeunload', () => {
  console.log('Popup is closing, preserving matches...');
  preserveMatches();
});

// Also preserve matches periodically
setInterval(() => {
  preserveMatches();
}, 5000); // Every 5 seconds

// Function to preserve matches in memory
function preserveMatches() {
  // Store the current matches in sessionStorage to prevent them from being lost
  if (selectedMatches && selectedMatches.length > 0) {
    try {
      sessionStorage.setItem('preservedSelectedMatches', JSON.stringify(selectedMatches));
      console.log(`Preserved ${selectedMatches.length} selected matches in sessionStorage`);
    } catch (e) {
      console.error('Error preserving selected matches:', e);
    }
  }

  if (confirmedMatches && confirmedMatches.length > 0) {
    try {
      sessionStorage.setItem('preservedConfirmedMatches', JSON.stringify(confirmedMatches));
      console.log(`Preserved ${confirmedMatches.length} confirmed matches in sessionStorage`);
    } catch (e) {
      console.error('Error preserving confirmed matches:', e);
    }
  }

  if (isMatchesConfirmed !== undefined) {
    try {
      sessionStorage.setItem('preservedIsMatchesConfirmed', JSON.stringify(isMatchesConfirmed));
    } catch (e) {
      console.error('Error preserving isMatchesConfirmed flag:', e);
    }
  }
}

// Function to restore preserved matches
function restorePreservedMatches() {
  try {
    const preservedSelectedMatches = sessionStorage.getItem('preservedSelectedMatches');
    if (preservedSelectedMatches) {
      const parsedMatches = JSON.parse(preservedSelectedMatches);
      if (parsedMatches && parsedMatches.length > 0) {
        console.log(`Restored ${parsedMatches.length} selected matches from sessionStorage`);
        selectedMatches = parsedMatches;
      }
    }

    const preservedConfirmedMatches = sessionStorage.getItem('preservedConfirmedMatches');
    if (preservedConfirmedMatches) {
      const parsedMatches = JSON.parse(preservedConfirmedMatches);
      if (parsedMatches && parsedMatches.length > 0) {
        console.log(`Restored ${parsedMatches.length} confirmed matches from sessionStorage`);
        confirmedMatches = parsedMatches;
      }
    }

    const preservedIsMatchesConfirmed = sessionStorage.getItem('preservedIsMatchesConfirmed');
    if (preservedIsMatchesConfirmed) {
      isMatchesConfirmed = JSON.parse(preservedIsMatchesConfirmed);
    }

    // Update the UI with the restored matches
    if ((selectedMatches && selectedMatches.length > 0) || (confirmedMatches && confirmedMatches.length > 0)) {
      const displayMatches = isMatchesConfirmed ? confirmedMatches : selectedMatches;
      if (displayMatches && displayMatches.length > 0) {
        console.log(`Updating UI with ${displayMatches.length} restored matches`);
        updateMatchesDisplay(displayMatches);
      }
    }
  } catch (e) {
    console.error('Error restoring preserved matches:', e);
  }
}

// Load saved settings
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM content loaded - initializing popup');

  // Ensure DOM elements are available
  selectedMatchesList = document.getElementById('selectedMatchesList');
  matchCountElement = document.getElementById('matchCount');

  // Make sure all button elements are properly initialized
  const startStopButton = document.getElementById('startStopButton');
  const startAutoBettingButton = document.getElementById('startAutoBettingButton');
  const terminateAutoBettingButton = document.getElementById('terminateAutoBettingButton');
  const stopBettingButton = document.getElementById('stopBettingButton');

  if (!selectedMatchesList) {
    console.error('CRITICAL: selectedMatchesList element not found on DOMContentLoaded');
  }

  if (!matchCountElement) {
    console.error('CRITICAL: matchCountElement not found on DOMContentLoaded');
  }

  // IMPORTANT: First directly check chrome.storage.local for matches
  // This is the most reliable source of truth
  chrome.storage.local.get(['selectedMatches', 'confirmedMatches', 'isMatchesConfirmed'], (result) => {
    console.log('Initial storage check result:', result);

    // Update global variables with storage data
    if (result.selectedMatches && result.selectedMatches.length > 0) {
      selectedMatches = [...result.selectedMatches];
      console.log(`Found ${selectedMatches.length} selected matches in storage`);
    }

    if (result.confirmedMatches && result.confirmedMatches.length > 0) {
      confirmedMatches = [...result.confirmedMatches];
      console.log(`Found ${confirmedMatches.length} confirmed matches in storage`);
    }

    if (result.isMatchesConfirmed !== undefined) {
      isMatchesConfirmed = result.isMatchesConfirmed;
    }

    // Immediately update the UI with the matches we found
    const displayMatches = isMatchesConfirmed ? confirmedMatches : selectedMatches;
    if (displayMatches && displayMatches.length > 0) {
      console.log(`Immediately displaying ${displayMatches.length} matches from storage`);
      updateUIWithMatches(displayMatches);
    }
  });

  // Try to restore any preserved matches as a backup
  restorePreservedMatches();
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

    // Check auto betting status and update UI accordingly
    const autoBettingStatus = await checkAutoBettingStatus();
    console.log('Initial auto betting status check:', autoBettingStatus);

    // If auto betting is active, show the appropriate buttons
    if (autoBettingStatus && autoBettingStatus.isAutoBetting) {
      console.log('Auto betting is active, updating UI');
      updateAutoBettingStatus(true);
    }

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

          // Add a second attempt after a short delay to ensure UI updates
          setTimeout(() => {
            console.log('Performing delayed match load after storage change');
            loadMatchesFromStorage();
          }, 300);
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

    // Function to toggle bot state
    async function toggleBot() {
      if (isRunning) {
        await stopBot();
      } else {
        await startBot();
      }
    }

    // Bet variations buttons event listeners removed

    if (startAutoBettingButton) {
      startAutoBettingButton.addEventListener('click', startAutoBetting);
    }

    if (terminateAutoBettingButton) {
      terminateAutoBettingButton.addEventListener('click', resetExtension);
    }

    if (stopBettingButton) {
      stopBettingButton.addEventListener('click', stopBettingAndReload);
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

    // Add event listener for debug button
    const debugButton = document.getElementById('debugButton');
    if (debugButton) {
      debugButton.addEventListener('click', debugForceReloadMatches);
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

      // IMPORTANT: Directly check if matches are displayed in the DOM
      const matchItems = document.querySelectorAll('.match-item');
      console.log(`After delayed load: Found ${matchItems.length} match items in DOM`);

      if (matchItems.length === 0 && selectedMatches.length > 0) {
        console.log('No match items in DOM despite having matches in memory, forcing display...');
        updateMatchesDisplay(selectedMatches);
      }
    }, 500);

    // And a third attempt after a longer delay
    setTimeout(() => {
      console.log('Performing final delayed match load to ensure matches are displayed');
      loadMatchesFromStorage();

      // Debug: Check if matches are actually in storage
      chrome.storage.local.get(['selectedMatches', 'confirmedMatches'], (result) => {
        console.log('DEBUG - Final check of matches in storage:');
        console.log('Selected matches:', result.selectedMatches ? result.selectedMatches.length : 0);
        console.log('Confirmed matches:', result.confirmedMatches ? result.confirmedMatches.length : 0);

        // If we have matches but they're not showing, force update the UI directly
        const matchesToShow = result.confirmedMatches && result.confirmedMatches.length > 0 ?
          result.confirmedMatches : (result.selectedMatches || []);

        if (matchesToShow.length > 0) {
          console.log('Forcing direct UI update with available matches:', matchesToShow.length);
          updateUIWithMatches(matchesToShow);

          // Check if the UI was actually updated
          setTimeout(() => {
            const matchItems = document.querySelectorAll('.match-item');
            console.log(`After final update: Found ${matchItems.length} match items in the DOM`);

            if (matchItems.length === 0) {
              console.log('CRITICAL: Still no match items in DOM despite having matches in storage. Trying emergency update...');

              // Emergency direct DOM update
              const matchesList = document.getElementById('selectedMatchesList');
              if (matchesList) {
                let html = '';
                matchesToShow.slice(0, 5).forEach((match, index) => {
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
                });

                if (matchesToShow.length > 5) {
                  html += `<div class="match-item">+ ${matchesToShow.length - 5} more matches...</div>`;
                }

                matchesList.innerHTML = html;
                console.log('Emergency DOM update completed');

                // Update match count
                const countElement = document.getElementById('matchCount');
                if (countElement) {
                  countElement.textContent = matchesToShow.length.toString();
                }

                showNotification(`Emergency loaded ${matchesToShow.length} matches`, 'info');
              }
            }
          }, 200);
        }
      });
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
      { action: 'startBot', delay: 1000 }, // Use default delay of 1000ms
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

    // Show confirmation dialog for resetting data and reloading page
    const confirmation = confirm('Do you want to reset data and reload the page?');
    if (confirmation) {
      await resetDataAndReloadPage();
    }
  } catch (error) {
    console.error('Error stopping bot:', error);
  }
}

// Function to stop betting, reset data and reload the page
async function stopBettingAndReload() {
  try {
    // Show confirmation dialog
    const confirmation = confirm('Are you sure you want to stop betting? This will reset all data and reload the page.');
    if (!confirmation) return;

    // Show notification that we're stopping the betting process
    showNotification('Stopping auto betting and resetting data...', 'info');

    // First, forcefully terminate auto betting if it's running
    console.log('Forcefully terminating auto betting...');

    // Send terminate message directly to ensure it stops
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'terminateAutoBetting' }, (response) => {
        console.log('Terminate auto betting response:', response);
        resolve();
      });

      // Add a timeout to resolve the promise even if there's no response
      setTimeout(resolve, 1000);
    });

    // Update UI to reflect that auto betting is stopped
    isAutoBetting = false;
    updateAutoBettingStatus(false);

    // Then reset data and reload page
    console.log('Resetting data and reloading page...');
    await resetDataAndReloadPage();
  } catch (error) {
    console.error('Error stopping betting and reloading:', error);
    showNotification('Error stopping betting: ' + error.message, 'error');

    // Try to reset and reload anyway as a fallback
    try {
      await resetDataAndReloadPage();
    } catch (innerError) {
      console.error('Error in fallback reset:', innerError);
    }
  }
}

// Function to reset data and reload the page
async function resetDataAndReloadPage() {
  try {
    // Clear all stored data in chrome.storage.local
    await chrome.storage.local.clear();

    // Show notification
    showNotification('Data reset successfully. Reloading page...', 'success');

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
  } catch (error) {
    console.error('Error resetting data and reloading page:', error);
    showNotification('Error resetting data: ' + error.message, 'error');
  }
}

async function saveSettings() {
  try {
    const stakeAmount = parseFloat(stakeAmountInput.value);
    await chrome.storage.local.set({ stakeAmount });

    // Show notification
    showNotification('Settings saved successfully', 'success');

    console.log('Settings saved');
  } catch (error) {
    console.error('Error saving settings:', error);
    showNotification('Error saving settings: ' + error.message, 'error');
  }
}

function updateStatus() {
  if (statusText) {
    statusText.textContent = isRunning ? 'Running' : 'Inactive';
    statusText.style.color = isRunning ? '#4CAF50' : '#f44336';
  }

  // The startBtn and stopBtn variables don't exist in the current HTML
  // Instead, we should use startStopButton which is defined at the top
  if (startStopButton) {
    startStopButton.textContent = isRunning ? 'Stop Bot' : 'Start Bot';
    startStopButton.className = isRunning ? 'button stop' : 'button start';
  }
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

  // Use confirmed matches if they exist and matches are confirmed
  const displayMatches = isMatchesConfirmed ? confirmedMatches : matches;
  console.log('Display matches:', displayMatches.length, 'isMatchesConfirmed:', isMatchesConfirmed);

  // Use the common updateUIWithMatches function to ensure consistent display
  updateUIWithMatches(displayMatches);

  // Add a verification check after a short delay
  setTimeout(() => {
    if (selectedMatchesList) {
      const items = selectedMatchesList.querySelectorAll('.match-item');
      console.log(`Verification: Found ${items.length} match items in the DOM after updateMatchesDisplay`);

      // If no items were rendered but we have matches, try direct update again
      if (items.length === 0 && displayMatches.length > 0) {
        console.log('No items rendered despite having matches. Trying direct update again.');
        updateUIWithMatches(displayMatches);
      }
    }
  }, 100);
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
    chrome.runtime.sendMessage({ action: 'matchesUpdated', matches: [] }, (response) => {
      console.log('Badge update response:', response);
    });

    // Also update the match count badge in the popup
    if (matchCountElement) {
      matchCountElement.textContent = '0';
    }

    clearBetSlip();

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

    // Show terminate and stop betting buttons
    if (terminateAutoBettingButton && stopBettingButton) {
      startAutoBettingButton.style.display = 'none';
      terminateAutoBettingButton.style.display = 'inline-block';
      stopBettingButton.style.display = 'inline-block';
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
      startAutoBettingButton.style.display = isActive ? 'none' : 'inline-block';
    }

    if (terminateAutoBettingButton) {
      terminateAutoBettingButton.style.display = isActive ? 'inline-block' : 'none';
    }

    if (stopBettingButton) {
      stopBettingButton.style.display = isActive ? 'inline-block' : 'none';
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
    console.log('Checking auto betting status...');
    const response = await chrome.runtime.sendMessage({
      action: 'getAutoBettingStatus'
    });

    console.log('Auto betting status response:', response);

    if (response) {
      // Update global state
      isAutoBetting = response.isAutoBetting;
      maxAutoBets = response.maxAutoBets || 5;

      // Log the current status
      console.log(`Auto betting is ${isAutoBetting ? 'active' : 'inactive'}`);

      // Update UI based on status
      if (isAutoBetting && response.sessionInfo) {
        updateAutoBettingProgress(
          response.sessionInfo.completedBets || 0,
          response.sessionInfo.totalBets || maxAutoBets
        );
      }

      // Return the status for the caller to use
      return {
        isAutoBetting: isAutoBetting,
        maxAutoBets: maxAutoBets,
        sessionInfo: response.sessionInfo
      };
    }

    return { isAutoBetting: false };
  } catch (error) {
    console.error('Error checking auto betting status:', error);
    return { isAutoBetting: false, error: error.message };
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
        // Make a copy of the matches array to avoid reference issues
        selectedMatches = [...message.matches];
        console.log(`Updated selectedMatches array with ${selectedMatches.length} matches`);

        // If we have match data, log the first match
        if (selectedMatches.length > 0) {
          console.log('First match data:', JSON.stringify(selectedMatches[0]));
        }

        // Update the display with the new matches
        updateMatchesDisplay(selectedMatches);

        // Also update the match count badge
        const matchCountBadge = document.getElementById('matchCount');
        if (matchCountBadge) {
          matchCountBadge.textContent = selectedMatches.length.toString();
          console.log(`Updated match count badge to ${selectedMatches.length}`);
        }

        // Make the updated matches available for debugging
        // @ts-ignore - These are for debugging purposes
        window.selectedMatchesDebug = [...selectedMatches];

        // Force a storage save to ensure consistency
        chrome.storage.local.set({ selectedMatches: selectedMatches }, () => {
          console.log('Saved selectedMatches to storage after message update');
        });
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
      if (terminateAutoBettingButton && stopBettingButton) {
        startAutoBettingButton.style.display = 'none';
        terminateAutoBettingButton.style.display = 'inline-block';
        stopBettingButton.style.display = 'inline-block';
      }

      // Update the global auto betting state
      isAutoBetting = true;

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
      if (terminateAutoBettingButton && stopBettingButton) {
        terminateAutoBettingButton.style.display = 'none';
        stopBettingButton.style.display = 'none';
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
      if (terminateAutoBettingButton && stopBettingButton) {
        terminateAutoBettingButton.style.display = 'none';
        stopBettingButton.style.display = 'none';
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

    // IMPORTANT: Save current matches before updating status
    // This prevents them from being lost during status updates
    const currentSelectedMatches = [...selectedMatches];
    const currentConfirmedMatches = [...confirmedMatches];
    const currentIsMatchesConfirmed = isMatchesConfirmed;

    console.log('Saved current matches before status update:', {
      selectedMatches: currentSelectedMatches.length,
      confirmedMatches: currentConfirmedMatches.length,
      isMatchesConfirmed: currentIsMatchesConfirmed
    });

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

    // Store the current running state
    window.isRunning = isRunning;

    // Update UI elements if they exist
    if (startStopButton) {
      startStopButton.textContent = isRunning ? 'Stop Bot' : 'Start Bot';
      startStopButton.className = isRunning ? 'button stop' : 'button start';
    }

    if (statusText) {
      statusText.textContent = isRunning ? 'Bot is running' : 'Bot is stopped';
    }

    console.log('Updated UI with bot status:', isRunning);

    // IMPORTANT: Restore matches after status update
    // This ensures they aren't lost during the update
    selectedMatches = currentSelectedMatches;
    confirmedMatches = currentConfirmedMatches;
    isMatchesConfirmed = currentIsMatchesConfirmed;

    console.log('Restored matches after status update:', {
      selectedMatches: selectedMatches.length,
      confirmedMatches: confirmedMatches.length,
      isMatchesConfirmed: isMatchesConfirmed
    });

    // Important: Check if we need to reload matches after status update
    // This ensures matches aren't cleared when bot status changes
    setTimeout(() => {
      const matchItems = document.querySelectorAll('.match-item');
      const matchCount = selectedMatches.length;
      console.log(`After bot status update: Found ${matchItems.length} match items in DOM, have ${matchCount} matches in memory`);

      if (matchItems.length === 0 && matchCount > 0) {
        console.log('Matches disappeared after bot status update, reloading them...');
        updateMatchesDisplay(selectedMatches);
      }
    }, 100);
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
        if (terminateAutoBettingButton && stopBettingButton) {
          terminateAutoBettingButton.style.display = 'none';
          stopBettingButton.style.display = 'none';
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




function clearBetSlip(){
  const betSlipContainer = document.querySelector('[data-testid="betslip-singles-container"]');
  if (betSlipContainer) {
    const removeButtons = betSlipContainer.querySelectorAll('[data-testid="remove-item"]');
    removeButtons.forEach(button => button.click());
  };
}