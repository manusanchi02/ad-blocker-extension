// Gets the ad selectors from GitHub (with cache) and removes matching elements from the DOM
let specificSelectors = [];
let genericSelectors = [];

// Run blockAds only while the master switch and the Ad Blocking toggle are both on
function runIfEnabled() {
    chrome.storage.local.get(['extensionEnabled', 'adBlockingEnabled'], function (result) {
        if (result.extensionEnabled !== false && result.adBlockingEnabled !== false) {
            blockAds();
        }
    });
}

// Function to fetch selectors from GitHub with caching
getSelectors().then(data => {
    specificSelectors = data.specific || [];
    genericSelectors = data.generic || [];
    runIfEnabled();
}).catch(error => {
    console.error('Errore nel caricamento dei selettori:', error);
    specificSelectors = [];
    genericSelectors = [];
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

// Elements that look like consent/cookie overlays (their removal usually leaves the page scroll-locked)
const CONSENT_PATTERN = /cookie|consent|cmp|gdpr|privacy|didomi|onetrust|iubenda|sp_message|cybot|usercentrics|truste|osano/i;
const SCROLL_LOCK_CLASSES = [
    'modal-open', 'no-scroll', 'noscroll', 'no-scrolling', 'overflow-hidden', 'scroll-lock', 'is-locked',
    'sp-message-open', 'didomi-popup-open', 'ot-no-scroll', 'cookie-modal-open', 'cmp-open'
];

function isConsentElement(element) {
    return CONSENT_PATTERN.test(String(element.id) + ' ' + String(element.className));
}

// Restore page scrolling that a removed consent overlay had disabled
function unlockScroll() {
    [document.documentElement, document.body].forEach(el => {
        if (!el) return;
        SCROLL_LOCK_CLASSES.forEach(cls => el.classList.remove(cls));
        const style = getComputedStyle(el);
        if (style.overflow === 'hidden' || style.overflowY === 'hidden') {
            el.style.setProperty('overflow', 'auto', 'important');
        }
        if (el === document.body && style.position === 'fixed') {
            // sites lock the body with position:fixed + negative top; restore the scroll offset
            const scrollY = -(parseInt(el.style.top, 10) || 0);
            el.style.setProperty('position', 'static', 'important');
            el.style.removeProperty('top');
            if (scrollY) window.scrollTo(0, scrollY);
        }
    });
}

// Sites often re-apply the lock right after the banner disappears, so unlock a few times
function scheduleUnlockScroll() {
    unlockScroll();
    [300, 1500].forEach(delay => setTimeout(unlockScroll, delay));
}

function blockAds() {
    let blockedCount = 0;
    let consentRemoved = false;

    // Block specific selectors without validation (known ads/banners)
    specificSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (isConsentElement(element)) {
                    consentRemoved = true;
                }
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

    if (consentRemoved) {
        scheduleUnlockScroll();
    }

    // block video ads if enabled (not on YouTube, where removing <video> breaks the player)
    chrome.storage.local.get(['videoAdBlockingEnabled'], function (result) {
        const videoAdBlockingEnabled = result.videoAdBlockingEnabled === true;
        if (videoAdBlockingEnabled && !/(^|\.)youtube\.com$/.test(location.hostname)) {
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
runIfEnabled();

// Observe DOM changes to block dynamically loaded ads
const observer = new MutationObserver(runIfEnabled);

observer.observe(document.body, {
    childList: true,
    subtree: true
});
