import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

/**
 * ModelFactory — строит AR-таргет: физический маркер (сфера в WebGL) +
 * интерактивная HTML-панель вопроса (CSS3DObject).
 *
 * Стили панели — через классы (.ar-css3d-panel и дочерние).
 * Темы подключаются ARSettings (./assets/arcss/*.css).
 */
export class ModelFactory {
    createArTargetSync(targetData = '', options = {}) {
        const { onAnswer = null } = options;

        const targetInfo = typeof targetData === 'object' && targetData !== null
            ? targetData
            : { title: String(targetData) };

        const title = targetInfo.title ?? targetInfo.name ?? String(targetData ?? '');
        const questionText = targetInfo.question || targetInfo.mainText || 'Выберите действие для продолжения:';
        const groupName = targetInfo.questId || targetInfo.id || title || 'target';
        const answerType = targetInfo.answerType || 'Slide';

        const group = new THREE.Group();
        group.name = `arTarget_${groupName}`;

        const sphere = this._createSphere();
        group.add(sphere);

        const panelEl = document.createElement('div');
        panelEl.className = 'ar-css3d-panel';

        const titleEl = document.createElement('div');
        titleEl.className = 'ar-panel-title';
        titleEl.textContent = title || 'ОТЛАДКА AR';
        panelEl.appendChild(titleEl);

        if (targetInfo.imageSrc) {
            const imgEl = document.createElement('img');
            imgEl.className = 'ar-panel-image';
            imgEl.src = targetInfo.imageSrc;
            panelEl.appendChild(imgEl);
        }

        const questionEl = document.createElement('div');
        questionEl.className = 'ar-panel-question';
        questionEl.textContent = questionText;
        panelEl.appendChild(questionEl);

        const bodyEl = document.createElement('div');
        bodyEl.className = 'ar-quest-body';
        panelEl.appendChild(bodyEl);

        const handleAnswer = (value) => {
            if (typeof onAnswer === 'function') onAnswer(value);
        };

        this._buildQuestionBody(bodyEl, { ...targetInfo, answerType }, handleAnswer);

        const cssObject = new CSS3DObject(panelEl);
        cssObject.scale.set(0.0005, 0.0005, 0.0005);
        cssObject.position.set(0, 0, 0);
        cssObject.rotation.set(-Math.PI / 2, 0, 0);
        group.add(cssObject);

        group.userData = { targetInfo, sphere, cssObject, panelEl, onAnswer, answerType };
        return group;
    }

    _buildQuestionBody(bodyEl, data, onAnswer) {
        bodyEl.innerHTML = '';

        const type = data.answerType || 'Slide';
        const options = data.options || [];

        if (type === 'Button') {
            const grid = document.createElement('div');
            grid.className = 'ar-quest-options-grid';

            options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'ar-quest-btn';
                btn.textContent = opt.text || `Вариант ${idx + 1}`;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onAnswer(idx + 1);
                });
                grid.appendChild(btn);
            });

            bodyEl.appendChild(grid);

        } else if (type === 'InputField') {
            const wrap = document.createElement('div');
            wrap.className = 'ar-quest-input-block';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'ar-quest-input';
            input.placeholder = 'Введите ответ...';
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('keydown', (e) => {
                e.stopPropagation();
                if (e.key === 'Enter') onAnswer(input.value);
            });

            const submitBtn = document.createElement('button');
            submitBtn.className = 'ar-quest-submit-btn';
            submitBtn.textContent = 'OK';
            submitBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onAnswer(input.value);
            });

            wrap.appendChild(input);
            wrap.appendChild(submitBtn);
            bodyEl.appendChild(wrap);

        } else if (type === 'Art' || type === 'AntiArt') {
            const btn = document.createElement('button');
            btn.className = 'ar-quest-submit-btn ar-quest-ok-btn';
            btn.textContent = 'OK';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                onAnswer(true);
            });
            bodyEl.appendChild(btn);

        } else {
            // Slide (по умолчанию)
            let idx = 0;
            const total = Math.max(options.length, 1);

            const slider = document.createElement('div');
            slider.className = 'ar-quest-slider';

            const prev = document.createElement('button');
            prev.className = 'ar-slide-nav prev';
            prev.textContent = '◄';

            const slideContent = document.createElement('div');
            slideContent.className = 'ar-slide-content';
            slideContent.textContent = options[0]?.text || data.mainText || '';

            const next = document.createElement('button');
            next.className = 'ar-slide-nav next';
            next.textContent = '►';

            const update = () => {
                slideContent.textContent = options[idx]?.text || data.mainText || '';
            };

            prev.addEventListener('click', (e) => {
                e.stopPropagation();
                idx = (idx - 1 + total) % total;
                update();
            });
            next.addEventListener('click', (e) => {
                e.stopPropagation();
                idx = (idx + 1) % total;
                update();
            });

            slider.appendChild(prev);
            slider.appendChild(slideContent);
            slider.appendChild(next);
            bodyEl.appendChild(slider);

            const okBtn = document.createElement('button');
            okBtn.className = 'ar-quest-submit-btn ar-quest-ok-btn';
            okBtn.textContent = 'OK';
            okBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onAnswer(idx + 1);
            });
            bodyEl.appendChild(okBtn);
        }
    }

    _createSphere() {
        const geo = new THREE.SphereGeometry(0.0075, 24, 24);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x00ffaa,
            emissive: 0x00ffaa,
            emissiveIntensity: 0.5
        });
        return new THREE.Mesh(geo, mat);
    }
}

const defaultFactory = new ModelFactory();

export function createArTargetSync(targetData, options = {}) {
    return defaultFactory.createArTargetSync(targetData, options);
}

export async function createArTarget(targetData, options = {}) {
    return defaultFactory.createArTargetSync(targetData, options);
}