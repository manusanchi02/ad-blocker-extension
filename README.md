# Ad Blocker Extension

A lightweight and efficient browser extension that blocks ads, banners, and unwanted content across websites.

## 🚀 Features

- **Automatic Ad Blocking**: Removes ads, banners, and sponsored content from web pages
- **Smart Detection**: Uses both specific and generic CSS selectors to identify and remove ads
- **Video Ad Blocking**: Optional feature to block video advertisements
- **Cookie Banner Removal**: Automatically removes annoying cookie consent banners
- **Content Preservation**: Intelligent filtering to avoid blocking legitimate content like forms and interactive elements
- **Ad Counter**: Tracks the number of ads blocked during your browsing session
- **Toggle Controls**: Easy on/off switches for general ad blocking and video ad blocking
- **Reset Counter**: Reset the blocked ads counter at any time
- **Lightweight**: Minimal performance impact on your browsing experience

## 📋 Requirements

- Chrome or Chromium-based browser (Edge, Brave, Opera, etc.)
- Manifest V3 support

## 🔧 Installation

### Install from Source

1. Clone or download this repository:
   ```bash
   git clone https://github.com/manusanchi02/ad-blocker-extension.git
   ```

2. Open your Chrome browser and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in the top right corner)

4. Click **Load unpacked**

5. Select the folder containing the extension files

6. The Ad Blocker extension is now installed and active!

## 📁 Project Structure

```
ad-blocker-extension/
├── manifest.json         # Extension configuration
├── ad-block.js           # Main content script for ad blocking logic
├── ad-block.html         # Popup HTML interface
├── popup.js              # Popup functionality and controls
├── ad-selectors.json     # CSS selectors for ad detection
└── README.md             # Project documentation
```

## 🎯 How It Works

### Ad Detection

The extension uses two types of selectors:

1. **Specific Selectors** (`ad-selectors.json`): Targets known ad platforms and services
   - Google Ads
   - DoubleClick
   - Cookie consent banners (Iubenda, OneTrust)
   - Known ad containers

2. **Generic Selectors**: Identifies common ad-related class names and IDs
   - Elements with "ad", "advertisement", "sponsored" keywords
   - Banner containers and ad wrappers
   - With validation to avoid blocking legitimate content

### Content Preservation

The extension includes smart filtering to avoid blocking:
- Form elements (inputs, buttons, textareas)
- Interactive UI components
- Main content areas
- Navigation elements
- Accessibility elements with role attributes

### Video Ad Blocking

Optional feature that can be enabled via the popup interface to remove video content that may contain advertisements.

## 🎨 Usage

### Popup Interface

Click the extension icon to access the control panel:

- **Ad Counter**: Displays the total number of ads blocked in the current session
- **Toggle Ad Blocking**: Enable/disable general ad blocking
- **Toggle Video Blocking**: Enable/disable video ad blocking
- **Reset Counter**: Reset the blocked ads counter to 0

### Customization

You can customize the ad blocking by editing [ad-selectors.json](ad-selectors.json):

```json
{
  "specific": [
    // Add specific selectors for known ad platforms
    "#specific-ad-id",
    ".specific-ad-class"
  ],
  "generic": [
    // Add generic patterns for ad detection
    ".your-custom-ad-class"
  ]
}
```

## ⚙️ Permissions

The extension requires the following permissions:

- **activeTab**: To access and modify the current tab's content
- **storage**: To save preferences and ad counter data

## 🛠️ Development

### Modifying Ad Selectors

1. Open [ad-selectors.json](ad-selectors.json)
2. Add or remove CSS selectors as needed
3. Reload the extension in `chrome://extensions/`

### Testing

1. Load the extension in developer mode
2. Navigate to websites with ads
3. Open the popup to check the blocked ads counter
4. Use browser DevTools to inspect blocked elements

## 📝 Known Limitations

- Some sophisticated ad platforms may bypass the blocking
- Certain dynamic ads loaded via JavaScript may require page refresh
- Video blocking is aggressive and may affect legitimate video content

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit your changes: `git commit -m 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👤 Author

**Emanuele Sanchi (manusanchi)**

## 🙏 Acknowledgments

- Inspired by popular ad blocking solutions
- Built with Manifest V3 for modern browser compatibility

## 📧 Support

If you encounter any issues or have suggestions, please open an issue on the GitHub repository.
