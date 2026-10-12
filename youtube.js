// YouTube video ad handling: skip/accelerate ads in the player and hide ad slots
const YT_AD_SLOT_SELECTORS = [
    '#masthead-ad',
    '#player-ads',
    '.ytp-ad-overlay-container',
    '.ytp-ad-image-overlay',
    '.ytp-suggested-action',
    'ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-display-ad-renderer',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-video-renderer',
    'ytd-banner-promo-renderer',
    'ytd-statement-banner-renderer',
    'ytd-companion-slot-renderer',
    'ytd-action-companion-ad-renderer',
    'ytd-merch-shelf-renderer',
    'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
    'ytd-enforcement-message-view-model'
];
const SKIP_BUTTON_SELECTORS = '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button';

let enabled = true;
let mutedBeforeAd = null;

function injectCosmeticStyle() {
    const style = document.createElement('style');
    style.textContent = YT_AD_SLOT_SELECTORS.join(',\n') + ' { display: none !important; }';
    (document.head || document.documentElement).appendChild(style);
    return style;
}

const cosmeticStyle = injectCosmeticStyle();

function handleVideoAd() {
    const player = document.querySelector('.html5-video-player');
    const video = document.querySelector('video.html5-main-video, .html5-video-container video');
    if (!player || !video) return;

    if (player.classList.contains('ad-showing')) {
        if (mutedBeforeAd === null) mutedBeforeAd = video.muted;
        video.muted = true;
        const skip = document.querySelector(SKIP_BUTTON_SELECTORS);
        if (skip) {
            skip.click();
        } else if (Number.isFinite(video.duration) && video.duration > 0) {
            // unskippable ad: jump to its end
            video.currentTime = video.duration;
            video.playbackRate = 16;
        }
    } else if (mutedBeforeAd !== null) {
        video.muted = mutedBeforeAd;
        video.playbackRate = 1;
        mutedBeforeAd = null;
    }
}

function setEnabled(value) {
    enabled = value;
    cosmeticStyle.disabled = !value;
}

chrome.storage.local.get(['adBlockingEnabled'], (result) => {
    setEnabled(result.adBlockingEnabled !== false);
});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.adBlockingEnabled) {
        setEnabled(changes.adBlockingEnabled.newValue !== false);
    }
});

setInterval(() => {
    if (enabled) handleVideoAd();
}, 300);
