import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'CSS2DRenderer.js';

let cssRendererInstance = null;

/**
 * Инициализация или получение CSS2DRenderer
 */
export function getOrCreateCSS2DRenderer(container = document.body) {
    if (!cssRendererInstance) {
        cssRendererInstance = new CSS2DRenderer();
        cssRendererInstance.setSize(window.innerWidth, window.innerHeight);
        cssRendererInstance.domElement.style.position = 'absolute';
        cssRendererInstance.domElement.style.top = '0px';
        cssRendererInstance.domElement.style.left = '0px';
        cssRendererInstance.domElement.style.pointerEvents = 'none'; // Пропускаем клики на WebGL, где нет кнопок
        cssRendererInstance.domElement.style.zIndex = '10';
        container.appendChild(cssRendererInstance.domElement);

        window.addEventListener('resize', () => {
            cssRendererInstance.setSize(window.innerWidth, window.innerHeight);
        });
    }
    return cssRendererInstance;
}

export class ModelFactory {
    /**
     * Создание 3D таргета с интерактивным CSS2D HTML оверлеем
     */
    async createArTarget(targetData = '', options = {}) {
        const { onOk = null, container = document.body } = options;

        // Инициализируем CSS2D рендерер
        getOrCreateCSS2DRenderer(container);

        const targetInfo = typeof targetData === 'object' && targetData !== null
            ? targetData
            : { title: String(targetData) };

        const title = targetInfo.title ?? targetInfo.name ?? String(targetData ?? '');
        const questionText = targetInfo.question || targetInfo.mainText || 'Выберите действие для продолжения:';
        const groupName = targetInfo.questId || targetInfo.id || title || 'target';

        const group = new THREE.Group();
        group.name = `arTarget_${groupName}`;

        // 1. Физический 3D-маркер в WebGL (зеленая точка)
        const sphere = this._createSphere();
        group.add(sphere);

        // 2. Создаем чистый DOM-элемент панели
        const panelEl = document.createElement('div');
        panelEl.className = 'ar-css2d-panel';
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
            pointer-events: auto; /* Включаем клики внутри панели */
            user-select: none;
        `;

        // Вставляем настоящую HTML-верстку с интерактивными элементами
        panelEl.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; color: #00ffaa; margin-bottom: 10px; text-transform: uppercase;">
                ${title || 'ОТЛАДКА AR'}
            </div>
            <div style="font-size: 14px; color: #f8fafc; line-height: 1.4; margin-bottom: 16px;">
                ${questionText}
            </div>
            <button class="ar-action-btn" style="
                width: 100%;
                padding: 12px;
                background: #ffaa00;
                color: #000000;
                border: none;
                border-radius: 8px;
                font-size: 15px;
                font-weight: bold;
                cursor: pointer;
                margin-bottom: 10px;
                transition: transform 0.1s;
            ">
                Надо выбрать как поступить
            </button>
            <button class="ar-ok-btn" style="
                width: 100%;
                padding: 10px;
                background: #00cc66;
                color: #ffffff;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
            ">
                ${targetInfo.okText ?? 'OK'}
            </button>
        `;

        // Нативные клики по реальным HTML-кнопкам
        const actionBtn = panelEl.querySelector('.ar-action-btn');
        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            alert('Нажата HTML кнопка: Надо выбрать как поступить');
        });

        const okBtn = panelEl.querySelector('.ar-ok-btn');
        okBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof onOk === 'function') {
                onOk(targetInfo);
            }
        });

        // 3. Оборачиваем DOM-элемент в CSS2DObject
        const cssObject = new CSS2DObject(panelEl);
        cssObject.position.set(0, 0.15, 0); // Позиция над маркером
        group.add(cssObject);

        group.userData = { targetInfo, sphere, cssObject, onOk };
        return group;
    }

    _createSphere() {
        const geo = new THREE.SphereGeometry(0.015, 24, 24);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x00ffaa,
            emissive: 0x00ffaa,
            emissiveIntensity: 0.5
        });
        return new THREE.Mesh(geo, mat);
    }
}

const defaultFactory = new ModelFactory();

export async function createArTarget(targetData, options = {}) {
    return defaultFactory.createArTarget(targetData, options);
}