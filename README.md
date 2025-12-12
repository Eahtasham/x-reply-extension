# X AI Reply Bot

A Chrome extension that automatically generates and posts AI-powered replies to X (formerly Twitter) posts using Google Gemini.

## Features

- **AI-Powered Replies**: Generate contextually relevant replies using Google's Gemini AI
- **Multiple Tones**: Choose from witty, helpful, professional, funny, or supportive reply styles
- **Smart Filtering**: Filter posts by keywords or specific accounts
- **Manual Control**: Review and approve each reply before posting
- **Seamless Integration**: Works directly on X.com and Twitter.com pages

## Installation

### Chrome/Edge
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension should now appear in your extensions list

### Firefox
1. Download or clone this repository
2. Open Firefox and go to `about:debugging`
3. Click "This Firefox" in the sidebar
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file from the extension folder

## Setup

1. **Get a Gemini API Key**:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the API key

2. **Configure the Extension**:
   - Click the extension icon in your browser toolbar
   - Enter your Gemini API key in the "Gemini API Key" field
   - Click "Save API Key"

3. **Customize Settings** (Optional):
   - Choose your preferred reply tone
   - Enable keyword filtering to only reply to posts containing specific words
   - Enable account filtering to only reply to specific users
   - Save your settings

## Usage

1. Navigate to [X.com](https://x.com) or [Twitter.com](https://twitter.com)
2. Click the X AI Reply Bot extension icon
3. The popup will show recent posts from your feed
4. Click "Generate Reply" on any post you want to respond to
5. The extension will:
   - Generate an AI reply based on the post content and your chosen tone
   - Automatically open the reply modal
   - Insert the generated reply
   - Post the reply

## Configuration Options

### Reply Tones
- **Witty**: Clever and engaging responses
- **Helpful**: Informative and supportive replies
- **Professional**: Respectful and business-appropriate
- **Funny**: Humorous and entertaining
- **Supportive**: Encouraging and positive

### Filtering
- **Keywords**: Only show posts containing specific words or phrases
- **Accounts**: Only show posts from specific users

## Permissions

The extension requires the following permissions:
- `scripting`: To interact with X/Twitter pages
- `activeTab`: To access the current tab
- `storage`: To save your API key and settings
- Host permissions for `https://x.com/*` and `https://twitter.com/*`

## Privacy

- Your Gemini API key is stored locally in your browser's storage
- No data is sent to external servers except for API calls to Google's Gemini service
- All processing happens locally on your device

## Troubleshooting

### "Please open this extension on X.com or Twitter.com"
- Make sure you're on x.com or twitter.com
- Try refreshing the page

### "Error loading posts"
- Ensure you're logged into X/Twitter
- Try scrolling down to load more posts
- Refresh the page

### "Gemini API error"
- Verify your API key is correct
- Check your internet connection
- Ensure your Gemini API quota hasn't been exceeded

### Reply not posting
- The extension simulates user interactions, but X's UI may change
- Try again or refresh the page
- Check if you have posting permissions on X

## Development

### Project Structure
```
x-reply-extension/
├── manifest.json      # Extension manifest
├── popup.html         # Extension popup UI
├── popup.js           # Popup functionality
├── popup.css          # Popup styling
├── content.js         # Content script for X/Twitter pages
└── images/            # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Building
No build process required - this is a pure JavaScript extension.

### Contributing
1. Fork the repository
2. Make your changes
3. Test thoroughly on X.com
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Disclaimer

This extension is for educational and personal use. Please use responsibly and respect X/Twitter's terms of service. Automated posting may violate platform policies if used excessively
