// DOM Elements
const logEntriesContainer = document.getElementById('logEntries');
const exportLogBtn = document.getElementById('exportLogBtn');
const clearLogBtn = document.getElementById('clearLogBtn');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load log entries
  await loadLogEntries();

  // Event listeners
  exportLogBtn.addEventListener('click', exportLogToFile);
  clearLogBtn.addEventListener('click', clearAllLogs);
});

// Load log entries from storage
async function loadLogEntries() {
  try {
    const result = await chrome.storage.local.get(['betCombinationLogs']);
    const logs = result.betCombinationLogs || [];
    
    if (logs.length === 0) {
      logEntriesContainer.innerHTML = '<p class="no-logs">No bet combinations have been logged yet.</p>';
      return;
    }

    // Sort logs by timestamp, newest first
    logs.sort((a, b) => b.timestamp - a.timestamp);

    // Clear existing content
    logEntriesContainer.innerHTML = '';

    // Add log entries to the container
    logs.forEach(log => {
      const logEntryElement = createLogEntryElement(log);
      logEntriesContainer.appendChild(logEntryElement);
    });
  } catch (error) {
    console.error('Error loading log entries:', error);
    logEntriesContainer.innerHTML = `<p class="no-logs">Error loading logs: ${error.message}</p>`;
  }
}

// Create a log entry element
function createLogEntryElement(log) {
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  if (log.result === 'win') {
    logEntry.classList.add('win');
  } else if (log.result === 'loss') {
    logEntry.classList.add('loss');
  }

  const logHeader = document.createElement('div');
  logHeader.className = 'log-header';

  const logTitle = document.createElement('h3');
  logTitle.textContent = `${log.variationType} - Stake: $${log.stake}`;
  
  const logTimestamp = document.createElement('span');
  logTimestamp.className = 'log-timestamp';
  logTimestamp.textContent = new Date(log.timestamp).toLocaleString();

  logHeader.appendChild(logTitle);
  logHeader.appendChild(logTimestamp);
  logEntry.appendChild(logHeader);

  // Create matches list
  const matchesList = document.createElement('ul');
  log.selections.forEach(selection => {
    const matchItem = document.createElement('li');
    matchItem.textContent = `${selection.matchName}: ${selection.playerSelected} (${selection.odds})`;
    matchesList.appendChild(matchItem);
  });

  const logDetails = document.createElement('div');
  logDetails.className = 'log-details';
  logDetails.innerHTML = `
    <p><strong>Potential Return:</strong> $${log.potentialReturn.toFixed(2)}</p>
    <p><strong>Selected Players:</strong></p>
  `;
  logDetails.appendChild(matchesList);

  // Add result info if available
  if (log.result) {
    const resultElement = document.createElement('p');
    resultElement.innerHTML = `<strong>Result:</strong> ${log.result === 'win' ? 'Win' : 'Loss'}`;
    if (log.actualReturn) {
      resultElement.innerHTML += ` - Return: $${log.actualReturn.toFixed(2)}`;
    }
    logDetails.appendChild(resultElement);
  }

  logEntry.appendChild(logDetails);
  return logEntry;
}

// Export logs to CSV file
function exportLogToFile() {
  chrome.storage.local.get(['betCombinationLogs'], result => {
    const logs = result.betCombinationLogs || [];
    
    if (logs.length === 0) {
      alert('No logs to export');
      return;
    }
    
    // Create CSV content
    let csvContent = 'Date,Type,Stake,Potential Return,Selections,Result,Actual Return\n';
    
    logs.forEach(log => {
      const date = new Date(log.timestamp).toLocaleString();
      const selections = log.selections.map(s => `${s.matchName}: ${s.playerSelected} (${s.odds})`).join(' | ');
      
      csvContent += `"${date}","${log.variationType}","${log.stake}","${log.potentialReturn.toFixed(2)}","${selections}","${log.result || 'Pending'}","${log.actualReturn ? log.actualReturn.toFixed(2) : ''}"\n`;
    });
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bet-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// Clear all logs
function clearAllLogs() {
  if (confirm('Are you sure you want to clear all bet combination logs?')) {
    chrome.storage.local.set({ betCombinationLogs: [] }, () => {
      loadLogEntries();
    });
  }
}

// Listen for log updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'betLogUpdated') {
    loadLogEntries();
    sendResponse({ status: 'success' });
  }
}); 