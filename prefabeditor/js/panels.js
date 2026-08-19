/** Панели: DOM-рендер через CSS2D, парсинг HTML, prop-панели из JSON */

import { normalizePath, escapeAttr, decodeHtmlB64 } from './utils.js';

export const DESIGN_PROP_KEYS = ['font', 'color', 'image', 'fx', 'sound', 'text', 'prefab'];

/** Стандартные DOM-элементы */
function createTextEl(text, opts = {}) {
    const el = document.createElement('div');
    el.className = 'ui-text';
    el.textContent = text || '';
    if (opts.fontSize) el.style.fontSize = opts.fontSize + 'px';
    if (opts.color) el.style.color = opts.color;
    if (opts.fontWeight) el.style.fontWeight = opts.fontWeight;
    if (opts.y != null) el.style.marginTop = (opts.y > 0 ? 4 : 0) + 'px';
    return el;
}

function createButtonEl(text, opts = {}) {
    const el = document.createElement('button');
    el.className = 'ui-button';
    el.textContent = text || 'Button';
    if (opts.btnBg) el.style.background = opts.btnBg;
    if (opts.fontSize) el.style.fontSize = opts.fontSize + 'px';
    return el;
}

function createInputEl(placeholder, opts = {}) {
    const el = document.createElement('input');
    el.className = 'ui-input';
    el.type = 'text';
    el.placeholder = placeholder || '';
    if (opts.fontSize) el.style.fontSize = opts.fontSize + 'px';
    return el;
}

function createImageEl(src, opts = {}) {
    const el = document.createElement('img');
    el.className = 'ui-image';
    el.src = src || '';
    el.alt = opts.alt || '';
    if (opts.width) el.style.width = opts.width + 'px';
    if (opts.height) el.style.height = opts.height + 'px';
    return el;
}

export function buildPropPanelVisual(props) {
    const panelData = { bgColor: '#181830', borderColor: '#4a5568', elements: [], props };

    if (props.color) {
        const c = String(props.color).replace('#', '');
        panelData.bgColor = /^[0-9a-fA-F]{6,8}$/.test(c) ? '#' + c.slice(0, 6) : panelData.bgColor;
    }

    let y = 8;
    panelData.elements.push({ type: 'text', text: props.group || '', y, fontSize: 15, fontWeight: 'bold', color: '#ffd700' });
    y += 22;

    if (props.image) {
        panelData.elements.push({ type: 'image', src: props.image, y, width: 80, height: 60 });
        y += 68;
    }
    if (props.text) {
        panelData.elements.push({ type: 'text', text: props.text, y, fontSize: 14, color: '#ffffff' });
        y += 20;
    }
    if (props.font) {
        panelData.elements.push({ type: 'text', text: 'Font: ' + props.font, y, fontSize: 11, color: '#94a3b8' });
        y += 16;
    }
    if (props.fx) {
        panelData.elements.push({ type: 'text', text: 'FX: ' + props.fx, y, fontSize: 11, color: '#94a3b8' });
        y += 16;
    }
    if (props.sound) {
        panelData.elements.push({ type: 'text', text: 'Sound: ' + props.sound, y, fontSize: 11, color: '#94a3b8' });
        y += 16;
    }
    if (props.prefab) {
        panelData.elements.push({ type: 'text', text: 'Prefab: ' + props.prefab, y, fontSize: 11, color: '#94a3b8' });
        y += 16;
    }

    return panelData;
}

export function serializePropPanelDiv(props) {
    let attrs = `class="panel prop-panel" data-group="${escapeAttr(props.group || '')}"`;
    DESIGN_PROP_KEYS.forEach(k => {
        if (props[k]) attrs += ` data-${k}="${escapeAttr(props[k])}"`;
    });
    return `<div ${attrs}></div>`;
}

export function buildPanelDOM(panelData) {
    const root = document.createElement('div');
    root.className = 'css2d-panel';
    root.style.background = panelData.bgColor || '#0a0a1e';
    root.style.border = panelData.borderColor ? `3px solid ${panelData.borderColor}` : 'none';
    root.style.width = '300px';
    root.style.minHeight = '180px';
    root.style.padding = '10px';
    root.style.boxSizing = 'border-box';
    root.style.fontFamily = 'Inter, sans-serif';
    root.style.color = '#fff';
    root.style.overflow = 'hidden';
    root.style.borderRadius = '6px';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.gap = '6px';
    root.style.pointerEvents = 'none';

    (panelData.elements || []).forEach(el => {
        let node;
        if (el.type === 'text' || el.type === 'label') {
            node = createTextEl(el.text, el);
        } else if (el.type === 'button') {
            node = createButtonEl(el.text, el);
        } else if (el.type === 'input') {
            node = createInputEl(el.text, el);
        } else if (el.type === 'image') {
            node = createImageEl(el.src || el.image, el);
        } else if (el.type === 'video') {
            node = buildVideoDOM(el);
        } else if (el.type === 'html') {
            node = buildHtmlDOM(el.html || '');
            node.style.width = (el.width || 220) + 'px';
            node.style.height = (el.height || 150) + 'px';
        }
        if (node) root.appendChild(node);
    });

    return root;
}

export function buildVideoDOM(opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'css2d-video';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '4px';
    wrap.style.pointerEvents = 'none';

    const video = document.createElement('video');
    video.className = 'ui-video';
    video.src = opts.src || '';
    video.muted = true;
    video.playsInline = true;
    video.style.width = '100%';
    video.style.maxHeight = '120px';
    video.style.background = '#000';
    video.style.borderRadius = '4px';

    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = opts.label || opts.src || 'Video';
    label.style.fontSize = '12px';
    label.style.color = '#ccc';

    wrap.appendChild(video);
    wrap.appendChild(label);
    return wrap;
}

export function buildHtmlDOM(html) {
    const el = document.createElement('div');
    el.className = 'css2d-html';
    el.style.pointerEvents = 'none';
    el.style.overflow = 'hidden';
    el.innerHTML = html || '';
    return el;
}

export function refreshPanelDOM(obj) {
    if (!obj || !obj.userData.domElement || !obj.userData.panelData) return;
    const newDom = buildPanelDOM(obj.userData.panelData);
    // заменяем содержимое
    obj.userData.domElement.innerHTML = '';
    obj.userData.domElement.style.background = newDom.style.background;
    obj.userData.domElement.style.border = newDom.style.border;
    while (newDom.firstChild) {
        obj.userData.domElement.appendChild(newDom.firstChild);
    }
}

export function parsePanelHTML(html) {
    const panelData = { bgColor: '#0a0a30', borderColor: '#00ffaa', elements: [] };
    if (!html) return panelData;

    if (html.includes('prop-panel')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const el = doc.querySelector('.prop-panel');
        const props = {};
        if (el) {
            for (const attr of Array.from(el.attributes)) {
                if (attr.name.startsWith('data-')) {
                    const key = attr.name.slice(5);
                    props[key] = attr.value;
                }
            }
        }
        return buildPropPanelVisual(props);
    }

    if (html.includes('artarget-root')) {
        panelData.bgColor = '#141428';
        panelData.borderColor = '#FFD700';

        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const groups = doc.querySelectorAll('.panel-group');

        let currentY = 8;
        groups.forEach(group => {
            const groupName = group.getAttribute('data-name') || '';

            const img = group.querySelector('img.panel-image');
            if (img) {
                panelData.elements.push({
                    type: 'image',
                    src: img.getAttribute('src') || '',
                    y: currentY,
                    width: 80,
                    height: 50
                });
                currentY += 56;
            }

            const textBlock = group.querySelector('.panel-text-block');
            if (textBlock) {
                const color = textBlock.getAttribute('data-color') || '#ffffff';
                const fx = textBlock.getAttribute('data-fx') || '';
                const textSpan = textBlock.querySelector('.label-text');
                const labelText = textSpan ? textSpan.textContent : '';

                let displayStr = `${groupName}: ${labelText}`;
                if (fx) displayStr += ` (FX: ${fx})`;

                panelData.elements.push({
                    type: 'text',
                    text: displayStr,
                    y: currentY,
                    fontSize: 14,
                    color: color.startsWith('#') ? color : '#' + color
                });
                currentY += 22;
            }
            currentY += 8;
        });
        return panelData;
    }

    if (html.includes('img-panel')) {
        panelData.bgColor = '#1a0033';
        panelData.borderColor = '#ff66cc';
    } else if (html.includes('ok-panel')) {
        panelData.bgColor = '#002814';
        panelData.borderColor = null;
    }

    const labelMatch = html.match(/class="label">([^<]+)</);
    if (labelMatch) panelData.elements.push({ type: 'text', text: labelMatch[1], y: 8, fontSize: 18, color: panelData.borderColor || '#fff' });

    const nameMatch = html.match(/class="name">([^<]+)</);
    if (nameMatch) panelData.elements.push({ type: 'text', text: nameMatch[1], y: 40, fontSize: 22, fontWeight: 'bold' });

    const subMatch = html.match(/class="sub">([^<]+)</);
    if (subMatch) panelData.elements.push({ type: 'text', text: subMatch[1], y: 70, fontSize: 14, color: '#aaa' });

    const btnMatch = html.match(/class="btn">([^<]+)</);
    if (btnMatch) panelData.elements.push({ type: 'button', text: btnMatch[1], y: 100, fontSize: 16, btnBg: '#00cc66' });

    const videoMatch = html.match(/<video[^>]*data-src="([^"]*)"[^>]*data-y="([^"]*)"[^>]*>/);
    if (videoMatch) {
        panelData.elements.push({
            type: 'video',
            src: normalizePath(videoMatch[1]),
            label: 'Video',
            y: parseFloat(videoMatch[2]) || 80,
            width: 200,
            height: 110
        });
    }

    const htmlBlockRegex = /<div class="html-block" data-raw-b64="([^"]*)" data-y="([^"]*)"[^>]*><\/div>/g;
    let hbMatch;
    while ((hbMatch = htmlBlockRegex.exec(html)) !== null) {
        panelData.elements.push({
            type: 'html',
            html: decodeHtmlB64(hbMatch[1]),
            y: parseFloat(hbMatch[2]) || 60,
            width: 220,
            height: 140
        });
    }

    return panelData;
}

export function refreshPanelTexture(obj) {
    // алиас для совместимости
    refreshPanelDOM(obj);
}