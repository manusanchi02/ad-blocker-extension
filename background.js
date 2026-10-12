/**
 * Function to extract domain from a URL
 * @param {URL} url The URL string
 * @returns {string|null} domain or null if invalid URL
 */
function getDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        return null;
    }
}

/**
 * Function to check if two domains are similar
 * @param {string} domain1 first domain
 * @param {string} domain2 second domain
 * @returns {boolean} true if domains are similar, false otherwise
 */
function areDomainsSimilar(domain1, domain2) {
    if (!domain1 || !domain2)
        return false;
    if (domain1 === domain2)
        return true;
    const cleanDomain1 = domain1.replace(/^www\./, '');
    const cleanDomain2 = domain2.replace(/^www\./, '');
    if (cleanDomain1 === cleanDomain2)
        return true;
    const parts1 = cleanDomain1.split('.');
    const parts2 = cleanDomain2.split('.');
    if (parts1.length >= 2 && parts2.length >= 2) {
        const root1 = parts1.slice(-2).join('.');
        const root2 = parts2.slice(-2).join('.');
        return root1 === root2;
    }
    return false;
}

const tabOpeners = new Map();

// Hosts that legitimately open popup windows (login / payment flows)
const POPUP_ALLOWLIST = [
    'accounts.google.com', 'appleid.apple.com', 'login.microsoftonline.com', 'login.live.com',
    'facebook.com', 'github.com', 'paypal.com', 'checkout.stripe.com', 'twitter.com', 'x.com',
    'linkedin.com', 'discord.com', 'slack.com', 'auth0.com', 'okta.com'
];

const RULESET_ID = 'trackers';

/**
 * Check if ad blocking is enabled (main toggle)
 * @param {function(boolean): void} callback
 */
function isBlockingEnabled(callback) {
    chrome.storage.local.get(['adBlockingEnabled'], (result) => {
        callback(result.adBlockingEnabled !== false);
    });
}

function incrementBlocked() {
    chrome.storage.local.get(['adsBlocked'], (result) => {
        chrome.storage.local.set({ adsBlocked: (result.adsBlocked || 0) + 1 });
    });
}

/**
 * Check if a popup window URL is allowed (internal pages and known login/payment hosts)
 * @param {string} url
 * @returns {boolean}
 */
function isAllowedPopupUrl(url) {
    if (!url) return false;
    let urlObj;
    try {
        urlObj = new URL(url);
    } catch (e) {
        return false;
    }
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return true;
    return POPUP_ALLOWLIST.some(host => urlObj.hostname === host || urlObj.hostname.endsWith('.' + host));
}

/**
 * Keep the tracker network ruleset in sync with the main toggle
 */
function syncTrackerRuleset() {
    isBlockingEnabled((enabled) => {
        chrome.declarativeNetRequest.updateEnabledRulesets(
            enabled ? { enableRulesetIds: [RULESET_ID] } : { disableRulesetIds: [RULESET_ID] }
        );
    });
}

syncTrackerRuleset();
chrome.runtime.onInstalled.addListener(syncTrackerRuleset);
chrome.runtime.onStartup.addListener(syncTrackerRuleset);
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.adBlockingEnabled) syncTrackerRuleset();
});

// Ad popup windows (window.open with features) are always blocked while ad blocking is on
chrome.windows.onCreated.addListener((win) => {
    if (win.type !== 'popup') return;
    isBlockingEnabled((enabled) => {
        if (!enabled) return;
        chrome.windows.get(win.id, { populate: true }, (popup) => {
            if (chrome.runtime.lastError || !popup) return;
            const tab = popup.tabs && popup.tabs[0];
            const url = tab ? (tab.pendingUrl || tab.url || '') : '';
            if (isAllowedPopupUrl(url)) return;
            console.log(`Blocking popup window: ${url || 'about:blank'}`);
            chrome.windows.remove(popup.id, () => {
                if (chrome.runtime.lastError) return;
                incrementBlocked();
            });
        });
    });
});

chrome.tabs.onCreated.addListener((tab) => {
    if (tab.openerTabId) {
        tabOpeners.set(tab.id, tab.openerTabId);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return;

    // Strip the Google vignette (interstitial ad) fragment from the URL
    if (changeInfo.url.includes('#google_vignette')) {
        isBlockingEnabled((enabled) => {
            if (enabled) {
                chrome.tabs.update(tabId, { url: changeInfo.url.replace('#google_vignette', '') });
            }
        });
        return;
    }

    const openerTabId = tabOpeners.get(tabId);
    if (!openerTabId) return;

    chrome.storage.local.get(['openInNewTab', 'adBlockingEnabled'], (result) => {
        const blockingEnabled = result.openInNewTab === true && result.adBlockingEnabled !== false;
        if (!blockingEnabled) {
            tabOpeners.delete(tabId);
            return;
        }
        chrome.tabs.get(openerTabId, (openerTab) => {
            if (chrome.runtime.lastError || !openerTab) {
                tabOpeners.delete(tabId);
                return;
            }
            const openerDomain = getDomain(openerTab.url);
            const newDomain = getDomain(changeInfo.url);
            if (!areDomainsSimilar(openerDomain, newDomain)) {
                console.log(`Blocking new tab: ${newDomain} (opened from ${openerDomain})`);
                chrome.tabs.remove(tabId);
                incrementBlocked();
            }
            tabOpeners.delete(tabId);
        });
    });
});

chrome.tabs.onRemoved.addListener((tabId) => {
    tabOpeners.delete(tabId);
});
