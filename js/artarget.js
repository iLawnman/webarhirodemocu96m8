import * as THREE from 'three';

function forceHideDOMOverlay() {
    ['#question-panel', '#ui-overlay', '#overlay', '.question-panel', '.ui-overlay'].forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
        });
    });
}

export class ModelFactory {
    constructor() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    }

    async createArTarget(targetData = '', options = {}) {
        forceHideDOMOverlay();

        const { onOk = null, camera = null, domElement = window } = options;
        const targetInfo = typeof targetData === 'object' && targetData !== null
            ? targetData
            : { title: String(targetData) };

        const title = targetInfo.title ?? targetInfo.name ?? String(targetData ?? '');
        const groupName = targetInfo.questId || targetInfo.id || title || 'target';

        const group = new THREE.Group();
        group.name = `arTarget_${groupName}`;

        // 1. Центральная отладочная сфера (Ярко-зеленая для проверки видимости 3D)
        const sphere = this._createSphere();
        group.add(sphere);

        // 2. Генерация панели с HTML кнопкой "Надо выбрать как поступить"
        const questionMesh = await this._buildDebugHtmlPanelMesh(title, targetInfo);
        group.add(questionMesh);

        // 3. Генерация стандартной 3D-кнопки OK
        const okMesh = this._createOkButtonMesh(targetInfo.okText ?? 'OK');
        group.add(okMesh);

        group.position.z = 0.02;
        group.userData = {
            targetInfo,
            markerName: title,
            sphere,
            questionPanel: questionMesh,
            okButton: okMesh,
            onOk
        };

        if (camera) {
            this._bind3DInteractions(group, camera, domElement);
        }

        return group;
    }

    createArTargetSync(targetData = '', options = {}) {
        return this.createArTarget(targetData, options);
    }

    // ─── Рендеринг HTML-кнопки в 3D Текстуру ─────────────────────────────

    async _buildDebugHtmlPanelMesh(title, targetInfo) {
        const questionText = targetInfo.question || targetInfo.mainText || 'Выберите действие для продолжения:';

        // Формируем чистый HTML-шаблон для рендеринга
        const htmlContent = `
            <div style="
                width: 380px; 
                height: 450px; 
                background: rgba(10, 10, 20, 0.95); 
                border: 2px solid #00ffaa; 
                border-radius: 16px; 
                padding: 20px; 
                box-sizing: border-box; 
                font-family: sans-serif; 
                color: #ffffff;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: center;
                text-align: center;
            ">
                <div style="font-size: 20px; font-weight: bold; color: #00ffaa; text-transform: uppercase;">
                    ${title || 'ОТЛАДКА AR'}
                </div>
                
                <div style="font-size: 15px; color: #f8fafc; line-height: 1.4;">
                    ${questionText}
                </div>

                <!-- ТЕСТОВАЯ HTML КНОПКА -->
                <button style="
                    width: 100%;
                    padding: 16px;
                    background: #ffaa00;
                    color: #000000;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(255, 170, 0, 0.4);
                ">
                    Надо выбрать как поступить
                </button>
            </div>
        `;

        let texture;
        try {
            texture = await this._htmlToTexture(htmlContent, 380, 450);
        } catch (e) {
            console.warn('[AR] SVG render failed, using Canvas fallback', e);
            texture = this._createCanvasFallbackTexture(title, questionText);
        }

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

    _htmlToTexture(html, width, height) {
        return new Promise((resolve, reject) => {
            const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
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
                }, 30);
            };

            img.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(err);
            };

            img.src = url;
        });
    }

    _createCanvasFallbackTexture(title, text) {
        const canvas = document.createElement('canvas');
        canvas.width = 380;
        canvas.height = 450;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(10, 10, 20, 0.95)';
        ctx.fillRect(0, 0, 380, 450);
        ctx.strokeStyle = '#00ffaa';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 376, 446);

        ctx.fillStyle = '#00ffaa';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title || 'ОТЛАДКА AR', 190, 50);

        ctx.fillStyle = '#ffffff';
        ctx.font = '16px sans-serif';
        ctx.fillText(text, 190, 120);

        // Отрисовка кнопки
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(30, 320, 320, 60);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('Надо выбрать как поступить', 190, 355);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        return tex;
    }

    _createOkButtonMesh(okText = 'OK') {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 96;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0, 40, 20, 0.95)';
        ctx.fillRect(0, 0, 256, 96);
        ctx.fillStyle = '#00cc66';
        ctx.fillRect(10, 10, 236, 76);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(okText, 128, 48);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;

        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.16, 0.06),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
        );
        mesh.name = 'okButton';
        mesh.position.set(0, -0.22, 0.02);
        mesh.rotation.set(-Math.PI / 2, 0, 0);
        return mesh;
    }

    _bind3DInteractions(group, camera, domElement) {
        const onClick = (event) => {
            forceHideDOMOverlay();

            const rect = domElement.getBoundingClientRect
                ? domElement.getBoundingClientRect()
                : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

            const clientX = event.clientX || (event.touches && event.touches[0].clientX);
            const clientY = event.clientY || (event.touches && event.touches[0].clientY);

            if (clientX === undefined) return;

            this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, camera);
            const intersects = this.raycaster.intersectObjects(group.children, true);

            if (intersects.length > 0) {
                const hit = intersects[0];
                if (hit.object.name === 'okButton' && typeof group.userData.onOk === 'function') {
                    group.userData.onOk(group.userData.targetInfo);
                }
            }
        };

        const targetEl = domElement.addEventListener ? domElement : window;
        targetEl.addEventListener('pointerdown', onClick);
    }

    _createSphere() {
        const geo = new THREE.SphereGeometry(0.02, 24, 24);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5
        });
        return new THREE.Mesh(geo, mat);
    }
}

const defaultFactory = new ModelFactory();

export async function createArTarget(targetData, options = {}) {
    return defaultFactory.createArTarget(targetData, options);
}

export function createArTargetSync(targetData, options = {}) {
    return defaultFactory.createArTargetSync(targetData, options);
}