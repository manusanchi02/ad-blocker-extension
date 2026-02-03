// Selectors Loader - Carica i selettori da GitHub
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/manusanchi02/ad-blocker-extension/blob/master/ad-selectors.json';
const CACHE_KEY = 'ad_selectors_cache';
const LAST_UPDATE_KEY = 'ad_selectors_last_update';
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minuti

// Selettori di default come fallback
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

// Carica i selettori da GitHub
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

// Salva i selettori nella cache
async function saveSelectorsCacheChrome(selectors) {
    return new Promise((resolve) => {
        chrome.storage.local.set({
            [CACHE_KEY]: selectors,
            [LAST_UPDATE_KEY]: Date.now()
        }, resolve);
    });
}

// Carica i selettori dalla cache
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

// Controlla se i selettori in cache sono ancora validi
function isCacheValid(lastUpdate) {
    if (!lastUpdate) return false;
    return (Date.now() - lastUpdate) < UPDATE_INTERVAL;
}

// Funzione principale per ottenere i selettori
async function getSelectors(forceUpdate = false) {
    // Prova a caricare dalla cache
    const cached = await loadSelectorsCacheChrome();
    
    // Se la cache è valida e non stiamo forzando l'aggiornamento, usala
    if (!forceUpdate && cached.selectors && isCacheValid(cached.lastUpdate)) {
        console.log('Usando selettori dalla cache');
        return cached.selectors;
    }
    
    // Altrimenti prova a scaricare da GitHub
    console.log('Scaricando selettori da GitHub...');
    const freshSelectors = await fetchSelectorsFromGitHub();
    
    if (freshSelectors) {
        // Salva nella cache per il futuro
        await saveSelectorsCacheChrome(freshSelectors);
        console.log('Selettori aggiornati da GitHub');
        return freshSelectors;
    }
    
    // Se il download fallisce, usa la cache anche se scaduta
    if (cached.selectors) {
        console.log('Usando selettori dalla cache scaduta (GitHub non disponibile)');
        return cached.selectors;
    }
    
    // Come ultima risorsa, usa i selettori di default
    console.log('Usando selettori di default');
    return DEFAULT_SELECTORS;
}

// Forza l'aggiornamento dei selettori
async function forceUpdateSelectors() {
    return await getSelectors(true);
}
