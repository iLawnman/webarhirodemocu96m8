import * as THREE from 'three';

// ─── Direct CSS Styles (без внешних шаблонов) ──────────────────────────────
const PANEL_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .question-panel-3d {
    width: 380px;
    padding: 18px;
    background: rgba(10, 10, 20, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .question-header {
    font-size: 16px;
    font-weight: 700;
    color: #00ffaa;
    margin-bottom: 10px;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .question-img-wrap {
    width: 100%;
    height: 140px;
    margin-bottom: 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .question-img {
    max-width: 100%;
    max-height: 140px;
    object-fit: contain;
  }
  .question-text {
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-line;
    margin-bottom: 14px;
    color: #f8fafc;
  }
  .quest-options-grid { display: grid; gap: 8px; }
  .quest-btn {
    padding: 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
    font-size: 13px;
    text-align: left;
    font-family: inherit;
  }
  .quest-input-block { display: flex; gap: 8px; }
  .quest-input {
    flex: 1;
    padding: 10px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
    font-size: 14px;
    font-family: inherit;
  }
  .quest-submit-btn {
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: #00cc66;
    color: #ffffff;
    font-weight: 700;
    font-size: 14px;
    font-family: inherit;
  }
  .quest-ok-btn { display: block; margin: 10px auto 0 auto; }
  .quest-slider {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
  }
  .slide-content {
    flex: 1;
    text-align: center;
    font-size: 13px;
    white-space: pre-line;
    line-height: 1.4;
  }
  .slide-nav {
    background: rgba(255, 255, 255, 0.15);
    border: none;
    color: #ffffff;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 14px;
  }
  .ok-btn-container {
    width: 256px;
    height: 96px;
    background: rgba(0, 40, 20, 0.95);
    border-radius: 12px;
    border: 2px solid #00ff99;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ok-btn-text {
    color: #ffffff;
    font-family: sans-serif;
    font-weight: bold;
    font-size: 32px;
    text-align: center;
  }
`;

/**
 * Скрываем классический DOM-оверлей
 */
function hideDOMOverlay() {
    ['question-panel', 'ui-overlay', 'overlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    document.querySelectorAll('.question-panel').forEach(el => el.style.display = 'none');
}

/**
 * Генерация HTML-строки для интерактивного тела вопроса
 */
export function buildInteractiveBodyHtml(targetInfo = {}, slideIndex = 0) {
    const answerType = targetInfo.answerType || 'Slide';
    const options = targetInfo.options || [];
    const mainText = targetInfo.mainText || '';

    if (answerType === 'Button') {
        const buttonsHtml = options.map((opt, idx) => 
            `<button class="quest-btn" data-opt-idx="${idx}">${opt.text || `Вариант ${idx + 1}`}</button>`
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
        const currentText = options[slideIndex]?.text || mainText || '';
        return `
            <div class="quest-slider">
                <button class="slide-nav prev">◄</button>
                <div class="slide-content">${currentText}</div>
                <button class="slide-nav next">►</button>
            </div>
        `;
    }
}

export class ModelFactory {
    constructor() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    }

    async createArTarget(targetData = '', options = {}) {
        hideDOMOverlay();

        const { onOk = null, camera = null, domElement = window } = options;
        const targetInfo = typeof targetData === 'object' && targetData !== null
            ? targetData
            : { title: String(targetData) };

        const title = targetInfo.title ?? targetInfo.name ?? String(targetData ?? '');
        const groupName = targetInfo.questId || targetInfo.id || title || 'target';

        const group = new THREE.Group();
        group.name = `arTarget_${groupName}`;

        // 1. Точечный фокус-маркер
        const sphere = this._createSphere();
        group.add(sphere);

        try {
            // 2. Генерация панели вопроса
            const questionMesh = await this._buildQuestionPanelMesh(targetInfo, 0);
            group.add(questionMesh);

            // 3. Генерация кнопки OK
            const okMesh = await this._buildOkButtonMesh(targetInfo.okText ?? 'OK');
            group.add(okMesh);

            group.position.z = 0.02;
            group.userData = {
                targetInfo,
                markerName: title,
                sphere,
                questionPanel: questionMesh,
                okButton: okMesh,
                slideIndex: 0,
                onOk
            };

            if (camera) {
                this._bind3DInteractions(group, camera, domElement);
            }

            return group;
        } catch (err) {
            console.warn('[ModelFactory] Fallback to sync canvas:', err);
            return this.createArTargetSync(targetData, options);
        }
    }

    createArTargetSync(targetData = '', options = {}) {
        hideDOMOverlay();
        const { onOk = null } = options;

        const targetInfo = typeof targetData === 'object' && targetData !== null
            ? targetData
            : { title: String(targetData) };

        const title = targetInfo.title ?? targetInfo.name ?? String(targetData ?? '');
        const question = targetInfo.question || targetInfo.mainText || '';
        const okText = targetInfo.okText ?? 'OK';

        const group = new THREE.Group();
        const sphere = this._createSphere();
        group.add(sphere);

        const questionPanel = this._makeCanvasPanel({
            name: 'questionPanel',
            w: 0.32, h: 0.38,
            pos: [0, 0, 0.02],
            rot: [-Math.PI / 2, 0, 0],
            canvasW: 380, canvasH: 450,
            draw: (ctx, cw, ch) => {
                ctx.fillStyle = 'rgba(10, 10, 20, 0.95)';
                ctx.fillRect(0, 0, cw, ch);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.lineWidth = 4;
                ctx.strokeRect(2, 2, cw - 4, ch - 4);

                ctx.fillStyle = '#00ffaa';
                ctx.font = 'bold 22px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(title, cw / 2, 40);

                ctx.fillStyle = '#ffffff';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(question, cw / 2, 100);
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
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 40px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(okText, cw / 2, ch / 2);
            }
        });
        group.add(okPanel);

        group.position.z = 0.02;
        group.userData = { targetInfo, sphere, questionPanel, okPanel, onOk };
        return group;
    }

    // ─── Dynamic HTML Panel Constructors ──────────────────────────────────

    async _buildQuestionPanelMesh(targetInfo, slideIndex = 0) {
        const title = targetInfo.title ?? targetInfo.name ?? '';
        const question = targetInfo.question || targetInfo.mainText || '';
        
        let imageSrc = targetInfo.imageSrc || targetInfo.image || '';
        if (imageSrc && !imageSrc.startsWith('data:')) {
            imageSrc = await this._imageToDataUrl(imageSrc);
        }

        const imgDisplay = imageSrc ? 'flex' : 'none';
        const bodyHtml = buildInteractiveBodyHtml(targetInfo, slideIndex);

        const html = `
            <div class="panel question-panel-3d">
                <div class="question-header">${title}</div>
                <div class="question-img-wrap" style="display: ${imgDisplay};">
                    <img class="question-img" src="${imageSrc}" alt="preview" />
                </div>
                <div class="question-text">${question}</div>
                <div class="question-body">${bodyHtml}</div>
            </div>
        `;

        const texture = await this._htmlToTexture(html, 380, 450);
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.32, 0.38),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
        );
        mesh.name = 'questionPanel';
        mesh.position.set(0, 0, 0.02);
        mesh.rotation.set(-Math.PI / 2, 0, 0);
        mesh.userData.texture = texture;
        return mesh;
    }

    async _buildOkButtonMesh(okText = 'OK') {
        const html = `
            <div class="panel ok-btn-container">
                <div class="ok-btn-text">${okText}</div>
            </div>
        `;

        const texture = await this._htmlToTexture(html, 256, 96);
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.16, 0.06),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
        );
        mesh.name = 'okButton';
        mesh.position.set(0, -0.22, 0.02);
        mesh.rotation.set(-Math.PI / 2, 0, 0);
        mesh.userData.texture = texture;
        return mesh;
    }

    // ─── 3D Raycasting & State Handling ───────────────────────────────────

    _bind3DInteractions(group, camera, domElement) {
        const onClick = (event) => {
            const rect = domElement.getBoundingClientRect ? domElement.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
            const clientX = event.clientX || (event.touches && event.touches[0].clientX);
            const clientY = event.clientY || (event.touches && event.touches[0].clientY);

            if (clientX === undefined) return;

            this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, camera);
            const intersects = this.raycaster.intersectObjects(group.children, true);

            if (intersects.length > 0) {
                const hit = intersects[0];
                const meshName = hit.object.name;

                if (meshName === 'okButton') {
                    if (typeof group.userData.onOk === 'function') {
                        group.userData.onOk(group.userData.targetInfo);
                    }
                } else if (meshName === 'questionPanel' && hit.uv) {
                    this._handlePanelClick(group, hit.uv);
                }
            }
        };

        const targetEl = domElement.addEventListener ? domElement : window;
        targetEl.addEventListener('pointerdown', onClick);
    }

    async _handlePanelClick(group, uv) {
        const info = group.userData.targetInfo;
        const options = info.options || [];

        // Переключение слайдов (клики на стрелки в нижней части 3D панели)
        if (uv.y < 0.25) { 
            let updated = false;
            if (uv.x < 0.3 && group.userData.slideIndex > 0) {
                group.userData.slideIndex--;
                updated = true;
            } else if (uv.x > 0.7 && group.userData.slideIndex < options.length - 1) {
                group.userData.slideIndex++;
                updated = true;
            }

            if (updated) {
                const newMesh = await this._buildQuestionPanelMesh(info, group.userData.slideIndex);
                const oldMesh = group.userData.questionPanel;
                
                if (oldMesh) {
                    oldMesh.material.map.dispose();
                    oldMesh.material.map = newMesh.material.map;
                    oldMesh.material.needsUpdate = true;
                }
            }
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    _imageToDataUrl(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || 100;
                canvas.height = img.naturalHeight || 100;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve('');
            img.src = url;
        });
    }

    _htmlToTexture(html, width, height) {
        return new Promise((resolve, reject) => {
            const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;margin:0;padding:0;overflow:hidden;">
      <style>${PANEL_STYLES}</style>
      ${html}
    </div>
  </foreignObject>
</svg>`.trim();

            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const img = new Image();

            img.onload = () => {
                setTimeout(() => {
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
                }, 20);
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
            emissive: 0xff00ff,
            emissiveIntensity: 0.15
        });
        return new THREE.Mesh(geo, mat);
    }

    _makeCanvasPanel({ name, w, h, pos, rot = [-Math.PI / 2, 0, 0], canvasW = 380, canvasH = 450, draw }) {
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

const defaultFactory = new ModelFactory();

export async function createArTarget(targetData, options = {}) {
    return defaultFactory.createArTarget(targetData, options);
}

export function createArTargetSync(targetData, options = {}) {
    return defaultFactory.createArTargetSync(targetData, options);
}