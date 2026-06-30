(function () {
    'use strict';

    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/skidding-code/lumi-cdn@singlefile-assist/';
    var LISTS_BASE = 'https://cdn.jsdelivr.net/gh/skidding-code/lumi-cdn@backends/';
    var DEFAULT_API = 'https://v2.quest';
    var DEFAULT_BACKEND = 'scramjet2';
    var RUNTIME_URL = CDN_BASE + 'single-runtime.js';

    var BACKEND_KEY = 'luminal_proxy_backend';
    var API_OVERRIDE = 'lumi_single_api_override';
    var WISP_OVERRIDE = 'lumi_single_wisp_override';
    var API_CACHE = 'lumi_single_api';

    var LABELS = { scramjet2: 'Scramjet v2', scramjet: 'Scramjet v1', uv: 'Ultraviolet', dynamic: 'Dynamic' };
    var BACKENDS = ['scramjet2', 'dynamic', 'uv'];

    var _fetch = self.fetch ? self.fetch.bind(self) : null;

    var parentCtx = null;
    try {
        if (window.parent && window.parent !== window && window.parent.__lumiSingle) parentCtx = window.parent.__lumiSingle;
    } catch (e) { parentCtx = null; }

    var store = makeStore();

    function baseHref() {
        try { if (document.baseURI && /^https?:/i.test(document.baseURI)) return document.baseURI; } catch (e) {}
        try { if (location.href && /^https?:/i.test(location.href)) return location.href; } catch (e) {}
        return CDN_BASE;
    }

    var PAGE_ORIGIN = '';
    try { if (location.origin && location.origin !== 'null') PAGE_ORIGIN = location.origin; } catch (e) {}

    var CDN_ORIGIN = '';
    var CDN_PATH = '/';
    try { var _cu = new URL(CDN_BASE); CDN_ORIGIN = _cu.origin; CDN_PATH = _cu.pathname; } catch (e) {}

    var BASE_URL, BASE_PATH;
    try { BASE_URL = new URL('.', baseHref()).href; } catch (e) { BASE_URL = CDN_BASE; }
    try { BASE_PATH = new URL('.', baseHref()).pathname; } catch (e) { BASE_PATH = '/'; }

    var resolvedApi = parentCtx ? parentCtx.apiBase() : '';
    var apiList = null;
    var ensureApiP = null;

    function makeStore() {
        var probe = '__lumi_store_test';
        try { localStorage.setItem(probe, '1'); localStorage.removeItem(probe); return localStorage; }
        catch (e) {}
        var mem = {};
        var shim = {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
            setItem: function (k, v) { mem[k] = String(v); },
            removeItem: function (k) { delete mem[k]; },
            clear: function () { mem = {}; },
            key: function (i) { return Object.keys(mem)[i] || null; }
        };
        try { Object.defineProperty(shim, 'length', { get: function () { return Object.keys(mem).length; } }); } catch (e) {}
        try { Object.defineProperty(window, 'localStorage', { value: shim, configurable: true }); } catch (e) {}
        return shim;
    }

    function clean(u) { return String(u || '').trim(); }
    function trimSlash(u) { return clean(u).replace(/\/+$/, ''); }
    function lsGet(k) { try { return store.getItem(k) || ''; } catch (e) { return ''; } }
    function lsSet(k, v) { try { store.setItem(k, v); } catch (e) {} }
    function lsDel(k) { try { store.removeItem(k); } catch (e) {} }

    function asset(p) { return new URL(p, BASE_URL).href; }

    function rebaseAsset(p) {
        p = clean(p);
        if (!p) return p;
        if (/^(?:https?:|data:|blob:|\/\/)/i.test(p)) return p;
        if (p.charAt(0) === '/') return CDN_BASE + p.slice(1);
        return CDN_BASE + p;
    }

    function apiOverride() { return clean(lsGet(API_OVERRIDE)); }
    function wispOverride() { return clean(lsGet(WISP_OVERRIDE)); }
    function apiBase() { return trimSlash(apiOverride() || resolvedApi || clean(lsGet(API_CACHE)) || DEFAULT_API); }
    function wispBase() { return apiBase(); }

    async function fetchList() {
        if (!_fetch) return [];
        try {
            var r = await _fetch(LISTS_BASE + 'api.txt', { cache: 'no-store' });
            if (!r || !r.ok) return [];
            var txt = await r.text();
            return txt.split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s && s.charAt(0) !== '#'; });
        } catch (e) { return []; }
    }

    async function probeApi(base) {
        if (!_fetch) return false;
        var ctrl = new AbortController();
        var t = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 6000);
        try {
            var r = await _fetch(trimSlash(base) + '/health', { signal: ctrl.signal, cache: 'no-store', mode: 'cors' });
            clearTimeout(t);
            return !!(r && r.ok);
        } catch (e) { clearTimeout(t); return false; }
    }

    async function ensureApi() {
        if (resolvedApi) return resolvedApi;
        if (parentCtx) { resolvedApi = parentCtx.apiBase(); return resolvedApi; }
        if (ensureApiP) return ensureApiP;
        ensureApiP = (async function () {
            var ov = apiOverride();
            if (ov) { resolvedApi = trimSlash(ov); return resolvedApi; }
            var cached = clean(lsGet(API_CACHE));
            if (cached) { resolvedApi = trimSlash(cached); return resolvedApi; }
            if (!apiList) apiList = await fetchList();
            if (!apiList.length) apiList = [DEFAULT_API];
            for (var i = 0; i < apiList.length; i++) {
                if (await probeApi(apiList[i])) { resolvedApi = trimSlash(apiList[i]); lsSet(API_CACHE, resolvedApi); return resolvedApi; }
            }
            resolvedApi = trimSlash(apiList[0]);
            return resolvedApi;
        })();
        try { return await ensureApiP; } finally { ensureApiP = null; }
    }

    function setApiOverride(v) { v = clean(v); if (v) lsSet(API_OVERRIDE, v); else lsDel(API_OVERRIDE); resolvedApi = ''; }
    function setWispOverride(v) { v = clean(v); if (v) lsSet(WISP_OVERRIDE, v); else lsDel(WISP_OVERRIDE); }
    function clearBackendCache() { resolvedApi = parentCtx ? parentCtx.apiBase() : ''; lsDel(API_CACHE); }

    function cleanPath(p) {
        if (CDN_PATH.length > 1 && p.indexOf(CDN_PATH) === 0) return '/' + p.slice(CDN_PATH.length);
        if (BASE_PATH.length > 1 && p.indexOf(BASE_PATH) === 0) return '/' + p.slice(BASE_PATH.length);
        return p;
    }

    function isApiPath(p) {
        return /^\/api\//.test(p) || /^\/lumi\/(search|suggest)\b/.test(p) || p === '/health' || p === '/users-online.json';
    }

    function resolveOurs(input) {
        var url;
        try { url = new URL(input, baseHref()); } catch (e) { return null; }
        if (url.origin !== PAGE_ORIGIN && url.origin !== CDN_ORIGIN) return null;
        return url;
    }

    function needsApi(input) {
        var url = resolveOurs(input);
        if (!url) return false;
        return isApiPath(cleanPath(url.pathname));
    }

    function toApi(input) {
        var url = resolveOurs(input);
        if (!url) { try { url = new URL(input, baseHref()); } catch (e) { return input; } }
        return apiBase() + cleanPath(url.pathname) + url.search + url.hash;
    }

    function currentBackend() { return lsGet(BACKEND_KEY) || DEFAULT_BACKEND; }
    function setBackend(b) { if (!b) return false; lsSet(BACKEND_KEY, b); return true; }

    function normalizeUrl(dest) {
        dest = clean(dest);
        if (!dest) return dest;
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(dest)) return dest;
        return 'https://' + dest.replace(/^\/+/, '');
    }

    function embedUrl(target, backend) {
        var b = backend || currentBackend();
        return apiBase() + '/embed.html?backend=' + encodeURIComponent(b) + '#' + target;
    }

    async function openInIframe(iframe, url, opts) {
        opts = opts || {};
        try { await ensureApi(); } catch (e) {}
        var target = normalizeUrl(url);
        var b = opts.backend || currentBackend();
        iframe.src = embedUrl(target, b);
        if (typeof opts.onUrlChange === 'function') { try { opts.onUrlChange(target); } catch (e) {} }
        return new Promise(function (resolve) {
            var done = false;
            function finish() { if (done) return; done = true; resolve(iframe); }
            iframe.addEventListener('load', finish, { once: true });
            setTimeout(finish, 20000);
        });
    }

    function openInWindow(url, backend) {
        var target = normalizeUrl(url);
        return window.open(embedUrl(target, backend), '_blank');
    }

    if (_fetch) {
        self.fetch = function (input, init) {
            try {
                if (typeof input === 'string') {
                    if (needsApi(input)) input = toApi(input);
                } else if (input && typeof input.url === 'string' && needsApi(input.url)) {
                    input = new Request(toApi(input.url), input);
                }
            } catch (e) {}
            return _fetch(input, init);
        };
    }

    if (self.XMLHttpRequest && XMLHttpRequest.prototype.open) {
        var _open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
            try { if (typeof url === 'string' && needsApi(url)) { arguments[1] = toApi(url); } } catch (e) {}
            return _open.apply(this, arguments);
        };
    }

    if (self.EventSource) {
        var _ES = self.EventSource;
        var ESShim = function (url, cfg) {
            try { if (typeof url === 'string' && needsApi(url)) url = toApi(url); } catch (e) {}
            return new _ES(url, cfg);
        };
        ESShim.prototype = _ES.prototype;
        try { ESShim.CONNECTING = _ES.CONNECTING; ESShim.OPEN = _ES.OPEN; ESShim.CLOSED = _ES.CLOSED; } catch (e) {}
        self.EventSource = ESShim;
    }

    if (self.navigator && navigator.sendBeacon) {
        var _beacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function (url, data) {
            try { if (typeof url === 'string' && needsApi(url)) url = toApi(url); } catch (e) {}
            return _beacon(url, data);
        };
    }

    window.lumiBackends = {
        BASE_URL: BASE_URL,
        BASE_PATH: BASE_PATH,
        CDN_BASE: CDN_BASE,
        LISTS_BASE: LISTS_BASE,
        DEFAULT_API: DEFAULT_API,
        asset: asset,
        rebaseAsset: rebaseAsset,
        apiUrl: function (p) { return apiBase() + (p.charAt(0) === '/' ? p : '/' + p); },
        apiBase: apiBase,
        wispBase: wispBase,
        ensureApi: ensureApi,
        ensureWisp: function () { return Promise.resolve(apiBase()); },
        apiOverride: apiOverride,
        wispOverride: wispOverride,
        setApiOverride: setApiOverride,
        setWispOverride: setWispOverride,
        clearBackendCache: clearBackendCache,
        getApiList: function () { return (apiList || []).slice(); },
        getWispList: function () { return []; }
    };

    window.lumiProxy = {
        BACKENDS: BACKENDS,
        LABELS: LABELS,
        DEFAULT_BACKEND: DEFAULT_BACKEND,
        normalizeUrl: normalizeUrl,
        encodeFor: function (url) { return embedUrl(normalizeUrl(url)); },
        embedUrl: function (url, backend) { return embedUrl(normalizeUrl(url), backend); },
        getCurrent: currentBackend,
        setCurrent: setBackend,
        getWispUrl: function () { return ''; },
        registerSW: function () { return Promise.resolve(); },
        openInIframe: openInIframe,
        openInWindow: openInWindow
    };

    window.__lumiSingle = {
        CDN_BASE: CDN_BASE,
        RUNTIME_URL: RUNTIME_URL,
        apiBase: apiBase,
        ensureApi: ensureApi,
        embedUrl: embedUrl
    };

    function spliceHead(html, inject) {
        var lower = html.toLowerCase();
        var headOpen = lower.indexOf('<head>');
        var headAttr = lower.indexOf('<head ');
        var at = headOpen >= 0 ? headOpen + 6 : headAttr >= 0 ? lower.indexOf('>', headAttr) + 1 : -1;
        if (at > 0) return html.slice(0, at) + inject + html.slice(at);
        return '<!DOCTYPE html><html><head>' + inject + '</head><body>' + html + '</body></html>';
    }

    var CDN_APPS = ['calculus.html', 'gnmath.html', 'ai.html', '404.html'];

    function cdnHtml(url) {
        if (!url || typeof url !== 'string') return url;
        if (/^(?:data:|blob:)/i.test(url)) return url;
        try {
            var u = new URL(url, location.href);
            if (u.origin === location.origin && /\.html?$/i.test(u.pathname)) {
                var path = u.pathname.replace(/^\//, '');
                var name = path.replace(/^.*\//, '').toLowerCase();
                if (CDN_APPS.indexOf(name) >= 0) return CDN_BASE + path + u.search + u.hash;
                return apiBase() + '/' + path + u.search + u.hash;
            }
        } catch (e) {}
        return url;
    }

    function installShell() {
        if (typeof window.loadIframeForApp !== 'function' && !window.createWindow) return;
        var runtimeTag = '<script src="' + RUNTIME_URL + '"><\/script>';
        window.loadIframeForApp = function (iframe, url, options) {
            if (options && options.forceFetchHtml === false) { iframe.src = url; return; }
            var rebased = cdnHtml(url);
            var u;
            try { u = new URL(rebased, location.href); } catch (e) { iframe.src = url; return; }
            var fetchAsHtml = u.origin !== location.origin && /\.html?$/i.test(u.pathname);
            if (!fetchAsHtml && !(options && options.forceFetchHtml === true)) { iframe.src = rebased; return; }
            var dir = u.href.replace(/[^/]*$/, '');
            _fetch(u.href, { credentials: 'omit', mode: 'cors' })
                .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
                .then(function (html) {
                    var inject = /<base[\s>]/i.test(html) ? runtimeTag : '<base href="' + dir + '">' + runtimeTag;
                    iframe.srcdoc = spliceHead(html, inject);
                })
                .catch(function () { iframe.src = rebased; });
        };
    }

    if (window === window.top) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installShell, { once: true });
        else installShell();
    }

    try { ensureApi(); } catch (e) {}
})();
