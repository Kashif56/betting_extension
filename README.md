# Bot Extension

A browser extension for automation tasks.

## Project Structure

```
bot-extension/
├── manifest.json        # Extension configuration
├── popup/               # Popup UI
│   ├── popup.html       # Popup HTML
│   ├── popup.css        # Popup styles
│   └── popup.js         # Popup functionality
├── background/          # Background scripts
│   └── background.js    # Background service worker
├── content/             # Content scripts
│   └── content.js       # Content script for web pages
├── icons/               # Extension icons
│   ├── icon16.png       # 16x16 icon
│   ├── icon48.png       # 48x48 icon
│   └── icon128.png      # 128x128 icon
└── utils/               # Utility functions
    └── api.js           # API utilities
```

## Development

### Prerequisites

- Chrome, Edge, or another Chromium-based browser

### Installation for Development

1. Open your browser and navigate to the extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`

2. Enable "Developer mode" using the toggle in the top-right corner.

3. Click "Load unpacked" and select the extension directory.

4. The extension should now be installed and visible in your browser toolbar.

### Building for Production

To package the extension for distribution:

1. Zip the entire extension directory.
2. Submit to the Chrome Web Store or other browser extension stores.

## Features

- Start/stop automation from the popup
- Configurable delay between actions
- Background processing
- Content script for interacting with web pages

## Customization

To customize the extension for your specific automation needs:

1. Modify the `performBotAction()` function in `content/content.js` to implement your automation logic.
2. Update the UI in `popup/popup.html` and `popup/popup.css` as needed.
3. Add additional permissions in `manifest.json` if required.

## License

[Your License Here]
