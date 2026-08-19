/** Инспектор свойств объекта */

import { selectedObject, deselectObject, removeEditableObject, addEditableObject } from './scene.js';
import { normalizePath } from './utils.js';
import {
    createObjectMesh, createPanelMesh, createVideoMesh, createHtmlMesh,
    rebuildPlaneGeometry, reloadObjectModel,
    refreshVideoTexture, refreshHtmlTexture
} from './objects.js';
import { buildPropPanelVisual, serializePropPanelDiv, serializePanelElements, refreshPanelDOM } from './panels.js';
import { updateHierarchyTree } from './io.js';

export function renderInspector() {
    if (!selectedObject) return;
    const container = document.getElementById('inspector-content');
    const obj = selectedObject;
    const pos = obj.position;
    const scale = obj.scale;

    const rotDegX = THREE.MathUtils.radToDeg(obj.rotation.x);
    const rotDegY = THREE.MathUtils.radToDeg(obj.rotation.y);
    const rotDegZ = THREE.MathUtils.radToDeg(obj.rotation.z);

    let html = `
      <div class="prop-group">
        <label>Имя элемента</label>
        <input type="text" value="${obj.name}" onchange="window.__editor.updateObjName(this.value)">
      </div>
      <div class="prop-group">
        <label>Позиция (X, Y, Z)</label>
        <div class="row">
          <div><input type="number" step="0.01" value="${pos.x.toFixed(3)}" onchange="window.__editor.updateObjTransform('pos', 'x', this.value)"></div>
          <div><input type="number" step="0.01" value="${pos.y.toFixed(3)}" onchange="window.__editor.updateObjTransform('pos', 'y', this.value)"></div>
          <div><input type="number" step="0.01" value="${pos.z.toFixed(3)}" onchange="window.__editor.updateObjTransform('pos', 'z', this.value)"></div>
        </div>
      </div>
      <div class="prop-group">
        <label>Поворот (Deg X, Y, Z)</label>
        <div class="row">
          <div><input type="number" step="1" value="${rotDegX.toFixed(1)}" onchange="window.__editor.updateObjTransform('rot', 'x', this.value)"></div>
          <div><input type="number" step="1" value="${rotDegY.toFixed(1)}" onchange="window.__editor.updateObjTransform('rot', 'y', this.value)"></div>
          <div><input type="number" step="1" value="${rotDegZ.toFixed(1)}" onchange="window.__editor.updateObjTransform('rot', 'z', this.value)"></div>
        </div>
      </div>
      <div class="prop-group">
        <label>Масштаб (X, Y, Z)</label>
        <div class="row">
          <div><input type="number" step="0.01" value="${scale.x.toFixed(3)}" onchange="window.__editor.updateObjTransform('scale', 'x', this.value)"></div>
          <div><input type="number" step="0.01" value="${scale.y.toFixed(3)}" onchange="window.__editor.updateObjTransform('scale', 'y', this.value)"></div>
          <div><input type="number" step="0.01" value="${scale.z.toFixed(3)}" onchange="window.__editor.updateObjTransform('scale', 'z', this.value)"></div>
        </div>
      </div>
    `;

    if (obj.userData.type === 'panel') {
        const w = obj.userData.width != null ? obj.userData.width : (parseFloat(obj.userData.rawData && obj.userData.rawData.width) || 0.3);
        const h = obj.userData.height != null ? obj.userData.height : (parseFloat(obj.userData.rawData && obj.userData.rawData.height) || 0.3);
        html += `
        <hr style="border-color:#3c3c3c; margin: 12px 0;">
        <div class="prop-group">
          <h3>Размер панели</h3>
          <div class="row">
            <div><label>Ширина (м)</label><input type="number" step="0.01" min="0.01" value="${w}" onchange="window.__editor.updateObjectProp('width', this.value)"></div>
            <div><label>Высота (м)</label><input type="number" step="0.01" min="0.01" value="${h}" onchange="window.__editor.updateObjectProp('height', this.value)"></div>
          </div>
        </div>
      `;

        if (obj.userData.panelData && obj.userData.panelData.props) {
            const props = obj.userData.panelData.props;
            html += `
        <hr style="border-color:#3c3c3c; margin: 12px 0;">
        <div class="prop-group">
          <h3>Группа из JSON-дизайна: ${props.group || ''}</h3>
          <label>Font</label>
          <input type="text" value="${props.font || ''}" onchange="window.__editor.updateDesignPanelProp('font', this.value)">
          <label>Color (HEX, без #)</label>
          <input type="text" value="${props.color || ''}" onchange="window.__editor.updateDesignPanelProp('color', this.value)">
          <label>Image</label>
          <input type="text" value="${props.image || ''}" onchange="window.__editor.updateDesignPanelProp('image', this.value)">
          <label>FX</label>
          <input type="text" value="${props.fx || ''}" onchange="window.__editor.updateDesignPanelProp('fx', this.value)">
          <label>Sound</label>
          <input type="text" value="${props.sound || ''}" onchange="window.__editor.updateDesignPanelProp('sound', this.value)">
          <label>Text</label>
          <input type="text" value="${props.text || ''}" onchange="window.__editor.updateDesignPanelProp('text', this.value)">
          <label>Prefab</label>
          <input type="text" value="${props.prefab || ''}" onchange="window.__editor.updateDesignPanelProp('prefab', this.value)">
        </div>
      `;
        } else {
            html += `
        <hr style="border-color:#3c3c3c; margin: 12px 0;">
        <div class="prop-group">
          <h3>UI (стандартные DOM)</h3>
          <button onclick="window.__editor.addUIElement('text')" style="margin-top:6px;">+ Текст (div)</button>
          <button onclick="window.__editor.addUIElement('button')">+ &lt;button&gt;</button>
          <button onclick="window.__editor.addUIElement('input')">+ &lt;input&gt;</button>
          <button onclick="window.__editor.addUIElement('image')">+ &lt;img&gt;</button>
          <button onclick="window.__editor.addUIElement('video')">+ &lt;video&gt;</button>
          <button onclick="window.__editor.addUIElement('html')">+ HTML</button>
        </div>
        <div id="ui-elements-list"></div>
      `;
        }
    }

    if (obj.userData.type === 'video') {
        html += `
        <hr style="border-color:#3c3c3c; margin: 12px 0;">
        <div class="prop-group">
          <label>Источник (URL)</label>
          <input type="text" value="${obj.userData.src || ''}" onchange="window.__editor.updateObjectProp('src', this.value)">
          <label>Подпись</label>
          <input type="text" value="${obj.userData.label || ''}" onchange="window.__editor.updateObjectProp('label', this.value)">
          <div class="row">
            <div><label>Ширина (м)</label><input type="number" step="0.01" value="${obj.userData.width}" onchange="window.__editor.updateObjectProp('width', this.value)"></div>
            <div><label>Высота (м)</label><input type="number" step="0.01" value="${obj.userData.height}" onchange="window.__editor.updateObjectProp('height', this.value)"></div>
          </div>
        </div>
      `;
    }

    if (obj.userData.type === 'html') {
        html += `
        <hr style="border-color:#3c3c3c; margin: 12px 0;">
        <div class="prop-group">
          <label>HTML содержимое</label>
          <textarea rows="4" style="width:100%; background:#3c3c3c; border:1px solid #555; color:#fff; font-size:11px; margin-bottom:8px; border-radius:2px; padding:4px 6px;" onchange="window.__editor.updateObjectProp('html', this.value)">${(obj.userData.html || '').replace(/</g, '&lt;')}</textarea>
          <div class="row">
            <div><label>Ширина (м)</label><input type="number" step="0.01" value="${obj.userData.width}" onchange="window.__editor.updateObjectProp('width', this.value)"></div>
            <div><label>Высота (м)</label><input type="number" step="0.01" value="${obj.userData.height}" onchange="window.__editor.updateObjectProp('height', this.value)"></div>
          </div>
        </div>
      `;
    }

    if (obj.userData.type === 'object3d') {
        html += `
        <hr style="border-color:#3c3c3c; margin: 12px 0;">
        <div class="prop-group">
          <label>Файл в /assets/</label>
          <input type="text" value="${obj.userData.src || ''}" onchange="window.__editor.updateObjectProp('src', this.value)">
        </div>
      `;
    }

    html += `<button class="btn-danger" onclick="window.__editor.deleteSelectedObject()" style="margin-top:16px; width:100%;">Удалить объект</button>`;
    container.innerHTML = html;

    if (obj.userData.type === 'panel' && !(obj.userData.panelData && obj.userData.panelData.props)) {
        renderUIElementsList();
    }
}

export function clearInspector() {
    document.getElementById('inspector-content').innerHTML =
        `<p style="font-size: 13px; color: var(--muted); margin-top: 8px; line-height: 1.5;">Выберите элемент в сцене для редактирования.</p>`;
}

export function updateObjName(val) {
    if (selectedObject) {
        selectedObject.name = val;
        updateHierarchyTree();
    }
}

export function updateObjTransform(type, axis, value) {
    if (!selectedObject) return;
    const val = parseFloat(value) || 0;
    if (type === 'pos') selectedObject.position[axis] = val;
    if (type === 'rot') selectedObject.rotation[axis] = THREE.MathUtils.degToRad(val);
    if (type === 'scale') selectedObject.scale[axis] = val || 0.001;
}

export function updateInspectorFromTransform() {
    if (!selectedObject) return;
    renderInspector();
}

function renderUIElementsList() {
    const container = document.getElementById('ui-elements-list');
    if (!container || !selectedObject || !selectedObject.userData.panelData) return;

    const elements = selectedObject.userData.panelData.elements || [];
    let html = '';

    elements.forEach((el, index) => {
        const box = (title, body) => `
          <div style="background:rgba(15,23,42,.8); padding:10px; margin-bottom:8px; border-radius:8px; border:1px solid var(--border);">
            <label style="color:#a5b4fc; font-weight:600;">${title}</label>
            ${body}
            <button class="btn-danger" style="font-size:11px; padding:4px 8px; margin-top:6px;" onclick="window.__editor.removeUIElement(${index})">Удалить</button>
          </div>`;

        if (el.type === 'button') {
            html += box('&lt;button&gt;', `
            <label>Текст</label>
            <input type="text" value="${(el.text || '').replace(/"/g, '&quot;')}" onchange="window.__editor.updateUIElement(${index}, 'text', this.value)">
            <div class="row">
              <div><label>Размер (px)</label><input type="number" value="${el.fontSize || 14}" onchange="window.__editor.updateUIElement(${index}, 'fontSize', this.value)"></div>
              <div><label>Фон (HEX/#)</label><input type="text" value="${el.btnBg || '#10b981'}" onchange="window.__editor.updateUIElement(${index}, 'btnBg', this.value)"></div>
            </div>
            <label>Цвет текста</label>
            <input type="text" value="${el.color || '#ffffff'}" onchange="window.__editor.updateUIElement(${index}, 'color', this.value)">
            `);
        } else if (el.type === 'input') {
            html += box('&lt;input&gt;', `
            <label>Placeholder</label>
            <input type="text" value="${(el.text || '').replace(/"/g, '&quot;')}" onchange="window.__editor.updateUIElement(${index}, 'text', this.value)">
            <label>Value</label>
            <input type="text" value="${(el.value || '').replace(/"/g, '&quot;')}" onchange="window.__editor.updateUIElement(${index}, 'value', this.value)">
            <div class="row">
              <div><label>Тип</label>
                <select onchange="window.__editor.updateUIElement(${index}, 'inputType', this.value)">
                  <option value="text" ${el.inputType === 'text' || !el.inputType ? 'selected' : ''}>text</option>
                  <option value="number" ${el.inputType === 'number' ? 'selected' : ''}>number</option>
                  <option value="email" ${el.inputType === 'email' ? 'selected' : ''}>email</option>
                  <option value="password" ${el.inputType === 'password' ? 'selected' : ''}>password</option>
                </select>
              </div>
              <div><label>Размер (px)</label><input type="number" value="${el.fontSize || 14}" onchange="window.__editor.updateUIElement(${index}, 'fontSize', this.value)"></div>
            </div>
            `);
        } else if (el.type === 'image') {
            html += box('&lt;img&gt;', `
            <label>src</label>
            <input type="text" value="${el.src || ''}" onchange="window.__editor.updateUIElement(${index}, 'src', this.value)">
            <label>alt</label>
            <input type="text" value="${(el.alt || '').replace(/"/g, '&quot;')}" onchange="window.__editor.updateUIElement(${index}, 'alt', this.value)">
            <div class="row">
              <div><label>Ширина (px)</label><input type="number" value="${el.width || 80}" onchange="window.__editor.updateUIElement(${index}, 'width', this.value)"></div>
              <div><label>Высота (px)</label><input type="number" value="${el.height || 60}" onchange="window.__editor.updateUIElement(${index}, 'height', this.value)"></div>
            </div>
            `);
        } else if (el.type === 'video') {
            html += box('&lt;video&gt;', `
            <label>src (URL)</label>
            <input type="text" value="${el.src || ''}" onchange="window.__editor.updateUIElement(${index}, 'src', this.value)">
            <label>Подпись</label>
            <input type="text" value="${(el.label || '').replace(/"/g, '&quot;')}" onchange="window.__editor.updateUIElement(${index}, 'label', this.value)">
            `);
        } else if (el.type === 'html') {
            html += box('HTML-блок', `
            <textarea rows="3" style="width:100%; background:#3c3c3c; border:1px solid #555; color:#fff; font-size:11px; margin-bottom:8px; border-radius:2px; padding:4px 6px;" onchange="window.__editor.updateUIElement(${index}, 'html', this.value)">${(el.html || '').replace(/</g, '&lt;')}</textarea>
            `);
        } else {
            // text / label
            html += box(`&lt;div class="ui-text"&gt; (${el.type})`, `
            <label>Текст</label>
            <input type="text" value="${(el.text || '').replace(/"/g, '&quot;')}" onchange="window.__editor.updateUIElement(${index}, 'text', this.value)">
            <div class="row">
              <div><label>Размер (px)</label><input type="number" value="${el.fontSize || 16}" onchange="window.__editor.updateUIElement(${index}, 'fontSize', this.value)"></div>
              <div><label>Цвет</label><input type="text" value="${el.color || '#ffffff'}" onchange="window.__editor.updateUIElement(${index}, 'color', this.value)"></div>
            </div>
            <label>font-weight</label>
            <select onchange="window.__editor.updateUIElement(${index}, 'fontWeight', this.value)">
              <option value="" ${!el.fontWeight ? 'selected' : ''}>normal</option>
              <option value="bold" ${el.fontWeight === 'bold' ? 'selected' : ''}>bold</option>
              <option value="600" ${el.fontWeight === '600' ? 'selected' : ''}>600</option>
            </select>
            `);
        }
    });
    container.innerHTML = html;
}

export function addUIElement(type) {
    if (!selectedObject || !selectedObject.userData.panelData) return;
    const elements = selectedObject.userData.panelData.elements;

    if (type === 'text') elements.push({ type: 'text', text: 'Новый текст', fontSize: 16, color: '#ffffff' });
    if (type === 'button') elements.push({ type: 'button', text: 'Кнопка', fontSize: 14, btnBg: '#10b981', color: '#ffffff' });
    if (type === 'input') elements.push({ type: 'input', text: 'Введите текст...', value: '', inputType: 'text', fontSize: 14 });
    if (type === 'image') elements.push({ type: 'image', src: '', alt: '', width: 80, height: 60 });
    if (type === 'video') elements.push({ type: 'video', src: '', label: 'Video' });
    if (type === 'html') elements.push({ type: 'html', html: '<div style="color:#fff;padding:8px;">Custom HTML</div>' });

    refreshPanelDOM(selectedObject); // также обновляет innerHTML
    renderUIElementsList();
}

export function updateUIElement(index, key, value) {
    if (!selectedObject || !selectedObject.userData.panelData) return;
    const el = selectedObject.userData.panelData.elements[index];
    if (el) {
        if (key === 'src') {
            el[key] = normalizePath(value);
        } else if (key === 'fontSize' || key === 'width' || key === 'height') {
            el[key] = parseInt(value, 10) || 0;
        } else {
            el[key] = value;
        }
        refreshPanelDOM(selectedObject); // синхронизирует DOM + innerHTML
    }
}

export function removeUIElement(index) {
    if (!selectedObject || !selectedObject.userData.panelData) return;
    selectedObject.userData.panelData.elements.splice(index, 1);
    refreshPanelDOM(selectedObject);
    renderUIElementsList();
}

export function updateDesignPanelProp(key, value) {
    if (!selectedObject || !selectedObject.userData.panelData || !selectedObject.userData.panelData.props) return;
    const props = selectedObject.userData.panelData.props;

    if (key === 'image' || key === 'prefab') {
        value = value ? normalizePath(value) : '';
    }

    if (value) {
        props[key] = value;
    } else {
        delete props[key];
    }

    const newPanelData = buildPropPanelVisual(props);
    selectedObject.userData.panelData = newPanelData;
    selectedObject.userData.innerHTML = serializePropPanelDiv(props);
    refreshPanelDOM(selectedObject);
}

export function updateObjectProp(key, value) {
    if (!selectedObject) return;
    const type = selectedObject.userData.type;

    if (type === 'video') {
        if (key === 'width' || key === 'height') {
            selectedObject.userData[key] = parseFloat(value) || 0.01;
            rebuildPlaneGeometry(selectedObject);
        } else if (key === 'src') {
            selectedObject.userData.src = normalizePath(value);
            refreshVideoTexture(selectedObject);
        } else {
            selectedObject.userData[key] = value;
            refreshVideoTexture(selectedObject);
        }
    } else if (type === 'html') {
        if (key === 'width' || key === 'height') {
            selectedObject.userData[key] = parseFloat(value) || 0.01;
            rebuildPlaneGeometry(selectedObject);
        } else if (key === 'html') {
            selectedObject.userData.html = value;
            refreshHtmlTexture(selectedObject);
        }
    } else if (type === 'panel') {
        if (key === 'width' || key === 'height') {
            const num = parseFloat(value) || 0.01;
            selectedObject.userData[key] = num;
            if (!selectedObject.userData.rawData) selectedObject.userData.rawData = {};
            selectedObject.userData.rawData[key] = String(num);
            rebuildPlaneGeometry(selectedObject);
        }
    } else if (type === 'object3d') {
        if (key === 'src') {
            selectedObject.userData.src = normalizePath(value);
            reloadObjectModel(selectedObject);
        }
    }
}

export function addObject3D() {
    const filename = prompt('Имя файла в /assets/ (например model.obj):', 'model.obj');
    if (filename === null || filename.trim() === '') return;
    const object = createObjectMesh({
        name: 'Object_' + Date.now().toString().slice(-3),
        src: normalizePath(filename.trim()),
        position: '0,0,0',
        rotation: '0,0,0'
    });
    addEditableObject(object);
    // select
    import('./scene.js').then(m => m.selectObject(object));
}

export function addVideoObject3D() {
    const video = createVideoMesh({
        name: 'Video_' + Date.now().toString().slice(-3),
        src: '', label: 'Video', width: 0.2, height: 0.12,
        position: '0,0,0', rotation: '0,0,0'
    });
    addEditableObject(video);
    import('./scene.js').then(m => m.selectObject(video));
}

export function addHtmlObject3D() {
    const htmlObj = createHtmlMesh({
        name: 'HTML_' + Date.now().toString().slice(-3),
        width: 0.2, height: 0.14,
        position: '0,0,0', rotation: '0,0,0'
    }, '<div style="color:#fff;padding:8px;">Custom HTML</div>');
    addEditableObject(htmlObj);
    import('./scene.js').then(m => m.selectObject(htmlObj));
}

export function addPanel() {
    const panel = createPanelMesh(
        {
            name: 'Panel_' + Date.now().toString().slice(-3),
            width: '0.3',
            height: '0.3',
            position: '0,0,0',
            rotation: '0,0,0'
        },
        '<div class="panel"><div class="label">New Panel</div></div>'
    );
    addEditableObject(panel);
    import('./scene.js').then(m => m.selectObject(panel));
}

export function deleteSelectedObject() {
    if (!selectedObject) return;
    removeEditableObject(selectedObject);
    deselectObject();
    updateHierarchyTree();
}