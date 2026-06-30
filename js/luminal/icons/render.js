import { glyph } from './glyphs.js';
import { configForApp, SYSTEM_ICONS } from './icon-config.js';

export function renderAppIcon(appOrName, opts = {}) {
    const app = typeof appOrName === 'string' ? { name: appOrName } : appOrName;
    const cfg = configForApp(app) || {};
    return renderFromConfig(cfg, opts);
}

export function renderSystemIcon(name, opts = {}) {
    return renderFromConfig(SYSTEM_ICONS[name] || {}, opts);
}

export function renderFromConfig(cfg, opts = {}) {
    const size = opts.size || 56;
    const wrapper = document.createElement('div');
    wrapper.className = 'lumi-icon';
    wrapper.style.width = size + 'px';
    wrapper.style.height = size + 'px';

    if (cfg.type === 'image' && cfg.image) {
        wrapper.classList.add('lumi-icon--image');
        const src = (window.lumiBackends && window.lumiBackends.rebaseAsset) ? window.lumiBackends.rebaseAsset(cfg.image) : cfg.image;
        wrapper.innerHTML = `
            <img src="${src}" alt="" draggable="false" loading="lazy" referrerpolicy="no-referrer">
            <div class="lumi-icon__sheen"></div>
        `;
        return wrapper;
    }

    const [c1, c2] = cfg.bg || ['#94A3B8', '#475569'];
    wrapper.style.setProperty('--ic-c1', c1);
    wrapper.style.setProperty('--ic-c2', c2);

    const glyphSize = Math.round(size * (cfg.glyphScale || 0.5));
    const glyphColor = cfg.glyphColor || 'white';
    wrapper.innerHTML = `
        <div class="lumi-icon__bg"></div>
        <div class="lumi-icon__glyph">${glyph(cfg.glyph || 'grid', { color: glyphColor, size: glyphSize })}</div>
        <div class="lumi-icon__sheen"></div>
    `;
    return wrapper;
}

export function renderAppIconHTML(appOrName, opts = {}) {
    return renderAppIcon(appOrName, opts).outerHTML;
}
