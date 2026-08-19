/** Создание 3D-объектов: model (Mesh), panel/video/html (CSS2DObject + proxy plane) */

import { normalizePath, applyTransformData } from './utils.js';
import {
    parsePanelHTML,
    buildPanelDOM,
    buildVideoDOM,
    buildHtmlDOM,
    refreshPanelDOM
} from './panels.js';

const objLoader = new THREE.OBJLoader();

/** Невидимый plane для raycast + CSS2DObject */
function createCSS2DWrapper(width, height, domElement) {
    const group = new THREE.Group();

    // Proxy mesh для выделения / transform
    const geo = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.001,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const proxy = new THREE.Mesh(geo, mat);
    proxy.name = 'proxy';
    group.add(proxy);

    // Реальный DOM
    const css2d = new THREE.CSS2DObject(domElement);
    css2d.position.set(0, 0, 0);
    // Масштаб CSS ≈ метры (базовый размер DOM 300×180 px ≈ 0.3×0.18 м)
    const baseW = 300;
    const baseH = 180;
    css2d.scale.set(width / (baseW / 1000), height / (baseH / 1000), 1);
    group.add(css2d);

    group.userData.proxy = proxy;
    group.userData.css2dObject = css2d;
    group.userData.domElement = domElement;

    return group;
}

export function createObjectMesh(data = {}) {
    const group = new THREE.Group();
    group.name = data.name || 'object_' + Date.now().toString().slice(-4);
    const srcPath = normalizePath(data.src || '');
    group.userData = { type: 'object3d', rawData: data, src: srcPath };

    const placeholder = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x666666, wireframe: true })
    );
    placeholder.name = 'placeholder';
    group.add(placeholder);

    applyTransformData(group, data);
    if (srcPath) loadObjIntoGroup(group, srcPath, placeholder);
    return group;
}

function loadObjIntoGroup(group, src, placeholder) {
    const path = normalizePath(src);
    objLoader.load(path, obj => {
        if (placeholder && placeholder.parent === group) group.remove(placeholder);
        obj.traverse(child => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.2, roughness: 0.6 });
            }
        });
        group.add(obj);
        group.userData.loadedObj = obj;
    }, undefined, err => {
        console.error('Не удалось загрузить OBJ:', path, err);
    });
}

export function reloadObjectModel(group) {
    if (group.userData.loadedObj) {
        group.remove(group.userData.loadedObj);
        group.userData.loadedObj = null;
    }
    const placeholder = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x666666, wireframe: true })
    );
    placeholder.name = 'placeholder';
    group.add(placeholder);
    if (group.userData.src) loadObjIntoGroup(group, group.userData.src, placeholder);
}

export function createVideoMesh(data = {}) {
    const width = parseFloat(data.width) || 0.2;
    const height = parseFloat(data.height) || 0.12;

    const dom = buildVideoDOM({
        src: normalizePath(data.src || ''),
        label: data.label || 'Video'
    });

    const group = createCSS2DWrapper(width, height, dom);
    group.name = data.name || 'video_' + Date.now().toString().slice(-4);
    group.userData = {
        type: 'video',
        rawData: data,
        src: normalizePath(data.src || ''),
        label: data.label || 'Video',
        width,
        height,
        ...group.userData
    };

    applyTransformData(group, data);
    return group;
}

export function refreshVideoTexture(mesh) {
    // DOM-версия
    const dom = mesh.userData.domElement;
    if (!dom) return;
    const video = dom.querySelector('video');
    const label = dom.querySelector('.video-label');
    if (video) {
        video.src = mesh.userData.src || '';
        video.load();
    }
    if (label) label.textContent = mesh.userData.label || 'Video';
}

export function createHtmlMesh(data = {}, rawHtml = '') {
    const width = parseFloat(data.width) || 0.2;
    const height = parseFloat(data.height) || 0.14;
    const html = rawHtml || data.html || '<div style="color:#fff;padding:8px;">Custom HTML</div>';

    const dom = buildHtmlDOM(html);

    const group = createCSS2DWrapper(width, height, dom);
    group.name = data.name || 'html_' + Date.now().toString().slice(-4);
    group.userData = {
        type: 'html',
        rawData: data,
        html,
        width,
        height,
        ...group.userData
    };

    applyTransformData(group, data);
    return group;
}

export function refreshHtmlTexture(mesh) {
    const dom = mesh.userData.domElement;
    if (!dom) return;
    dom.innerHTML = mesh.userData.html || '';
}

export function createPanelMesh(data = {}, innerHTML = '') {
    const width = parseFloat(data.width) || 0.3;
    const height = parseFloat(data.height) || 0.3;

    const panelData = parsePanelHTML(innerHTML);
    const dom = buildPanelDOM(panelData);

    const group = createCSS2DWrapper(width, height, dom);
    group.name = data.name || 'panel_' + Date.now().toString().slice(-4);
    group.userData = {
        type: 'panel',
        rawData: data,
        panelData,
        innerHTML: innerHTML,
        width,
        height,
        ...group.userData
    };

    applyTransformData(group, data);
    return group;
}

export function rebuildPlaneGeometry(mesh) {
    const w = mesh.userData.width || 0.3;
    const h = mesh.userData.height || 0.3;

    if (mesh.userData.proxy) {
        mesh.userData.proxy.geometry.dispose();
        mesh.userData.proxy.geometry = new THREE.PlaneGeometry(w, h);
    }

    if (mesh.userData.css2dObject) {
        const baseW = 300;
        const baseH = 180;
        mesh.userData.css2dObject.scale.set(w / (baseW / 1000), h / (baseH / 1000), 1);
    }
}