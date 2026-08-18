import * as THREE from 'three';

const DEFAULT_TEMPLATE_URL = './assets/artarget.html';

/**
 * Helper function to generate HTML structure for 3D interactive panel body based on answer type.
 */
export function buildInteractiveBodyHtml(targetInfo = {}) {
    const answerType = targetInfo.answerType || 'Slide';
    const options = targetInfo.options || [];
    const mainText = targetInfo.mainText || '';

    if (answerType === 'Button') {
        const buttonsHtml = options.map((opt, idx) => 
            `<button class="quest-btn">${opt.text || `Вариант ${idx + 1}`}</button>`
        ).join('');
        return `<div class="quest-options-grid">${buttonsHtml}</div>`;
    } else if (answerType === 'InputField') {
        return `
            <div class="quest-input-block">
                <input type="text" class="quest-input" placeholder="Введите ответ..." />
                <button class="quest-submit-btn">OK</button>
            </div>
        `;
    } else if (answerType === 'Art' || answerType === 'AntiArt') {
        return `<button class="quest-submit-btn quest-ok-btn">OK</button>`;
    } else {
        // Slide / Default
        const currentText = options[0]?.text || mainText || '';
        return `
            <div class="quest-slider">
                <button class="slide-nav prev">◄</button>
                <div class="slide-content">${currentText}</div>
                <button class="slide-nav next">►</button>
            </div>
            <button class="quest-submit-btn quest-ok-btn">OK</button>
        `;
    }
}

/**
 * ModelFactory — central builder for AR target objects.
 * HTML templates remain the single source of truth for panel content, size and placement.
 * Procedural (canvas) fallback is available for offline / no-foreignObject environments.
 */
export class ModelFactory {
    /**
     * @param {object} [defaults]
     * @param {string} [defaults.templateUrl]
     */
    constructor(defaults = {}) {
        this.templateUrl = defaults.templateUrl || DEFAULT_TEMPLATE_URL;
    }

    /**
     * Abstract AR object: panels + layout come from declarative HTML.
     * @param {string|object} [targetData=''] Target identifier or data object
     * @param {object} [options]
     * @param {Function|null} [options.onOk]
     * @param {string} [options.templateUrl]
     * @param {object} [options.vars] Additional variables for template substitution
     * @returns {Promise<THREE.Group>}
     */
    async createArTarget(targetData = '', options = {}) {
        const { onOk = null, templateUrl = this.templateUrl, vars: extraVars = {} } = options;

        const targetInfo = typeof targetData === 'object' && targetData !== null
            ? targetData
            : { title: String(targetData) };

        const title = targetInfo.title ?? targetInfo.name ?? String(targetData ?? '');
        const groupName = targetInfo.questId || targetInfo.id || title || 'target';

        const group = new THREE.Group();
        group.name = `arTarget_${groupName}`;

        const sphere = this._createSphere();
        group.add(sphere);

        const template = await this._loadTemplate(templateUrl);
        const panels = template.querySelectorAll('panel');

        const interactiveBodyHtml = buildInteractiveBodyHtml(targetInfo);
        
        let imageSrc = targetInfo.imageSrc || targetInfo.image || '';
        if (imageSrc && !imageSrc.startsWith('data:')) {
            imageSrc = await this._imageToDataUrl(imageSrc);
        }

        const templateVars = {
            title: title,
            question: targetInfo.question || targetInfo.mainText || '',
            imageSrc: imageSrc,
            imgDisplay: imageSrc ? 'flex' : 'none',
            interactiveBody: interactiveBodyHtml,
            okText: targetInfo.okText ?? 'OK',
            textLabel: targetInfo.textLabel ?? 'MARKER',
            subtitle: targetInfo.subtitle ?? 'AR Target',
            markerName: title,
            ...extraVars
        };

        const userData = {
            targetInfo,
            markerName: title,
            sphere,
            onOk,
            panels: {}
        };

        for (const panelEl of panels) {
            const mesh = await this._createPanelFromHtml(panelEl, templateVars);
            group.add(mesh);
            userData.panels[mesh.name] = mesh;
            userData[mesh.name] = mesh;
            if (mesh.userData.texture) {
                userData[`${mesh.name}Texture`] = mesh.userData.texture;
            }
        }

        group.position.z = 0.02;
        group.userData = userData;

        return group;
    }

    /**
     * Pure-canvas fallback (no network / no foreignObject) — for offline use.
     * @param {string|object} [targetData=''] Target identifier or data object
     * @param {object} [options]
     * @returns {THREE.Group}
     */
    createArTargetSync(targetData = '', options = {}) {
        const { onOk = null } = options;

        const targetInfo = typeof targetData === 'object' && targetData !== null
            ? targetData
            : { title: String(targetData) };

        const title = targetInfo.title ?? targetInfo.name ?? String(targetData ?? '');
        const question = targetInfo.question || targetInfo.mainText || '';
        const okText = targetInfo.okText ?? 'OK';
        const groupName = targetInfo.questId || targetInfo.id || title || 'target';

        const group = new THREE.Group();
        group.name = `arTarget_${groupName}`;

        const sphere = this._createSphere();
        group.add(sphere);

        const questionPanel = this._makeCanvasPanel({
            name: 'questionPanel',
            w: 0.32, h: 0.38,
            pos: [0, 0, 0.02],
            rot: [-Math.PI / 2, 0, 0],
            canvasW: 380, canvasH: 450,
            draw: (ctx, cw, ch) => {
                ctx.fillStyle = 'rgba(10, 10, 20, 0.92)';
                ctx.fillRect(0, 0, cw, ch);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.lineWidth = 4;
                ctx.strokeRect(2, 2, cw - 4, ch - 4);

                ctx.fillStyle = '#00ffaa';
                ctx.font = 'bold 22px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(title, cw / 2, 40);

                ctx.fillStyle = '#ffffff';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                
                const words = question.split(' ');
                let line = '';
                let y = 80;
                for (let n = 0; n < words.length; n++) {
                    const testLine = line + words[n] + ' ';
                    const metrics = ctx.measureText(testLine);
                    if (metrics.width > cw - 40 && n > 0) {
                        ctx.fillText(line, cw / 2, y);
                        line = words[n] + ' ';
                        y += 24;
                    } else {
                        line = testLine;
                    }
                }
                ctx.fillText(line, cw / 2, y);
            }
        });
        group.add(questionPanel);

        const okPanel = this._makeCanvasPanel({
            name: 'okButton',
            w: 0.16, h: 0.06,
            pos: [0, -0.22, 0.02],
            rot: [-Math.PI / 2, 0, 0],
            canvasW: 256, canvasH: 96,
            draw: (ctx, cw, ch) => {
                ctx.fillStyle = 'rgba(0, 40, 20, 0.95)';
                ctx.fillRect(0, 0, cw, ch);
                ctx.fillStyle = '#00cc66';
                this._roundRectPath(ctx, 24, 16, 208, 64, 12);
                ctx.fill();
                ctx.strokeStyle = '#00ff99';
                ctx.lineWidth = 4;
                ctx.stroke();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 40px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(okText, cw / 2, ch / 2);
            }
        });
        group.add(okPanel);

        group.position.z = 0.02;
        group.userData = {
            targetInfo,
            markerName: title,
            sphere,
            questionPanel,
            okPanel,
            questionTexture: questionPanel.userData.texture,
            okTexture: okPanel.userData.texture,
            onOk
        };
        return group;
    }

    // ─── private: Helpers ───────────────────────────────────────────────────

    _imageToDataUrl(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve('');
            img.src = url;
        });
    }

    async _loadTemplate(url) {
        const res = await fetch(url);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('#ar-target') || doc.querySelector('template');
        if (!template) throw new Error(`No <template id="ar-target"> in ${url}`);

        const styleEl = template.content ? template.content.querySelector('style') : doc.querySelector('style');
        if (styleEl) {
            template.dataset.style = styleEl.textContent;
        }
        return template;
    }

    async _createPanelFromHtml(panelEl, vars = {}) {
        const name = panelEl.getAttribute('name') || 'panel';
        const w = parseFloat(panelEl.dataset.width) || 0.32;
        const h = parseFloat(panelEl.dataset.height) || 0.38;
        const pos = this._parseVec3(panelEl.dataset.position, [0, 0, 0.02]);
        const rot = this._parseVec3(panelEl.dataset.rotation, [-90, 0, 0]).map(d => d * Math.PI / 180);

        let inner = panelEl.innerHTML;
        for (const [k, v] of Object.entries(vars)) {
            inner = inner.replaceAll(`{{${k}}}`, String(v ?? ''));
        }

        const { cssW, cssH } = this._measurePanelCss(panelEl);

        const texture = await this._htmlToTexture(
            inner,
            cssW,
            cssH,
            panelEl.closest('template')?.dataset?.style || ''
        );

        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide
            })
        );
        mesh.name = name;
        mesh.position.set(...pos);
        mesh.rotation.set(...rot);
        mesh.userData.texture = texture;

        return mesh;
    }

    _measurePanelCss(panelEl) {
        const name = panelEl.getAttribute('name') || '';
        const root = panelEl.querySelector('.panel') || panelEl.firstElementChild;

        if (name === 'okButton') {
            return { cssW: 256, cssH: 96 };
        }

        if (!root) return { cssW: 380, cssH: 450 };

        const style = root.getAttribute('style') || '';
        const wMatch = style.match(/width:\s*([\d.]+)px/);
        const hMatch = style.match(/height:\s*([\d.]+)px/);

        let cssW = wMatch ? parseFloat(wMatch[1]) : 380;
        let cssH = hMatch ? parseFloat(hMatch[1]) : 450;

        return { cssW, cssH };
    }

    _htmlToTexture(html, width, height, cssText = '') {
        return new Promise((resolve, reject) => {
            const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;margin:0;padding:0;overflow:hidden;">
      <style>${cssText}</style>
      ${html}
    </div>
  </foreignObject>
</svg>`.trim();

            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);

                const tex = new THREE.CanvasTexture(canvas);
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.needsUpdate = true;
                resolve(tex);
            };
            img.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(e);
            };
            img.src = url;
        });
    }

    _createSphere() {
        const geo = new THREE.SphereGeometry(0.01, 24, 24);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xff00ff,
            metalness: 0.3,
            roughness: 0.4,
            emissive: 0xff00ff,
            emissiveIntensity: 0.15
        });
        return new THREE.Mesh(geo, mat);
    }

    _parseVec3(str, fallback) {
        if (!str) return fallback.slice();
        const parts = str.split(',').map(s => parseFloat(s.trim()));
        return parts.length === 3 && parts.every(Number.isFinite) ? parts : fallback.slice();
    }

    _makeCanvasPanel({ name, w, h, pos, rotX, rot = [rotX ?? -Math.PI / 2, 0, 0], canvasW = 380, canvasH = 450, draw }) {
        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        draw(ctx, canvasW, canvasH);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;

        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
        );
        mesh.name = name;
        mesh.position.set(...pos);
        mesh.rotation.set(...rot);
        mesh.userData.texture = tex;
        return mesh;
    }

    _roundRectPath(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}

// ─── backward-compatible free functions (no regression) ───────────────────────

const defaultFactory = new ModelFactory();

/**
 * @param {string|object} [targetData]
 * @param {object} [options]
 * @returns {Promise<THREE.Group>}
 */
export async function createArTarget(targetData, options = {}) {
    return defaultFactory.createArTarget(targetData, options);
}

/**
 * @param {string|object} [targetData]
 * @param {object} [options]
 * @returns {THREE.Group}
 */
export function createArTargetSync(targetData, options = {}) {
    return defaultFactory.createArTargetSync(targetData, options);
}