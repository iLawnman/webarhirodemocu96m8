import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// ВАЖНО: имя файла регистрозависимо на большинстве серверов/CDN (Linux, most
// hosting). Файл называется "artargetPrefab.html" (заглавная P). Если тут
// будет несовпадение регистра — fetch() в _ensurePrefab() молча упадёт в 404,
// ошибка уйдёт в console.warn, и всё тихо откатится на _buildFallbackPrefab().
// Именно это и было причиной "перекрытия панелей" на скриншоте: реальный
// prefab не грузился, а fallback использовал другие (более тесные) позиции.
const DEFAULT_PREFAB_URL = './assets/artargetPrefab.html';

/**
 * Канонический набор панелей и их дефолтные position/rotation/scale.
 * Единственный источник дефолтных значений — используется:
 *   1) для сборки fallback-prefab целиком (если fetch prefab-файла не удался);
 *   2) для точечной синтезации ОТДЕЛЬНОЙ панели, если реальный prefab
 *      загрузился, но в нём нет панели с таким data-name (например, кто-то
 *      отредактировал artargetPrefab.html и забыл один из блоков).
 *
 * Если панель с данным именем ЕСТЬ в prefab — она используется как есть
 * (авторская разметка в приоритете), эти значения не применяются.
 *
 * Числа рассчитаны от реальных CSS-размеров панелей (см. <style> в
 * artargetPrefab.html: .ar-left-help-block/.ar-right-block/.ar-main-block/
 * .ar-buttons-block), взят худший случай (max-height), чтобы панели НЕ
 * пересекались даже при максимально длинном контенте:
 *
 *   LeftHelp/Right: 160×200px * 0.00048 = 0.0768 × 0.096 м
 *   Main:           220×240px * 0.0005  = 0.11   × 0.12  м
 *   Buttons:        200×120px * 0.0005  = 0.10   × 0.06  м
 *
 * Верхние края LeftHelp/Main/Right выровнены по общей линии (Y_top ≈ 0.09),
 * ButtonsBlock подвешен вплотную под MainBlock с небольшим зазором.
 * Меняешь CSS-размеры панелей — пересчитай эти позиции (и synхронно
 * поправь data-position в artargetPrefab.html, чтобы два файла не разъезжались).
 *
 * ─── про Z (глубина) ────────────────────────────────────────────────────
 * Раньше у всех 4 панелей z=0 — они лежали в одной плоскости. CSS3DRenderer
 * каждый кадр пересортировывает DOM-узлы по расстоянию до камеры; когда
 * расстояния у нескольких панелей почти равны (как тут, из-за общего z=0
 * и лёгких Y-поворотов ±12°), при малейшем движении камеры порядок сортировки
 * "перещёлкивается" туда-обратно — из-за этого текст визуально мерцает,
 * а невидимая в данный момент "верхняя" по z-порядку панель может перехватывать
 * клики у той, что должна быть кликабельной (кнопки).
 * Фикс: развели панели по z на разные, заведомо различающиеся значения,
 * чтобы порядок глубины был однозначным и стабильным при любом ракурсе:
 *   ButtonsBlock (0.004) — впереди всех, это интерактивный слой, ему
 *                          нельзя давать шанс оказаться "под" чем-то ещё;
 *   MainBlock    (0.002) — второй по важности, центральный контент;
 *   LeftHelpBlock/RightBlock (0.001) — фон/подсказки, дальше всех.
 * Значения маленькие (миллиметры), от маркера панели визуально не отрываются.
 */
const PANEL_ORDER = ['LeftHelpBlock', 'MainBlock', 'RightBlock', 'ButtonsBlock'];

const PANEL_DEFAULTS = {
    LeftHelpBlock: {
        className: 'ar-left-help-block',
        position: [-0.17, 0.042, 0.001],
        rotation: [-90, 12, 0],
        scale: 0.00048,
        html: '<div class="ar-panel-help" data-field="help"></div>'
    },
    MainBlock: {
        className: 'ar-main-block',
        position: [0, 0.03, 0.002],
        rotation: [-90, 0, 0],
        scale: 0.0005,
        html: `<div class="ar-panel-title" data-field="title"></div>
       <div class="ar-panel-question" data-field="question"></div>
       <div class="ar-panel-maintext" data-field="mainText"></div>`
    },
    RightBlock: {
        className: 'ar-right-block',
        position: [0.17, 0.042, 0.001],
        rotation: [-90, -12, 0],
        scale: 0.00048,
        html: `<img class="ar-panel-image" data-field="imageSrc" alt="" />
       <div class="ar-panel-help" data-field="imageCaption"></div>`
    },
    ButtonsBlock: {
        className: 'ar-buttons-block',
        position: [0, -0.075, 0.004],
        rotation: [-90, 0, 0],
        scale: 0.0005,
        html: '<div class="ar-quest-body" data-field="buttons"></div>'
    }
};

/**
 * ModelFactory — AR-таргет:
 *   сфера-маркер (WebGL) + 4 CSS3D-панели из prefab:
 *     LeftHelpBlock | MainBlock | RightBlock
 *                   | ButtonsBlock
 *
 * Все панели создаются всегда (даже при пустых данных).
 * Структура панелей и позиции — в artargetPrefab.html (если он загрузился;
 * если конкретной панели там нет — берутся дефолты из PANEL_DEFAULTS выше).
 * Входные данные: любой объект с полями answers.json / questtable
 * или упрощённый { title, question, mainText, help, imageSrc, options, answerType }.
 *
 * Макет по умолчанию (метры, относительно маркера) — см. PANEL_DEFAULTS.
 */
export class ModelFactory {
    /**
     * @param {object} [defaults]
     * @param {string} [defaults.prefabUrl]
     */
    constructor(defaults = {}) {
        this.prefabUrl = defaults.prefabUrl || DEFAULT_PREFAB_URL;
        this._prefabCache = null; // DocumentFragment / template content
    }

    /**
     * Асинхронное создание (загружает prefab при необходимости).
     * @param {string|object} [targetData='']
     * @param {object} [options]
     * @param {Function|null} [options.onAnswer]
     * @param {string} [options.prefabUrl]
     * @returns {Promise<THREE.Group>}
     */
    async createArTarget(targetData = '', options = {}) {
        const prefabUrl = options.prefabUrl || this.prefabUrl;
        await this._ensurePrefab(prefabUrl);
        return this.createArTargetSync(targetData, options);
    }

    /**
     * Синхронное создание (prefab должен быть уже загружен, иначе fallback-разметка).
     * @param {string|object} [targetData='']
     * @param {object} [options]
     * @param {Function|null} [options.onAnswer]
     * @returns {THREE.Group}
     */
    createArTargetSync(targetData = '', options = {}) {
        const { onAnswer = null } = options;
        const data = this._normalizeTargetData(targetData);

        const group = new THREE.Group();
        group.name = `arTarget_${data.groupName}`;

        const sphere = this._createSphere();
        group.add(sphere);

        const handleAnswer = (value) => {
            if (typeof onAnswer === 'function') onAnswer(value);
        };

        const panelNodes = this._getPanelNodes();
        const panels = {};

        for (const src of panelNodes) {
            const name = src.dataset.name || 'panel';
            const el = src.cloneNode(true);

            // заполнение полей
            this._fillPanel(el, name, data, handleAnswer);

            const pos = this._parseVec3(el.dataset.position, [0, 0, 0]);
            const rotDeg = this._parseVec3(el.dataset.rotation, [-90, 0, 0]);
            const rot = rotDeg.map((d) => (d * Math.PI) / 180);
            const scale = parseFloat(el.dataset.scale) || 0.0005;

            // убираем data-* из DOM (не нужны в runtime)
            el.removeAttribute('data-name');
            el.removeAttribute('data-position');
            el.removeAttribute('data-rotation');
            el.removeAttribute('data-scale');

            const cssObject = new CSS3DObject(el);
            cssObject.name = name;
            cssObject.scale.set(scale, scale, scale);
            cssObject.position.set(...pos);
            cssObject.rotation.set(...rot);

            group.add(cssObject);
            panels[name] = cssObject;
        }

        group.userData = {
            targetInfo: data.raw,
            normalized: data,
            sphere,
            ...panels,
            // legacy
            panelEl: panels.MainBlock?.element || null,
            cssObject: panels.MainBlock || null,
            onAnswer,
            answerType: data.answerType
        };

        return group;
    }

    // ─── normalize any input shape ─────────────────────────────────────────────

    /**
     * Приводит произвольный targetData к единому виду.
     * Поддерживает:
     *  - строку / число
     *  - answers.json-строку (TitleText_Text, MainTxt_Text, HelpUpText_Text, …)
     *  - questtable-поля
     *  - упрощённый объект { title, question, mainText, help, imageSrc, options, answerType }
     */
    _normalizeTargetData(targetData) {
        const raw =
            typeof targetData === 'object' && targetData !== null
                ? targetData
                : { title: String(targetData ?? '') };

        const pick = (...keys) => {
            for (const k of keys) {
                const v = raw[k];
                if (v !== undefined && v !== null && String(v).trim() !== '') return v;
            }
            return '';
        };

        const title = String(
            pick('TitleText_Text', 'title', 'name', 'Title') || ''
        );

        const question = String(
            pick('Question', 'question', 'MainTxt_Text', 'mainText') || ''
        );

        // mainText отдельно, если отличается от question
        let mainText = String(pick('MainTxt_Text', 'mainText') || '');
        if (mainText === question) mainText = '';

        const help = String(
            pick(
                'HelpUpText_Text',
                'HelpDownText_Text',
                'help',
                'helpUp',
                'helpDown',
                'HelpUp',
                'HelpDown'
            ) || ''
        );

        // если есть оба help — склеиваем
        const helpUp = String(pick('HelpUpText_Text', 'helpUp', 'HelpUp') || '');
        const helpDown = String(pick('HelpDownText_Text', 'helpDown', 'HelpDown') || '');
        const helpCombined =
            help ||
            [helpUp, helpDown].filter(Boolean).join('\n\n') ||
            '';

        const imageSrc = String(
            pick(
                'imageSrc',
                'AnswerPicture_Image',
                'AdditionalImg_Image',
                'image',
                'img'
            ) || ''
        );

        const imageCaption = String(
            pick('imageCaption', 'imgLabel', 'AnswerPictureCaption') || ''
        );

        const answerType = String(
            pick('AnswerType', 'answerType', 'type') || 'Slide'
        );

        // options: массив { text } или строки
        let options = raw.options || raw.Options || [];
        if (!Array.isArray(options)) options = [];
        options = options.map((o, i) => {
            if (typeof o === 'string') return { text: o };
            if (o && typeof o === 'object') return { text: o.text ?? o.MainTxt_Text ?? String(o) };
            return { text: `Вариант ${i + 1}` };
        });

        // AnswerList из quest (A01, A02…) — не разворачиваем здесь, ожидаем готовые options
        // либо caller передаёт уже подготовленный options

        const groupName = String(
            pick('questId', 'QuestID', 'id', 'AnswerID', 'title', 'name') || 'target'
        );

        return {
            raw,
            title,
            question,
            mainText,
            help: helpCombined,
            helpUp,
            helpDown,
            imageSrc,
            imageCaption,
            answerType,
            options,
            groupName
        };
    }

    // ─── prefab load / fallback ────────────────────────────────────────────────

    /**
     * Загружает реальный prefab по сети и кеширует его в this._prefabCache.
     *
     * ВАЖНО про кэш: this._prefabCache хранит ТОЛЬКО успешно загруженный
     * реальный prefab. Если fetch не удался — мы НЕ пишем сюда fallback,
     * иначе следующий вызов _ensurePrefab() увидит "кэш уже заполнен" и
     * больше никогда не попытается загрузить настоящий prefab заново
     * (даже если сеть/путь потом починили). Раньше здесь была именно эта
     * ошибка — один неудачный fetch "залипал" на fallback-разметке навсегда.
     */
    async _ensurePrefab(url) {
        if (this._prefabCache) return; // уже успешно загружен реальный prefab
        try {
            const res = await fetch(url, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const tpl = doc.querySelector('#ar-target') || doc.querySelector('template');
            if (!tpl) throw new Error('No <template id="ar-target">');

            // инжектим стили из prefab один раз
            const styleEl = doc.querySelector('style');
            if (styleEl && !document.getElementById('ar-target-prefab-styles')) {
                const s = document.createElement('style');
                s.id = 'ar-target-prefab-styles';
                s.textContent = styleEl.textContent;
                document.head.appendChild(s);
            }

            this._prefabCache = tpl.content || tpl;
        } catch (e) {
            console.error(
                `[ModelFactory] Не удалось загрузить prefab по адресу "${url}" — ` +
                `на ЭТОТ вызов используется временный fallback (позиции могут не ` +
                `совпадать с авторской разметкой). Кэш НЕ поражён — следующий вызов ` +
                `createArTarget() попробует загрузить реальный prefab заново. ` +
                `Частая причина 404: несовпадение регистра в имени файла на ` +
                `сервере/CDN — проверь, что путь прописан ТОЧНО так же, как ` +
                `называется файл на диске.`,
                e
            );
            // намеренно НЕ пишем fallback в this._prefabCache — см. коммент выше
        }
    }

    /**
     * Возвращает финальный список DOM-узлов панелей для сборки таргета,
     * с мерджем "prefab-first, default as fallback":
     *   - для каждого канонического имени (PANEL_ORDER) — если такая панель
     *     ЕСТЬ в загруженном prefab (по data-name), берём её как есть
     *     (авторская разметка/стили в приоритете);
     *   - если такой панели в prefab НЕТ — синтезируем её из PANEL_DEFAULTS
     *     (дефолтная позиция/поворот/масштаб, гарантированно без перекрытий);
     *   - любые ДОПОЛНИТЕЛЬНЫЕ панели, которые есть в prefab, но не входят
     *     в канонический набор (кастомные блоки автора) — тоже включаются,
     *     как есть, со своими собственными data-position/rotation/scale.
     *
     * Если реальный prefab ещё не загружен (this._prefabCache пуст), берём
     * fallback ТОЛЬКО на это обращение — он не сохраняется в this._prefabCache,
     * чтобы не заблокировать последующую успешную загрузку настоящего prefab.
     */
    _getPanelNodes() {
        const source = this._prefabCache || this._buildFallbackPrefab();

        const prefabNodes = Array.from(source.querySelectorAll('[data-name]'));
        const byName = new Map(prefabNodes.map((n) => [n.dataset.name, n]));

        const merged = [];

        for (const name of PANEL_ORDER) {
            const node = byName.get(name);
            if (node) {
                merged.push(node);
                byName.delete(name);
            } else {
                merged.push(this._makeDefaultPanelNode(name));
            }
        }

        // прочие, не-канонические панели, объявленные прямо в prefab
        for (const node of byName.values()) {
            merged.push(node);
        }

        return merged;
    }

    /** Синтезирует один дефолтный узел панели из PANEL_DEFAULTS. */
    _makeDefaultPanelNode(name) {
        const def = PANEL_DEFAULTS[name];
        if (!def) return null;
        const div = document.createElement('div');
        div.className = `ar-css3d-panel ${def.className}`;
        div.dataset.name = name;
        div.dataset.position = def.position.join(', ');
        div.dataset.rotation = def.rotation.join(', ');
        div.dataset.scale = String(def.scale);
        div.innerHTML = def.html;
        return div;
    }

    /** Минимальная разметка целиком, если prefab не загрузился вообще. */
    _buildFallbackPrefab() {
        const root = document.createDocumentFragment();
        for (const name of PANEL_ORDER) {
            root.appendChild(this._makeDefaultPanelNode(name));
        }
        return root;
    }

    // ─── fill panel content ────────────────────────────────────────────────────

    _fillPanel(el, name, data, onAnswer) {
        const setText = (selector, value) => {
            const node = el.querySelector(selector);
            if (!node) return;
            node.textContent = value || '';
        };

        if (name === 'LeftHelpBlock') {
            setText('[data-field="help"]', data.help);
            if (!data.help) el.classList.add('ar-panel-empty');
        }

        if (name === 'MainBlock') {
            setText('[data-field="title"]', data.title);
            setText('[data-field="question"]', data.question);
            setText('[data-field="mainText"]', data.mainText);
            if (!data.title && !data.question && !data.mainText) {
                el.classList.add('ar-panel-empty');
            }
        }

        if (name === 'RightBlock') {
            const img = el.querySelector('[data-field="imageSrc"]');
            if (img) {
                if (data.imageSrc) {
                    img.src = data.imageSrc;
                    img.alt = data.imageCaption || data.title || '';
                } else {
                    img.removeAttribute('src');
                    img.alt = '';
                }
            }
            setText('[data-field="imageCaption"]', data.imageCaption);
            if (!data.imageSrc && !data.imageCaption) el.classList.add('ar-panel-empty');
        }

        if (name === 'ButtonsBlock') {
            const body = el.querySelector('[data-field="buttons"]') || el;
            this._buildQuestionBody(body, data, onAnswer);
        }

        // Кастомная панель, объявленная в prefab, но не входящая в канонический
        // набор (LeftHelpBlock/MainBlock/RightBlock/ButtonsBlock). Мы не знаем
        // её конкретной семантики, поэтому делаем максимум разумного:
        // подставляем значения по [data-field] из data.raw / data по имени поля.
        if (!['LeftHelpBlock', 'MainBlock', 'RightBlock', 'ButtonsBlock'].includes(name)) {
            const fields = el.querySelectorAll('[data-field]');
            let hasContent = false;
            fields.forEach((node) => {
                const field = node.dataset.field;
                if (!field) return;
                const raw = data.raw ? data.raw[field] : undefined;
                const val = raw !== undefined && raw !== null
                    ? String(raw)
                    : (data[field] !== undefined && data[field] !== null ? String(data[field]) : '');

                if (node.tagName === 'IMG') {
                    if (val) {
                        node.src = val;
                        hasContent = true;
                    } else {
                        node.removeAttribute('src');
                    }
                } else {
                    node.textContent = val;
                    if (val) hasContent = true;
                }
            });
            if (!hasContent) el.classList.add('ar-panel-empty');
        }
    }

    // ─── interactive body (без регрессий) ──────────────────────────────────────

    _buildQuestionBody(bodyEl, data, onAnswer) {
        bodyEl.innerHTML = '';

        const type = data.answerType || 'Slide';
        const options = data.options || [];

        if (type === 'Button') {
            const grid = document.createElement('div');
            grid.className = 'ar-quest-options-grid';

            options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ar-quest-btn';
                btn.textContent = opt.text || `Вариант ${idx + 1}`;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onAnswer(idx + 1);
                });
                grid.appendChild(btn);
            });

            // если options пуст — всё равно показываем блок (пустая сетка)
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
            submitBtn.type = 'button';
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
            btn.type = 'button';
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
            prev.type = 'button';
            prev.className = 'ar-slide-nav prev';
            prev.textContent = '◄';

            const slideContent = document.createElement('div');
            slideContent.className = 'ar-slide-content';
            slideContent.textContent =
                options[0]?.text || data.mainText || data.question || '';

            const next = document.createElement('button');
            next.type = 'button';
            next.className = 'ar-slide-nav next';
            next.textContent = '►';

            const update = () => {
                slideContent.textContent =
                    options[idx]?.text || data.mainText || data.question || '';
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
            okBtn.type = 'button';
            okBtn.className = 'ar-quest-submit-btn ar-quest-ok-btn';
            okBtn.textContent = 'OK';
            okBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onAnswer(idx + 1);
            });
            bodyEl.appendChild(okBtn);
        }
    }

    // ─── helpers ───────────────────────────────────────────────────────────────

    _createSphere() {
        const geo = new THREE.SphereGeometry(0.0075, 24, 24);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x00ffaa,
            emissive: 0x00ffaa,
            emissiveIntensity: 0.5
        });
        return new THREE.Mesh(geo, mat);
    }

    _parseVec3(str, fallback) {
        if (!str) return fallback.slice();
        const parts = String(str)
            .split(',')
            .map((s) => parseFloat(s.trim()));
        return parts.length === 3 && parts.every(Number.isFinite)
            ? parts
            : fallback.slice();
    }
}

const defaultFactory = new ModelFactory();

export function createArTargetSync(targetData, options = {}) {
    return defaultFactory.createArTargetSync(targetData, options);
}

export async function createArTarget(targetData, options = {}) {
    return defaultFactory.createArTarget(targetData, options);
}

export { ModelFactory as default };