# Betting Bot Extension

A browser extension for automating betting on sports matches, specifically designed for tennis matches on Ladbrokes.

## Features

- Automatically track selected matches
- Place multiple types of bets
- Reselect matches with different players automatically
- Support for various betting strategies
- Customizable stake amounts

## New Feature: Smart Player Selection Strategy (60/40 Ratio)

The extension now supports sophisticated betting with a balanced player selection strategy:

1. Captures your manually selected matches
2. Automatically selects players using a 60% favorites / 40% underdogs ratio
3. Places bets with your specified stake amount
4. Repeats the process with new player combinations for multiple bets

### How to Use Auto Betting

1. Manually select your desired matches by clicking on players
2. Enter your desired stake amount (default: 0.10 USD)
3. Click the "Start Auto Betting" button
4. The bot will automatically:
   - Clear your current selections
   - Select players using the 60/40 ratio strategy
   - Navigate to the MultiBet section
   - Enter your stake amount
   - Place the bet
   - Repeat the process with different combinations (up to 5 times by default)

## Getting Started

1. Install the extension
2. Navigate to a tennis betting page
3. Select your matches
4. Configure your betting preferences
5. Start the bot to automate your betting process

## Development

To develop or modify this extension:

1. Clone the repository
2. Install dependencies with `npm install`
3. Make your changes
4. Load the unpacked extension in Chrome

## Implemented Betting Strategies

The extension now implements the following approaches:

1. **Opposite Player Selection**: Simple and direct, selects the opposite player
2. **Favorites/Underdogs Ratio (ACTIVE)**: More sophisticated strategy maintaining a 60% favorites and 40% underdogs ratio for optimal betting patterns
3. **Machine Learning-Based**: Advanced approach using historical data (future development)

## License

MIT License
