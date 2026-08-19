import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

/**
 * ModelFactory — строит AR-таргет: физический маркер (сфера в WebGL) +
 * интерактивная HTML-панель вопроса (CSS3DObject), являющаяся частью
 * того же THREE.Group и следующая за трекингом маркера с сохранением поворота.
 */
export class ModelFactory {
    /**
     * Синхронное создание AR-таргета с полноценной панелью вопроса.
     * Никаких Promise — вызывается прямо в кадровом цикле (processTracking).
     *
     * @param {string|object} [targetData='']
     * @param {object} [targetData.title]
     * @param {object} [targetData.question]      Текст вопроса
     * @param {object} [targetData.mainText]       Текст-заглушка для Slide без вариантов
     * @param {'Slide'|'Button'|'InputField'|'Art'|'AntiArt'} [targetData.answerType]
     * @param {Array}  [targetData.options]
     * @param {string} [targetData.imageSrc]       Картинка распознанного маркера
     * @param {object} [options]
     * @param {Function|null} [options.onAnswer]   callback(value) — вызывается когда пользователь дал ответ
     * @returns {THREE.Group}
     */
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

        // 1. Физический 3D-маркер в WebGL (зелёная точка) — в origin, в 2 раза меньше
        const sphere = this._createSphere();
        group.add(sphere);

        // 2. HTML-панель вопроса — часть таргета, не оверлей
        const panelEl = document.createElement('div');
        panelEl.className = 'ar-css3d-panel';
        panelEl.style.cssText = `
      width: 320px;
      padding: 16px;
      background: rgba(10, 10, 20, 0.92);
      border: 2px solid #00ffaa;
      border-radius: 16px;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      text-align: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      pointer-events: auto;
      user-select: none;
      transform-style: preserve-3d;
    `;

        const titleEl = document.createElement('div');
        titleEl.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      color: #00ffaa;
      margin-bottom: 10px;
      text-transform: uppercase;
    `;
        titleEl.textContent = title || 'ОТЛАДКА AR';
        panelEl.appendChild(titleEl);

        if (targetInfo.imageSrc) {
            const imgEl = document.createElement('img');
            imgEl.src = targetInfo.imageSrc;
            imgEl.style.cssText = `
        width: 100%;
        max-height: 140px;
        object-fit: cover;
        border-radius: 10px;
        border: 1px solid #00ffaa55;
        margin-bottom: 10px;
        display: block;
      `;
            panelEl.appendChild(imgEl);
        }

        const questionEl = document.createElement('div');
        questionEl.style.cssText = `
      font-size: 14px;
      color: #f8fafc;
      line-height: 1.4;
      margin-bottom: 4px;
    `;
        questionEl.textContent = questionText;
        panelEl.appendChild(questionEl);

        const bodyEl = document.createElement('div');
        bodyEl.className = 'ar-quest-body';
        panelEl.appendChild(bodyEl);

        const handleAnswer = (value) => {
            if (typeof onAnswer === 'function') onAnswer(value);
        };

        this._buildQuestionBody(bodyEl, { ...targetInfo, answerType }, handleAnswer);

        // 3. CSS3DObject — точно в позиции маркера (локальный origin)
        // scale 0.0005 ≈ 0.16 м, rotation в радианах
        const cssObject = new CSS3DObject(panelEl);
        cssObject.scale.set(0.0005, 0.0005, 0.0005);
        cssObject.position.set(0, 0, 0);
        cssObject.rotation.set(-Math.PI / 2, 0, 0);
        group.add(cssObject);

        group.userData = { targetInfo, sphere, cssObject, panelEl, onAnswer, answerType };
        return group;
    }

    /**
     * Строит интерактивное тело панели в зависимости от answerType.
     */
    _buildQuestionBody(bodyEl, data, onAnswer) {
        bodyEl.innerHTML = '';

        const type = data.answerType || 'Slide';
        const options = data.options || [];

        if (type === 'Button') {
            const grid = document.createElement('div');
            grid.className = 'ar-quest-options-grid';
            grid.style.cssText = `display:flex; flex-direction:column; gap:8px; margin-top:12px;`;

            options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'ar-quest-btn';
                btn.textContent = opt.text || `Вариант ${idx + 1}`;
                btn.style.cssText = `
          width: 100%;
          padding: 12px;
          background: #ffaa00;
          color: #000000;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
        `;
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
            wrap.style.cssText = `display:flex; gap:8px; margin-top:12px;`;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'ar-quest-input';
            input.placeholder = 'Введите ответ...';
            input.style.cssText = `
        flex: 1;
        min-width: 0;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid #00ffaa;
        background: #0a0a14;
        color: #ffffff;
        font-size: 14px;
      `;
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('keydown', (e) => {
                e.stopPropagation();
                if (e.key === 'Enter') onAnswer(input.value);
            });

            const submitBtn = document.createElement('button');
            submitBtn.className = 'ar-quest-submit-btn';
            submitBtn.textContent = 'OK';
            submitBtn.style.cssText = `
        padding: 10px 16px;
        background: #00cc66;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
      `;
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
            btn.style.cssText = `
        width: 100%;
        margin-top: 12px;
        padding: 10px;
        background: #00cc66;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
      `;
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
            slider.style.cssText = `display:flex; align-items:center; gap:8px; margin-top:12px;`;

            const navBtnStyle = `
        flex: 0 0 auto;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: 1px solid #00ffaa;
        background: transparent;
        color: #00ffaa;
        font-size: 16px;
        cursor: pointer;
      `;

            const prev = document.createElement('button');
            prev.className = 'ar-slide-nav prev';
            prev.textContent = '◄';
            prev.style.cssText = navBtnStyle;

            const slideContent = document.createElement('div');
            slideContent.className = 'ar-slide-content';
            slideContent.style.cssText = `flex: 1; min-width: 0; font-size: 13px; color: #f8fafc; line-height: 1.4;`;
            slideContent.textContent = options[0]?.text || data.mainText || '';

            const next = document.createElement('button');
            next.className = 'ar-slide-nav next';
            next.textContent = '►';
            next.style.cssText = navBtnStyle;

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
            okBtn.style.cssText = `
        width: 100%;
        margin-top: 10px;
        padding: 10px;
        background: #00cc66;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
      `;
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

/** Синхронное создание AR-таргета (используется в кадровом цикле). */
export function createArTargetSync(targetData, options = {}) {
    return defaultFactory.createArTargetSync(targetData, options);
}

/** Асинхронная обёртка сохранена для обратной совместимости. */
export async function createArTarget(targetData, options = {}) {
    return defaultFactory.createArTargetSync(targetData, options);
}