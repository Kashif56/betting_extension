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
      // Set matches from confirmed selections
      if (message.matches && message.matches.length > 0) {
        // Store the confirmed matches for reselection
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
      // Check if we should use confirmed matches
      chrome.storage.local.get(['isMatchesConfirmed', 'confirmedMatches'], (result) => {
        if (result.isMatchesConfirmed && result.confirmedMatches && result.confirmedMatches.length > 0) {
          console.log('Using confirmed matches for reselection');
          // Use confirmed matches instead of provided matches
          handleMatchReselection(
            result.confirmedMatches.map(match => match.matchId), 
            result.confirmedMatches.map(match => ({
              matchId: match.matchId,
              selectedTeam: match.selectedTeam
            }))
          )
          .then(result => {
            sendResponse({ status: 'started', result });
          })
          .catch(error => {
            console.error('Error in match re-selection:', error);
            sendResponse({ error: error.message });
          });
        } else {
          // Handle re-selection of matches by their IDs using provided data
          handleMatchReselection(message.matchIds, message.playerSelections)
            .then(result => {
              sendResponse({ status: 'started', result });
            })
            .catch(error => {
              console.error('Error in match re-selection:', error);
              sendResponse({ error: error.message });
            });
        }
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
  } catch (error) {
    console.error('Error initializing content script:', error);
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

    // Only save if this is a manual selection (not from auto betting)
    // This helps keep selectedMatches accurate for user selections
    const isManualSelection = !document.documentElement.hasAttribute('data-auto-betting-in-progress');

    // Save the match data
    saveMatchData(matchData, isManualSelection);

    console.log('Match selected:', matchData);
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

    // First try to determine opponent based on team names
    if (selectedTeam === team1) {
      otherTeamName = team2;
    } else if (selectedTeam === team2) {
      otherTeamName = team1;
    } else {
      // If selected team doesn't match team1 or team2, try to find the other button
      const allButtons = matchContainer.querySelectorAll('.price-button, .selection-button, [data-testid="price-button"]');
      for (const button of allButtons) {
        if (button !== selectedButton) {
          // Try to get the team name using the same selectors
          for (const selector of teamNameSelectors) {
            const buttonNameElement = button.querySelector(selector);
            if (buttonNameElement) {
              const buttonName = buttonNameElement.textContent.trim();
              // Clean up common selection text formatting
              const cleanButtonName = buttonName.replace(/(\d+\.\d+)|\+|\-|\s*win\s*|\s*to win\s*/gi, '').trim();
              
              if (cleanButtonName && cleanButtonName !== selectedTeam) {
                otherTeamName = cleanButtonName;
                
                // Get odds using the same selectors
                for (const oddsSelector of oddsSelectors) {
                  const buttonOddsElement = button.querySelector(oddsSelector);
                  if (buttonOddsElement) {
                    otherTeamOdds = buttonOddsElement.textContent.trim();
                    if (otherTeamOdds) break;
                  }
                }
                
                // If still no odds, try to extract from button text using regex
                if (otherTeamOdds === '1.0') {
                  const oddsMatch = button.textContent.match(/(\d+\.\d+)/);
                  if (oddsMatch) {
                    otherTeamOdds = oddsMatch[1];
                  }
                }
                
                break;
              }
            }
          }
          
          // Break if we found the other team
          if (otherTeamName) break;
        }
      }
    }
    
    console.log(`Opponent team: ${otherTeamName}, odds: ${otherTeamOdds}`);

    // Determine if this selection is a favorite based on odds
    // Lower odds = favorite, higher odds = underdog
    const selectedOddsValue = parseFloat(odds);
    const otherOddsValue = parseFloat(otherTeamOdds);
    
    // Make sure odds are valid numbers
    const isFavorite = !isNaN(selectedOddsValue) && !isNaN(otherOddsValue) ? 
                       selectedOddsValue < otherOddsValue : false;
    
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
  } catch (error) {
    console.error('Error saving match data:', error);
  }
}

// Handle match deselection
async function handleMatchDeselection(matchId, button) {
  try {
    // Find the match with this ID and button
    const index = selectedMatches.findIndex(match => match.matchId === matchId);
    
    if (index >= 0) {
      // We don't remove this match automatically - only when manually deselected
      // The removal now happens only when user explicitly deselects the match in the UI
      
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
  if (!isRunning) {
    console.log('Bot is not running');
    return;
  }
  
  console.log('Performing bot action');
  
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
  console.log(`Total matches on page: ${matchContainers.length}`);
  
  // Note: We've removed automatic selection of matches
  // This was causing unwanted behavior when the bot was running
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
          element = document.querySelector(singleSelector);
          if (element) {
            console.log(`Found element with selector: ${singleSelector}`);
            break;
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
    
    checkElement();
  });
}

// Handle reselection of matches
async function handleMatchReselection(matchIds, playerSelections = []) {
  try {
    console.log(`Reselecting ${matchIds.length} matches with specific players`);
    
    // Find the matches on the page
    const matchElements = await findMatchesByIds(matchIds);
    
    if (!matchElements || Object.keys(matchElements).length === 0) {
      throw new Error('No match elements found for the provided IDs');
    }
    
    console.log(`Found ${Object.keys(matchElements).length} match elements on the page`);
    
    // Create a map of player selections by matchId for easy lookup
    const selectionMap = {};
    if (playerSelections && playerSelections.length > 0) {
      playerSelections.forEach(selection => {
        selectionMap[selection.matchId] = selection.selectedTeam;
      });
      console.log('Using provided player selections:', selectionMap);
    }
    
    // Select the specified player for each match
    let successCount = 0;
    for (const matchId of matchIds) {
      const matchElement = matchElements[matchId];
      if (matchElement) {
        // If we have a specific selection for this match, use it
        // otherwise fall back to selecting the opposite player
        const targetTeam = selectionMap[matchId];
        
        if (targetTeam) {
          const success = await selectSpecificPlayer(matchElement, matchId, targetTeam);
          if (success) successCount++;
        } else {
          const success = await selectOppositePlayer(matchElement, matchId);
          if (success) successCount++;
        }
      }
    }
    
    return { success: true, matchCount: Object.keys(matchElements).length, successCount };
  } catch (error) {
    console.error('Error reselecting matches:', error);
    throw error;
  }
}

// Select a specific player for a match by team name
async function selectSpecificPlayer(matchElement, matchId, targetTeam) {
  try {
    // Get all price buttons in this match container
    const priceButtons = matchElement.querySelectorAll('.price-button');
    
    // Find the button for the specific team
    let targetButton = null;
    
    for (const button of priceButtons) {
      const buttonNameElement = button.querySelector('.displayTitle');
      if (buttonNameElement) {
        const buttonName = buttonNameElement.textContent.trim();
        if (buttonName === targetTeam) {
          targetButton = button;
          break;
        }
      }
    }
    
    if (!targetButton) {
      console.error(`No button found for team ${targetTeam} in match ${matchId}`);
      return false;
    }
    
    // Click the target button
    targetButton.click();
    
    // Wait a moment for the UI to update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Adding the selection to QuickSlip/BetSlip
    // Check for the "Add to Betslip" button in QuickSlip
    try {
      const quickSlipAddButton = await waitForElement('button.quickbet-add-betslip', 2000);
      quickSlipAddButton.click();
      console.log(`Added ${targetTeam} for match ${matchId} to betslip via QuickSlip`);
    } catch (quickSlipError) {
      console.log(`QuickSlip not found, assuming selection added directly to betslip: ${quickSlipError.message}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error selecting specific player for match ${matchId}:`, error);
    return false;
  }
}

// Find match elements by match IDs
async function findMatchesByIds(matchIds) {
  try {
    console.log(`Searching for ${matchIds.length} matches with IDs:`, matchIds);
    
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
    
    // Get all match containers - try multiple selectors to ensure we find matches
    const allMatchesSelectors = [
      '.flex-col.rounded-md',
      '.market-container',
      '.event-card',
      '.match-container',
      '[data-testid="match-container"]',
      '.event-row',
      '.match-row',
      '.game-container'
    ];
    
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
      const priceButtons = document.querySelectorAll('.price-button, [data-testid="price-button"]');
      
      if (priceButtons.length > 0) {
        console.log(`Found ${priceButtons.length} price buttons directly`);
        
        // Group price buttons by their parent containers
        const buttonContainers = new Map();
        
        for (const button of priceButtons) {
          // Try to find a parent container (up to 5 levels up)
          let container = button.parentElement;
          for (let i = 0; i < 5 && container; i++) {
            if (container.querySelectorAll('.price-button, [data-testid="price-button"]').length >= 2) {
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
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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
    
    // Map to store found matches
    const matchesMap = {};
    
    // STEP 1: Find matches by match ID in price buttons
    console.log('Looking for matches by data-market-id attribute');
    for (const container of allMatches) {
      // Get all price buttons in this match container
      const priceButtons = container.querySelectorAll('.price-button, [data-testid="price-button"]');
      
      for (const button of priceButtons) {
        const buttonMatchId = button.getAttribute('data-market-id');
        
        if (buttonMatchId && matchIds.includes(buttonMatchId)) {
          // Found a match, store its container
          matchesMap[buttonMatchId] = container;
          console.log(`Found match ${buttonMatchId} by data-market-id attribute`);
          break;
        }
      }
    }
    
    // STEP 2: If we found all matches, return early
    if (Object.keys(matchesMap).length === matchIds.length) {
      console.log(`Found all ${matchIds.length} matches by ID, returning`);
      return matchesMap;
    }
    
    // STEP 3: For matches we haven't found, try to find by team names
    const missingMatchIds = matchIds.filter(id => !matchesMap[id]);
    
    if (missingMatchIds.length > 0) {
      console.log(`Still missing ${missingMatchIds.length} matches, trying to find by team names`);
      
      // Get current selected matches data from storage
      const result = await chrome.storage.local.get(['selectedMatches', 'confirmedMatches', 'isMatchesConfirmed']);
      
      // Use confirmed matches if available, otherwise use selected matches
      const storedMatches = result.isMatchesConfirmed && result.confirmedMatches ? 
                             result.confirmedMatches : result.selectedMatches || [];
      
      console.log(`Got ${storedMatches.length} stored matches to look up team names`);
      
      // Create a map of team names to match IDs
      const teamToMatchMap = {};
      for (const match of storedMatches) {
        if (missingMatchIds.includes(match.matchId)) {
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
            console.log(`Found match ${matchId} by team name "${teamName}"`);
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
            console.log(`Found match ${matchId} by team element containing "${teamName}"`);
          }
        }
      }
    }
    
    // Log final results
    const foundCount = Object.keys(matchesMap).length;
    console.log(`Final search results: found ${foundCount} out of ${matchIds.length} matches`);
    if (foundCount < matchIds.length) {
      const missingIds = matchIds.filter(id => !matchesMap[id]);
      console.warn(`Missing match IDs: ${missingIds.join(', ')}`);
    }
    
    return matchesMap;
  } catch (error) {
    console.error('Error finding matches by IDs:', error);
    throw error;
  }
}

// Select the opposite player for a match
async function selectOppositePlayer(matchElement, matchId) {
  try {
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
    
    // Click the opposite button
    oppositeButton.click();
    
    // Wait a moment for the UI to update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Adding the selection to QuickSlip/BetSlip
    // Check for the "Add to Betslip" button in QuickSlip
    try {
      const quickSlipAddButton = await waitForElement('button.quickbet-add-betslip', 2000);
      quickSlipAddButton.click();
      console.log(`Added opposite player for match ${matchId} to betslip via QuickSlip`);
    } catch (quickSlipError) {
      console.log(`QuickSlip not found, assuming selection added directly to betslip: ${quickSlipError.message}`);
    }
    
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
    
    // Try to open the bet slip first in case it's collapsed
    const betSlipToggle = document.querySelector('[data-testid="betslip-toggle"]');
    if (betSlipToggle) {
      betSlipToggle.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
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
            button.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            return; // We're done if we found and clicked "Clear All"
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
        clearAllButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Cleared all selections at once using Clear All button');
        return;
      }
      
      // If no Clear All button, find individual remove buttons
      const removeButtons = betSlipContainer.querySelectorAll('[data-testid="remove-item"]');
      
      if (removeButtons.length === 0) {
        console.log('No selections to clear');
        return;
      }
      
      console.log(`Clearing ${removeButtons.length} selections one by one`);
      
      // Click each remove button with a small delay between clicks
      for (const button of removeButtons) {
        button.click();
        await new Promise(resolve => setTimeout(resolve, 300));
      }
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
  } catch (error) {
    console.error('Error clearing selections:', error);
    throw error;
  }
}

// Wait for the bet slip to be accessible
async function waitForBetSlip() {
  try {
    // Try to open the bet slip if it's collapsed
    const betSlipToggle = document.querySelector('[data-testid="betslip-toggle"]');
    if (betSlipToggle) {
      betSlipToggle.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Wait for the bet slip container
    const betSlipContainer = await waitForElement('#betslip-container', 5000);
    
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
    
    // Check if MultiBet section already exists
    const multiBetContainer = betSlipContainer.querySelector('[data-testid="betslip-multis-container"]');
    if (!multiBetContainer) {
      throw new Error('MultiBet section not found in bet slip');
    }
    
    // Make sure the MultiBet section is visible (it may be collapsed)
    const multiBetTitle = multiBetContainer.querySelector('[data-testid="betslip-multis-container-title"]');
    if (multiBetTitle && !multiBetTitle.parentElement.parentElement.querySelector('[data-testid="betslip-multi-item"]')) {
      // Click the title to expand the section
      multiBetTitle.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return true;
  } catch (error) {
    console.error('Error navigating to MultiBet section:', error);
    throw error;
  }
}

// Enter stake amount in MultiBet section
async function enterStakeAmount(amount) {
  try {
    // Make sure we're in the MultiBet section
    await navigateToMultiBet();
    
    // Find the input field in the MultiBet section
    const multiBetContainer = document.querySelector('[data-testid="betslip-multis-container"]');
    if (!multiBetContainer) {
      throw new Error('MultiBet section not found');
    }
    
    // Look for stake input fields in different formats
    const stakeInputSelectors = [
      '[data-testid="bs-multi-input"] input[data-testid="input-bet-value"]',
      'input[data-testid="input-bet-value"]',
      '.stake-input input'
    ];
    
    let stakeInput = null;
    
    // Try each selector
    for (const selector of stakeInputSelectors) {
      stakeInput = multiBetContainer.querySelector(selector);
      if (stakeInput) break;
    }
    
    if (!stakeInput) {
      throw new Error('Stake input field not found in MultiBet section');
    }
    
    // Focus the input field
    stakeInput.focus();
    
    // Clear existing value
    stakeInput.value = '';
    
    // Trigger an input event to notify the field has changed
    stakeInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Type the amount
    stakeInput.value = amount;
    
    // Trigger another input event
    stakeInput.dispatchEvent(new Event('input', { bubbles: true }));
    stakeInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Blur the field to trigger any validation
    stakeInput.blur();
    
    console.log(`Entered stake amount: ${amount}`);
    
    // Wait a moment for the UI to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  } catch (error) {
    console.error('Error entering stake amount:', error);
    throw error;
  }
}

// Click the "Place Bets" button
async function clickPlaceBets() {
  try {
    // Find the "Place Bets" button in the MultiBet section
    const multiBetContainer = document.querySelector('[data-testid="betslip-multis-container"]');
    if (!multiBetContainer) {
      throw new Error('MultiBet section not found');
    }
    
    // Look for the Place Bets button in different formats
    const placeButtonSelectors = [
      'button[data-testid="place-bet-button"]',
      'button.place-bet-button',
      '.place-bet button',
      'button:contains("Place Bet")',
      'button:contains("Place Bets")'
    ];
    
    let placeButton = null;
    
    // Try each selector
    for (const selector of placeButtonSelectors) {
      // Use different methods for the :contains pseudo-selector
      if (selector.includes(':contains')) {
        const buttonText = selector.match(/:contains\("(.+)"\)/)[1];
        const buttons = multiBetContainer.querySelectorAll('button');
        for (const button of buttons) {
          if (button.textContent.includes(buttonText)) {
            placeButton = button;
            break;
          }
        }
      } else {
        placeButton = multiBetContainer.querySelector(selector);
      }
      
      if (placeButton) break;
    }
    
    // If not found in MultiBet section, look in the entire bet slip
    if (!placeButton) {
      const betSlipContainer = document.querySelector('#betslip-container');
      if (betSlipContainer) {
        const buttons = betSlipContainer.querySelectorAll('button');
        for (const button of buttons) {
          if (button.textContent.includes('Place Bet') || button.textContent.includes('Place Bets')) {
            placeButton = button;
            break;
          }
        }
      }
    }
    
    if (!placeButton) {
      throw new Error('Place Bets button not found');
    }
    
    // Check if the button is disabled
    if (placeButton.disabled || placeButton.classList.contains('disabled')) {
      throw new Error('Place Bets button is disabled');
    }
    
    // Click the button
    placeButton.click();
    
    console.log('Clicked Place Bets button');
    
    // Wait a moment for the bet to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return true;
  } catch (error) {
    console.error('Error clicking Place Bets button:', error);
    throw error;
  }
}
