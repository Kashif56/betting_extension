// DOM Elements
const matchesContainer = document.getElementById('matchesContainer');
const noMatchesElement = document.getElementById('noMatches');
const refreshBtn = document.getElementById('refreshBtn');
const clearBtn = document.getElementById('clearBtn');
const backBtn = document.getElementById('backBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSelectedMatches();

  // Set up event listeners
  refreshBtn.addEventListener('click', loadSelectedMatches);
  clearBtn.addEventListener('click', clearAllMatches);
  backBtn.addEventListener('click', () => {
    window.close();
  });
});

// Load selected matches from storage
async function loadSelectedMatches() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot load matches');
      matchesContainer.innerHTML = '<div class="error">Extension context invalid. Please refresh the page.</div>';
      return;
    }

    // Show loading state
    matchesContainer.innerHTML = '<div class="loading">Loading selected matches...</div>';

    // Get matches from storage
    const result = await chrome.storage.local.get(['selectedMatches']);
    const matches = result.selectedMatches || [];

    // Update UI based on matches
    if (matches.length === 0) {
      matchesContainer.innerHTML = '';
      noMatchesElement.style.display = 'block';
    } else {
      noMatchesElement.style.display = 'none';
      renderMatches(matches);
    }
  } catch (error) {
    console.error('Error loading matches:', error);
    matchesContainer.innerHTML = '<div class="error">Error loading matches. Please try again.</div>';
  }
}

// Render matches to the UI
function renderMatches(matches) {
  // Sort matches by timestamp (newest first)
  matches.sort((a, b) => b.timestamp - a.timestamp);

  // Clear container
  matchesContainer.innerHTML = '';

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

    // Get opponent team name from the match data or determine it if not available
    let opponentTeam = match.opponentTeam || '';

    // If opponentTeam is not available in the match data, try to determine it
    if (!opponentTeam) {
      if (match.selectedTeam === match.team1) {
        opponentTeam = match.team2;
      } else if (match.selectedTeam === match.team2) {
        opponentTeam = match.team1;
      } else {
        // If for some reason the selected team doesn't match either team1 or team2
        // This could happen if the DOM structure changes on the betting site
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
      <button class="btn danger remove-match" data-match-id="${match.matchId}">Remove</button>
    `;

    // Add to container
    matchesContainer.appendChild(matchCard);

    // Add event listener for remove button
    const removeBtn = matchCard.querySelector('.remove-match');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeMatch(match.matchId);
    });
  });
}

// Remove a single match
async function removeMatch(matchId) {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot remove match');
      alert('Extension context invalid. Please refresh the page.');
      return;
    }

    // Get current matches
    const result = await chrome.storage.local.get(['selectedMatches']);
    let matches = result.selectedMatches || [];

    // Filter out the match to remove
    matches = matches.filter(match => match.matchId !== matchId);

    // Save back to storage
    await chrome.storage.local.set({ selectedMatches: matches });

    // Update UI
    if (matches.length === 0) {
      matchesContainer.innerHTML = '';
      noMatchesElement.style.display = 'block';
    } else {
      // Remove just this card from the DOM
      const card = document.querySelector(`.match-card[data-match-id="${matchId}"]`);
      if (card) {
        card.remove();
      }
    }

    // Notify background script about the update with error handling
    try {
      chrome.runtime.sendMessage({
        action: 'matchesUpdated',
        matches: matches
      }, () => {
        if (chrome.runtime.lastError) {
          console.log('Background connection error:', chrome.runtime.lastError.message);
        }
      });
    } catch (msgError) {
      console.log('Error sending message to background:', msgError);
    }
  } catch (error) {
    console.error('Error removing match:', error);
    alert('Error removing match. Please try again.');
  }
}

// Clear all matches
async function clearAllMatches() {
  if (!confirm('Are you sure you want to clear all selected matches?')) {
    return;
  }

  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, cannot clear matches');
      alert('Extension context invalid. Please refresh the page.');
      return;
    }

    // Clear matches in storage
    await chrome.storage.local.set({ selectedMatches: [] });

    // Update UI
    matchesContainer.innerHTML = '';
    noMatchesElement.style.display = 'block';

    // Notify background script about the update with error handling
    try {
      chrome.runtime.sendMessage({
        action: 'matchesUpdated',
        matches: []
      }, () => {
        if (chrome.runtime.lastError) {
          console.log('Background connection error:', chrome.runtime.lastError.message);
        }
      });
    } catch (msgError) {
      console.log('Error sending message to background:', msgError);
    }
  } catch (error) {
    console.error('Error clearing matches:', error);
    alert('Error clearing matches. Please try again.');
  }
}
