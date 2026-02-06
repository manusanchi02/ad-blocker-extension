const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/manusanchi02/ad-blocker-extension/master/ad-selectors.json';
const CACHE_KEY = 'ad_selectors_cache';
const LAST_UPDATE_KEY = 'ad_selectors_last_update';
const UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

const DEFAULT_SELECTORS = {
    "specific": [
        "#iubenda-cs-banner",
        ".iubenda-cs-container",
        "#onetrust-banner-sdk",
        ".cookie-banner",
        "[id^='google_ads_']",
        "[id^='div-gpt-ad']",
        "iframe[src*='doubleclick']",
        "iframe[src*='googlesyndication']",
        "iframe[src*='adservice']",
        ".dmp_iframe",
        ".qc-cmp2-container",
        "#ez-cookie-dialog-wrapper",
        ".ez-cookie-dialog-wrapper",
        "#ez-cmpv2-container",
        ".ez-cmpv2-container",
        ".privacy-cp-wall",
        "#privacy-cp-wall",
        ".didomi-host",
        "#didomi-host"
    ],
    "generic": [
        ".ad",
        ".ads",
        ".adv",
        ".advertisement",
        ".video-ads",
        ".banner-ad",
        ".ad-container",
        ".ad-banner",
        ".ad-slot",
        ".ad-wrapper",
        ".ad-placeholder",
        ".google-ad",
        ".google-ads",
        ".sponsored-content",
        "#ad-banner",
        "#ad-container"
    ]
};

/**
 * Fetch selectors from GitHub repository
 * @returns {Promise<Object|null>} The selectors object or null if failed
 */
async function fetchSelectorsFromGitHub() {
    try {
        const response = await fetch(GITHUB_RAW_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Errore nel caricamento dei selettori da GitHub:', error);
        return null;
    }
}

/**
 * Function to save selectors to Chrome storage
 * @param {Object} selectors The selectors object to save
 * @returns {Promise<void>} A promise that resolves when the selectors are saved
 */
async function saveSelectorsCacheChrome(selectors) {
    return new Promise((resolve) => {
        chrome.storage.local.set({
            [CACHE_KEY]: selectors,
            [LAST_UPDATE_KEY]: Date.now()
        }, resolve);
    });
}

/**
 * Function to load selectors from Chrome storage
 * @returns {Promise<{selectors: Object|null, lastUpdate: number|null}>} A promise that resolves to an object containing selectors and last update time
 */
async function loadSelectorsCacheChrome() {
    return new Promise((resolve) => {
        chrome.storage.local.get([CACHE_KEY, LAST_UPDATE_KEY], (result) => {
            resolve({
                selectors: result[CACHE_KEY],
                lastUpdate: result[LAST_UPDATE_KEY]
            });
        });
    });
}

/**
 * Function to check if the cache is still valid
 * @param {number} lastUpdate The timestamp of the last update 
 * @returns {boolean} True if the cache is valid, false otherwise
 */
function isCacheValid(lastUpdate) {
    if (!lastUpdate) return false;
    return (Date.now() - lastUpdate) < UPDATE_INTERVAL;
}

/**
 * Function to get selectors, updating from GitHub if necessary
 * @param {boolean} forceUpdate Whether to force an update from GitHub
 * @returns {Promise<Object>} A promise that resolves to the selectors object
 */
async function getSelectors(forceUpdate = false) {
    const cached = await loadSelectorsCacheChrome();
    if (!forceUpdate && cached.selectors && isCacheValid(cached.lastUpdate)) {
        console.log('Using cached selectors');
        return cached.selectors;
    }
    console.log('Downloading selectors from GitHub...');
    const freshSelectors = await fetchSelectorsFromGitHub();
    if (freshSelectors) {
        await saveSelectorsCacheChrome(freshSelectors);
        console.log('Updated selectors from GitHub');
        return freshSelectors;
    }
    if (cached.selectors) {
        console.log('Using cached selectors after failed update');
        return cached.selectors;
    }
    console.log('Using default selectors as fallback');
    return DEFAULT_SELECTORS;
}

/**
 * Force update selectors from GitHub
 * @returns {Promise<Object>} A promise that resolves to the updated selectors object
 */
async function forceUpdateSelectors() {
    return await getSelectors(true);
}
