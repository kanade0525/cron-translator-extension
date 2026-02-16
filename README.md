# Cron Expression Translator Chrome Extension

A Chrome extension that automatically detects and translates cron expressions on any website into human-readable format.

## Features

- 🔍 **Automatic Detection**: Finds cron expressions on any webpage
- 💬 **Human-Readable Translation**: Converts cron syntax to plain English
- 🎯 **Smart Highlighting**: Highlights detected cron expressions
- ⚙️ **Customizable Display**: Choose between tooltip or inline translations
- 🚫 **Domain Exclusion**: Exclude specific websites from translation
- ☕ **Support the Developer**: Buy Me a Coffee integration

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

## Usage

- The extension automatically detects cron expressions on any webpage
- Hover over highlighted expressions to see translations
- Click the extension icon to toggle on/off
- Access settings to customize behavior and exclude domains

## Buy Me a Coffee Setup

To enable Buy Me a Coffee donations:

1. Create an account at [buymeacoffee.com](https://www.buymeacoffee.com)
2. Edit `popup.js` and `options.js`
3. Replace `YOUR_USERNAME` with your Buy Me a Coffee username

## Examples of Detected Patterns

- `0 0 * * *` → "Runs at 00:00 every day"
- `*/5 * * * *` → "Runs every 5 minutes"
- `0 9-17 * * MON-FRI` → "Runs at minute 0 from 9 to 17 on Monday through Friday"

## Development

### File Structure

- `manifest.json` - Extension configuration
- `content.js` - Main translation logic
- `background.js` - Background service worker
- `popup.html/js/css` - Extension popup interface
- `options.html/js/css` - Settings page
- `styles.css` - Injected styles for translations

### Testing

1. Make changes to the code
2. Go to `chrome://extensions/`
3. Click the refresh button on the extension card
4. Test on websites with cron expressions

## License

MIT