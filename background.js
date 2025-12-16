// Background script to handle tab blocking

// Function to extract domain from URL
function getDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        return null;
    }
}

// Function to check if two domains are similar
function areDomainsSimilar(domain1, domain2) {
    if (!domain1 || !domain2) return false;
    
    // Exact match
    if (domain1 === domain2) return true;
    
    // Remove 'www.' prefix for comparison
    const cleanDomain1 = domain1.replace(/^www\./, '');
    const cleanDomain2 = domain2.replace(/^www\./, '');
    
    if (cleanDomain1 === cleanDomain2) return true;
    
    // Check if they share the same root domain (e.g., news.google.com and mail.google.com)
    const parts1 = cleanDomain1.split('.');
    const parts2 = cleanDomain2.split('.');
    
    // Get the last two parts (root domain)
    if (parts1.length >= 2 && parts2.length >= 2) {
        const root1 = parts1.slice(-2).join('.');
        const root2 = parts2.slice(-2).join('.');
        return root1 === root2;
    }
    
    return false;
}

// Store the opener tab ID for each new tab
const tabOpeners = new Map();

// Listen for new tabs being created
chrome.tabs.onCreated.addListener((tab) => {
    if (tab.openerTabId) {
        tabOpeners.set(tab.id, tab.openerTabId);
    }
});

// Listen for tab updates (when URL is set)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only check when the URL changes
    if (!changeInfo.url) return;
    
    // Check if this tab has an opener and if tab blocking is enabled
    chrome.storage.local.get(['openInNewTab'], (result) => {
        const blockingEnabled = result.openInNewTab === true;
        
        if (!blockingEnabled) {
            tabOpeners.delete(tabId);
            return;
        }
        
        const openerTabId = tabOpeners.get(tabId);
        
        if (openerTabId) {
            // Get the opener tab's URL
            chrome.tabs.get(openerTabId, (openerTab) => {
                if (chrome.runtime.lastError) {
                    // Opener tab doesn't exist anymore
                    tabOpeners.delete(tabId);
                    return;
                }
                
                const openerDomain = getDomain(openerTab.url);
                const newDomain = getDomain(changeInfo.url);
                
                // If domains are not similar, close the tab
                if (!areDomainsSimilar(openerDomain, newDomain)) {
                    console.log(`Blocking new tab: ${newDomain} (opened from ${openerDomain})`);
                    chrome.tabs.remove(tabId);
                    
                    // Update blocked ads counter
                    chrome.storage.local.get(['adsBlocked'], (result) => {
                        const currentCount = result.adsBlocked || 0;
                        chrome.storage.local.set({ adsBlocked: currentCount + 1 });
                    });
                }
                
                // Clean up the map
                tabOpeners.delete(tabId);
            });
        }
    });
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    tabOpeners.delete(tabId);
});
