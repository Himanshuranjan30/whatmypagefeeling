# What My Page Feeling 😊

A Chrome extension that analyzes webpage content for emotions using Google's Gemini AI and visualizes them with colorful highlights.

## Features

- 🎨 **Clean, modern UI** inspired by top design systems
- 🤖 Powered by Google's Gemini AI for emotion analysis
- 🌈 **Comprehensive color-coding** - ALL text on the webpage gets analyzed and colored
- 🎨 **Soft pastel colors** - Easy on the eyes with subtle, beautiful highlighting
- 😊 Supports multiple emotions: happy, sad, angry, love, fear, neutral, and more
- ⚡ Fast and easy to use with one-click analysis
- 🎯 Every piece of text gets emotion-based coloring, not just selected phrases

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/Himanshuranjan30/whatmypagefeeling.git
   cd whatmypagefeeling
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the `whatmypagefeeling` directory

5. The extension icon should appear in your Chrome toolbar

## Setup

1. Click on the extension icon to open the popup

2. Enter your Gemini API key (Get one from [Google AI Studio](https://makersuite.google.com/app/apikey))

3. Click "Save" to store your API key securely

## Usage

1. Navigate to any webpage you want to analyze

2. Click the extension icon

3. Click the "Analyze Page" button

4. Wait for the analysis to complete

5. The webpage content will be highlighted with soft pastel colors based on detected emotions:
   - 🌼 Light Yellow: Happy content
   - 💧 Light Blue: Sad content
   - 🌸 Light Red: Angry content
   - 💖 Light Pink: Love/affection
   - 🔮 Light Purple: Fear
   - 🌫️ Light Gray: Neutral
   - 🍑 Light Orange: Surprise
   - 🤎 Light Brown: Disgust
   - 🌱 Light Green: Trust
   - 🌹 Light Rose: Anticipation

## Emotion Color Legend

| Emotion | Color |
|---------|-------|
| Happy | Light Yellow (#FFF4B3) |
| Sad | Light Blue (#B3D4F5) |
| Angry | Light Red (#FFB3B3) |
| Love | Light Pink (#FFD6EC) |
| Fear | Light Purple (#D4B3E6) |
| Neutral | Light Gray (#E0E5E6) |
| Surprise | Light Orange (#FFD4A3) |
| Disgust | Light Brown (#D4B3A3) |
| Trust | Light Green (#B3E6B3) |
| Anticipation | Light Rose (#FFB3D4) |

## Technical Details

- **Manifest Version**: 3
- **Permissions**: activeTab, storage, scripting
- **APIs Used**: Google Gemini Pro
- **Technologies**: JavaScript, HTML, CSS

## File Structure

```
whatmypagefeeling/
├── manifest.json           # Extension configuration
├── icons/                  # Extension icons
├── src/
│   ├── popup/             # Popup UI files
│   │   ├── popup.html
│   │   └── popup.js
│   ├── content/           # Content scripts
│   │   └── content.js
│   ├── background/        # Background service worker
│   │   └── background.js
│   └── styles/            # CSS files
│       ├── popup.css
│       └── content.css
└── README.md
```

## Development

To modify the extension:

1. Make your changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## Privacy

- Your Gemini API key is stored locally in Chrome's secure storage
- No data is sent to any server except Google's Gemini API
- The extension only analyzes content when you explicitly click "Analyze Page"

## Troubleshooting

- **Extension not working?** Make sure you've entered a valid Gemini API key
- **No highlights appearing?** Some websites may have restrictive content security policies
- **API errors?** Check your API key and ensure you have quota remaining

## Future Improvements

- [ ] Add more emotion categories
- [ ] Implement sentiment intensity levels
- [ ] Add export functionality for emotion analysis
- [ ] Support for multiple languages
- [ ] Customizable color schemes

## License

MIT License

## Author

Himanshu Ranjan

---

Made with ❤️ and 🤖 AI