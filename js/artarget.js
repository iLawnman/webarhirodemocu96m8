import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

/**
 * ModelFactory — строит AR-таргет: физический маркер (сфера в WebGL) +
 * 5 отдельных интерактивных HTML-панелей (CSS3DObject):
 *   TitleBlock, MainBlock, ButtonsBlock, LeftHelpBlock, RightBlock
 *
 * Все панели создаются всегда, независимо от наличия данных.
 * Стили — через классы (.ar-css3d-panel и дочерние).
 * Темы подключаются ARSettings (./assets/arcss/*.css).
 */
export class ModelFactory {
    createArTargetSync(targetData = '', options = {}) {
        const { onAnswer = null } = options;

        const targetInfo = typeof targetData === 'object' && targetData !== null
            ? targetData
            : { title: String(targetData) };

        // ─── поля из JSON (answers / quest) ───────────────────────────────────
        const title =
            targetInfo.TitleText_Text ??
            targetInfo.title ??
            targetInfo.name ??
            String(targetData ?? '');

        const mainText =
            targetInfo.MainTxt_Text ??
            targetInfo.mainText ??
            targetInfo.question ??
            '';

        const questionText =
            targetInfo.Question ??
            targetInfo.question ??
            targetInfo.mainText ??
            'Выберите действие для продолжения:';

        const helpUp =
            targetInfo.HelpUpText_Text ??
            targetInfo.helpUp ??
            targetInfo.HelpUp ??
            '';

        const helpDown =
            targetInfo.HelpDownText_Text ??
            targetInfo.helpDown ??
            targetInfo.HelpDown ??
            '';

        const groupName =
            targetInfo.questId ??
            targetInfo.QuestID ??
            targetInfo.id ??
            targetInfo.AnswerID ??
            title ??
            'target';

        const answerType =
            targetInfo.AnswerType ??
            targetInfo.answerType ??
            'Slide';

        const imageSrc =
            targetInfo.imageSrc ??
            targetInfo.AnswerPicture_Image ??
            targetInfo.AdditionalImg_Image ??
            null;

        // ─── группа ──────────────────────────────────────────────────────────
        const group = new THREE.Group();
        group.name = `arTarget_${groupName}`;

        const sphere = this._createSphere();
        group.add(sphere);

        const handleAnswer = (value) => {
            if (typeof onAnswer === 'function') onAnswer(value);
        };

        // ─── 1. TitleBlock ────────────────────────────────────────────────────
        const titlePanel = this._createPanel({
            className: 'ar-css3d-panel ar-title-block',
            name: 'TitleBlock',
            position: [0, 0.09, 0],
            rotation: [-Math.PI / 2, 0, 0],
            scale: 0.0005
        });
        const titleEl = document.createElement('div');
        titleEl.className = 'ar-panel-title';
        titleEl.textContent = title || '';
        titlePanel.element.appendChild(titleEl);
        group.add(titlePanel);

        // ─── 2. MainBlock ─────────────────────────────────────────────────────
        const mainPanel = this._createPanel({
            className: 'ar-css3d-panel ar-main-block',
            name: 'MainBlock',
            position: [0, 0.02, 0],
            rotation: [-Math.PI / 2, 0, 0],
            scale: 0.0005
        });

        if (imageSrc) {
            const imgEl = document.createElement('img');
            imgEl.className = 'ar-panel-image';
            imgEl.src = imageSrc;
            mainPanel.element.appendChild(imgEl);
        }

        const questionEl = document.createElement('div');
        questionEl.className = 'ar-panel-question';
        questionEl.textContent = questionText || mainText || '';
        mainPanel.element.appendChild(questionEl);

        // дополнительный текст (MainTxt), если он отличается от question
        if (mainText && mainText !== questionText) {
            const mainTxtEl = document.createElement('div');
            mainTxtEl.className = 'ar-panel-maintext';
            mainTxtEl.textContent = mainText;
            mainPanel.element.appendChild(mainTxtEl);
        }

        group.add(mainPanel);

        // ─── 3. ButtonsBlock ──────────────────────────────────────────────────
        const buttonsPanel = this._createPanel({
            className: 'ar-css3d-panel ar-buttons-block',
            name: 'ButtonsBlock',
            position: [0, -0.08, 0],
            rotation: [-Math.PI / 2, 0, 0],
            scale: 0.0005
        });

        const bodyEl = document.createElement('div');
        bodyEl.className = 'ar-quest-body';
        buttonsPanel.element.appendChild(bodyEl);

        this._buildQuestionBody(
            bodyEl,
            { ...targetInfo, answerType, options: targetInfo.options || [] },
            handleAnswer
        );
        group.add(buttonsPanel);

        // ─── 4. LeftHelpBlock ─────────────────────────────────────────────────
        const leftPanel = this._createPanel({
            className: 'ar-css3d-panel ar-left-help-block',
            name: 'LeftHelpBlock',
            position: [-0.11, 0.01, 0],
            rotation: [-Math.PI / 2, (18 * Math.PI) / 180, 0],
            scale: 0.00045
        });
        const leftEl = document.createElement('div');
        leftEl.className = 'ar-panel-help ar-panel-help-up';
        leftEl.textContent = helpUp || '';
        leftPanel.element.appendChild(leftEl);
        group.add(leftPanel);

        // ─── 5. RightBlock ────────────────────────────────────────────────────
        const rightPanel = this._createPanel({
            className: 'ar-css3d-panel ar-right-block',
            name: 'RightBlock',
            position: [0.11, 0.01, 0],
            rotation: [-Math.PI / 2, (-18 * Math.PI) / 180, 0],
            scale: 0.00045
        });
        const rightEl = document.createElement('div');
        rightEl.className = 'ar-panel-help ar-panel-help-down';
        rightEl.textContent = helpDown || '';
        rightPanel.element.appendChild(rightEl);
        group.add(rightPanel);

        // ─── userData ─────────────────────────────────────────────────────────
        group.userData = {
            targetInfo,
            sphere,
            TitleBlock: titlePanel,
            MainBlock: mainPanel,
            ButtonsBlock: buttonsPanel,
            LeftHelpBlock: leftPanel,
            RightBlock: rightPanel,
            panelEl: mainPanel.element,          // legacy
            cssObject: mainPanel,                // legacy
            onAnswer,
            answerType
        };

        return group;
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    _createPanel({ className, name, position, rotation, scale }) {
        const el = document.createElement('div');
        el.className = className;

        const obj = new CSS3DObject(el);
        obj.name = name;
        obj.scale.set(scale, scale, scale);
        obj.position.set(...position);
        obj.rotation.set(...rotation);
        return obj;
    }

    _buildQuestionBody(bodyEl, data, onAnswer) {
        bodyEl.innerHTML = '';

        const type = data.answerType || data.AnswerType || 'Slide';
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
            slideContent.textContent = options[0]?.text || data.mainText || data.MainTxt_Text || '';

            const next = document.createElement('button');
            next.className = 'ar-slide-nav next';
            next.textContent = '►';

            const update = () => {
                slideContent.textContent =
                    options[idx]?.text || data.mainText || data.MainTxt_Text || '';
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