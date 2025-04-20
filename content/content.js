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
    
    // Initial wait before starting
    await sleep(1000);
    
    // Find the matches on the page
    const matchElements = await findMatchesByIds(matchIds);
    
    if (!matchElements || Object.keys(matchElements).length === 0) {
      throw new Error('No match elements found for the provided IDs');
    }
    
    console.log(`Found ${Object.keys(matchElements).length} match elements on the page`);
    
    // Wait for DOM to be ready after search
    await sleep(1000);
    
    // Create a map of player selections by matchId for easy lookup
    const selectionMap = {};
    if (playerSelections && playerSelections.length > 0) {
      playerSelections.forEach(selection => {
        selectionMap[selection.matchId] = selection.selectedTeam;
      });
      console.log('Using provided player selections:', selectionMap);
    }
    
    // Select the specified player for each match with a delay between selections
    let successCount = 0;
    for (const matchId of matchIds) {
      const matchElement = matchElements[matchId];
      if (matchElement) {
        // Wait between each match selection to avoid overwhelming the UI
        await sleep(1500);
        
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
    
    // Wait after all selections are complete
    await sleep(2000);
    
    return { success: true, matchCount: Object.keys(matchElements).length, successCount };
  } catch (error) {
    console.error('Error reselecting matches:', error);
    throw error;
  }
}

// Select a specific player for a match by team name
async function selectSpecificPlayer(matchElement, matchId, targetTeam) {
  try {
    // Wait briefly before starting the selection process
    await sleep(500);
    
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
    
    for (const button of allPriceButtons) {
      // First look for displayTitle spans
      const displayTitleElement = button.querySelector('span.displayTitle');
      if (displayTitleElement) {
        const buttonName = displayTitleElement.textContent.trim();
        if (buttonName === targetTeam) {
          targetButton = button;
          console.log(`Found target button with displayTitle "${buttonName}"`);
          break;
        }
      }
      
      // If no displayTitle, try other elements like price-button-name
      if (!targetButton) {
        const buttonNameElement = button.querySelector('[data-testid="price-button-name"], .price-button-name');
        if (buttonNameElement) {
          const buttonName = buttonNameElement.textContent.trim();
          if (buttonName === targetTeam) {
            targetButton = button;
            console.log(`Found target button with price-button-name "${buttonName}"`);
            break;
          }
        }
      }
    }
    
    if (!targetButton) {
      console.error(`No button found for team ${targetTeam} in match ${matchId}`);
      return false;
    }
    
    // Log the odds for the selected team
    const oddsElement = targetButton.querySelector('[data-testid="price-button-odds"]');
    if (oddsElement) {
      const odds = oddsElement.textContent.trim();
      console.log(`Selected ${targetTeam} with odds: ${odds}`);
    }
    
    // Wait before clicking to ensure UI is stable
    await sleep(800);
    
    // Click the target button
    targetButton.click();
    console.log(`Clicked button for team ${targetTeam}`);
    
    // Wait for the UI to update after click
    await sleep(1000);
    
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
      await sleep(500);
      
      quickSlipAddButton.click();
      console.log(`Added ${targetTeam} for match ${matchId} to betslip via explicit button click`);
      
      // Wait for betslip to update
      await sleep(1000);
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
    await sleep(1000);
    
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
    await sleep(500);
    
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
    await sleep(800);
    
    // Click the opposite button
    oppositeButton.click();
    console.log(`Clicked opposite button for match ${matchId}`);
    
    // Wait for the UI to update after click
    await sleep(1000);
    
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
      await sleep(500);
      
      quickSlipAddButton.click();
      console.log(`Added opposite player for match ${matchId} to betslip via explicit button click`);
      
      // Wait for betslip to update
      await sleep(1000);
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
    await sleep(1000);
    
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
        await sleep(500);
        clearAllButton.click();
        await sleep(1500);
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
        await sleep(500); // More time between each button click
        button.click();
        await sleep(800); // Wait for UI to update after each removal
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
    await sleep(1000);
    
    // Try to open the bet slip if it's collapsed
    const betSlipToggle = document.querySelector('[data-testid="betslip-toggle"]');
    if (betSlipToggle) {
      betSlipToggle.click();
      await sleep(1500);
    }
    
    // Wait for the bet slip container with increased timeout
    const betSlipContainer = await waitForElement('#betslip-container', 8000);
    
    // Wait for the betslip to fully load
    await sleep(1000);
    
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
    await sleep(1000);
    
    // Check if MultiBet section already exists
    const multiBetContainer = betSlipContainer.querySelector('[data-testid="betslip-multis-container"]');
    if (!multiBetContainer) {
      throw new Error('MultiBet section not found in bet slip');
    }
    
    // Make sure the MultiBet section is visible (it may be collapsed)
    const multiBetTitle = multiBetContainer.querySelector('[data-testid="betslip-multis-container-title"]');
    if (multiBetTitle && !multiBetTitle.parentElement.parentElement.querySelector('[data-testid="betslip-multi-item"]')) {
      // Wait before clicking to expand
      await sleep(500);
      
      // Click the title to expand the section
      multiBetTitle.click();
      
      // Wait for section to expand
      await sleep(1500);
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
    await sleep(1000);
    
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
        await sleep(100);
      }
      
      // Click 'Done' if present
      const doneButton = keypadContainer.querySelector('[data-testid="qb-values-done"]');
      if (doneButton) doneButton.click();
    }
    
    // Wait a moment to ensure the amount is properly entered
    await sleep(1000);
    
    // Verify the value was entered
    if (stakeInput.value !== amount && stakeInput.value !== `$${amount}`) {
      console.warn(`Stake amount verification failed: expected ${amount}, got ${stakeInput.value}`);
    }
    
    console.log(`Entered stake amount: ${amount}`);
    return true;
  } catch (error) {
    console.error('Error entering stake amount:', error);
    throw error;
  }
}

// Click the "Place Bets" button
async function clickPlaceBets() {
  try {
    console.log('Attempting to place bets...');
    
    // Wait for the UI to be fully ready
    await sleep(1500);
    
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
      
      // Check for odds change notifications
      const oddsChangeElements = document.querySelectorAll(
        '[data-testid="odds-change-notification"], ' +
        '.odds-changed, .odds-change-alert'
      );
      
      if (oddsChangeElements.length > 0) {
        console.log('Odds have changed, attempting to handle...');
        const handled = await handleOddsChangeError();
        if (handled) {
          console.log('Odds change handled, retrying place bets...');
          return await clickPlaceBets(); // Recursive call after handling odds change
        }
      }
      
      // Check for maximum stake limits
      const maxStakeWarnings = document.querySelectorAll('.max-stake-warning, [data-testid="max-stake-warning"]');
      if (maxStakeWarnings.length > 0) {
        throw new Error('Cannot place bets: Maximum stake limit exceeded');
      }
      
      throw new Error('Place Bets button is disabled for an unknown reason');
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
    
    // If no confirmation button was found but we see a dialog/modal, look for any primary/action button
    if (!confirmButtonFound) {
      const dialogElements = document.querySelectorAll('.modal, .dialog, .overlay, .popup');
      for (const dialog of dialogElements) {
        if (dialog.offsetParent !== null) { // Check if dialog is visible
          // Look for primary action buttons in the dialog
          const actionButton = dialog.querySelector('button.primary, button.action, button.primary-action');
          if (actionButton) {
            console.log('Found dialog with action button, clicking to confirm...');
            actionButton.click();
            await sleep(1500);
            break;
          }
        }
      }
    }
    
    // Enhanced success verification - Checking multiple indicators
    // 1. Check for bet receipt/confirmation message
    const receiptSelectors = [
      '[data-testid="betslip-receipt"]',
      '[data-testid="bet-confirmation"]',
      '.bet-receipt',
      '.bet-confirmation',
      '.bet-success',
      '.bet-placed-message',
      '.success-message'
    ];
    
    for (const selector of receiptSelectors) {
      const receiptElement = document.querySelector(selector);
      if (receiptElement && receiptElement.offsetParent !== null) { // Check if visible
        console.log(`Bet placed successfully! Receipt found with selector: ${selector}`);
        
        // Send a message indicating successful bet placement
        chrome.runtime.sendMessage({
          action: 'betPlaced',
          success: true
        });
        
        return true;
      }
    }
    
    // 2. Check for success toast/notification
    const successNotifications = document.querySelectorAll(
      '.toast-success, .success-notification, .success-toast, ' +
      '[data-testid="success-notification"], [data-testid="toast-success"]'
    );
    
    if (successNotifications.length > 0) {
      console.log('Bet placed successfully! Success notification found');
      chrome.runtime.sendMessage({
        action: 'betPlaced',
        success: true
      });
      return true;
    }
    
    // 3. Check for bet reference/ID which often appears after successful placement
    const betReferenceElements = document.querySelectorAll(
      '[data-testid="bet-reference"], .bet-reference, .bet-id, ' +
      '.reference-number, .transaction-id'
    );
    
    if (betReferenceElements.length > 0) {
      console.log('Bet placed successfully! Bet reference/ID found');
      chrome.runtime.sendMessage({
        action: 'betPlaced',
        success: true
      });
      return true;
    }
    
    // Check if there are any errors in the bet slip after placing the bet
    const betSlipErrors = document.querySelectorAll(
      '[data-testid="betslip-error-message"], .bet-error, .error-message, ' +
      '.betting-error, .validation-error'
    );
    
    if (betSlipErrors.length > 0) {
      const errorTexts = Array.from(betSlipErrors).map(el => el.textContent).join(', ');
      throw new Error(`Error after placing bet: ${errorTexts}`);
    }
    
    // Check if the bet slip is now empty (some sites clear the slip after successful bet)
    const emptyBetSlipMessage = document.querySelector(
      '[data-testid="empty-betslip"], .empty-betslip, .no-selections'
    );
    
    if (emptyBetSlipMessage) {
      console.log('Bet likely placed successfully as bet slip is now empty');
      chrome.runtime.sendMessage({
        action: 'betPlaced',
        success: true
      });
      return true;
    }
    
    // If we got here without seeing a receipt or errors, check if Place Bet button is still visible
    if (placeBetsButton.offsetParent === null || 
        !document.body.contains(placeBetsButton) ||
        getComputedStyle(placeBetsButton).display === 'none') {
      console.log('Place Bets button is no longer visible, bet likely placed successfully');
      chrome.runtime.sendMessage({
        action: 'betPlaced',
        success: true
      });
      return true;
    }
    
    // If we got here without any confirmation but also no errors, assume it worked but keep a warning
    console.log('Bet appears to be placed, but no confirmation receipt found');
    chrome.runtime.sendMessage({
      action: 'betPlaced',
      success: true,
      warning: 'No confirmation receipt found'
    });
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

// Handle odds change errors
async function handleOddsChangeError() {
  try {
    console.log('Handling odds change error');
    
    // Look for an "Accept New Odds" button
    const acceptButtonSelectors = [
      'button[data-testid="accept-new-odds"]',
      'button.accept-odds',
      '.accept-button',
      'button:contains("Accept")',
      'button:contains("Accept New Odds")'
    ];
    
    let acceptButton = null;
    
    // Try each selector
    for (const selector of acceptButtonSelectors) {
      // Use different methods for the :contains pseudo-selector
      if (selector.includes(':contains')) {
        const buttonText = selector.match(/:contains\("(.+)"\)/)[1];
        const buttons = document.querySelectorAll('button');
        for (const button of buttons) {
          if (button.textContent.includes(buttonText)) {
            acceptButton = button;
            break;
          }
        }
      } else {
        acceptButton = document.querySelector(selector);
      }
      
      if (acceptButton) break;
    }
    
    if (acceptButton) {
      console.log('Found Accept New Odds button, clicking it');
      acceptButton.click();
      
      // Wait for the UI to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } else {
      // If no accept button, we may need to reselect the matches
      console.log('No accept button found, we may need to reload the selections');
      
      // Close any error dialogs
      const closeButtons = document.querySelectorAll('.close-button, button.close, [data-testid="close-button"]');
      for (const button of closeButtons) {
        button.click();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // We'll let the startNextBetCombination function handle reselecting
      return false;
    }
  } catch (error) {
    console.error('Error handling odds change:', error);
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
