// Runs in the page's own JS context (world: MAIN) in every frame, before page scripts.
// Stops "click anywhere / invisible overlay" popups that a user never intended.
(function () {
    // Keep in sync with POPUP_ALLOWLIST in background.js
    const ALLOWED_HOSTS = [
        'accounts.google.com', 'appleid.apple.com', 'login.microsoftonline.com', 'login.live.com',
        'facebook.com', 'github.com', 'paypal.com', 'checkout.stripe.com', 'twitter.com', 'x.com',
        'linkedin.com', 'discord.com', 'slack.com', 'auth0.com', 'okta.com'
    ];
    const nativeOpen = window.open;
    const nativeAnchorClick = HTMLAnchorElement.prototype.click;

    function enabled() {
        const root = document.documentElement;
        return !root || root.getAttribute('data-abp-guard') !== 'off';
    }

    function report() {
        try {
            document.dispatchEvent(new CustomEvent('abp-popup-blocked'));
        } catch (e) { /* ignore */ }
    }

    function hostAllowed(host) {
        return ALLOWED_HOSTS.some(h => host === h || host.endsWith('.' + h));
    }

    function resolve(url) {
        try {
            return new URL(url, location.href);
        } catch (e) {
            return null;
        }
    }

    function rootDomain(host) {
        return host.replace(/^www\./, '').split('.').slice(-2).join('.');
    }

    function isCrossSite(u) {
        return rootDomain(u.hostname) !== rootDomain(location.hostname);
    }

    // An anchor a person would not knowingly click: invisible, empty, or a full-screen overlay
    function isDeceptiveAnchor(a) {
        const style = getComputedStyle(a);
        if (parseFloat(style.opacity) < 0.1 || style.visibility === 'hidden') return true;
        const hasContent = (a.innerText || '').trim() || a.querySelector('img, svg, video, picture, canvas, iframe');
        if (!hasContent) return true;
        const rect = a.getBoundingClientRect();
        const viewport = Math.max(1, window.innerWidth * window.innerHeight);
        const overlay = style.position === 'fixed' || style.position === 'absolute';
        return overlay && (rect.width * rect.height) / viewport >= 0.5;
    }

    // True when window.open was called while handling a real click on a visible link to that same URL
    function fromRealLink(u) {
        const ev = window.event;
        if (!ev || !ev.isTrusted || !ev.target || !ev.target.closest) return false;
        const a = ev.target.closest('a[href]');
        return !!a && resolve(a.href).href === u.href && !isDeceptiveAnchor(a);
    }

    function isPopupWindowFeatures(features) {
        if (!features) return false;
        return String(features).split(',')
            .map(t => t.trim().toLowerCase().split('=')[0])
            .filter(Boolean)
            .some(t => t !== 'noopener' && t !== 'noreferrer');
    }

    // Harmless stand-in so scripts that use the returned window do not fall back to redirecting the page
    function fakeWindow() {
        const stub = new Proxy(function () { }, {
            get: (_, prop) => {
                if (prop === 'closed') return false;
                if (prop === Symbol.toPrimitive) return () => '';
                return stub;
            },
            set: () => true,
            apply: () => stub
        });
        return stub;
    }

    window.open = function (url, target, features) {
        if (!enabled()) return nativeOpen.apply(this, arguments);
        const u = url ? resolve(String(url)) : null;
        if (!u) {
            if (isPopupWindowFeatures(features)) {
                report();
                return fakeWindow();
            }
            return nativeOpen.apply(this, arguments);
        }
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return nativeOpen.apply(this, arguments);
        if (hostAllowed(u.hostname)) return nativeOpen.apply(this, arguments);
        if (isPopupWindowFeatures(features) || (isCrossSite(u) && !fromRealLink(u))) {
            report();
            return fakeWindow();
        }
        return nativeOpen.apply(this, arguments);
    };

    // Programmatic a.click() on a detached anchor (the classic "create link, click it" trick)
    HTMLAnchorElement.prototype.click = function () {
        if (enabled() && !this.isConnected && this.target === '_blank') {
            const u = resolve(this.href);
            if (u && /^https?:$/.test(u.protocol) && isCrossSite(u) && !hostAllowed(u.hostname)) {
                report();
                return;
            }
        }
        return nativeAnchorClick.apply(this, arguments);
    };

    // Clicks on links that open a new tab: block synthetic ones and deceptive overlays
    window.addEventListener('click', function (e) {
        if (!enabled()) return;
        const a = e.target && e.target.closest && e.target.closest('a[href]');
        if (!a || a.target !== '_blank') return;
        const u = resolve(a.href);
        if (!u || !/^https?:$/.test(u.protocol) || hostAllowed(u.hostname) || !isCrossSite(u)) return;
        if (!e.isTrusted || isDeceptiveAnchor(a)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            report();
        }
    }, true);
})();
