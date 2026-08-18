import * as THREE from 'three';

/**
 * Принудительно скрывает старый 2D DOM-оверлей
 */
function forceHideDOMOverlay() {
    const selectorList = ['#question-panel', '#ui-overlay', '#overlay', '.question-panel', '.ui-overlay'];
    selectorList.forEach(selector => {
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

    /**
     * Основная точка входа генерации AR-таргета
     */
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

        // 1. Центральный 3D-маркер (сфера)
        const sphere = this._createSphere();
        group.add(sphere);

        // 2. Загружаем фоновое изображение (если есть)
        let loadedImage = null;
        const imageSrc = targetInfo.imageSrc || targetInfo.image || '';
        if (imageSrc) {
            loadedImage = await this._loadImage(imageSrc);
        }

        // 3. Создаем 3D-панель с вопросом (Direct Canvas Render)
        const questionMesh = this._createQuestionPanelMesh(targetInfo, 0, loadedImage);
        group.add(questionMesh);

        // 4. Создаем 3D-кнопку OK
        const okMesh = this._createOkButtonMesh(targetInfo.okText ?? 'OK');
        group.add(okMesh);

        group.position.z = 0.02;
        group.userData = {
            targetInfo,
            markerName: title,
            sphere,
            questionPanel: questionMesh,
            okButton: okMesh,
            slideIndex: 0,
            loadedImage,
            onOk
        };

        // 5. Привязка 3D Raycasting (клики)
        if (camera) {
            this._bind3DInteractions(group, camera, domElement);
        }

        return group;
    }

    createArTargetSync(targetData = '', options = {}) {
        // Синхронный метод вызывает тот же Canvas-генератор без ожидания картинок
        return this.createArTarget(targetData, options);
    }

    // ─── Direct Canvas Rendering ───────────────────────────────────────────

    _createQuestionPanelMesh(targetInfo, slideIndex = 0, loadedImage = null) {
        const canvas = document.createElement('canvas');
        const cw = (canvas.width = 512);
        const ch = (canvas.height = 600);
        const ctx = canvas.getContext('2d');

        // Фон карточки
        ctx.fillStyle = 'rgba(10, 10, 20, 0.95)';
        this._roundRect(ctx, 0, 0, cw, ch, 24);
        ctx.fill();

        // Обводка
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Заголовок
        const title = targetInfo.title ?? targetInfo.name ?? '';
        ctx.fillStyle = '#00ffaa';
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title.toUpperCase(), cw / 2, 45);

        let currentY = 70;

        // Отрисовка изображения (если загружено)
        if (loadedImage) {
            const imgH = 160;
            const imgW = cw - 40;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            this._roundRect(ctx, 20, currentY, imgW, imgH, 12);
            ctx.fill();

            // Пропорциональное вписывание картинки
            const aspect = loadedImage.width / loadedImage.height;
            let drawW = imgW;
            let drawH = imgW / aspect;
            if (drawH > imgH) {
                drawH = imgH;
                drawW = imgH * aspect;
            }
            const drawX = 20 + (imgW - drawW) / 2;
            const drawY = currentY + (imgH - drawH) / 2;

            ctx.drawImage(loadedImage, drawX, drawY, drawW, drawH);
            currentY += imgH + 20;
        }

        // Текст вопроса
        const question = targetInfo.question || targetInfo.mainText || '';
        ctx.fillStyle = '#f8fafc';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        currentY = this._wrapText(ctx, question, cw / 2, currentY, cw - 50, 28);

        currentY += 20;

        // Интерактивное тело (Варианты / Слайдер)
        const answerType = targetInfo.answerType || 'Slide';
        const options = targetInfo.options || [];

        if (answerType === 'Button') {
            options.forEach((opt, idx) => {
                const btnY = currentY + idx * 55;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
                this._roundRect(ctx, 30, btnY, cw - 60, 45, 10);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = '18px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(opt.text || `Вариант ${idx + 1}`, 45, btnY + 28);
            });
        } else {
            // Slider / Default
            const currentText = options[slideIndex]?.text || targetInfo.mainText || '';

            // Стрелка Назад
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this._roundRect(ctx, 30, ch - 80, 50, 50, 10);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('◄', 55, ch - 48);

            // Текст слайда
            ctx.fillStyle = '#ffffff';
            ctx.font = '18px sans-serif';
            this._wrapText(ctx, currentText, cw / 2, ch - 65, cw - 180, 24);

            // Стрелка Вперед
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this._roundRect(ctx, cw - 80, ch - 80, 50, 50, 10);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px sans-serif';
            ctx.fillText('►', cw - 55, ch - 48);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;

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

    _createOkButtonMesh(okText = 'OK') {
        const canvas = document.createElement('canvas');
        const cw = (canvas.width = 256);
        const ch = (canvas.height = 96);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0, 40, 20, 0.95)';
        this._roundRect(ctx, 0, 0, cw, ch, 16);
        ctx.fill();

        ctx.fillStyle = '#00cc66';
        this._roundRect(ctx, 10, 10, cw - 20, ch - 20, 12);
        ctx.fill();

        ctx.strokeStyle = '#00ff99';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(okText, cw / 2, ch / 2);

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
        mesh.userData.texture = texture;
        return mesh;
    }

    // ─── Raycasting & Interactions ────────────────────────────────────────

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

    _handlePanelClick(group, uv) {
        const info = group.userData.targetInfo;
        const options = info.options || [];

        // Переключение слайдера внизу 3D-панели (UV Y < 0.2)
        if (uv.y < 0.2) {
            let updated = false;
            if (uv.x < 0.25 && group.userData.slideIndex > 0) {
                group.userData.slideIndex--;
                updated = true;
            } else if (uv.x > 0.75 && group.userData.slideIndex < options.length - 1) {
                group.userData.slideIndex++;
                updated = true;
            }

            if (updated) {
                const oldMesh = group.userData.questionPanel;
                const newMesh = this._createQuestionPanelMesh(
                    info,
                    group.userData.slideIndex,
                    group.userData.loadedImage
                );

                if (oldMesh) {
                    oldMesh.material.map.dispose();
                    oldMesh.material.map = newMesh.material.map;
                    oldMesh.material.needsUpdate = true;
                }
            }
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    _loadImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }

    _createSphere() {
        const geo = new THREE.SphereGeometry(0.01, 24, 24);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xff00ff,
            emissive: 0xff00ff,
            emissiveIntensity: 0.2
        });
        return new THREE.Mesh(geo, mat);
    }

    _roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
        return currentY;
    }
}

const defaultFactory = new ModelFactory();

export async function createArTarget(targetData, options = {}) {
    return defaultFactory.createArTarget(targetData, options);
}

export function createArTargetSync(targetData, options = {}) {
    return defaultFactory.createArTargetSync(targetData, options);
}