# Betting Bot Automation Project

## Project Overview

This project aims to develop an automated betting bot for **Ladbrokes.com.au** that helps users automatically place bets based on pre-selected matches. The bot will allow users to:
1. Select 20 tennis matches.
2. Automatically place re-bets on these matches with a controlled distribution of **12 favorites** and **8 non-favorites**.
3. Avoid placing bets on live matches and ignore bet combinations if they exceed a specified threshold.

The goal is to automate the betting process, saving time while following a predefined selection strategy.

## Key Features & Functionalities

- **Manual Selection of Matches:**
  - The user will first manually select 20 tennis matches.
  
- **Re-Betting Logic:**
  - Once the user has selected the initial 20 matches, the bot will re-bet on these matches following the selection strategy.
  - **Bet Distribution:** The bot must always select **12 favorites** and **8 non-favorites** from the pre-selected matches.
  
- **Match Status Handling:**
  - If any match becomes live, the bot will automatically skip that match and continue with the remaining non-live matches.
  
- **Bet Limitation:**
  - The bot will stop placing bets if the total estimated bet exceeds **650,000**. It will discard any bet combination that causes the total to exceed this limit.
  
- **Continuous Betting:**
  - The bot will continue placing bets until the user manually stops it.
  
- **Multi-Betting:**
  - The bot will place multiple bets based on combinations of the selected favorites and non-favorites. Each bet will have a unique combination.
  
- **Bet Tracking and Notifications:**
  - The bot will notify the user how many combinations are left to be placed.
  - It will track the total amount being bet and will follow the user's selected bet value (e.g., 10 cents or 1 cent).

- **Browser Compatibility:**
  - The bot will be developed as a Chrome Extension, but it should also work for **Edge** and **Firefox** browsers.

## Algorithm to Focus On

The algorithm for this betting bot needs to handle several core tasks effectively:

### 1. **Match Selection Filtering**
   - **Input:** List of 20 pre-selected matches by the user.
   - **Action:** Ensure that only these 20 matches are used for betting. For each match, the bot will identify the favorites (lower odds) and non-favorites (higher odds).
   - **Logic:** 
     - **Favorites:** Any match where one player has lower odds than their opponent is a favorite.
     - **Non-Favorites:** Matches where the odds are higher for one player compared to the other.

### 2. **Bet Combination Generation**
   - **Input:** 20 selected matches, 12 favorites, and 8 non-favorites.
   - **Action:** The bot will create multiple bet combinations by selecting 12 favorites and 8 non-favorites from the available pool of matches.
   - **Logic:** 
     - For each combination, randomly select the 12 favorites and 8 non-favorites from the matches.
     - Ensure that no combination is repeated.

### 3. **Live Match Handling**
   - **Input:** A status indicator for each match (live or upcoming).
   - **Action:** The bot will continuously check if a match is live.
   - **Logic:** 
     - If a match is live, the bot will skip it and only place bets on upcoming matches.

### 4. **Bet Value Tracking**
   - **Input:** The initial bet value (e.g., 10 cents or 1 cent).
   - **Action:** The bot should follow this value when placing all bets and will repeat it for each combination.
   - **Logic:** 
     - Ensure the selected bet value is consistent across all automated bets.
   
### 5. **Total Bet Limitation**
   - **Input:** A threshold value (250,000).
   - **Action:** Before placing any bet, the bot will calculate the total amount that will be wagered.
   - **Logic:** 
     - If placing the current combination causes the total bet amount to exceed 250,000, the bot will discard that combination and continue with the next one.

### 6. **Continuous Operation**
   - **Input:** User triggers.
   - **Action:** The bot will continue placing bets until the user manually stops it.
   - **Logic:** 
     - The bot will run continuously, ensuring that the user’s selection strategy is followed, and notify the user if any bet exceeds the limit or if there are no more combinations left.

## Technologies & Tools
- Javscript Chrome Extenion

  
## Conclusion

The goal of this project is to create a robust betting bot that automates the re-betting process on Ladbrokes.com.au. The bot will follow the user’s selection strategy while avoiding live matches, ensuring that no combination exceeds the betting limit, and continuously placing bets until manually stopped.

Let me know if any further details are needed or if you have additional requirements.
