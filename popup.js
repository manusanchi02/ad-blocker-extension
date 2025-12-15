// Load and display the ad counter
chrome.storage.local.get(['adsBlocked'], function(result) {
    const count = result.adsBlocked || 0;
    document.getElementById('counter').textContent = count;
});

// Load and set the ad blocking toggle state
chrome.storage.local.get(['adBlockingEnabled'], function(result) {
    const isEnabled = result.adBlockingEnabled !== false;
    document.getElementById('toggleBlocking').checked = isEnabled;
});

// Ad blocking toggle functionality
document.getElementById('toggleBlocking').addEventListener('change', function() {
    const isEnabled = this.checked;
    chrome.storage.local.set({ adBlockingEnabled: isEnabled });
});

// Load and set the video ad blocking toggle state
chrome.storage.local.get(['videoAdBlockingEnabled'], function(result) {
    const isEnabled = result.videoAdBlockingEnabled === true;
    document.getElementById('toggleVideoBlocking').checked = isEnabled;
});

// Video ad blocking toggle functionality
document.getElementById('toggleVideoBlocking').addEventListener('change', function() {
    const isEnabled = this.checked;
    chrome.storage.local.set({ videoAdBlockingEnabled: isEnabled });
});

// Reset button functionality
document.getElementById('reset').addEventListener('click', function() {
    chrome.storage.local.set({ adsBlocked: 0 }, function() {
        document.getElementById('counter').textContent = '0';
    });
});




