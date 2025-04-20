// DOM Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusText = document.getElementById('statusText');
const delayInput = document.getElementById('delay');
const saveSettingsBtn = document.getElementById('saveSettings');
const matchCountElement = document.getElementById('matchCount');
const viewMatchesBtn = document.getElementById('viewMatchesBtn');
const confirmMatchesBtn = document.getElementById('confirmMatchesBtn');
const favoritesCountInput = document.getElementById('favoritesCount');
const underdogsCountInput = document.getElementById('underdogsCount');
const matchCountWarning = document.getElementById('matchCountWarning');

// Initial state
let isRunning = false;
let selectedMatches = [];

// Load saved settings
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load delay setting
    const result = await chrome.storage.local.get(['delay']);
    if (result.delay) {
      delayInput.value = result.delay;
    }

    // Check if the bot is currently running
    const status = await chrome.storage.local.get(['isRunning']);
    if (status.isRunning) {
      isRunning = true;
      updateStatus();
    }

    // Load selected matches
    await loadSelectedMatches();

    // Listen for match updates
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'matchesUpdated') {
        updateMatchCount(message.matches);
      }
    });
    
    // Add event listeners for input validation
    favoritesCountInput.addEventListener('input', validateMatchCounts);
    underdogsCountInput.addEventListener('input', validateMatchCounts);
  } catch (error) {
    console.error('Error loading settings:', error);
  }
});

// Event Listeners
startBtn.addEventListener('click', startBot);
stopBtn.addEventListener('click', stopBot);
saveSettingsBtn.addEventListener('click', saveSettings);
viewMatchesBtn.addEventListener('click', openMatchesPage);
confirmMatchesBtn.addEventListener('click', confirmMatches);

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
    await chrome.storage.local.set({ delay });

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
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot load matches');
      return;
    }

    const result = await chrome.storage.local.get(['selectedMatches']);
    selectedMatches = result.selectedMatches || [];
    updateMatchCount(selectedMatches);
    
    // Also validate match counts when matches are loaded
    validateMatchCounts();
  } catch (error) {
    console.error('Error loading selected matches:', error);
  }
}

// Update the match count display
function updateMatchCount(matches) {
  selectedMatches = matches || selectedMatches;
  matchCountElement.textContent = selectedMatches.length;

  // Enable/disable buttons based on whether there are matches
  const hasMatches = selectedMatches.length > 0;
  viewMatchesBtn.disabled = !hasMatches;
  confirmMatchesBtn.disabled = !hasMatches || !isValidMatchCounts();
  
  // Update validation when match count changes
  validateMatchCounts();
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

// Confirm matches and set stake
function confirmMatches() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot confirm matches');
      return;
    }

    // Get favorites and underdogs counts
    const favoritesCount = parseInt(favoritesCountInput.value) || 0;
    const underdogsCount = parseInt(underdogsCountInput.value) || 0;
    
    // Validate counts match selected matches
    if (favoritesCount + underdogsCount !== selectedMatches.length) {
      alert(`The sum of favorites (${favoritesCount}) and underdogs (${underdogsCount}) must equal the number of selected matches (${selectedMatches.length}).`);
      return;
    }
    
    // Validate counts are non-negative
    if (favoritesCount < 0 || underdogsCount < 0) {
      alert('Please enter valid numbers for favorites and underdogs (0 or greater).');
      return;
    }
    
    // Prompt for stake amount
    const stake = prompt('Enter stake amount for each bet:', '10');

    // Validate stake input
    if (stake === null) {
      // User cancelled
      return;
    }

    const stakeAmount = parseFloat(stake);
    if (isNaN(stakeAmount) || stakeAmount <= 0) {
      alert('Please enter a valid stake amount greater than 0.');
      return;
    }

    // Save confirmed matches, stake, and player counts to storage
    chrome.storage.local.set({
      confirmedMatches: selectedMatches,
      stakeAmount: stakeAmount,
      favoritesCount: favoritesCount,
      underdogsCount: underdogsCount,
      betVariationActive: true,
      lastVariationIndex: -1 // Start with -1 so first variation will be 0
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving confirmed matches:', chrome.runtime.lastError);
        alert('Error confirming matches. Please try again.');
        return;
      }

      // Notify background script to start bet variations
      chrome.runtime.sendMessage({
        action: 'startBetVariations',
        matches: selectedMatches,
        stake: stakeAmount,
        favoritesCount: favoritesCount,
        underdogsCount: underdogsCount
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending start variations message:', chrome.runtime.lastError);
          return;
        }

        // Open bet details page
        chrome.tabs.create({
          url: chrome.runtime.getURL('pages/bet-details.html')
        });

        // Close popup
        window.close();
      });
    });
  } catch (error) {
    console.error('Error confirming matches:', error);
    alert('Error confirming matches. Please try again.');
  }
}
