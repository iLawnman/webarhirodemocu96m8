/** Загрузка / сохранение префабов, иерархия сцены */

import { normalizePath, encodeHtmlB64, decodeHtmlB64, getDataset } from './utils.js';
import {
    clearEditableObjects, addEditableObject, selectObject,
    getEditableObjects, getSelectedObject
} from './scene.js';
import { createObjectMesh, createPanelMesh, createVideoMesh, createHtmlMesh } from './objects.js';

export const localDefaultTemplate = `<template id="ar-target">
  <model name="Object_Main" data-src="./assets/target.obj" data-position="0,0.05,0" data-rotation="0,0,0"></model>
  <panel name="UI_TextPanel" data-width="0.2" data-height="0.2" data-position="-0.15,0.1,0" data-rotation="0,0,0">
    <div class="panel text-panel">
      <div class="border"></div>
      <div class="label">Header</div>
      <div class="name">Title</div>
      <div class="sub">Subtitle</div>
    </div>
  </panel>
</template>`;

export function loadLocalPrefab() {
    parseAndBuildPrefab(localDefaultTemplate);
}

export function parseAndBuildPrefab(htmlContent) {
    clearEditableObjects();

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const template = doc.querySelector('template#ar-target');
    const root = template ? template.content : doc.body;

    Array.from(root.children).forEach(node => {
        const tag = node.tagName.toLowerCase();
        let mesh = null;

        if (tag === 'model') {
            mesh = createObjectMesh(getDataset(node));
        } else if (tag === 'panel') {
            mesh = createPanelMesh(getDataset(node), node.innerHTML);
        } else if (tag === 'video') {
            mesh = createVideoMesh(getDataset(node));
        } else if (tag === 'htmlblock') {
            const ds = getDataset(node);
            const raw = ds.rawB64 ? decodeHtmlB64(ds.rawB64) : (ds.html || '');
            mesh = createHtmlMesh(ds, raw);
        }

        if (mesh) {
            addEditableObject(mesh);
        }
    });

    updateHierarchyTree();
}

export function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => parseAndBuildPrefab(e.target.result);
    reader.readAsText(file);
}

export function updateHierarchyTree() {
    const treeContainer = document.getElementById('tree');
    treeContainer.innerHTML = '';

    getEditableObjects().forEach(obj => {
        const div = document.createElement('div');
        div.className = 'tree-item' + (getSelectedObject() === obj ? ' active' : '');
        div.innerHTML = `<span>${obj.name}</span><span>${obj.userData.type}</span>`;
        div.onclick = () => selectObject(obj);
        treeContainer.appendChild(div);
    });
}

export function exportHTML() {
    let output = `<template id="ar-target">\n`;

    getEditableObjects().forEach(obj => {
        const pos = `${obj.position.x.toFixed(3)},${obj.position.y.toFixed(3)},${obj.position.z.toFixed(3)}`;
        const rotDegX = THREE.MathUtils.radToDeg(obj.rotation.x);
        const rotDegY = THREE.MathUtils.radToDeg(obj.rotation.y);
        const rotDegZ = THREE.MathUtils.radToDeg(obj.rotation.z);
        const rot = `${rotDegX.toFixed(0)},${rotDegY.toFixed(0)},${rotDegZ.toFixed(0)}`;
        const scl = `${obj.scale.x.toFixed(3)},${obj.scale.y.toFixed(3)},${obj.scale.z.toFixed(3)}`;

        if (obj.userData.type === 'object3d') {
            output += `  <model\n    name="${obj.name}"\n    data-src="${normalizePath(obj.userData.src || '')}"\n    data-position="${pos}"\n    data-rotation="${rot}"\n    data-scale="${scl}"\n  ></model>\n`;
        } else if (obj.userData.type === 'panel') {
            const pw = obj.userData.width != null ? obj.userData.width : (obj.userData.rawData && obj.userData.rawData.width) || '0.3';
            const ph = obj.userData.height != null ? obj.userData.height : (obj.userData.rawData && obj.userData.rawData.height) || '0.3';
            const cssAttr = obj.userData.customCSS
                ? `\n    data-css="${encodeHtmlB64(obj.userData.customCSS)}"`
                : '';
            output += `  <panel\n    name="${obj.name}"\n    data-width="${pw}"\n    data-height="${ph}"\n    data-position="${pos}"\n    data-rotation="${rot}"\n    data-scale="${scl}"${cssAttr}\n  >\n`;
            output += obj.userData.innerHTML || `    <div class="panel"></div>\n`;
            output += `  </panel>\n`;
        } else if (obj.userData.type === 'video') {
            output += `  <video\n    name="${obj.name}"\n    data-src="${normalizePath(obj.userData.src || '')}"\n    data-label="${obj.userData.label || ''}"\n    data-width="${obj.userData.width}"\n    data-height="${obj.userData.height}"\n    data-position="${pos}"\n    data-rotation="${rot}"\n    data-scale="${scl}"\n  ></video>\n`;
        } else if (obj.userData.type === 'html') {
            output += `  <htmlblock\n    name="${obj.name}"\n    data-raw-b64="${encodeHtmlB64(obj.userData.html || '')}"\n    data-width="${obj.userData.width}"\n    data-height="${obj.userData.height}"\n    data-position="${pos}"\n    data-rotation="${rot}"\n    data-scale="${scl}"\n  ></htmlblock>\n`;
        }
    });

    output += `</template>`;

    const blob = new Blob([output], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'artarget.html';
    a.click();
}
