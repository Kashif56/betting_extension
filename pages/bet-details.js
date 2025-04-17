// DOM Elements
const refreshBtn = document.getElementById('refreshBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const betStatus = document.getElementById('betStatus');
const stakeAmount = document.getElementById('stakeAmount');
const currentVariation = document.getElementById('currentVariation');
const startVariationsBtn = document.getElementById('startVariationsBtn');
const stopVariationsBtn = document.getElementById('stopVariationsBtn');
const confirmedMatchesContainer = document.getElementById('confirmedMatchesContainer');
const betHistoryContainer = document.getElementById('betHistoryContainer');
const noData = document.getElementById('noData');
const backBtn = document.getElementById('backBtn');

// Statistics Elements
const totalCombinations = document.getElementById('totalCombinations');
const triedCombinations = document.getElementById('triedCombinations');
const remainingCombinations = document.getElementById('remainingCombinations');

// We only use Single Bets now
const betVariations = ['Single Bets'];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadBetData();

  // Set up event listeners
  refreshBtn.addEventListener('click', loadBetData);
  clearHistoryBtn.addEventListener('click', clearBetHistory);
  startVariationsBtn.addEventListener('click', startBetVariations);
  stopVariationsBtn.addEventListener('click', stopBetVariations);
  backBtn.addEventListener('click', () => {
    window.close();
  });

  // Listen for updates from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'betVariationUpdated' || message.action === 'betHistoryUpdated') {
      loadBetData();
      sendResponse({ status: 'Bet data updated' });
    } else if (message.action === 'allCombinationsTried') {
      // All possible combinations have been tried
      loadBetData();
      alert(`All possible combinations (${message.totalCombinations}) have been tried. Betting variations have been stopped.`);
      sendResponse({ status: 'All combinations tried notification received' });
    }
    return true;
  });
});

// Load bet data from storage
async function loadBetData() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot load bet data');
      noData.style.display = 'block';
      confirmedMatchesContainer.innerHTML = '';
      betHistoryContainer.innerHTML = '';
      return;
    }

    // Show loading state
    confirmedMatchesContainer.innerHTML = '<div class="loading">Loading confirmed matches...</div>';
    betHistoryContainer.innerHTML = '<div class="loading">Loading bet history...</div>';

    // Get bet data from storage
    const result = await chrome.storage.local.get([
      'confirmedMatches',
      'stakeAmount',
      'betVariationActive',
      'lastVariationIndex',
      'betHistory',
      'previousSelections'
    ]);

    const confirmedMatches = result.confirmedMatches || [];
    const stake = result.stakeAmount || 0;
    const isActive = result.betVariationActive || false;
    const variationIndex = result.lastVariationIndex || -1;
    const betHistory = result.betHistory || [];
    const previousSelections = result.previousSelections || [];

    // Update UI based on data
    updateStatusDisplay(isActive, stake, variationIndex);

    // Update statistics
    updateStatistics(confirmedMatches, previousSelections);

    if (confirmedMatches.length === 0 && betHistory.length === 0) {
      noData.style.display = 'block';
      confirmedMatchesContainer.innerHTML = '';
      betHistoryContainer.innerHTML = '';
    } else {
      noData.style.display = 'none';

      if (confirmedMatches.length > 0) {
        renderConfirmedMatches(confirmedMatches);
      } else {
        confirmedMatchesContainer.innerHTML = '<div class="no-matches">No confirmed matches.</div>';
      }

      if (betHistory.length > 0) {
        renderBetHistory(betHistory);
      } else {
        betHistoryContainer.innerHTML = '<div class="no-bets">No bet history yet.</div>';
      }
    }
  } catch (error) {
    console.error('Error loading bet data:', error);
    noData.style.display = 'block';
    confirmedMatchesContainer.innerHTML = '';
    betHistoryContainer.innerHTML = '';
  }
}

// Update status display
function updateStatusDisplay(isActive, stake, variationIndex) {
  betStatus.textContent = isActive ? 'Active' : 'Inactive';
  betStatus.style.color = isActive ? '#4CAF50' : '#f44336';

  stakeAmount.textContent = `$${stake.toFixed(2)}`;

  if (variationIndex >= 0 && variationIndex < betVariations.length) {
    currentVariation.textContent = betVariations[variationIndex];
  } else {
    currentVariation.textContent = 'None';
  }

  startVariationsBtn.disabled = isActive;
  stopVariationsBtn.disabled = !isActive;
}

// Calculate and update statistics
function updateStatistics(confirmedMatches, previousSelections) {
  // If no confirmed matches, reset statistics
  if (!confirmedMatches || confirmedMatches.length === 0) {
    totalCombinations.textContent = '0';
    triedCombinations.textContent = '0';
    remainingCombinations.textContent = '0';
    return;
  }

  // Filter out live matches as they are skipped in the betting algorithm
  const nonLiveMatches = confirmedMatches.filter(match => !match.isLive);

  if (nonLiveMatches.length === 0) {
    totalCombinations.textContent = '0';
    triedCombinations.textContent = '0';
    remainingCombinations.textContent = '0';
    return;
  }

  // Count favorites and underdogs
  const favorites = nonLiveMatches.filter(match => match.isFavorite);
  const underdogs = nonLiveMatches.filter(match => !match.isFavorite);

  // Calculate how many favorites and underdogs to select based on 60/40 rule
  const totalMatches = nonLiveMatches.length;
  const favoritesToSelect = Math.round(totalMatches * 0.6);
  const underdogsToSelect = totalMatches - favoritesToSelect;

  // Calculate total possible combinations based on the 60/40 rule
  // This is the number of ways to select exactly favoritesToSelect favorites from totalMatches matches
  // which is given by the binomial coefficient C(totalMatches, favoritesToSelect)
  let totalPossibleCombinations = 0;

  // Calculate combinations using the binomial coefficient
  // C(n,k) = n! / (k! * (n-k)!)
  totalPossibleCombinations = calculateCombinations(totalMatches, favoritesToSelect);

  // Log the calculation for debugging
  console.log(`Calculating total valid combinations for ${totalMatches} matches:`);
  console.log(`- Available favorites: ${favorites.length}, Available underdogs: ${underdogs.length}`);
  console.log(`- Target favorites: ${favoritesToSelect} (${(favoritesToSelect/totalMatches*100).toFixed(1)}%)`);
  console.log(`- Target underdogs: ${underdogsToSelect} (${(underdogsToSelect/totalMatches*100).toFixed(1)}%)`);
  console.log(`- Total valid combinations: C(${totalMatches},${favoritesToSelect}) = ${totalPossibleCombinations}`);
  console.log(`- Total possible combinations (all): 2^${totalMatches} = ${Math.pow(2, totalMatches)}`);
  console.log(`- Percentage of valid combinations: ${(totalPossibleCombinations/Math.pow(2, totalMatches)*100).toFixed(2)}%`);

  // Number of tried combinations is the length of previousSelections
  const triedCombinationsCount = previousSelections.length;

  // Remaining combinations
  const remainingCombinationsCount = Math.max(0, totalPossibleCombinations - triedCombinationsCount);

  // Update the UI
  totalCombinations.textContent = totalPossibleCombinations.toLocaleString();
  triedCombinations.textContent = triedCombinationsCount.toLocaleString();
  remainingCombinations.textContent = remainingCombinationsCount.toLocaleString();

  // Update the UI to show if all combinations have been tried
  if (remainingCombinationsCount <= 0 && totalPossibleCombinations > 0) {
    // Add a class to the stats container to show completion
    document.querySelector('.stats-container').classList.add('all-combinations-tried');

    // Update the status display
    if (betStatus) {
      betStatus.textContent = 'Completed';
      betStatus.style.color = '#4CAF50';
    }

    // Disable the start button and enable the stop button
    if (startVariationsBtn) startVariationsBtn.disabled = true;
    if (stopVariationsBtn) stopVariationsBtn.disabled = true;
  } else {
    // Remove the class if not all combinations have been tried
    document.querySelector('.stats-container').classList.remove('all-combinations-tried');
  }
}

// Helper function to calculate combinations C(n,k)
function calculateCombinations(n, k) {
  // If k is greater than n, return 0
  if (k > n) return 0;

  // If k is 0 or equal to n, return 1
  if (k === 0 || k === n) return 1;

  // Use the symmetry of combinations: C(n,k) = C(n,n-k)
  if (k > n - k) k = n - k;

  // Calculate C(n,k) using a more numerically stable method
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result *= (n - (i - 1));
    result /= i;
  }

  return Math.round(result);
}

// Render confirmed matches
function renderConfirmedMatches(matches) {
  // Sort matches by timestamp (newest first)
  matches.sort((a, b) => b.timestamp - a.timestamp);

  // Clear container
  confirmedMatchesContainer.innerHTML = '';

  // Add each match
  matches.forEach(match => {
    const matchCard = document.createElement('div');
    matchCard.className = 'match-card';
    matchCard.dataset.matchId = match.matchId;

    // Format date
    const date = new Date(match.timestamp);
    const formattedDate = date.toLocaleString();

    // Determine favorite status class and text
    const favoriteClass = match.isFavorite ? 'favorite' : 'underdog';
    const favoriteText = match.isFavorite ? 'Favorite' : 'Underdog';

    // Determine live status class and text
    const liveClass = match.isLive ? 'live' : '';
    const liveText = match.isLive ? '<span class="live-badge">LIVE</span>' : '';

    // Get opponent team name from the match data or determine it
    let opponentTeam = match.opponentTeam || '';

    // If opponentTeam is not available in the match data, try to determine it
    if (!opponentTeam) {
      if (match.selectedTeam === match.team1) {
        opponentTeam = match.team2;
      } else if (match.selectedTeam === match.team2) {
        opponentTeam = match.team1;
      } else {
        opponentTeam = 'Unknown Opponent';
      }
    }

    matchCard.innerHTML = `
      <div class="match-header ${liveClass}">
        <div class="match-tournament">${match.tournament}</div>
        <div class="match-time">${match.timeInfo} ${liveText}</div>
      </div>
      <div class="match-teams">${match.team1} vs ${match.team2}</div>
      <div class="match-selection ${favoriteClass}">
        <div class="selection-details">
          <div class="match-competitors">
            <div class="selection-team">Your Pick: <strong>${match.selectedTeam}</strong></div>
            <div class="opponent-team">Opponent: <strong>${opponentTeam}</strong></div>
          </div>
          <div class="selection-status">${favoriteText}</div>
        </div>
        <div class="selection-odds">${match.odds}</div>
      </div>
      <div class="odds-comparison">
        <div class="your-odds">Your Pick (${match.selectedTeam.split('/')[0]}): <strong>${match.odds}</strong></div>
        <div class="opponent-odds">Opponent (${opponentTeam.split('/')[0]}): <strong>${match.otherTeamOdds || 'N/A'}</strong></div>
      </div>
      <div class="match-timestamp">Selected: ${formattedDate}</div>
    `;

    // Add to container
    confirmedMatchesContainer.appendChild(matchCard);
  });
}

// Render bet history
function renderBetHistory(history) {
  // Sort history by timestamp (newest first)
  history.sort((a, b) => b.timestamp - a.timestamp);

  // Clear container
  betHistoryContainer.innerHTML = '';

  // Add each bet
  history.forEach(bet => {
    const betCard = document.createElement('div');
    betCard.className = 'bet-card';
    betCard.dataset.betId = bet.betId;

    // Format date
    const date = new Date(bet.timestamp);
    const formattedDate = date.toLocaleString();

    // Determine result class and text
    let resultClass = 'pending';
    let resultText = 'Pending';

    if (bet.result === 'win') {
      resultClass = 'win';
      resultText = 'Win';
    } else if (bet.result === 'loss') {
      resultClass = 'loss';
      resultText = 'Loss';
    }

    // Count favorites and underdogs in this bet
    const favoriteCount = bet.matches.filter(m => m.isFavorite).length;
    const underdogCount = bet.matches.length - favoriteCount;

    betCard.innerHTML = `
      <div class="bet-header">
        <div class="bet-id">Bet #${bet.betId}</div>
        <div class="bet-time">${bet.variationType}</div>
      </div>
      <div class="bet-selection-summary">
        <div class="selection-count">Selected ${bet.matches.length} players: ${favoriteCount} favorites, ${underdogCount} underdogs</div>
      </div>
      <div class="bet-teams">
        ${bet.matches.map(m => {
          const team1Class = m.selectedTeam === m.team1 ? 'selected-team' : '';
          const team2Class = m.selectedTeam === m.team2 ? 'selected-team' : '';
          const favoriteClass = m.isFavorite ? 'favorite-pick' : 'underdog-pick';
          const favoriteLabel = m.isFavorite ? 'Favorite' : 'Underdog';
          return `<div class="bet-match ${favoriteClass}">
            <span class="match-teams-container">
              <span class="${team1Class}">${m.team1 || 'Team 1'}</span> vs <span class="${team2Class}">${m.team2 || 'Team 2'}</span>
            </span>
            <div class="match-selection-details">
              <span class="match-selection-info">Selected: ${m.selectedTeam || 'Unknown'} (${m.odds || '1.0'})</span>
              <span class="match-favorite-status">${favoriteLabel}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="bet-details">
        <div class="bet-stake">Stake: <strong>$${bet.stake.toFixed(2)}</strong></div>
        <div class="bet-variation">Type: <strong>Random Selection</strong></div>
      </div>
      <div class="bet-result ${resultClass}">
        <div class="bet-result-details">
          <div class="bet-result-status">Result: <strong>${resultText}</strong></div>
          <div class="bet-result-info">
            <div>Stake: <strong>$${bet.stake.toFixed(2)}</strong></div>
            <div>Potential Return: <strong>$${bet.potentialReturn.toFixed(2)}</strong></div>
            <div>Profit if Win: <strong>$${(bet.potentialReturn - bet.stake).toFixed(2)}</strong></div>
          </div>
        </div>
      </div>
      <div class="bet-timestamp">Placed: ${formattedDate}</div>
    `;

    // Add to container
    betHistoryContainer.appendChild(betCard);
  });
}

// Start bet variations
async function startBetVariations() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot start variations');
      alert('Extension context invalid. Please refresh the page.');
      return;
    }

    // Get confirmed matches and stake
    const result = await chrome.storage.local.get(['confirmedMatches', 'stakeAmount']);
    const matches = result.confirmedMatches || [];
    const stake = result.stakeAmount || 0;

    if (matches.length === 0) {
      alert('No confirmed matches to place bets on.');
      return;
    }

    if (stake <= 0) {
      alert('Please set a valid stake amount.');
      return;
    }

    // Set bet variation active
    await chrome.storage.local.set({
      betVariationActive: true,
      lastVariationIndex: -1 // Reset to start from the first variation
    });

    // Notify background script to start bet variations
    chrome.runtime.sendMessage({
      action: 'startBetVariations',
      matches: matches,
      stake: stake
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error sending start variations message:', chrome.runtime.lastError);
        alert('Error starting bet variations. Please try again.');
        return;
      }

      // Update UI
      loadBetData();
    });
  } catch (error) {
    console.error('Error starting bet variations:', error);
    alert('Error starting bet variations. Please try again.');
  }
}

// Stop bet variations
async function stopBetVariations() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot stop variations');
      alert('Extension context invalid. Please refresh the page.');
      return;
    }

    // Set bet variation inactive
    await chrome.storage.local.set({ betVariationActive: false });

    // Notify background script to stop bet variations
    chrome.runtime.sendMessage({
      action: 'stopBetVariations'
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error sending stop variations message:', chrome.runtime.lastError);
        alert('Error stopping bet variations. Please try again.');
        return;
      }

      // Update UI
      loadBetData();
    });
  } catch (error) {
    console.error('Error stopping bet variations:', error);
    alert('Error stopping bet variations. Please try again.');
  }
}

// Clear bet history
async function clearBetHistory() {
  if (!confirm('Are you sure you want to clear all bet history?')) {
    return;
  }

  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot clear history');
      alert('Extension context invalid. Please refresh the page.');
      return;
    }

    // Clear bet history and previous selections in storage
    await chrome.storage.local.set({
      betHistory: [],
      previousSelections: []
    });

    // Update UI
    loadBetData();
  } catch (error) {
    console.error('Error clearing bet history:', error);
    alert('Error clearing bet history. Please try again.');
  }
}
