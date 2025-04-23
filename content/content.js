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


    if (message.action === 'performBotAction') {
      performBotAction();
      sendResponse({ status: 'Action performed' });
    }
  
    else if (message.action === 'botStatus') {
      isRunning = message.isRunning;
      console.log(`Bot status updated: ${isRunning ? 'Running' : 'Inactive'}`);
      sendResponse({ status: 'Status updated' });
    }
    else if (message.action === 'getSelectedMatches') {
      // First check if we have confirmed matches in storage
      chrome.storage.local.get(['isMatchesConfirmed', 'confirmedMatches'], (result) => {
        if (result.isMatchesConfirmed && result.confirmedMatches && result.confirmedMatches.length > 0) {
          // Return confirmed matches instead of current selections
          console.log('Returning confirmed matches:', result.confirmedMatches.length);
          sendResponse({ matches: result.confirmedMatches });
        } else {
          // Return current selections
          console.log('Returning selected matches:', selectedMatches.length);
          sendResponse({ matches: selectedMatches });
        }
      });
      return true; // Keep the message channel open for the async response
    }
    else if (message.action === 'setConfirmedMatches') {
      if (message.matches && message.matches.length > 0) {
        chrome.storage.local.set({
          confirmedMatches: message.matches,
          isMatchesConfirmed: true
        }, () => {
          console.log('Confirmed matches set in storage:', message.matches.length);
          sendResponse({ success: true });
        });
      } else {
        console.error('No matches to confirm');
        sendResponse({ success: false, error: 'No matches to confirm' });
      }
      return true; // Keep the message channel open for the async response
    }
    else if (message.action === 'reselectMatches') {
      // IMPORTANT: Always use the provided player selections from the background script
      // This ensures we select exactly what the background script requested
      console.log('Using provided matches for reselection (ignoring confirmed matches)');
      console.log('Received matchIds:', message.matchIds);
      console.log('Received playerSelections:', JSON.stringify(message.playerSelections));

      // Always use the provided selections, even if confirmed matches exist
      handleMatchReselection(message.matchIds, message.playerSelections)
        .then(result => {
          console.log('Reselection completed with provided matches:', result);
          // Log the current state of selectedMatches after reselection
          console.log('Current selectedMatches array after reselection:', JSON.stringify(selectedMatches));
          sendResponse({ status: 'started', result });
        })
        .catch(error => {
          console.error('Error in match re-selection with provided matches:', error);
          sendResponse({ error: error.message });
        });
      return true; // Keep the message channel open for the async response
    }
    // New message handlers for bet slip interaction
    else if (message.action === 'clearSelections') {
      clearSelections()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
    else if (message.action === 'waitForBetSlip') {
      waitForBetSlip()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
    else if (message.action === 'navigateToMultiBet') {
      navigateToMultiBet()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
    else if (message.action === 'enterStakeAmount') {
      enterStakeAmount(message.amount)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
    else if (message.action === 'clickPlaceBets') {
      clickPlaceBets()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
    // New message handler for starting the next bet combination
    else if (message.action === 'startNextBetCombination') {
      startNextBetCombination()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
    // Add new message handler for setting up bet combinations
    else if (message.action === 'setupBetCombinations') {
      setupBetCombinations(message.combinations, message.stakeAmount)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
    // Add message handler for showing toast notifications
    else if (message.action === 'showToast') {
      try {
        showToast(message.message, message.type || 'info', message.duration || 5000);
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error showing toast notification:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }
  } catch (error) {
    console.error('Error handling message in content script:', error);
    // Send an error response so the sender doesn't hang
    sendResponse({ error: error.message });
  }

  // Return true to indicate that we will send a response asynchronously
  return true;
});

// Create and show a toast notification
function showToast(message, type = 'info', duration = 5000) {
  try {
    console.log(`Toast notification (${type}): ${message}`);

    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('bot-extension-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'bot-extension-toast-container';
      toastContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      `;
      document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `bot-extension-toast ${type}`;
    toast.style.cssText = `
      min-width: 250px;
      margin-top: 10px;
      padding: 15px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      font-family: Arial, sans-serif;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      animation: fadeIn 0.3s ease-in-out;
      transition: all 0.3s ease;
      opacity: 0;
      transform: translateX(50px);
    `;

    // Set background color based on type
    switch (type) {
      case 'success':
        toast.style.backgroundColor = '#4CAF50';
        toast.style.color = 'white';
        break;
      case 'error':
        toast.style.backgroundColor = '#F44336';
        toast.style.color = 'white';
        break;
      case 'warning':
        toast.style.backgroundColor = '#FF9800';
        toast.style.color = 'white';
        break;
      default: // info
        toast.style.backgroundColor = '#2196F3';
        toast.style.color = 'white';
    }

    // Add message
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      margin-left: 10px;
      padding: 0 5px;
    `;
    closeBtn.onclick = () => {
      removeToast(toast);
    };
    toast.appendChild(closeBtn);

    // Add to container
    toastContainer.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 10);

    // Auto remove after duration
    setTimeout(() => {
      removeToast(toast);
    }, duration);

    return toast;
  } catch (error) {
    console.error('Error showing toast notification:', error);
  }
}

// Remove a toast notification
function removeToast(toast) {
  try {
    if (!toast) return;

    // Animate out
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';

    // Remove after animation
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  } catch (error) {
    console.error('Error removing toast notification:', error);
  }
}

// Initialize the content script
async function init() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid during initialization');
      return;
    }

    // Check if the bot is running
    const result = await chrome.storage.local.get(['isRunning', 'isMatchesConfirmed', 'confirmedMatches']);
    isRunning = result.isRunning || false;

    console.log('Bot status:', isRunning ? 'Running' : 'Inactive');

    // Explicitly ask the background script for the current bot status
    // This ensures we have the most up-to-date status
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getBotStatus' });
      if (response && response.status === 'success') {
        isRunning = response.isRunning;
        console.log('Updated bot status from background script:', isRunning ? 'Running' : 'Inactive');
      }
    } catch (err) {
      console.log('Non-critical error getting bot status from background script:', err);
    }

    // Set up match selection tracking
    setupMatchTracking();

    // Check if there are confirmed matches that need to be selected
    if (result.isMatchesConfirmed && result.confirmedMatches && result.confirmedMatches.length > 0) {
      console.log('Found confirmed matches, will attempt to select them on page load');

      // Wait for the page to be fully loaded
      if (document.readyState !== 'complete') {
        console.log('Waiting for page to fully load before selecting confirmed matches...');
        window.addEventListener('load', () => {
          // Wait a bit more for any dynamic content to load
          setTimeout(() => {
            autoSelectConfirmedMatches(result.confirmedMatches);
          }, 2000);
        });
      } else {
        // Page is already loaded, wait a bit for any dynamic content
        setTimeout(() => {
          autoSelectConfirmedMatches(result.confirmedMatches);
        }, 2000);
      }
    }

    // If the bot is running, we might want to do some initial setup
    if (isRunning) {
      // Any setup needed when the bot is running
    }
  } catch (error) {
    console.error('Error initializing content script:', error);
  }
}

// Function to automatically select confirmed matches
async function autoSelectConfirmedMatches(confirmedMatches) {
  try {
    console.log(`Attempting to auto-select ${confirmedMatches.length} confirmed matches`);

    // Set flag that we're doing auto-selection (not manual)
    document.documentElement.setAttribute('data-auto-betting-in-progress', 'true');

    // Get match IDs and selection info from confirmed matches
    const matchIds = confirmedMatches.map(match => match.matchId);
    const playerSelections = confirmedMatches.map(match => ({
      matchId: match.matchId,
      selectedTeam: match.selectedTeam
    }));

    // Use the existing match reselection function
    await handleMatchReselection(matchIds, playerSelections);

    // Clear the auto-selection flag
    document.documentElement.removeAttribute('data-auto-betting-in-progress');

    console.log('Confirmed matches auto-selection completed');
  } catch (error) {
    console.error('Error auto-selecting confirmed matches:', error);
    // Clear the flag even if there was an error
    document.documentElement.removeAttribute('data-auto-betting-in-progress');
  }
}

// Set up tracking for match selections
function setupMatchTracking() {
  // Flag to identify if auto-betting is in progress
  let autoBettingInProgress = false;

  // Listen for auto-betting messages
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'reselectMatches') {
      // Set flag that auto-betting is in progress
      document.documentElement.setAttribute('data-auto-betting-in-progress', 'true');
      autoBettingInProgress = true;
    } else if (message.action === 'clearSelections' && autoBettingInProgress) {
      // Maintain the flag during the auto-betting process
      document.documentElement.setAttribute('data-auto-betting-in-progress', 'true');
    }
  });

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

  // Reset auto-betting flag when page changes
  window.addEventListener('beforeunload', () => {
    document.documentElement.removeAttribute('data-auto-betting-in-progress');
  });
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

    // Check if this is an auto-betting selection
    const isAutoBetting = document.documentElement.hasAttribute('data-auto-betting-in-progress');

    // Always update the global array, even during auto-betting
    // This ensures selectedMatches is always up to date with the current UI state
    saveMatchData(matchData, true);

    console.log(`Match selected: ${matchData.selectedTeam} (Auto-betting: ${isAutoBetting})`);
  } catch (error) {
    console.error('Error handling match selection:', error);
  }
}

// Find the match container element from a selected button
function findMatchContainer(button) {
  // Navigate up the DOM to find the match container
  let element = button;

  // Define possible match container classes/attributes to check
  const containerSelectors = [
    // Generic containers
    'rounded-md',
    'flex-col',
    // More specific selectors - add any that match the site's structure
    'event-card',
    'match-row',
    'market-container',
    'match-container'
  ];

  // Navigate up at most 10 levels to find a suitable container
  let maxLevels = 10;
  let currentLevel = 0;

  while (element && element.parentElement && currentLevel < maxLevels) {
    // Check if element matches any of our container selectors
    const matchesSelector = containerSelectors.some(selector => {
      if (element.classList.contains(selector)) return true;
      if (element.getAttribute('data-testid') === selector) return true;
      return false;
    });

    if (matchesSelector) {
      console.log('Found match container:', element);
      return element;
    }

    // Move up the DOM tree
    element = element.parentElement;
    currentLevel++;
  }

  // If we couldn't find a specific container, return the closest meaningful container
  // Try to find the closest element with a data-testid attribute
  element = button;
  currentLevel = 0;

  while (element && element.parentElement && currentLevel < maxLevels) {
    if (element.getAttribute('data-testid')) {
      console.log('Found alternative match container with data-testid:', element);
      return element;
    }
    element = element.parentElement;
    currentLevel++;
  }

  // Last resort - go up 3 levels from the button as a fallback
  element = button;
  for (let i = 0; i < 3 && element && element.parentElement; i++) {
    element = element.parentElement;
  }

  console.log('Using fallback match container:', element);
  return element;
}

// Extract match data from the match container
function extractMatchData(matchContainer, selectedButton) {
  try {
    console.log('Extracting match data from container:', matchContainer);

    // Extract match ID
    const matchId = selectedButton.getAttribute('data-market-id') || Date.now().toString();
    console.log(`Match ID: ${matchId}`);

    // Extract tournament/league info - try multiple selectors
    const tournamentSelectors = [
      'a.text-info',
      '.tournament-name',
      '.league-name',
      '.event-name',
      '[data-testid="tournament-name"]'
    ];

    let tournament = 'Unknown Tournament';
    for (const selector of tournamentSelectors) {
      const element = matchContainer.querySelector(selector);
      if (element) {
        tournament = element.textContent.trim();
        if (tournament) break;
      }
    }
    console.log(`Tournament: ${tournament}`);

    // Extract time info - try multiple selectors
    const timeSelectors = [
      '.countdown-badge span',
      '.match-time',
      '.event-time',
      '.time-display',
      '[data-testid="match-time"]'
    ];

    let timeInfo = '';
    for (const selector of timeSelectors) {
      const element = matchContainer.querySelector(selector);
      if (element) {
        timeInfo = element.textContent.trim();
        if (timeInfo) break;
      }
    }
    console.log(`Time info: ${timeInfo}`);

    // Determine if match is live - check for multiple indicators
    const liveIndicatorSelectors = [
      '.live-indicator',
      '.live-badge',
      '.live-text',
      '[data-testid="live-indicator"]'
    ];

    let isLive = false;
    for (const selector of liveIndicatorSelectors) {
      if (matchContainer.querySelector(selector)) {
        isLive = true;
        break;
      }
    }

    // Also check if time text contains "live"
    if (timeInfo && timeInfo.toLowerCase().includes('live')) {
      isLive = true;
    }
    console.log(`Is live: ${isLive}`);

    // Extract teams/players - try multiple approaches
    let team1 = 'Team 1', team2 = 'Team 2';

    // Approach 1: Look for team-vs-team container
    const teamsContainerSelectors = [
      '[data-testid="team-vs-team"]',
      '.team-names',
      '.team-container',
      '.match-teams'
    ];

    let teamsFound = false;
    for (const selector of teamsContainerSelectors) {
      const container = matchContainer.querySelector(selector);
      if (container) {
        // Try to find team elements within the container
        const teamElements = container.querySelectorAll('.flex-shrink.truncate, .team-name, .player-name');
        if (teamElements.length >= 2) {
          team1 = teamElements[0].textContent.trim() || 'Team 1';
          team2 = teamElements[1].textContent.trim() || 'Team 2';
          teamsFound = true;
          break;
        }
      }
    }

    // Approach 2: If teams not found, look for home/away or player labels
    if (!teamsFound) {
      const homeSelector = matchContainer.querySelector('.home-team, [data-testid="home-team"]');
      const awaySelector = matchContainer.querySelector('.away-team, [data-testid="away-team"]');

      if (homeSelector && awaySelector) {
        team1 = homeSelector.textContent.trim();
        team2 = awaySelector.textContent.trim();
        teamsFound = true;
      }
    }

    // Approach 3: Last resort - get all text nodes in match container and look for patterns
    if (!teamsFound) {
      // Get all text nodes within the container
      const textNodes = [];
      const walker = document.createTreeWalker(
        matchContainer,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while (node = walker.nextNode()) {
        const text = node.nodeValue.trim();
        if (text.length > 2) { // Ignore very short text
          textNodes.push(text);
        }
      }

      // Find the two most prominent text nodes (they're likely team names)
      if (textNodes.length >= 2) {
        // Sort by length descending (team names are usually longer)
        textNodes.sort((a, b) => b.length - a.length);
        team1 = textNodes[0];
        team2 = textNodes[1];
      }
    }

    // Ensure team names are not empty
    if (!team1 || team1.length === 0) team1 = 'Team 1';
    if (!team2 || team2.length === 0) team2 = 'Team 2';

    console.log(`Teams: ${team1} vs ${team2}`);

    // Extract selected team and odds
    let selectedTeam = 'Unknown Selection';

    // Try multiple selectors for team name
    const teamNameSelectors = [
      '.displayTitle',
      '.selection-name',
      '.team-selection',
      '[data-testid="selection-name"]'
    ];

    for (const selector of teamNameSelectors) {
      const element = selectedButton.querySelector(selector);
      if (element) {
        selectedTeam = element.textContent.trim();
        if (selectedTeam) break;
      }
    }

    // If no specific element found, use the button text itself
    if (selectedTeam === 'Unknown Selection') {
      selectedTeam = selectedButton.textContent.trim();
    }

    // Clean up common selection text formatting
    selectedTeam = selectedTeam.replace(/(\d+\.\d+)|\+|\-|\s*win\s*|\s*to win\s*/gi, '').trim();

    console.log(`Selected team: ${selectedTeam}`);

    // Extract odds
    let odds = '1.0';
    const oddsSelectors = [
      '[data-testid="price-button-odds"]',
      '.odds-value',
      '.selection-odds',
      '.price'
    ];

    for (const selector of oddsSelectors) {
      const element = selectedButton.querySelector(selector);
      if (element) {
        odds = element.textContent.trim();
        if (odds) break;
      }
    }

    // If still no odds, try to extract from button text using regex
    if (odds === '1.0') {
      const oddsMatch = selectedButton.textContent.match(/(\d+\.\d+)/);
      if (oddsMatch) {
        odds = oddsMatch[1];
      }
    }

    console.log(`Selected odds: ${odds}`);

    // Find the other team's button, name and odds
    let otherTeamOdds = '1.0';
    let otherTeamName = '';
    let otherTeamButton = null;

    // First try to determine opponent based on team names
    if (selectedTeam === team1) {
      otherTeamName = team2;
    } else if (selectedTeam === team2) {
      otherTeamName = team1;
    }

    // Find all price buttons in the match container
    const allButtons = matchContainer.querySelectorAll('.price-button, .selection-button, [data-testid="price-button"], button[data-market-id]');
    console.log(`Found ${allButtons.length} price buttons in match container`);

    // Look for the other team's button
    for (const button of allButtons) {
      // Skip the selected button
      if (button === selectedButton) continue;

      // Check if this button has the same match ID
      const buttonMatchId = button.getAttribute('data-market-id');
      if (buttonMatchId && buttonMatchId !== matchId) {
        // Skip buttons from other matches
        continue;
      }

      // Try to get the team name using the same selectors
      let buttonTeamName = '';
      for (const selector of teamNameSelectors) {
        const buttonNameElement = button.querySelector(selector);
        if (buttonNameElement) {
          const buttonName = buttonNameElement.textContent.trim();
          // Clean up common selection text formatting
          buttonTeamName = buttonName.replace(/(\d+\.\d+)|\+|\-|\s*win\s*|\s*to win\s*/gi, '').trim();
          if (buttonTeamName) break;
        }
      }

      // If no specific element found, use the button text itself
      if (!buttonTeamName) {
        buttonTeamName = button.textContent.trim();
        buttonTeamName = buttonTeamName.replace(/(\d+\.\d+)|\+|\-|\s*win\s*|\s*to win\s*/gi, '').trim();
      }

      // Check if this is the other team
      if (buttonTeamName && buttonTeamName !== selectedTeam) {
        // If we already have a name from team1/team2 matching, verify it matches
        if (otherTeamName && buttonTeamName !== otherTeamName) {
          console.log(`Button team name "${buttonTeamName}" doesn't match expected opponent "${otherTeamName}", checking next button`);
          continue;
        }

        otherTeamName = buttonTeamName;
        otherTeamButton = button;

        // Get odds using the same selectors
        for (const oddsSelector of oddsSelectors) {
          const buttonOddsElement = button.querySelector(oddsSelector);
          if (buttonOddsElement) {
            otherTeamOdds = buttonOddsElement.textContent.trim();
            console.log(`Found opponent odds ${otherTeamOdds} using selector ${oddsSelector}`);
            if (otherTeamOdds) break;
          }
        }

        // If still no odds, try to extract from button text using regex
        if (otherTeamOdds === '1.0') {
          const oddsMatch = button.textContent.match(/(\d+\.\d+)/);
          if (oddsMatch) {
            otherTeamOdds = oddsMatch[1];
            console.log(`Found opponent odds ${otherTeamOdds} using regex`);
          }
        }

        // If we found a button with a name and odds, we're done
        if (otherTeamOdds !== '1.0') {
          console.log(`Successfully found opponent button with name "${otherTeamName}" and odds ${otherTeamOdds}`);
          break;
        }
      }
    }

    // If we still don't have odds but have a button, try one more approach
    if (otherTeamButton && otherTeamOdds === '1.0') {
      // Try to find any element with a number that looks like odds
      const allElements = otherTeamButton.querySelectorAll('*');
      for (const element of allElements) {
        const text = element.textContent.trim();
        const oddsMatch = text.match(/^\s*(\d+\.\d+)\s*$/);
        if (oddsMatch) {
          otherTeamOdds = oddsMatch[1];
          console.log(`Found opponent odds ${otherTeamOdds} from element text`);
          break;
        }
      }
    }

    console.log(`Opponent team: ${otherTeamName}, odds: ${otherTeamOdds}`);

    // If we still couldn't find the other team's odds, try more approaches
    if (otherTeamOdds === '1.0' && otherTeamName) {
      console.log(`Still couldn't find odds for ${otherTeamName}, trying alternative approaches`);

      // Approach 1: Try to find any element containing the team name
      const allElements = matchContainer.querySelectorAll('*');
      for (const element of allElements) {
        const text = element.textContent.trim();

        // Check if this element contains the other team name
        if (text.includes(otherTeamName)) {
          // Look for a number that could be odds
          const oddsMatch = text.match(/(\d+\.\d+)/);
          if (oddsMatch) {
            otherTeamOdds = oddsMatch[1];
            console.log(`Found opponent odds ${otherTeamOdds} from element containing team name`);
            break;
          }

          // Also check siblings and parent for odds
          const siblings = element.parentElement?.children || [];
          for (const sibling of siblings) {
            if (sibling !== element) {
              const siblingText = sibling.textContent.trim();
              const siblingOddsMatch = siblingText.match(/^\s*(\d+\.\d+)\s*$/);
              if (siblingOddsMatch) {
                otherTeamOdds = siblingOddsMatch[1];
                console.log(`Found opponent odds ${otherTeamOdds} from sibling element`);
                break;
              }
            }
          }

          if (otherTeamOdds !== '1.0') break;
        }
      }

      // Approach 2: Look for elements that might be odds displays
      if (otherTeamOdds === '1.0') {
        console.log('Trying to find odds displays in the match container');

        // Common classes for odds displays
        const oddsDisplaySelectors = [
          '.odds-display',
          '.price-display',
          '.selection-price',
          '[data-testid^="odds-"]',
          '.price-value'
        ];

        for (const selector of oddsDisplaySelectors) {
          const oddsElements = matchContainer.querySelectorAll(selector);
          if (oddsElements.length >= 2) {
            // We found at least two odds elements, one should be for our opponent
            for (const oddsElement of oddsElements) {
              const oddsText = oddsElement.textContent.trim();
              const oddsMatch = oddsText.match(/^\s*(\d+\.\d+)\s*$/);

              if (oddsMatch) {
                const foundOdds = oddsMatch[1];
                // If this odds value is different from our selected odds, it's likely the opponent's
                if (foundOdds !== odds) {
                  otherTeamOdds = foundOdds;
                  console.log(`Found opponent odds ${otherTeamOdds} from odds display element`);
                  break;
                }
              }
            }
          }

          if (otherTeamOdds !== '1.0') break;
        }
      }

      // Approach 3: Last resort - scan all text nodes for numbers that look like odds
      if (otherTeamOdds === '1.0') {
        console.log('Using last resort approach - scanning all text nodes for odds');

        // Get all text nodes
        const textNodes = [];
        const walker = document.createTreeWalker(
          matchContainer,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        let node;
        while (node = walker.nextNode()) {
          const text = node.nodeValue.trim();
          if (text.length > 0) {
            textNodes.push({ node, text });
          }
        }

        // Look for text nodes that contain just a number (likely odds)
        const oddsNodes = textNodes.filter(item => {
          return /^\s*(\d+\.\d+)\s*$/.test(item.text);
        });

        if (oddsNodes.length >= 2) {
          // Find the odds that's different from our selected odds
          for (const item of oddsNodes) {
            const match = item.text.match(/^\s*(\d+\.\d+)\s*$/);
            if (match && match[1] !== odds) {
              otherTeamOdds = match[1];
              console.log(`Found opponent odds ${otherTeamOdds} from text node scan`);
              break;
            }
          }
        }
      }
    }

    // Ensure odds are valid numbers
    let selectedOddsValue = parseFloat(odds);
    let otherOddsValue = parseFloat(otherTeamOdds);

    // Handle invalid odds values
    if (isNaN(selectedOddsValue)) {
      console.warn(`Invalid selected odds value: ${odds}, using default 1.5`);
      selectedOddsValue = 1.5;
      odds = '1.5';
    }

    if (isNaN(otherOddsValue)) {
      console.warn(`Invalid opponent odds value: ${otherTeamOdds}, using default 2.5`);
      otherOddsValue = 2.5;
      otherTeamOdds = '2.5';
    }

    // Determine if this selection is a favorite based on odds
    // Lower odds = favorite, higher odds = underdog
    const isFavorite = selectedOddsValue < otherOddsValue;

    console.log(`Is favorite: ${isFavorite}`);

    const matchData = {
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

    console.log('Extracted match data:', matchData);
    return matchData;
  } catch (error) {
    console.error('Error extracting match data:', error);
    // Return a minimal match data object as fallback
    return {
      matchId: selectedButton.getAttribute('data-market-id') || Date.now().toString(),
      tournament: 'Unknown Tournament',
      timeInfo: '',
      team1: 'Team 1',
      team2: 'Team 2',
      selectedTeam: 'Unknown Selection',
      opponentTeam: 'Unknown Opponent',
      odds: '1.0',
      otherTeamOdds: '1.0',
      isFavorite: false,
      isLive: false,
      timestamp: Date.now()
    };
  }
}

// Save match data to the list of selected matches
async function saveMatchData(matchData, updateGlobalArray = true) {
  try {
    // Check if we should update the global selectedMatches array
    if (updateGlobalArray) {
      // Add or update the match data in the global array
      const existingIndex = selectedMatches.findIndex(match =>
        match.matchId === matchData.matchId &&
        match.selectedTeam === matchData.selectedTeam
      );

      if (existingIndex >= 0) {
        // Update existing match data
        selectedMatches[existingIndex] = matchData;
      } else {
        // Add new match data
        selectedMatches.push(matchData);
      }
    }

    // Send the updated matches to the background script
    // Always include the current selections in the global array
    chrome.runtime.sendMessage({
      action: 'matchesUpdated',
      matches: selectedMatches
    });

    // Also save to storage
    await chrome.storage.local.set({ selectedMatches });
    console.log('Match data saved to storage and global array');
  } catch (error) {
    console.error('Error saving match data:', error);
  }
}

// Handle match deselection
async function handleMatchDeselection(matchId, button) {
  try {
    // Check if matches are confirmed from storage
    const isConfirmed = await chrome.storage.local.get(['isMatchesConfirmed', 'confirmedMatches']);

    // If matches are confirmed, don't allow deselection to affect our stored matches
    if (isConfirmed.isMatchesConfirmed && isConfirmed.confirmedMatches && isConfirmed.confirmedMatches.length > 0) {
      console.log(`Match ${matchId} deselected, but matches are confirmed so ignoring deselection`);
      // Don't update anything - the confirmed matches are locked
      return;
    }

    // If matches are not confirmed, proceed with normal deselection
    // Find the match with this ID and button
    const index = selectedMatches.findIndex(match => match.matchId === matchId);

    if (index >= 0) {
      // We don't remove this match from the global array - only update the background script
      // Create a copy without the deselected match
      const updatedMatches = [...selectedMatches];
      updatedMatches.splice(index, 1);

      // Send the updated matches to the background script
      chrome.runtime.sendMessage({
        action: 'matchesUpdated',
        matches: updatedMatches
      });

      // DON'T update the global selectedMatches - we keep them for auto-betting reference
      // Only clear selectedMatches when explicitly asked with clearSelections function

      console.log(`Match ${matchId} deselected (kept in memory for auto-betting)`);
    }
  } catch (error) {
    console.error('Error handling match deselection:', error);
  }
}

// Example of how to perform a bot action
function performBotAction() {
  // Check storage directly to ensure we have the latest status
  chrome.storage.local.get(['isRunning'], function(result) {
    // Update our local variable
    isRunning = result.isRunning || false;

    if (!isRunning) {
      console.log('Bot is not running (checked storage)');
      return;
    }

    console.log('Bot is running, performing action...');

    // Instead of auto-selecting matches, we'll just monitor for price changes
    // and other relevant information from the page

    // Check for any price changes on the page
    const priceButtons = document.querySelectorAll('.price-button');
    priceButtons.forEach(button => {
      // You could add code here to monitor for price changes
      // For example, store the current odds and check if they change
    });

    // Optional: Gather stats or other information from the page
    const matchContainers = document.querySelectorAll('.flex-col.rounded-md');

    // Note: We've removed automatic selection of matches
    // This was causing unwanted behavior when the bot was running
  });
}

// Helper function to wait for an element to be present in the DOM
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = 3;

    const checkElement = () => {
      // Try to find the element with querySelector
      let element;

      // If selector contains multiple selectors (comma-separated), try each one
      if (selector.includes(',')) {
        const selectors = selector.split(',').map(s => s.trim());
        for (const singleSelector of selectors) {
          // Special handling for :contains pseudo-selector
          if (singleSelector.includes(':contains')) {
            const match = singleSelector.match(/button:contains\("(.+)"\)/);
            if (match && match[1]) {
              const buttonText = match[1];
              const buttons = document.querySelectorAll('button');
              for (const button of buttons) {
                if (button.textContent.includes(buttonText)) {
                  element = button;
                  console.log(`Found button containing text: "${buttonText}"`);
                  break;
                }
              }
            }
          } else {
            element = document.querySelector(singleSelector);
          }

          if (element) {
            console.log(`Found element with selector: ${singleSelector}`);
            break;
          }
        }
      } else if (selector.includes(':contains')) {
        // Handle :contains for a single selector
        const match = selector.match(/button:contains\("(.+)"\)/);
        if (match && match[1]) {
          const buttonText = match[1];
          const buttons = document.querySelectorAll('button');
          for (const button of buttons) {
            if (button.textContent.includes(buttonText)) {
              element = button;
              console.log(`Found button containing text: "${buttonText}"`);
              break;
            }
          }
        }
      } else {
        element = document.querySelector(selector);
      }

      if (element) {
        resolve(element);
        return;
      }

      const elapsedTime = Date.now() - startTime;

      if (elapsedTime > timeout) {
        // If we've exceeded maximum retries, reject with error
        if (retryCount >= maxRetries) {
          reject(new Error(`Timeout waiting for element: ${selector}`));
          return;
        }

        // Otherwise, try a different approach - scroll and retry
        retryCount++;
        console.log(`Retry ${retryCount}/${maxRetries} - scrolling and trying again`);

        // Scroll down to potentially load more content
        window.scrollBy(0, 500);

        // Retry with extended timeout
        setTimeout(checkElement, 1000);
        return;
      }

      // Check again after a short delay
      setTimeout(checkElement, 250);
    };

    // Start checking immediately
    checkElement();
  });
}

// Add a sleep function for consistent wait times
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle reselection of matches
async function handleMatchReselection(matchIds, playerSelections = []) {
  try {
    console.log(`Reselecting ${matchIds.length} matches with specific players`);
    console.log('Match IDs to reselect:', matchIds);
    console.log('Player selections:', JSON.stringify(playerSelections));

    // Initial wait before starting
    await sleep(500); // Reduced from 1000

    // Find the matches on the page
    const matchElements = await findMatchesByIds(matchIds);

    if (!matchElements || Object.keys(matchElements).length === 0) {
      throw new Error('No match elements found for the provided IDs');
    }

    console.log(`Found ${Object.keys(matchElements).length} match elements on the page`);
    console.log('Match elements found:', Object.keys(matchElements));

    // Wait for DOM to be ready after search
    await sleep(250); // Reduced from 500

    // Create a map of player selections by matchId for easy lookup
    const selectionMap = {};
    if (playerSelections && playerSelections.length > 0) {
      playerSelections.forEach(selection => {
        selectionMap[selection.matchId] = selection.selectedTeam;
      });
      console.log('Using provided player selections map:', selectionMap);

      // Log the current state of selectedMatches before reselection
      console.log('Current selectedMatches array before reselection:', JSON.stringify(selectedMatches));
    }

    // Select the specified player for each match with a delay between selections
    let successCount = 0;
    for (const matchId of matchIds) {
      const matchElement = matchElements[matchId];
      if (matchElement) {
        // Wait between each match selection to avoid overwhelming the UI
        await sleep(400); // Reduced from 750

        // If we have a specific selection for this match, use it
        // otherwise fall back to selecting the opposite player
        const targetTeam = selectionMap[matchId];

        console.log(`Processing match ${matchId}:`);
        console.log(`- Target team to select: ${targetTeam || 'No specific team (will select opposite)'}`);

        if (targetTeam) {
          console.log(`- Selecting specific player: ${targetTeam}`);
          const success = await selectSpecificPlayer(matchElement, matchId, targetTeam);
          console.log(`- Selection ${success ? 'successful' : 'failed'}`);
          if (success) successCount++;
        } else {
          console.log(`- Selecting opposite player`);
          const success = await selectOppositePlayer(matchElement, matchId);
          console.log(`- Selection ${success ? 'successful' : 'failed'}`);
          if (success) successCount++;
        }
      } else {
        console.error(`Match element not found for match ID: ${matchId}`);
      }
    }

    // Wait after all selections are complete
    await sleep(1000); // Reduced from 2000

    // Verify that all requested selections were made correctly
    let allSelectionsCorrect = true;
    const selectionVerification = {};

    // Create a map of the current selections by matchId
    const currentSelectionsByMatchId = {};
    selectedMatches.forEach(match => {
      currentSelectionsByMatchId[match.matchId] = match.selectedTeam;
    });

    // Check each requested selection against what we actually have
    if (playerSelections && playerSelections.length > 0) {
      playerSelections.forEach(selection => {
        const matchId = selection.matchId;
        const requestedTeam = selection.selectedTeam;
        const actualTeam = currentSelectionsByMatchId[matchId];

        if (!actualTeam) {
          console.error(`VERIFICATION FAILED: Match ${matchId} was not selected at all`);
          selectionVerification[matchId] = {
            requested: requestedTeam,
            actual: null,
            correct: false
          };
          allSelectionsCorrect = false;
        } else if (actualTeam !== requestedTeam) {
          console.error(`VERIFICATION FAILED: Match ${matchId} has wrong selection. Requested: ${requestedTeam}, Actual: ${actualTeam}`);
          selectionVerification[matchId] = {
            requested: requestedTeam,
            actual: actualTeam,
            correct: false
          };
          allSelectionsCorrect = false;
        } else {
          console.log(`VERIFICATION PASSED: Match ${matchId} correctly selected ${requestedTeam}`);
          selectionVerification[matchId] = {
            requested: requestedTeam,
            actual: actualTeam,
            correct: true
          };
        }
      });
    }

    // Log the verification results
    console.log('\n=== SELECTION VERIFICATION RESULTS ===');
    console.log(`All selections correct: ${allSelectionsCorrect}`);
    console.log('Verification details:', selectionVerification);

    // Log the final state of selectedMatches after all selections
    console.log('\n=== FINAL STATE AFTER ALL SELECTIONS ===');
    console.log(`Final selectedMatches array has ${selectedMatches.length} matches:`);
    selectedMatches.forEach((match, index) => {
      console.log(`Match ${index + 1}: ${match.team1} vs ${match.team2}`);
      console.log(`  - Selected: ${match.selectedTeam} (Odds: ${match.odds})`);
      console.log(`  - Type: ${match.isFavorite ? 'FAVORITE' : 'UNDERDOG'}`);
      console.log(`  - Match ID: ${match.matchId}`);
    });
    console.log('=== END OF FINAL STATE ===\n');

    // Send one final update to the background script with the complete selectedMatches array
    chrome.runtime.sendMessage({
      action: 'matchesUpdated',
      matches: selectedMatches
    });

    return {
      success: true,
      matchCount: Object.keys(matchElements).length,
      successCount,
      allSelectionsCorrect,
      verificationDetails: selectionVerification
    };
  } catch (error) {
    console.error('Error reselecting matches:', error);
    throw error;
  }
}

// Select a specific player for a match by team name
async function selectSpecificPlayer(matchElement, matchId, targetTeam) {
  try {
    // Wait briefly before starting the selection process
    await sleep(250); // Reduced from 500

    console.log(`Selecting player "${targetTeam}" for match ${matchId}`);

    // Get all price buttons in this match container with data-market-id attribute
    const priceButtons = matchElement.querySelectorAll(`button[data-market-id="${matchId}"]`);

    console.log(`Found ${priceButtons.length} price buttons with data-market-id="${matchId}"`);

    // If no specific buttons found, try getting all price buttons in the container
    let allPriceButtons = priceButtons;
    if (priceButtons.length === 0) {
      allPriceButtons = matchElement.querySelectorAll('.price-button, [data-testid^="price-button-"]');
      console.log(`Found ${allPriceButtons.length} price buttons without specific data-market-id`);
    }

    // Find the button for the specific team
    let targetButton = null;
    let bestMatchScore = 0;
    let bestMatchButton = null;
    let allButtonNames = [];

    // Helper function to normalize text for comparison
    const normalizeText = (text) => {
      return text.toLowerCase().replace(/\s+/g, ' ').trim();
    };

    // Helper function to calculate string similarity (0-1 score)
    const calculateSimilarity = (str1, str2) => {
      const s1 = normalizeText(str1);
      const s2 = normalizeText(str2);

      // Exact match
      if (s1 === s2) return 1;

      // One string contains the other
      if (s1.includes(s2) || s2.includes(s1)) {
        return 0.9;
      }

      // Calculate word overlap
      const words1 = s1.split(' ');
      const words2 = s2.split(' ');
      let matchCount = 0;

      for (const word1 of words1) {
        if (word1.length < 3) continue; // Skip very short words
        for (const word2 of words2) {
          if (word2.length < 3) continue; // Skip very short words
          if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
            matchCount++;
            break;
          }
        }
      }

      return matchCount / Math.max(words1.length, words2.length);
    };

    for (const button of allPriceButtons) {
      // First look for displayTitle spans
      const displayTitleElement = button.querySelector('span.displayTitle');
      let buttonName = '';

      if (displayTitleElement) {
        buttonName = displayTitleElement.textContent.trim();
        allButtonNames.push(buttonName);

        const similarity = calculateSimilarity(buttonName, targetTeam);
        console.log(`Button name: "${buttonName}", similarity to target "${targetTeam}": ${similarity.toFixed(2)}`);

        if (similarity === 1) {
          // Exact match, use this button
          targetButton = button;
          console.log(`Found exact match button with displayTitle "${buttonName}"`);
          break;
        } else if (similarity > bestMatchScore) {
          bestMatchScore = similarity;
          bestMatchButton = button;
        }
      }

      // If no displayTitle, try other elements like price-button-name
      if (!targetButton) {
        const buttonNameElement = button.querySelector('[data-testid="price-button-name"], .price-button-name');
        if (buttonNameElement) {
          buttonName = buttonNameElement.textContent.trim();
          allButtonNames.push(buttonName);

          const similarity = calculateSimilarity(buttonName, targetTeam);
          console.log(`Button name: "${buttonName}", similarity to target "${targetTeam}": ${similarity.toFixed(2)}`);

          if (similarity === 1) {
            // Exact match, use this button
            targetButton = button;
            console.log(`Found exact match button with price-button-name "${buttonName}"`);
            break;
          } else if (similarity > bestMatchScore) {
            bestMatchScore = similarity;
            bestMatchButton = button;
          }
        }
      }

      // Also check the full button text as a fallback
      if (!targetButton) {
        buttonName = button.textContent.trim();
        // Clean up the button text to remove odds and other non-name text
        buttonName = buttonName.replace(/\d+\.\d+|\+|\-|\s*win\s*|\s*to win\s*/gi, '').trim();

        if (buttonName && !allButtonNames.includes(buttonName)) {
          allButtonNames.push(buttonName);

          const similarity = calculateSimilarity(buttonName, targetTeam);
          console.log(`Button text: "${buttonName}", similarity to target "${targetTeam}": ${similarity.toFixed(2)}`);

          if (similarity === 1) {
            // Exact match, use this button
            targetButton = button;
            console.log(`Found exact match in button text "${buttonName}"`);
            break;
          } else if (similarity > bestMatchScore) {
            bestMatchScore = similarity;
            bestMatchButton = button;
          }
        }
      }
    }

    // If no exact match found, use the best match if it's good enough
    if (!targetButton && bestMatchScore >= 0.7) {
      targetButton = bestMatchButton;
      console.log(`Using best match button with score ${bestMatchScore.toFixed(2)} for team ${targetTeam}`);
    }

    if (!targetButton) {
      console.error(`No button found for team ${targetTeam} in match ${matchId}`);
      console.error(`Available button names: ${allButtonNames.join(', ')}`);
      return false;
    }

    // Get the actual name from the selected button for verification
    let selectedButtonName = '';
    const displayTitleElement = targetButton.querySelector('span.displayTitle');
    if (displayTitleElement) {
      selectedButtonName = displayTitleElement.textContent.trim();
    } else {
      const buttonNameElement = targetButton.querySelector('[data-testid="price-button-name"], .price-button-name');
      if (buttonNameElement) {
        selectedButtonName = buttonNameElement.textContent.trim();
      } else {
        selectedButtonName = targetButton.textContent.trim();
        selectedButtonName = selectedButtonName.replace(/\d+\.\d+|\+|\-|\s*win\s*|\s*to win\s*/gi, '').trim();
      }
    }

    console.log(`Selected button with name "${selectedButtonName}" for target "${targetTeam}"`);

    // Log the odds for the selected team
    const oddsElement = targetButton.querySelector('[data-testid="price-button-odds"]');
    if (oddsElement) {
      const odds = oddsElement.textContent.trim();
      console.log(`Selected ${selectedButtonName} with odds: ${odds}`);
    }

    // Wait before clicking to ensure UI is stable
    await sleep(200); // Reduced from 400

    // Click the target button
    targetButton.click();
    console.log(`Clicked button for team ${selectedButtonName}`);

    // Wait for the UI to update after click
    await sleep(300); // Reduced from 500

    // Find the match container again after clicking to ensure we have the updated DOM
    const updatedMatchContainer = findMatchContainer(targetButton);
    if (updatedMatchContainer) {
      // Extract the updated match data to ensure we have the correct selection
      const matchData = extractMatchData(updatedMatchContainer, targetButton);
      if (matchData) {
        // IMPORTANT: Always use the target team name from the background script
        // This ensures consistency between what the background script expects and what we store
        console.log(`Original extracted selectedTeam: ${matchData.selectedTeam}, forcing to target: ${targetTeam}`);
        matchData.selectedTeam = targetTeam;

        // Also update other fields that depend on the selected team
        if (matchData.team1 === targetTeam || matchData.team1 === selectedButtonName) {
          matchData.opponentTeam = matchData.team2;
        } else {
          matchData.opponentTeam = matchData.team1;
        }

        // Update the global selectedMatches array with this selection
        // This ensures the background script gets the updated selection
        const existingIndex = selectedMatches.findIndex(match => match.matchId === matchId);
        if (existingIndex >= 0) {
          // Replace the existing match data
          selectedMatches[existingIndex] = matchData;
          console.log(`Replaced existing match data in selectedMatches for ${matchId}`);
        } else {
          // Add new match data
          selectedMatches.push(matchData);
          console.log(`Added new match data to selectedMatches for ${matchId}`);
        }

        // Send the updated matches to the background script
        chrome.runtime.sendMessage({
          action: 'matchesUpdated',
          matches: selectedMatches
        });

        console.log(`Updated selectedMatches array with new selection: ${matchData.selectedTeam}`);
        console.log(`Current selectedMatches array now has ${selectedMatches.length} matches`);
      } else {
        console.error(`Failed to extract match data after clicking for ${matchId}`);
      }
    } else {
      console.error(`Failed to find match container after clicking for ${matchId}`);
    }

    // Check for betslip count before clicking
    const betslipCounter = document.querySelector('[data-testid="betslip-counter"], .betslip-counter');
    const initialCount = betslipCounter ? parseInt(betslipCounter.textContent.trim()) || 0 : 0;

    // Adding the selection to QuickSlip/BetSlip
    // Try multiple selectors for the "Add to Betslip" button with a shorter timeout
    try {
      const quickSlipSelectors = [
        '[data-testid="qb-add-to-betslip"]',
      ];

      // Try to find and click the QuickSlip button - increased timeout to give more time for rendering
      const quickSlipAddButton = await waitForElement(quickSlipSelectors.join(', '), 1500);

      // Wait briefly before clicking the QuickSlip button
      await sleep(250);

      quickSlipAddButton.click();
      console.log(`Added ${targetTeam} for match ${matchId} to betslip via explicit button click`);

      // Wait for betslip to update
      await sleep(500);
    } catch (quickSlipError) {
      console.log(`QuickSlip button not found: ${quickSlipError.message}`);

      // Wait for possible automatic addition to betslip
      await sleep(1500);

      // Check if the betslip count has changed
      const newCount = betslipCounter ? parseInt(betslipCounter.textContent.trim()) || 0 : 0;
      if (newCount > initialCount) {
        console.log(`Selection appears to have been added automatically (betslip count changed from ${initialCount} to ${newCount})`);
      } else {
        console.log(`No change in betslip count (${initialCount}), but assuming selection was added`);

        // As a last resort, try to click any dialog buttons that might be present
        try {
          // Wait before looking for confirm buttons
          await sleep(500);

          // Use standard selectors without :contains
          const standardButtons = document.querySelectorAll('.confirm-button, [data-testid="confirm-button"]');

          // Also check for buttons with specific text
          const allButtons = document.querySelectorAll('button');
          const textButtons = Array.from(allButtons).filter(button => {
            const text = button.textContent.trim();
            return text === 'OK' || text === 'Confirm' || text.includes('Confirm') || text.includes('OK');
          });

          // Combine both sets of buttons
          const confirmButtons = [...Array.from(standardButtons), ...textButtons];

          if (confirmButtons.length > 0) {
            console.log(`Found ${confirmButtons.length} confirm buttons, clicking the first one`);
            await sleep(300);
            confirmButtons[0].click();
            await sleep(800);
          }
        } catch (dialogError) {
          console.log('Error handling potential dialog:', dialogError);
        }
      }
    }

    // Final wait to ensure all UI updates are complete
    await sleep(500);

    return true;
  } catch (error) {
    console.error(`Error selecting specific player for match ${matchId}:`, error);
    return false;
  }
}

// Select the opposite player for a match
async function selectOppositePlayer(matchElement, matchId) {
  try {
    // Wait briefly before starting the selection process
    await sleep(250); // Reduced from 500

    // Get all price buttons in this match container
    const priceButtons = matchElement.querySelectorAll('.price-button');

    // Find the button that's currently NOT selected
    let oppositeButton = null;

    for (const button of priceButtons) {
      if (!button.classList.contains('selected')) {
        oppositeButton = button;
        break;
      }
    }

    if (!oppositeButton) {
      console.error(`No opposite button found for match ${matchId}`);
      return false;
    }

    // Wait before clicking to ensure UI is stable
    await sleep(200); // Reduced from 400

    // Click the opposite button
    oppositeButton.click();
    console.log(`Clicked opposite button for match ${matchId}`);

    // Wait for the UI to update after click
    await sleep(300); // Reduced from 500

    // Find the match container again after clicking to ensure we have the updated DOM
    const updatedMatchContainer = findMatchContainer(oppositeButton);
    if (updatedMatchContainer) {
      // Extract the updated match data to ensure we have the correct selection
      const matchData = extractMatchData(updatedMatchContainer, oppositeButton);
      if (matchData) {
        // Update the global selectedMatches array with this selection
        // This ensures the background script gets the updated selection
        const existingIndex = selectedMatches.findIndex(match => match.matchId === matchId);
        if (existingIndex >= 0) {
          // Replace the existing match data
          selectedMatches[existingIndex] = matchData;
          console.log(`Replaced existing match data in selectedMatches for ${matchId}`);
        } else {
          // Add new match data
          selectedMatches.push(matchData);
          console.log(`Added new match data to selectedMatches for ${matchId}`);
        }

        // Send the updated matches to the background script
        chrome.runtime.sendMessage({
          action: 'matchesUpdated',
          matches: selectedMatches
        });

        console.log(`Updated selectedMatches array with new selection: ${matchData.selectedTeam}`);
        console.log(`Current selectedMatches array now has ${selectedMatches.length} matches`);
      } else {
        console.error(`Failed to extract match data after clicking for ${matchId}`);
      }
    } else {
      console.error(`Failed to find match container after clicking for ${matchId}`);
    }

    // Check for betslip count before clicking
    const betslipCounter = document.querySelector('[data-testid="betslip-counter"], .betslip-counter');
    const initialCount = betslipCounter ? parseInt(betslipCounter.textContent.trim()) || 0 : 0;

    // Adding the selection to QuickSlip/BetSlip
    // Try multiple selectors for the "Add to Betslip" button with a shorter timeout
    try {
      const quickSlipSelectors = [
        'button.quickbet-add-betslip',
        '[data-testid="quickbet-add-betslip"]',
        '.add-to-betslip',
        'button:contains("Add to Betslip")',
        'button:contains("Add Selection")',
        '.add-selection-button'
      ];

      // Try to find and click the QuickSlip button - increased timeout to give more time for rendering
      const quickSlipAddButton = await waitForElement(quickSlipSelectors.join(', '), 1500);

      // Wait briefly before clicking the QuickSlip button
      await sleep(250);

      quickSlipAddButton.click();
      console.log(`Added opposite player for match ${matchId} to betslip via explicit button click`);

      // Wait for betslip to update
      await sleep(500);
    } catch (quickSlipError) {
      console.log(`QuickSlip button not found: ${quickSlipError.message}`);

      // Wait for possible automatic addition to betslip
      await sleep(1500);

      // Check if the betslip count has changed
      const newCount = betslipCounter ? parseInt(betslipCounter.textContent.trim()) || 0 : 0;
      if (newCount > initialCount) {
        console.log(`Selection appears to have been added automatically (betslip count changed from ${initialCount} to ${newCount})`);
      } else {
        console.log(`No change in betslip count (${initialCount}), but assuming selection was added`);

        // As a last resort, try to click any dialog buttons that might be present
        try {
          // Wait before looking for confirm buttons
          await sleep(500);

          // Use standard selectors without :contains
          const standardButtons = document.querySelectorAll('.confirm-button, [data-testid="confirm-button"]');

          // Also check for buttons with specific text
          const allButtons = document.querySelectorAll('button');
          const textButtons = Array.from(allButtons).filter(button => {
            const text = button.textContent.trim();
            return text === 'OK' || text === 'Confirm' || text.includes('Confirm') || text.includes('OK');
          });

          // Combine both sets of buttons
          const confirmButtons = [...Array.from(standardButtons), ...textButtons];

          if (confirmButtons.length > 0) {
            console.log(`Found ${confirmButtons.length} confirm buttons, clicking the first one`);
            await sleep(300);
            confirmButtons[0].click();
            await sleep(800);
          }
        } catch (dialogError) {
          console.log('Error handling potential dialog:', dialogError);
        }
      }
    }

    // Final wait to ensure all UI updates are complete
    await sleep(500);

    return true;
  } catch (error) {
    console.error(`Error selecting opposite player for match ${matchId}:`, error);
    return false;
  }
}

// Clear all selections from the page UI without affecting the stored data
async function clearSelections() {
  try {
    // Only clear the UI betslip - not our stored data in selectedMatches
    const isAutoBetting = document.documentElement.hasAttribute('data-auto-betting-in-progress');

    console.log(`Clearing betslip selections (Auto-betting: ${isAutoBetting})`);

    // Check if matches are confirmed from storage
    const result = await chrome.storage.local.get(['isMatchesConfirmed', 'confirmedMatches']);
    const isMatchesConfirmed = result.isMatchesConfirmed && result.confirmedMatches && result.confirmedMatches.length > 0;

    if (isMatchesConfirmed) {
      console.log('Matches are confirmed - will clear UI but keep confirmed matches in memory');
    }

    // Wait before starting the clear process
    await sleep(1000);

    // Try to open the bet slip first in case it's collapsed
    const betSlipToggle = document.querySelector('[data-testid="betslip-toggle"]');
    if (betSlipToggle) {
      betSlipToggle.click();
      await sleep(1500);
    }

    // Try to find the bet slip
    const betSlipContainer = document.querySelector('#betslip-container');
    if (!betSlipContainer) {
      console.log('Bet slip container not found - trying alternative selectors');

      // Try alternative selectors
      const alternativeSelectors = [
        '.betslip-container',
        '[data-testid="betslip"]',
        '#bet-slip',
        '.bet-slip-container'
      ];

      for (const selector of alternativeSelectors) {
        const container = document.querySelector(selector);
        if (container) {
          console.log(`Found bet slip with selector: ${selector}`);
          betSlipContainer = container;
          break;
        }
      }

      // If still not found, try a broader approach
      if (!betSlipContainer) {
        const allButtons = document.querySelectorAll('button');
        for (const button of allButtons) {
          if (button.textContent.includes('Remove All') ||
              button.textContent.includes('Clear All') ||
              button.getAttribute('data-testid') === 'remove-all') {
            console.log('Found clear all button directly');
            await sleep(500);
            button.click();
            await sleep(1500);

            // If matches are confirmed, we're done - no memory clearing needed
            if (isMatchesConfirmed) {
              console.log('UI cleared but keeping confirmed matches in memory');
              return;
            }

            // Otherwise continue to memory clearing below
            break;
          }
        }
      }

      // If we still can't find it, we'll continue with whatever we found
      if (!betSlipContainer) {
        console.log('Could not find bet slip container using any selector');
      }
    }

    // If we found the bet slip, process it
    if (betSlipContainer) {
      // First try to find a "Clear All" button
      const clearAllButton = betSlipContainer.querySelector('[data-testid="remove-all"], button:contains("Clear All"), button:contains("Remove All")');
      if (clearAllButton) {
        await sleep(500);
        clearAllButton.click();
        await sleep(1500);
        console.log('Cleared all selections at once using Clear All button');

        // If matches are confirmed, we're done - no memory clearing needed
        if (isMatchesConfirmed) {
          console.log('UI cleared but keeping confirmed matches in memory');
          return;
        }
      } else {
        // If no Clear All button, find individual remove buttons
        const removeButtons = betSlipContainer.querySelectorAll('[data-testid="remove-item"]');

        if (removeButtons.length === 0) {
          console.log('No selections to clear');
          return;
        }

        console.log(`Clearing ${removeButtons.length} selections one by one`);

        // Click each remove button with a small delay between clicks
        for (const button of removeButtons) {
          await sleep(500); // More time between each button click
          button.click();
          await sleep(800); // Wait for UI to update after each removal
        }
      }
    }

    // If matches are confirmed, don't clear memory even for manual actions
    if (isMatchesConfirmed) {
      console.log('UI cleared but keeping confirmed matches in memory');
      return;
    }

    // Important: If this is an auto-betting operation, we DON'T clear the selectedMatches
    // We only clear selectedMatches if this was a manual user action
    if (!isAutoBetting) {
      // User manually cleared, so update global array
      selectedMatches = [];

      // Update storage
      await chrome.storage.local.set({ selectedMatches: [] });

      console.log('All selections cleared from UI and memory (manual clear)');
    } else {
      console.log('All selections cleared from UI only (kept in memory for auto-betting)');
    }

    // Final wait to ensure betslip is fully cleared
    await sleep(1000);
  } catch (error) {
    console.error('Error clearing selections:', error);
    throw error;
  }
}

// Wait for the bet slip to be accessible
async function waitForBetSlip() {
  try {
    // Initial wait before trying to access betslip
    await sleep(500); // Reduced from 1000

    // Try to open the bet slip if it's collapsed
    const betSlipToggle = document.querySelector('[data-testid="betslip-toggle"]');
    if (betSlipToggle) {
      betSlipToggle.click();
      await sleep(750); // Reduced from 1500
    }

    // Wait for the bet slip container with increased timeout
    const betSlipContainer = await waitForElement('#betslip-container', 8000);

    // Wait for the betslip to fully load
    await sleep(500); // Reduced from 1000

    // Check if there are any selections
    const betSlipItems = betSlipContainer.querySelectorAll('[data-testid="betslip-single-item"], [data-testid="betslip-multi-item"]');
    if (betSlipItems.length === 0) {
      throw new Error('No items in bet slip');
    }

    return betSlipContainer;
  } catch (error) {
    console.error('Error waiting for bet slip:', error);
    throw error;
  }
}

// Navigate to the MultiBet section
async function navigateToMultiBet() {
  try {
    const betSlipContainer = await waitForBetSlip();

    // Wait to ensure betslip is fully loaded
    await sleep(500); // Reduced from 1000

    // Check if MultiBet section already exists
    const multiBetContainer = betSlipContainer.querySelector('[data-testid="betslip-multis-container"]');
    if (!multiBetContainer) {
      throw new Error('MultiBet section not found in bet slip');
    }

    // Make sure the MultiBet section is visible (it may be collapsed)
    const multiBetTitle = multiBetContainer.querySelector('[data-testid="betslip-multis-container-title"]');
    if (multiBetTitle && !multiBetTitle.parentElement.parentElement.querySelector('[data-testid="betslip-multi-item"]')) {
      // Wait before clicking to expand
      await sleep(250); // Reduced from 500

      // Click the title to expand the section
      multiBetTitle.click();

      // Wait for section to expand
      await sleep(750); // Reduced from 1500
    }

    return true;
  } catch (error) {
    console.error('Error navigating to MultiBet section:', error);
    throw error;
  }
}

// Enter the stake amount in the bet slip
async function enterStakeAmount(amount) {
  try {
    // Initial wait to ensure UI is ready
    await sleep(500); // Reduced from 1000

    // Find the MultiBet section
    const multiBetContainer = document.querySelector('[data-testid="betslip-multis-container"]');
    if (!multiBetContainer) {
      throw new Error('MultiBet section not found');
    }

    // Find the stake input field in the MultiBet section
    // Look for different possible input selectors in the MultiBet section
    const inputSelectors = [
      'input[data-testid="input-bet-value"]',
      'input.sc-crHmcD',
      'input[placeholder="0.00"]',
      'input[min="0"]'
    ];

    let stakeInput = null;

    // Try each selector
    for (const selector of inputSelectors) {
      // Look specifically in the main MultiBet container first (not in the alternative combinations section)
      const inputs = multiBetContainer.querySelectorAll(selector);
      for (const input of inputs) {
        // Make sure we're not finding inputs in the "Alternative Combinations" section
        const isInAltCombinations = input.closest('[data-testid="betslip-alternative-combinations-container"]');
        if (!isInAltCombinations && !input.readOnly) {
          stakeInput = input;
          break;
        }
      }

      if (stakeInput) break;
    }

    // If not found, try one more approach - the first editable input in the MultiBet section
    if (!stakeInput) {
      const inputs = multiBetContainer.querySelectorAll('input[data-testid="input-bet-value"]');
      for (const input of inputs) {
        // Skip read-only inputs
        if (!input.readOnly) {
          stakeInput = input;
          break;
        }
      }
    }

    if (!stakeInput) {
      throw new Error('Stake input field not found in MultiBet section');
    }

    // Clear any existing value
    stakeInput.value = '';

    // Focus the input
    stakeInput.focus();

    // Use both direct setting and simulated typing
    // First, set the value directly
    stakeInput.value = amount;

    // Then trigger input and change events to ensure the UI updates
    stakeInput.dispatchEvent(new Event('input', { bubbles: true }));
    stakeInput.dispatchEvent(new Event('change', { bubbles: true }));

    // If there's a numeric keypad visible, try using it to enter the amount
    const keypadContainer = document.querySelector('#betslip-mobile-keyboard-container');
    if (keypadContainer) {
      // Enter digits one by one
      for (const digit of amount.toString()) {
        if (digit === '.') {
          const decimalButton = keypadContainer.querySelector('[data-testid="qb-keypad-."]');
          if (decimalButton) decimalButton.click();
        } else {
          const digitButton = keypadContainer.querySelector(`[data-testid="qb-keypad-${digit}"]`);
          if (digitButton) digitButton.click();
        }
        await sleep(50); // Reduced from 100
      }

      // Click 'Done' if present
      const doneButton = keypadContainer.querySelector('[data-testid="qb-values-done"]');
      if (doneButton) doneButton.click();
    }

    // Wait a moment to ensure the amount is properly entered
    await sleep(500); // Reduced from 1000

    // Verify the value was entered
    if (stakeInput.value !== amount && stakeInput.value !== `$${amount}`) {
      console.warn(`Stake amount verification failed: expected ${amount}, got ${stakeInput.value}`);

      // Try one more time with a different approach
      console.log('Retrying stake amount entry with a different approach...');
      stakeInput.focus();
      stakeInput.select();
      stakeInput.value = amount;
      stakeInput.dispatchEvent(new Event('input', { bubbles: true }));
      stakeInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait again to ensure the value is updated
      await sleep(500); // Reduced from 1000

      // Check again
      if (stakeInput.value !== amount && stakeInput.value !== `$${amount}`) {
        console.warn(`Stake amount verification still failed after retry: expected ${amount}, got ${stakeInput.value}`);
      } else {
        console.log('Stake amount verification successful after retry');
      }
    }

    // Wait an additional 1 second for the estimated return to be calculated
    console.log('Waiting for estimated return to be calculated...');
    await sleep(500); // Reduced from 1000

    console.log(`Entered stake amount: ${amount}`);
    return true;
  } catch (error) {
    console.error('Error entering stake amount:', error);
    throw error;
  }
}

// Get the estimated return value from the bet slip
function getEstimatedReturn() {
  /*
  <span font-size="md" data-testid="betslip-multi-odds-value" class="sc-gsDKAQ mSqqB">@ 452698.71</span>
  */
  try {
    console.log('Checking estimated return value...');

    // Look for the estimated return element in the footer section
    const estimatedReturnSelectors = [
      '[data-testid="betslip-multi-odds-value"]',
    ];

    let estimatedReturnElement = null;

    // Try each selector
    for (const selector of estimatedReturnSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Make sure it's visible and contains a value
        if (element.offsetParent !== null && element.textContent.trim()) {
          estimatedReturnElement = element;
          console.log(`Found estimated return element with selector: ${selector}`);
          break;
        }
      }
      if (estimatedReturnElement) break;
    }

    // If not found with specific selectors, try a more general approach
    if (!estimatedReturnElement) {
      console.log('Trying alternative approach to find estimated return...');

      // Look for elements containing text like "Est. Return" or "Potential Return"
      const potentialElements = [];
      const textPatterns = ['est. return', 'estimated return', 'potential return', 'total return', 'potential payout'];

      // Get all visible text elements
      const allElements = document.querySelectorAll('div, span, p, label');

      for (const element of allElements) {
        if (element.offsetParent !== null) { // Element is visible
          const text = element.textContent.toLowerCase();

          // Check if this element contains any of our patterns
          for (const pattern of textPatterns) {
            if (text.includes(pattern)) {
              console.log(`Found element with text containing "${pattern}": ${text}`);

              // Check if this element itself contains the value
              const valueMatch = text.match(/[\$£€]?\s*[\d,]+\.?\d*/);
              if (valueMatch) {
                estimatedReturnElement = element;
                console.log(`Element contains value: ${valueMatch[0]}`);
                break;
              }

              // If not, add to potential elements to check siblings/children
              potentialElements.push(element);
            }
          }

          if (estimatedReturnElement) break;
        }
      }

      // If still not found, check siblings and children of potential elements
      if (!estimatedReturnElement && potentialElements.length > 0) {
        for (const element of potentialElements) {
          // Check siblings
          const siblings = element.parentElement?.children || [];
          for (const sibling of siblings) {
            if (sibling !== element) {
              const siblingText = sibling.textContent.trim();
              if (siblingText.match(/[\$£€]?\s*[\d,]+\.?\d*/)) {
                estimatedReturnElement = sibling;
                console.log(`Found value in sibling: ${siblingText}`);
                break;
              }
            }
          }

          // Check children
          if (!estimatedReturnElement) {
            const children = element.querySelectorAll('*');
            for (const child of children) {
              const childText = child.textContent.trim();
              if (childText.match(/[\$£€]?\s*[\d,]+\.?\d*/)) {
                estimatedReturnElement = child;
                console.log(`Found value in child: ${childText}`);
                break;
              }
            }
          }

          if (estimatedReturnElement) break;
        }
      }
    }

    if (!estimatedReturnElement) {
      console.log('Estimated return element not found after exhaustive search');
      return null;
    }

    // Extract the text content
    const returnText = estimatedReturnElement.textContent.trim();
    console.log(`Found estimated return text: ${returnText}`);

    // Try to extract just the number part using regex
    // Handle the new format with @ symbol (e.g., "@ 452698.71")
    const valueMatch = returnText.match(/@?\s*([\d,]+\.?\d*)/);
    let returnValue;

    if (valueMatch && valueMatch[1]) {
      // Use the captured group which should be just the number
      returnValue = parseFloat(valueMatch[1].replace(/,/g, ''));
      console.log(`Extracted value using regex: ${valueMatch[1]} -> ${returnValue}`);
    } else {
      // Fallback to the old method
      returnValue = parseFloat(returnText.replace(/[^0-9.]/g, ''));
      console.log(`Extracted value using fallback method: ${returnValue}`);
    }

    if (isNaN(returnValue)) {
      console.log('Could not parse estimated return value');
      return null;
    }

    console.log(`Final parsed estimated return value: $${returnValue}`);
    return returnValue;
  } catch (error) {
    console.error('Error getting estimated return:', error);
    return null;
  }
}

// Click the "Place Bets" button
async function clickPlaceBets() {
  try {
    console.log('Attempting to place bets...');

    // Wait for the UI to be fully ready
    await sleep(750);

    // Wait an additional 0.5 seconds after UI is ready before checking estimated return
    // This ensures the estimated return value has been updated after stake amount input
    console.log('Waiting 0.5 seconds for estimated return to update...');
    await sleep(500);

    // Check the estimated return value
    console.log('Now checking estimated return value...');
    const estimatedReturn = getEstimatedReturn();


    const ESTIMATED_RETURN_THRESHOLD = 250000;

    if (estimatedReturn !== null && estimatedReturn > ESTIMATED_RETURN_THRESHOLD) {
      console.log(`Skipping bet with high estimated return: $${estimatedReturn} (exceeds $${ESTIMATED_RETURN_THRESHOLD.toLocaleString()} limit)`);

      // Show toast notification for skipped bet
      showToast(
        `Skipping bet: Estimated return ${estimatedReturn.toLocaleString()} exceeds limit of ${ESTIMATED_RETURN_THRESHOLD.toLocaleString()}`,
        'warning',
        8000
      );

      clearBetSlip();

      // Notify that we're skipping this bet
      chrome.runtime.sendMessage({
        action: 'betSkipped',
        reason: 'high_return',
        estimatedReturn: estimatedReturn
      });


      return false;
    }

    // Array of possible Place Bets button selectors from most specific to most general
    const placeBetsButtonSelectors = [
      // Data attribute selectors (most specific)
      '[data-testid="betslip-place-bet"]',
      'button:contains("Place Bets")',
    ];

    let placeBetsButton = null;

    // Try each selector
    for (const selector of placeBetsButtonSelectors) {
      if (selector.includes(':contains')) {
        // Handle text-based selectors with a different approach
        const buttonText = selector.match(/:contains\("(.+?)"\)/)[1];
        const buttons = Array.from(document.querySelectorAll('button'));
        placeBetsButton = buttons.find(btn =>
          btn.textContent &&
          btn.textContent.trim().toLowerCase().includes(buttonText.toLowerCase())
        );
      } else {
        placeBetsButton = document.querySelector(selector);
      }

      if (placeBetsButton) {
        console.log(`Found Place Bets button with selector: ${selector}`);
        break;
      }
    }

    // If still not found, try looking for any button that has "Place" and "Bet" in its text
    if (!placeBetsButton) {
      const allButtons = Array.from(document.querySelectorAll('button'));
      placeBetsButton = allButtons.find(btn => {
        const text = (btn.textContent || '').toLowerCase();
        return (text.includes('place') && (text.includes('bet') || text.includes('wager')));
      });

      if (placeBetsButton) {
        console.log('Found Place Bets button using text content search');
      }
    }

    // Last resort: look for submit buttons within bet slip containers
    if (!placeBetsButton) {
      const betSlipContainers = document.querySelectorAll('.betslip, .bet-slip, [data-testid="betslip-container"]');
      for (const container of betSlipContainers) {
        const submitButton = container.querySelector('button[type="submit"], button.primary-button, button.submit-button');
        if (submitButton) {
          placeBetsButton = submitButton;
          console.log('Found potential Place Bets button (submit button in bet slip)');
          break;
        }
      }
    }

    if (!placeBetsButton) {
      throw new Error('Place Bets button not found on the page');
    }

    // Check if the button is disabled
    const isDisabled = placeBetsButton.disabled ||
                      placeBetsButton.getAttribute('disabled') !== null ||
                      placeBetsButton.classList.contains('disabled') ||
                      getComputedStyle(placeBetsButton).opacity < 0.5 ||
                      getComputedStyle(placeBetsButton).pointerEvents === 'none';

    if (isDisabled) {
      console.warn('Place Bets button is disabled, checking for issues...');

      // Check for any error messages in the bet slip
      const errorMessages = document.querySelectorAll(
        '[data-testid="betslip-error-message"], ' +
        '.error-message, .bet-error, .betting-error, ' +
        '.validation-error, .betslip-validation'
      );

      if (errorMessages.length > 0) {
        const errorTexts = Array.from(errorMessages).map(el => el.textContent).join(', ');
        throw new Error(`Cannot place bets due to errors: ${errorTexts}`);
      }

      // Check if minimum stake requirements are met
      const minStakeWarnings = document.querySelectorAll('.min-stake-warning, [data-testid="min-stake-warning"]');
      if (minStakeWarnings.length > 0) {
        throw new Error('Cannot place bets: Minimum stake requirement not met');
      }

      // Check if stake amount is missing
      const stakeInputs = document.querySelectorAll('input[data-testid="input-bet-value"], input.stake-input, input[placeholder*="stake"], input.betslip-stake');
      let hasValue = false;
      for (const input of stakeInputs) {
        const rawValue = input.value.replace(/[$£€,]/g, ''); // Remove currency symbols and commas
        if (rawValue && parseFloat(rawValue) > 0) {
          hasValue = true;
          break;
        }
      }

      if (!hasValue) {
        throw new Error('Cannot place bets: No stake amount entered');
      }

    }

    // Before clicking, ensure we're scrolled to the button for visibility
    placeBetsButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(500);

    // Click the button
    console.log('Clicking Place Bets button...');
    placeBetsButton.click();

    // Wait for potential confirmation dialog or success message
    await sleep(2000);

    // Check for confirmation dialog/overlay and handle it if present
    const confirmButtonSelectors = [
      'button[data-testid="betslip-confirm-place-bet"]',
      'button:contains("Confirm")',

    ];

    let confirmButtonFound = false;

    // Try standard selectors first
    for (const selector of confirmButtonSelectors) {
      let confirmButtons;

      if (selector.includes(':contains')) {
        const buttonText = selector.match(/:contains\("(.+?)"\)/)[1];
        const buttons = Array.from(document.querySelectorAll('button'));
        confirmButtons = buttons.filter(btn =>
          btn.textContent &&
          btn.textContent.trim().toLowerCase().includes(buttonText.toLowerCase()) &&
          btn.offsetParent !== null // Ensure button is visible
        );
      } else {
        confirmButtons = Array.from(document.querySelectorAll(selector)).filter(btn =>
          btn.offsetParent !== null // Ensure button is visible
        );
      }

      for (const confirmButton of confirmButtons) {
        console.log('Confirming bet placement...');
        confirmButton.click();
        confirmButtonFound = true;
        await sleep(1500);
        break;
      }

      if (confirmButtonFound) break;
    }


    chrome.runtime.sendMessage({
      action: 'betPlaced',
      success: true
    });

    // Look for and click the "Done" button to automatically deselect matches
    await clickDoneButton();
    clearBetSlip();

    console.log('Bet appears to be placed, but no confirmation receipt found');


    return true;
  } catch (error) {
    console.error('Error placing bets:', error);

    // Notify about the bet placement failure
    chrome.runtime.sendMessage({
      action: 'betPlaced',
      success: false,
      error: error.message
    });

    throw error;
  }
}

// Function to click the "Done" button after successful bet placement
async function clickDoneButton() {
  try {
    console.log('Looking for Done button to click...');
    await sleep(1000);

    // Array of possible selectors for the Done button
    const doneButtonSelectors = [
      'button[data-testid="betslip-place-bet-done"]',
      'button:contains("Done")'
    ];

    let doneButton = null;

    // Try each selector
    for (const selector of doneButtonSelectors) {
      if (selector.includes(':contains')) {
        // Handle text-based selectors
        const buttonText = selector.match(/:contains\("(.+?)"\)/)[1];
        const buttons = Array.from(document.querySelectorAll('button'));
        doneButton = buttons.find(btn =>
          btn.textContent &&
          btn.textContent.trim().toLowerCase().includes(buttonText.toLowerCase()) &&
          btn.offsetParent !== null // Ensure button is visible
        );
      } else {
        const foundButtons = Array.from(document.querySelectorAll(selector)).filter(btn =>
          btn.offsetParent !== null // Ensure button is visible
        );
        if (foundButtons.length > 0) {
          doneButton = foundButtons[0];
        }
      }

      if (doneButton) {
        console.log(`Found Done button with selector: ${selector}`);
        break;
      }
    }

    // If still not found, look in bet receipt or confirmation containers
    if (!doneButton) {
      const receiptContainers = document.querySelectorAll(
        '[data-testid="betslip-receipt"], [data-testid="bet-confirmation"], .bet-receipt, .bet-confirmation'
      );

      for (const container of receiptContainers) {
        if (container.offsetParent !== null) { // Check if visible
          const buttons = container.querySelectorAll('button');
          for (const button of buttons) {
            const text = button.textContent.toLowerCase();
            if (text.includes('done') || text.includes('close') || text.includes('ok') || text.includes('continue')) {
              doneButton = button;
              console.log('Found Done button in receipt container');
              break;
            }
          }
          if (doneButton) break;
        }
      }
    }

    // If we found the Done button, click it
    if (doneButton) {
      console.log('Clicking Done button to clear selections...');
      doneButton.click();
      await sleep(1500); // Wait for UI to update
      console.log('Done button clicked successfully');
      return true;
    } else {
      console.log('No Done button found, selections may need to be cleared manually');
      return false;
    }
  } catch (error) {
    console.error('Error clicking Done button:', error);
    return false;
  }
}


// Add a retry mechanism to the startNextBetCombination function
async function startNextBetCombination(retryCount = 0) {
  try {
    console.log('Starting next bet combination');

    // Check if we have any pending bet combinations to process
    const result = await chrome.storage.local.get(['pendingBetCombinations', 'currentBetIndex']);

    const pendingCombinations = result.pendingBetCombinations || [];
    const currentIndex = result.currentBetIndex || 0;

    if (currentIndex >= pendingCombinations.length) {
      console.log('No more bet combinations to process');
      // Notify that all combinations are complete
      chrome.runtime.sendMessage({
        action: 'allBetCombinationsComplete',
        success: true
      });
      return;
    }

    console.log(`Processing bet combination ${currentIndex + 1} of ${pendingCombinations.length}`);

    // First, clear any existing selections
    await clearSelections();

    // Get the current combination to process
    const currentCombination = pendingCombinations[currentIndex];

    // Check if we have match IDs and selections
    if (!currentCombination.matchIds || !currentCombination.playerSelections) {
      throw new Error('Invalid bet combination data');
    }

    // Reselect the matches for this combination
    await handleMatchReselection(
      currentCombination.matchIds,
      currentCombination.playerSelections
    );

    // Wait for the betslip to be ready
    await waitForBetSlip();

    // Navigate to multi-bet section
    await navigateToMultiBet();

    // Enter stake amount
    const stakeAmount = currentCombination.stakeAmount || '10.00';
    await enterStakeAmount(stakeAmount);

    // Increment the current bet index for the next combination
    await chrome.storage.local.set({
      currentBetIndex: currentIndex + 1
    });

    // Place the bets
    await clickPlaceBets();

    return true;
  } catch (error) {
    console.error(`Error starting bet combination (attempt ${retryCount + 1}):`, error);

    // Check if we should retry
    const maxRetries = 2;
    if (retryCount < maxRetries) {
      console.log(`Retrying (${retryCount + 1}/${maxRetries})...`);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try again with incremented retry count
      return startNextBetCombination(retryCount + 1);
    }

    // If we've exhausted retries, notify of the error and move to next combination
    chrome.runtime.sendMessage({
      action: 'betCombinationError',
      error: error.message
    });

    // Get current index and increment to skip this problematic combination
    const result = await chrome.storage.local.get(['currentBetIndex']);
    const currentIndex = result.currentBetIndex || 0;

    // Move to the next combination
    await chrome.storage.local.set({
      currentBetIndex: currentIndex + 1
    });

    // Start the next combination
    console.log('Moving to next combination after error');
    setTimeout(() => {
      startNextBetCombination().catch(error => {
        console.error('Error skipping to next combination:', error);
      });
    }, 2000);

    throw error;
  }
}

// Listen for the bet placed event in the clickPlaceBets function
// and automatically start the next combination
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'betPlaced' && message.success) {
    // Wait a moment before starting the next combination
    setTimeout(() => {
      startNextBetCombination().catch(error => {
        console.error('Error in auto-starting next bet combination:', error);
      });
    }, 2000);
  }
});

// Setup and start the bet combinations process
async function setupBetCombinations(combinations, defaultStakeAmount = '10.00') {
  try {
    console.log(`Setting up ${combinations.length} bet combinations`);

    // Format the combinations with necessary data
    const formattedCombinations = combinations.map(combo => {
      return {
        matchIds: combo.matchIds,
        playerSelections: combo.playerSelections,
        stakeAmount: combo.stakeAmount || defaultStakeAmount
      };
    });

    // Store the combinations and reset the index
    await chrome.storage.local.set({
      pendingBetCombinations: formattedCombinations,
      currentBetIndex: 0
    });

    console.log('Bet combinations stored, starting the process');

    // Clear any existing betslip selections
    await clearSelections();

    // Start the first combination
    await startNextBetCombination();

    return true;
  } catch (error) {
    console.error('Error setting up bet combinations:', error);
    throw error;
  }
}

// Find match elements by match IDs
async function findMatchesByIds(matchIds) {
  try {
    console.log(`Searching for ${matchIds.length} matches with IDs:`, matchIds);
    console.log('PRIORITY SEARCH: Using data-market-id attribute as primary identifier');

    // Wait briefly before starting the search
    await sleep(500);

    // Wait for the main content to load with a high timeout
    const mainContentSelectors = [
      '.main-content',
      '.event-list',
      '.market-group',
      '.flex-col.rounded-md',
      '.match-list',
      '.event-container',
      '#main-content'
    ];

    console.log('Waiting for main content with selectors:', mainContentSelectors.join(', '));
    const matchesContainer = await waitForElement(mainContentSelectors.join(', '), 30000);
    console.log('Found main content container:', matchesContainer);

    // Wait briefly after finding the main container
    await sleep(800);

    // Get all match containers - try multiple selectors to ensure we find matches
    const allMatchesSelectors = [
      '.flex-col.rounded-md',  // This matches the example DOM structure
      '.market-container',
      '.event-card',
      '.match-container',
      '[data-testid="team-vs-team"]',  // This is in the example DOM
      '.event-row',
      '.match-row',
      '.game-container'
    ];

    // Map to store found matches
    const matchesMap = {};

    // DIRECT METHOD: First try to find buttons with the exact match IDs directly
    console.log('DIRECT SEARCH: Looking for price buttons with exact data-market-id attributes');

    for (const matchId of matchIds) {
      // Look for buttons with this specific matchId
      const buttons = document.querySelectorAll(`button[data-market-id="${matchId}"], .price-button[data-market-id="${matchId}"]`);

      if (buttons.length > 0) {
        console.log(`Found ${buttons.length} buttons with data-market-id="${matchId}"`);

        // Get the closest match container (parent element)
        let matchContainer = null;

        // Find a parent that contains both buttons (if multiple buttons exist)
        if (buttons.length > 1) {
          const firstButton = buttons[0];
          let parent = firstButton.parentElement;

          // Go up the DOM tree to find a container that includes both buttons
          while (parent && !matchContainer) {
            // Check if this parent contains all buttons
            let containsAllButtons = true;
            for (const button of buttons) {
              if (!parent.contains(button)) {
                containsAllButtons = false;
                break;
              }
            }

            if (containsAllButtons) {
              matchContainer = parent;
              console.log(`Found match container for ${matchId} (contains all buttons)`);
              break;
            }

            parent = parent.parentElement;
          }
        }

        // If we couldn't find a common parent, use the first button's parent
        if (!matchContainer && buttons.length > 0) {
          // Look for parent with specific classes from the example
          let button = buttons[0];
          let parent = button.parentElement;

          while (parent) {
            if (parent.classList.contains('flex-col') &&
                parent.classList.contains('rounded-md') ||
                parent.querySelector('[data-testid="team-vs-team"]')) {
              matchContainer = parent;
              console.log(`Found match container for ${matchId} (by class structure)`);
              break;
            }

            // If we've gone too far up the tree, stop
            if (parent === document.body) break;
            parent = parent.parentElement;
          }

          // If still no match, use a closer parent
          if (!matchContainer) {
            // Try to find a parent up to 5 levels up
            button = buttons[0];
            parent = button.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
              if (parent.querySelector('[data-testid="team-vs-team"]') ||
                  parent.querySelectorAll('.price-button, [data-testid^="price-button-"]').length >= 2) {
                matchContainer = parent;
                console.log(`Found match container for ${matchId} (by proximity)`);
                break;
              }
              parent = parent.parentElement;
            }

            // Last resort: use the immediate parent
            if (!matchContainer) {
              matchContainer = buttons[0].parentElement;
              console.log(`Using immediate parent as match container for ${matchId} (last resort)`);
            }
          }
        }

        if (matchContainer) {
          matchesMap[matchId] = matchContainer;
          console.log(`Successfully mapped match ${matchId} to container element`);
        }
      }
    }

    // If we found all matches using direct button search, return early
    if (Object.keys(matchesMap).length === matchIds.length) {
      console.log(`Found all ${matchIds.length} matches by direct data-market-id search, returning`);
      return matchesMap;
    }

    // Log which matches are still missing
    const missingMatchIds = matchIds.filter(id => !matchesMap[id]);
    console.log(`Still missing ${missingMatchIds.length} matches, trying container search`);

    // Wait briefly before trying container search
    await sleep(800);

    // Continue with normal container-based search for remaining matches
    let allMatches = [];
    for (const selector of allMatchesSelectors) {
      console.log(`Trying to find matches with selector: ${selector}`);
      const matches = matchesContainer.querySelectorAll(selector);
      if (matches.length > 0) {
        allMatches = Array.from(matches);
        console.log(`Found ${matches.length} match elements using selector: ${selector}`);
        break;
      }
    }

    // If still not found, try looking anywhere in the document (not just in the main container)
    if (allMatches.length === 0) {
      console.log('No matches found in main container, trying document-wide search');
      for (const selector of allMatchesSelectors) {
        const matches = document.querySelectorAll(selector);
        if (matches.length > 0) {
          allMatches = Array.from(matches);
          console.log(`Found ${matches.length} match elements in document using selector: ${selector}`);
          break;
        }
      }
    }

    // If still no matches found, look for price buttons directly
    if (allMatches.length === 0) {
      console.log('No match containers found, searching for price buttons directly');
      console.log('Looking for price buttons with data-market-id attributes directly');
      const priceButtons = document.querySelectorAll('.price-button[data-market-id], [data-testid^="price-button-"][data-market-id]');

      if (priceButtons.length > 0) {
        console.log(`Found ${priceButtons.length} price buttons with data-market-id directly`);

        // Extract all match IDs from the buttons for logging
        const foundIds = new Set();
        priceButtons.forEach(button => {
          const id = button.getAttribute('data-market-id');
          if (id) foundIds.add(id);
        });
        console.log(`Price buttons contain ${foundIds.size} unique match IDs:`, Array.from(foundIds));

        // Group price buttons by their parent containers
        const buttonContainers = new Map();

        for (const button of priceButtons) {
          // Try to find a parent container (up to 5 levels up)
          let container = button.parentElement;
          for (let i = 0; i < 5 && container; i++) {
            if (container.querySelectorAll('.price-button[data-market-id], [data-testid^="price-button-"][data-market-id]').length >= 2) {
              // This container has multiple price buttons, likely a match container
              buttonContainers.set(container, container);
              break;
            }
            container = container.parentElement;
          }

          // If no suitable container found, use the button's immediate parent
          if (!container) {
            buttonContainers.set(button.parentElement, button.parentElement);
          }
        }

        // Convert map values to array
        allMatches = Array.from(buttonContainers.values());
        console.log(`Identified ${allMatches.length} potential match containers from price buttons`);
      } else {
        // If still nothing found, try again without the data-market-id requirement
        const allPriceButtons = document.querySelectorAll('.price-button, [data-testid^="price-button-"]');
        console.log(`Found ${allPriceButtons.length} price buttons without data-market-id requirement`);

        // Group price buttons by their parent containers
        const buttonContainers = new Map();

        for (const button of allPriceButtons) {
          // Try to find a parent container (up to 5 levels up)
          let container = button.parentElement;
          for (let i = 0; i < 5 && container; i++) {
            if (container.querySelectorAll('.price-button, [data-testid^="price-button-"]').length >= 2) {
              // This container has multiple price buttons, likely a match container
              buttonContainers.set(container, container);
              break;
            }
            container = container.parentElement;
          }

          // If no suitable container found, use the button's immediate parent
          if (!container) {
            buttonContainers.set(button.parentElement, button.parentElement);
          }
        }

        // Convert map values to array
        allMatches = Array.from(buttonContainers.values());
        console.log(`Identified ${allMatches.length} potential match containers from price buttons (without data-market-id)`);
      }
    }

    // If we still don't have any matches, try a last resort approach
    if (allMatches.length === 0) {
      console.warn('No match elements found using any selector, trying to identify matches by scrolling');

      // Try scrolling down to load more content
      const scrollStep = 500;
      const maxScrolls = 5;

      for (let i = 0; i < maxScrolls; i++) {
        window.scrollBy(0, scrollStep);
        await sleep(1000);

        // Try all selectors again after scrolling
        for (const selector of allMatchesSelectors) {
          const matches = document.querySelectorAll(selector);
          if (matches.length > 0) {
            allMatches = Array.from(matches);
            console.log(`Found ${matches.length} match elements after scrolling, using selector: ${selector}`);
            break;
          }
        }

        if (allMatches.length > 0) break;
      }
    }

    // Log for debugging
    console.log(`Found ${allMatches.length} total match elements on page`);

    // STEP 1: Find matches by match ID in price buttons - PRIMARY METHOD
    console.log('Looking for matches by data-market-id attribute - PRIMARY SEARCH METHOD');
    console.log('Searching for match IDs:', missingMatchIds);

    // Keep track of the match IDs we find
    const foundMatchIds = [];

    for (const container of allMatches) {
      // Get all price buttons in this match container
      const priceButtons = container.querySelectorAll('.price-button, [data-testid^="price-button-"]');

      for (const button of priceButtons) {
        const buttonMatchId = button.getAttribute('data-market-id');

        if (buttonMatchId && missingMatchIds.includes(buttonMatchId)) {
          // Found a match, store its container
          matchesMap[buttonMatchId] = container;
          foundMatchIds.push(buttonMatchId);
          console.log(`Found match ${buttonMatchId} by data-market-id attribute`);
          break;
        }
      }
    }

    // Log all successfully found match IDs
    if (foundMatchIds.length > 0) {
      console.log(`Successfully found ${foundMatchIds.length}/${missingMatchIds.length} matches by data-market-id:`, foundMatchIds);
    }

    // If we found all matches, return early
    if (Object.keys(matchesMap).length === matchIds.length) {
      console.log(`Found all ${matchIds.length} matches by ID, returning`);
      return matchesMap;
    }

    // STEP 3: For matches we haven't found, try to find by team names - FALLBACK METHOD
    const remainingMissingIds = matchIds.filter(id => !matchesMap[id]);

    if (remainingMissingIds.length > 0) {
      console.log(`Still missing ${remainingMissingIds.length} matches, trying to find by team names (FALLBACK METHOD)`);
      console.log('Missing match IDs:', remainingMissingIds);

      // Wait briefly before trying team name search
      await sleep(500);

      // Get current selected matches data from storage
      const result = await chrome.storage.local.get(['selectedMatches', 'confirmedMatches', 'isMatchesConfirmed']);

      // Use confirmed matches if available, otherwise use selected matches
      const storedMatches = result.isMatchesConfirmed && result.confirmedMatches ?
                             result.confirmedMatches : result.selectedMatches || [];

      console.log(`Got ${storedMatches.length} stored matches to look up team names`);

      // Create a map of team names to match IDs
      const teamToMatchMap = {};
      for (const match of storedMatches) {
        if (remainingMissingIds.includes(match.matchId)) {
          // Map both teams to this match ID
          if (match.team1) teamToMatchMap[match.team1.toLowerCase()] = match.matchId;
          if (match.team2) teamToMatchMap[match.team2.toLowerCase()] = match.matchId;

          // Also map the selected team
          if (match.selectedTeam) teamToMatchMap[match.selectedTeam.toLowerCase()] = match.matchId;

          // And the opponent team
          if (match.opponentTeam) teamToMatchMap[match.opponentTeam.toLowerCase()] = match.matchId;
        }
      }

      console.log('Created team name to match ID mapping:', teamToMatchMap);

      // Look for team names in the DOM
      const foundByTeam = {};

      for (const container of allMatches) {
        // Only check containers we haven't already mapped
        const containerMatchIds = Object.entries(matchesMap)
                                        .filter(([_, c]) => c === container)
                                        .map(([id, _]) => id);

        if (containerMatchIds.length > 0) continue; // Skip this container, already mapped

        // Get all text content from this container
        const allText = container.textContent.toLowerCase();

        // Check each team name
        for (const [teamName, matchId] of Object.entries(teamToMatchMap)) {
          if (allText.includes(teamName.toLowerCase()) && !foundByTeam[matchId]) {
            matchesMap[matchId] = container;
            foundByTeam[matchId] = true;
            console.log(`Found match ${matchId} by team name "${teamName}" (fallback method)`);
          }
        }

        // Also look more specifically for team elements
        const teamElements = container.querySelectorAll('.team-name, .player-name, .flex-shrink.truncate, .displayTitle');
        for (const element of teamElements) {
          const teamName = element.textContent.trim().toLowerCase();
          if (teamToMatchMap[teamName] && !foundByTeam[teamToMatchMap[teamName]]) {
            const matchId = teamToMatchMap[teamName];
            matchesMap[matchId] = container;
            foundByTeam[matchId] = true;
            console.log(`Found match ${matchId} by team element containing "${teamName}" (fallback method)`);
          }
        }
      }
    }

    // Log final results
    const foundCount = Object.keys(matchesMap).length;
    console.log(`Final search results: found ${foundCount} out of ${matchIds.length} matches`);
    if (foundCount < matchIds.length) {
      const finalMissingIds = matchIds.filter(id => !matchesMap[id]);
      console.warn(`Missing match IDs: ${finalMissingIds.join(', ')}`);
    }

    // Final wait before returning results
    await sleep(500);

    return matchesMap;
  } catch (error) {
    console.error('Error finding matches by IDs:', error);
    throw error;
  }
}



/*
<div data-testid="remove-item" cursor="pointer" class="sc-hKwDye cyA-dgk" style="opacity: 1;" bis_skin_checked="1"><svg id="cross-circle-fill" width="16" height="16" fill="#9196a1" version="1.1"><use xlink:href="/images/ladbrokes/sprites/svg-misc-icon.svg#cross-circle-fill"></use></svg></div>
*/




function clearBetSlip(){
  const betSlipContainer = document.querySelector('[data-testid="betslip-singles-container"]');
  if (betSlipContainer) {
    const removeButtons = betSlipContainer.querySelectorAll('[data-testid="remove-item"]');
    removeButtons.forEach(button => button.click());
  };
}