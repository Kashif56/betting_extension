// Content script for the Bot Extension
console.log('Bot Extension content script loaded');

// Global variables
let isRunning = false;
let selectedMatches = [];

// Initialize
init();

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    console.log('Content script received message:', message);

    if (message.action === 'performBotAction') {
      performBotAction();
      sendResponse({ status: 'Action performed' });
    }
    else if (message.action === 'botStatus') {
      isRunning = message.isRunning;
      sendResponse({ status: 'Status updated' });
    }
    else if (message.action === 'getSelectedMatches') {
      sendResponse({ matches: selectedMatches });
    }
  } catch (error) {
    console.error('Error handling message in content script:', error);
    // Send an error response so the sender doesn't hang
    sendResponse({ error: error.message });
  }

  // Return true to indicate that we will send a response asynchronously
  return true;
});

// Initialize the content script
async function init() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid during initialization');
      return;
    }

    // Check if the bot is running
    const result = await chrome.storage.local.get(['isRunning']);
    isRunning = result.isRunning || false;

    console.log('Bot status:', isRunning ? 'Running' : 'Inactive');

    // Set up match selection tracking
    setupMatchTracking();

    // If the bot is running, we might want to do some initial setup
    if (isRunning) {
      // Any setup needed when the bot is running
    }

    // Set up listener for extension context invalidation
    chrome.runtime.onSuspend.addListener(() => {
      console.log('Extension is being suspended, cleaning up...');
      // Perform any cleanup needed
    });
  } catch (error) {
    console.error('Error initializing content script:', error);
  }
}

// Set up tracking for match selections
function setupMatchTracking() {
  // Use mutation observer to detect DOM changes
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target;
        if (target.classList.contains('price-button')) {
          if (target.classList.contains('selected')) {
            // A selection was made
            handleMatchSelection(target);
          } else {
            // A deselection might have occurred
            // Check if this was previously selected
            const matchId = target.getAttribute('data-market-id');
            if (matchId) {
              handleMatchDeselection(matchId, target);
            }
          }
        }
      }
    }
  });

  // Start observing the document with the configured parameters
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true
  });

  // Also check for existing selections on page load
  document.addEventListener('DOMContentLoaded', () => {
    checkExistingSelections();
  });

  // For pages that are already loaded
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    checkExistingSelections();
  }
}

// Check for existing selections on the page
function checkExistingSelections() {
  const selectedButtons = document.querySelectorAll('.price-button.selected');
  selectedButtons.forEach(button => {
    handleMatchSelection(button);
  });
}

// Handle a match selection
function handleMatchSelection(button) {
  try {
    // Find the match container
    const matchContainer = findMatchContainer(button);
    if (!matchContainer) return;

    // Extract match data
    const matchData = extractMatchData(matchContainer, button);
    if (!matchData) return;

    // Save the match data
    saveMatchData(matchData);

    console.log('Match selected:', matchData);
  } catch (error) {
    console.error('Error handling match selection:', error);
  }
}

// Find the match container element from a selected button
function findMatchContainer(button) {
  // Navigate up the DOM to find the match container
  let element = button;
  while (element && !element.classList.contains('flex-col') && !element.classList.contains('rounded-md')) {
    element = element.parentElement;
  }
  return element;
}

// Extract match data from the match container
function extractMatchData(matchContainer, selectedButton) {
  try {
    // Extract match ID
    const matchId = selectedButton.getAttribute('data-market-id') || Date.now().toString();

    // Extract tournament/league info
    const tournamentElement = matchContainer.querySelector('a.text-info');
    const tournament = tournamentElement ? tournamentElement.textContent.trim() : 'Unknown Tournament';

    // Extract time info
    const timeElement = matchContainer.querySelector('.countdown-badge span');
    const timeInfo = timeElement ? timeElement.textContent.trim() : '';

    // Determine if match is live
    // Check for live indicators - typically matches with "LIVE" text or specific classes
    const liveIndicator = matchContainer.querySelector('.live-indicator, .live-badge, .live-text');
    const isLive = liveIndicator !== null || (timeInfo && timeInfo.toLowerCase().includes('live'));

    // Extract teams/players
    const teamsContainer = matchContainer.querySelector('[data-testid="team-vs-team"]');
    let team1 = 'Team 1', team2 = 'Team 2';

    if (teamsContainer) {
      const teamElements = teamsContainer.querySelectorAll('.flex-shrink.truncate');
      if (teamElements.length >= 2) {
        team1 = teamElements[0].textContent.trim() || 'Team 1';
        team2 = teamElements[1].textContent.trim() || 'Team 2';
      }
    }

    // Fallback for team names if they're empty
    if (!team1 || team1.length === 0) team1 = 'Team 1';
    if (!team2 || team2.length === 0) team2 = 'Team 2';

    // Extract selected team and odds
    let selectedTeam = 'Unknown Selection';
    const selectedTeamElement = selectedButton.querySelector('.displayTitle');
    if (selectedTeamElement) {
      selectedTeam = selectedTeamElement.textContent.trim() || 'Unknown Selection';
    }

    let odds = '1.0';
    const oddsElement = selectedButton.querySelector('[data-testid="price-button-odds"]');
    if (oddsElement) {
      odds = oddsElement.textContent.trim() || '1.0';
    }

    // Find the other team's button, name and odds
    let otherTeamOdds = '1.0';
    let otherTeamName = '';

    // First try to determine opponent based on team names
    if (selectedTeam === team1) {
      otherTeamName = team2;
    } else if (selectedTeam === team2) {
      otherTeamName = team1;
    } else {
      // If selected team doesn't match either team name, try to find from buttons
      const allButtons = matchContainer.querySelectorAll('.price-button');
      for (const button of allButtons) {
        if (button !== selectedButton) {
          const otherOddsElement = button.querySelector('[data-testid="price-button-odds"]');
          const otherTeamElement = button.querySelector('.displayTitle');

          if (otherOddsElement) {
            otherTeamOdds = otherOddsElement.textContent.trim() || '1.0';
          }

          if (otherTeamElement) {
            otherTeamName = otherTeamElement.textContent.trim() || 'Unknown Opponent';
          }

          if (otherTeamOdds && otherTeamName) {
            break;
          }
        }
      }
    }

    // Ensure we have an opponent name
    if (!otherTeamName || otherTeamName.length === 0) {
      if (selectedTeam === team1) {
        otherTeamName = team2;
      } else if (selectedTeam === team2) {
        otherTeamName = team1;
      } else {
        otherTeamName = 'Unknown Opponent';
      }
    }

    // Determine if selected team is favorite
    let isFavorite = false;
    if (odds && otherTeamOdds) {
      const selectedOddsValue = parseFloat(odds);
      const otherOddsValue = parseFloat(otherTeamOdds);

      // Lower odds means higher probability of winning (favorite)
      isFavorite = selectedOddsValue < otherOddsValue;
    }

    // Create match data object
    return {
      matchId,
      tournament,
      timeInfo,
      team1,
      team2,
      selectedTeam,
      opponentTeam: otherTeamName,
      odds,
      otherTeamOdds,
      isFavorite,
      isLive,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error extracting match data:', error);
    return null;
  }
}

// Save match data to storage
async function saveMatchData(matchData) {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime) {
      console.log('Extension context invalidated, reloading page to restore functionality');
      // Optionally reload the page to restore functionality
      // window.location.reload();
      return;
    }

    // Get current matches from storage
    const result = await chrome.storage.local.get(['selectedMatches']);
    let matches = result.selectedMatches || [];

    // Check if this match is already saved
    const existingIndex = matches.findIndex(m => m.matchId === matchData.matchId);

    if (existingIndex >= 0) {
      // Update existing match
      matches[existingIndex] = matchData;
    } else {
      // Add new match
      matches.push(matchData);
    }

    // Update local variable
    selectedMatches = matches;

    // Save back to storage
    await chrome.storage.local.set({ selectedMatches: matches });

    // Notify background script about the update - with error handling
    try {
      chrome.runtime.sendMessage({
        action: 'matchesUpdated',
        matches: matches
      }, () => {
        // Check for error
        if (chrome.runtime.lastError) {
          console.log('Background connection error:', chrome.runtime.lastError.message);
          // No need to throw, just log it
        }
      });
    } catch (msgError) {
      console.log('Error sending message to background:', msgError);
      // Continue execution, don't let message errors stop the function
    }
  } catch (error) {
    console.error('Error saving match data:', error);
  }
}

// Handle match deselection
async function handleMatchDeselection(matchId, button) {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime) {
      console.log('Extension context invalidated, cannot handle deselection');
      return;
    }

    // Check if this match is in our selected matches
    const result = await chrome.storage.local.get(['selectedMatches']);
    let matches = result.selectedMatches || [];

    // Find if this match exists in our storage
    const existingIndex = matches.findIndex(m => m.matchId === matchId);

    // If it exists and the button that was deselected is for the same team we had selected
    if (existingIndex >= 0) {
      const match = matches[existingIndex];
      const buttonTeam = button.querySelector('.displayTitle')?.textContent.trim();

      // If this is the same team we had selected, remove the match
      if (buttonTeam === match.selectedTeam) {
        console.log('Match deselected:', match);

        // Remove the match
        matches.splice(existingIndex, 1);

        // Update local variable
        selectedMatches = matches;

        // Save back to storage
        await chrome.storage.local.set({ selectedMatches: matches });

        // Notify background script about the update - with error handling
        try {
          chrome.runtime.sendMessage({
            action: 'matchesUpdated',
            matches: matches
          }, () => {
            // Check for error
            if (chrome.runtime.lastError) {
              console.log('Background connection error:', chrome.runtime.lastError.message);
            }
          });
        } catch (msgError) {
          console.log('Error sending message to background:', msgError);
        }
      }
    }
  } catch (error) {
    console.error('Error handling match deselection:', error);
  }
}

// Perform the bot action on the current page
function performBotAction() {
  console.log('Performing bot action at', new Date().toLocaleTimeString());

  // Check for new selections or changes
  checkExistingSelections();

  // This is where you'll implement your specific automation logic
  // For now, we'll just log a message to the console

  // Example: Find all buttons on the page and log them
  const buttons = document.querySelectorAll('button');
  console.log(`Found ${buttons.length} buttons on the page`);

  // Example: You could click a specific button
  // if (buttons.length > 0) {
  //   buttons[0].click();
  // }

  // Example: Fill a form field
  // const inputField = document.querySelector('input[type="text"]');
  // if (inputField) {
  //   inputField.value = 'Automated text';
  // }

  // Add your custom automation logic here
}

// Helper function to wait for an element to appear on the page
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkElement = () => {
      const element = document.querySelector(selector);

      if (element) {
        resolve(element);
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for element: ${selector}`));
        return;
      }

      setTimeout(checkElement, 100);
    };

    checkElement();
  });
}
