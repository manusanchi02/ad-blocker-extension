// Isolated-world companion of popup-guard-main.js: passes the toggle state in, and counts blocks
function applyGuardState() {
    chrome.storage.local.get(['extensionEnabled', 'adBlockingEnabled'], function (result) {
        const on = result.extensionEnabled !== false && result.adBlockingEnabled !== false;
        document.documentElement.setAttribute('data-abp-guard', on ? 'on' : 'off');
    });
}

applyGuardState();
chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && (changes.extensionEnabled || changes.adBlockingEnabled)) {
        applyGuardState();
    }
});

document.addEventListener('abp-popup-blocked', function () {
    chrome.storage.local.get(['adsBlocked'], function (result) {
        chrome.storage.local.set({ adsBlocked: (result.adsBlocked || 0) + 1 });
    });
});
