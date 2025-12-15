// Gets the ad selectors from a JSON file and removes matching elements from the DOM
let specificSelectors = [];
let genericSelectors = [];

fetch(chrome.runtime.getURL('ad-selectors.json'))
    .then(response => response.json())
    .then(data => {
        specificSelectors = data.specific || [];
        genericSelectors = data.generic || [];
        blockAds();
    });

// Check if an element is likely a legitimate content element
function isLegitimateElement(element) {
    // Skip elements that are part of forms or inputs
    const tagName = element.tagName.toLowerCase();
    if (['input', 'textarea', 'button', 'select', 'form', 'label'].includes(tagName)) {
        return true;
    }

    // Skip if element or parent is a form
    if (element.closest('form')) {
        return true;
    }

    // Skip elements with role attributes (accessibility elements)
    if (element.hasAttribute('role')) {
        return true;
    }

    // Skip main content areas
    const contentRoles = ['main', 'article', 'navigation', 'search'];
    if (element.hasAttribute('role') && contentRoles.includes(element.getAttribute('role'))) {
        return true;
    }

    // Skip if contains interactive elements
    if (element.querySelector('input, textarea, button, select')) {
        return true;
    }

    return false;
}

function blockAds() {
    let blockedCount = 0;

    // Block specific selectors without validation (known ads/banners)
    specificSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.remove();
                blockedCount++;
            });
        } catch (e) {
            console.warn('Selettore non valido:', selector);
        }
    });

    // Block generic selectors with validation
    genericSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // Skip if it's a legitimate content element
                if (isLegitimateElement(element)) {
                    return;
                }

                // Additional validation: check if element looks like an ad
                const rect = element.getBoundingClientRect();
                const hasAdKeywords = /ad|advertisement|sponsor|promo/i.test(element.className + element.id);
                const isIframe = element.tagName.toLowerCase() === 'iframe';
                const hasAdSource = isIframe && /ad|doubleclick|googlesyndication/i.test(element.src || '');

                // Block if it's an ad iframe or has typical ad dimensions with ad keywords
                if (hasAdSource || (hasAdKeywords && rect.width > 0 && rect.height > 0)) {
                    element.remove();
                    blockedCount++;
                }
            });
        } catch (e) {
            console.warn('Selettore non valido:', selector);
        }
    });

    // block video ads if enabled
    chrome.storage.local.get(['videoAdBlockingEnabled'], function (result) {
        const videoAdBlockingEnabled = result.videoAdBlockingEnabled === true;
        if (videoAdBlockingEnabled) {
            const videoAds = document.querySelectorAll('video, [class*="video" i], [id*="video" i], iframe[src*="video" i]');
            videoAds.forEach(video => {
                if (video.pause) {
                    video.pause();
                }
                video.remove();
                blockedCount++;
            });
        }
    });

    // Update the counter in storage
    if (blockedCount > 0) {
        chrome.storage.local.get(['adsBlocked'], function (result) {
            const currentCount = result.adsBlocked || 0;
            chrome.storage.local.set({ adsBlocked: currentCount + blockedCount });
        });
    }
}

// Check if ad blocking is enabled
chrome.storage.local.get(['adBlockingEnabled'], function (result) {
    const adBlockingEnabled = result.adBlockingEnabled !== false;
    if (adBlockingEnabled)
        blockAds();
});

// Observe DOM changes to block dynamically loaded ads
const observer = new MutationObserver(() => {
    chrome.storage.local.get(['adBlockingEnabled'], function (result) {
        const adBlockingEnabled = result.adBlockingEnabled !== false;
        if (adBlockingEnabled)
            blockAds();
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
