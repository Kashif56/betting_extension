// Test script for estimated return check
console.log('Running estimated return check test');

// Function to simulate the estimated return check
function testEstimatedReturnCheck() {
  // Mock the DOM structure with a high estimated return value
  const mockBetSlip = document.createElement('div');
  mockBetSlip.id = 'betslip-container';
  mockBetSlip.innerHTML = `
    <div class="sc-hmjpVf iSRISB">
      <span color="#ffffff" font-size="4xl" class="sc-gsDKAQ cIShPR">Total Stake:&nbsp;<span><strong>$10.00</strong></span></span>
      <span font-size="lg" color="#beff85" class="sc-gsDKAQ dDmkEU">Est. Return:&nbsp;
        <span>
          <strong>$300,000.00</strong>
        </span>
      </span>
    </div>
    <div class="sc-hKwDye fhFVbq">
      <button type="button" data-testid="betslip-place-bet">Place Bets</button>
    </div>
  `;

  // Add the mock bet slip to the document
  document.body.appendChild(mockBetSlip);

  // Import the getEstimatedReturn function from content.js
  // Note: In a real test, you would need to import this function properly
  // For this demo, we'll assume it's available globally
  if (typeof getEstimatedReturn === 'function') {
    const estimatedReturn = getEstimatedReturn();
    console.log(`Estimated return: $${estimatedReturn}`);

    // Check if the value exceeds the threshold
    const threshold = 250000; // Same as in content.js
    if (estimatedReturn > threshold) {
      console.log(`Estimated return exceeds threshold of $${threshold}`);
      console.log('Bet would be skipped');
    } else {
      console.log(`Estimated return is below threshold of $${threshold}`);
      console.log('Bet would be placed');
    }
  } else {
    console.error('getEstimatedReturn function not available');
  }

  // Clean up
  document.body.removeChild(mockBetSlip);
}

// Function to test with a lower threshold
function testWithLowerThreshold() {
  // Mock the DOM structure with a very small estimated return value
  const mockBetSlip = document.createElement('div');
  mockBetSlip.id = 'betslip-container';
  mockBetSlip.innerHTML = `
    <div class="sc-hmjpVf iSRISB">
      <span color="#ffffff" font-size="4xl" class="sc-gsDKAQ cIShPR">Total Stake:&nbsp;<span><strong>$10.00</strong></span></span>
      <span font-size="lg" color="#beff85" class="sc-gsDKAQ dDmkEU">Est. Return:&nbsp;
        <span>
          <strong>$0.10</strong>
        </span>
      </span>
    </div>
    <div class="sc-hKwDye fhFVbq">
      <button type="button" data-testid="betslip-place-bet">Place Bets</button>
    </div>
  `;

  // Add the mock bet slip to the document
  document.body.appendChild(mockBetSlip);

  // Override the threshold to an extremely low value for testing
  const originalThreshold = 250000;
  const testThreshold = 0.05; // Extremely low threshold for testing

  console.log(`Original threshold: $${originalThreshold}`);
  console.log(`Test threshold: $${testThreshold}`);

  // Get the estimated return
  if (typeof getEstimatedReturn === 'function') {
    const estimatedReturn = getEstimatedReturn();
    console.log(`Estimated return: $${estimatedReturn}`);

    // Check with the lower threshold
    if (estimatedReturn > testThreshold) {
      console.log(`Estimated return exceeds test threshold of $${testThreshold}`);
      console.log('Bet would be skipped with the lower threshold');
    } else {
      console.log(`Estimated return is below test threshold of $${testThreshold}`);
      console.log('Bet would be placed with the lower threshold');
    }
  } else {
    console.error('getEstimatedReturn function not available');
  }

  // Clean up
  document.body.removeChild(mockBetSlip);
}

// Instructions for running the tests
console.log('To run the tests:');
console.log('1. Open the betting site');
console.log('2. Open the browser console (F12 or right-click > Inspect > Console)');
console.log('3. Copy the getEstimatedReturn function from content.js');
console.log('4. Paste it in the console and press Enter');
console.log('5. Run testEstimatedReturnCheck() to test with the original threshold');
console.log('6. Run testWithLowerThreshold() to test with a lower threshold');

// Export the test functions
window.testEstimatedReturnCheck = testEstimatedReturnCheck;
window.testWithLowerThreshold = testWithLowerThreshold;
