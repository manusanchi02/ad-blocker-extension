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

chrome.tabs.onCreated.addListener((tab) => {
    if (tab.openerTabId) {
        tabOpeners.set(tab.id, tab.openerTabId);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo.url) return;
    if (tabOpeners.get(tabId).url.contains('#google-vignette')) {
        chrome.tabs.update(tabId, { url: changeInfo.url.replace('#google_vignette', '') });
        return;
    }
    chrome.storage.local.get(['openInNewTab'], (result) => {
        const blockingEnabled = result.openInNewTab === true;
        if (!blockingEnabled) {
            tabOpeners.delete(tabId);
            return;
        }
        const openerTabId = tabOpeners.get(tabId);
        if (openerTabId) {
            chrome.tabs.get(openerTabId, (openerTab) => {
                if (chrome.runtime.lastError) {
                    tabOpeners.delete(tabId);
                    return;
                }
                const openerDomain = getDomain(openerTab.url);
                const newDomain = getDomain(changeInfo.url);
                if (!areDomainsSimilar(openerDomain, newDomain)) {
                    console.log(`Blocking new tab: ${newDomain} (opened from ${openerDomain})`);
                    chrome.tabs.remove(tabId);
                    chrome.storage.local.get(['adsBlocked'], (result) => {
                        const currentCount = result.adsBlocked || 0;
                        chrome.storage.local.set({ adsBlocked: currentCount + 1 });
                    });
                }
                tabOpeners.delete(tabId);
            });
        }
    });
});

chrome.tabs.onRemoved.addListener((tabId) => {
    tabOpeners.delete(tabId);
});
