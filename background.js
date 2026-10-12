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
 * Check if blocking is enabled: the master switch (extensionEnabled) and the Ad Blocking toggle must both be on
 * @param {function(boolean): void} callback
 */
function isBlockingEnabled(callback) {
    chrome.storage.local.get(['extensionEnabled', 'adBlockingEnabled'], (result) => {
        callback(result.extensionEnabled !== false && result.adBlockingEnabled !== false);
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
    if (area === 'local' && (changes.adBlockingEnabled || changes.extensionEnabled)) syncTrackerRuleset();
});

// New windows are always ad popups: closed unless the URL is on POPUP_ALLOWLIST (or the extension is off)
const handledWindows = new Set();

function checkNewWindow(windowId, attempt = 0) {
    if (handledWindows.has(windowId)) return;
    isBlockingEnabled((enabled) => {
        if (!enabled) return;
        chrome.windows.get(windowId, { populate: true }, (win) => {
            if (chrome.runtime.lastError || !win) return;
            if (win.type !== 'popup' && win.type !== 'normal') return; // devtools, app
            // Only ever judge brand-new windows holding a single tab, never a window with your own tabs
            if (!win.tabs || win.tabs.length !== 1) return;
            const tab = win.tabs[0];
            const url = tab.pendingUrl || tab.url || '';

            // A "normal" window is only suspicious when a script just opened it from another tab
            // (a loading tab with an opener; a tab dragged out of a window is already complete)
            if (win.type === 'normal' && (!tab.openerTabId || tab.status !== 'loading')) return;

            // The URL may not be known yet: look again shortly before deciding
            if (!url && attempt < 2) {
                setTimeout(() => checkNewWindow(windowId, attempt + 1), 400);
                return;
            }
            if (isAllowedPopupUrl(url)) return;

            handledWindows.add(windowId);
            console.log(`Blocking new window (${win.type}): ${url || 'about:blank'}`);
            chrome.windows.remove(windowId, () => {
                if (chrome.runtime.lastError) {
                    console.warn('Could not close window:', chrome.runtime.lastError.message);
                    return;
                }
                incrementBlocked();
            });
        });
    });
}

chrome.windows.onCreated.addListener((win) => checkNewWindow(win.id));
chrome.windows.onRemoved.addListener((windowId) => handledWindows.delete(windowId));

chrome.tabs.onCreated.addListener((tab) => {
    if (tab.openerTabId) {
        tabOpeners.set(tab.id, tab.openerTabId);
    }
    // Second safety net: the tab's window may not have been reported by windows.onCreated
    checkNewWindow(tab.windowId);
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

    chrome.storage.local.get(['openInNewTab', 'adBlockingEnabled', 'extensionEnabled'], (result) => {
        const blockingEnabled = result.openInNewTab === true && result.adBlockingEnabled !== false
            && result.extensionEnabled !== false;
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
