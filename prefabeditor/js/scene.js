/** 3D-сцена: инициализация, камера, контролы, выбор объектов + CSS3DRenderer */

export let scene, camera, renderer, css3dRenderer, orbitControls, transformControls;
export let selectedObject = null;
export const editableObjects = [];

// алиас для старого имени
export let css2dRenderer;

let onSelectCallback = null;
let onDeselectCallback = null;
let onTransformChangeCallback = null;

export function setSceneCallbacks({ onSelect, onDeselect, onTransformChange }) {
    onSelectCallback = onSelect;
    onDeselectCallback = onDeselect;
    onTransformChangeCallback = onTransformChange;
}

/** Подгрузить CSS3DRenderer, если его нет (нужен, чтобы панели не смотрели на камеру) */
function ensureCSS3DRenderer() {
    return new Promise((resolve, reject) => {
        if (typeof THREE !== 'undefined' && typeof THREE.CSS3DRenderer === 'function') {
            resolve();
            return;
        }
        const rev = (typeof THREE !== 'undefined' && THREE.REVISION) ? THREE.REVISION : '160';
        const urls = [
            `https://cdn.jsdelivr.net/npm/three@0.${rev}.0/examples/js/renderers/CSS3DRenderer.js`,
            'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/renderers/CSS3DRenderer.js',
            'https://unpkg.com/three@0.160.0/examples/js/renderers/CSS3DRenderer.js'
        ];
        let i = 0;
        const tryNext = () => {
            if (i >= urls.length) {
                reject(new Error('Не удалось загрузить CSS3DRenderer.js'));
                return;
            }
            const s = document.createElement('script');
            s.src = urls[i++];
            s.onload = () => {
                if (typeof THREE.CSS3DRenderer === 'function') resolve();
                else tryNext();
            };
            s.onerror = tryNext;
            document.head.appendChild(s);
        };
        tryNext();
    });
}

export function init3D() {
    const container = document.getElementById('viewport');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.01, 100);
    camera.position.set(0, 0.3, 0.5);

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas3d'), antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(1, 20, 0x1e293b, 0x111827);
    scene.add(grid);

    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);

    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    transformControls.size = 0.75;
    transformControls.addEventListener('dragging-changed', (event) => {
        orbitControls.enabled = !event.value;
    });
    transformControls.addEventListener('change', () => {
        if (onTransformChangeCallback) onTransformChangeCallback();
    });
    scene.add(transformControls);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('pointerdown', (e) => {
        if (transformControls.dragging) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(editableObjects, true);

        if (intersects.length > 0) {
            const root = resolveEditableRoot(intersects[0].object);
            if (root) selectObject(root);
        } else {
            deselectObject();
        }
    });

    window.addEventListener('resize', onWindowResize);

    // CSS3D — после загрузки скрипта (return Promise)
    return ensureCSS3DRenderer().then(() => {
        css3dRenderer = new THREE.CSS3DRenderer();
        css2dRenderer = css3dRenderer;
        css3dRenderer.setSize(container.clientWidth, container.clientHeight);
        css3dRenderer.domElement.style.position = 'absolute';
        css3dRenderer.domElement.style.top = '0';
        css3dRenderer.domElement.style.left = '0';
        css3dRenderer.domElement.style.pointerEvents = 'none';
        container.appendChild(css3dRenderer.domElement);
        animate();
    }).catch(err => {
        console.error(err);
        if (typeof THREE.CSS2DRenderer === 'function') {
            console.warn('Fallback: CSS2DRenderer (панели billboard)');
            css3dRenderer = new THREE.CSS2DRenderer();
            css2dRenderer = css3dRenderer;
            css3dRenderer.setSize(container.clientWidth, container.clientHeight);
            css3dRenderer.domElement.style.position = 'absolute';
            css3dRenderer.domElement.style.top = '0';
            css3dRenderer.domElement.style.left = '0';
            css3dRenderer.domElement.style.pointerEvents = 'none';
            container.appendChild(css3dRenderer.domElement);
            window.__useCSS2DFallback = true;
            animate();
        } else {
            alert('Не найден CSS3DRenderer. Подключите examples/js/renderers/CSS3DRenderer.js');
        }
    });
}

function resolveEditableRoot(obj) {
    let cur = obj;
    while (cur) {
        if (editableObjects.includes(cur)) return cur;
        cur = cur.parent;
    }
    return null;
}

function animate() {
    requestAnimationFrame(animate);
    if (orbitControls) orbitControls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
    if (css3dRenderer && scene && camera) css3dRenderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.getElementById('viewport');
    if (!camera || !container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    if (renderer) renderer.setSize(container.clientWidth, container.clientHeight);
    if (css3dRenderer) css3dRenderer.setSize(container.clientWidth, container.clientHeight);
}

export function selectObject(obj) {
    selectedObject = obj;
    if (transformControls) transformControls.attach(obj);
    if (onSelectCallback) onSelectCallback(obj);
}

export function deselectObject() {
    selectedObject = null;
    if (transformControls) transformControls.detach();
    if (onDeselectCallback) onDeselectCallback();
}

export function clearEditableObjects() {
    editableObjects.forEach(obj => {
        scene.remove(obj);
        if (obj.userData.css2dObject && obj.userData.css2dObject.element) {
            obj.userData.css2dObject.element.remove();
        }
        if (obj.userData.cssUid) {
            const st = document.getElementById('ar-css-' + obj.userData.cssUid);
            if (st) st.remove();
        }
    });
    editableObjects.length = 0;
    deselectObject();
}

export function addEditableObject(mesh) {
    scene.add(mesh);
    editableObjects.push(mesh);
}

export function removeEditableObject(obj) {
    const index = editableObjects.indexOf(obj);
    if (index > -1) editableObjects.splice(index, 1);
    scene.remove(obj);
    if (obj.userData.css2dObject && obj.userData.css2dObject.element) {
        obj.userData.css2dObject.element.remove();
    }
    if (obj.userData.cssUid) {
        const st = document.getElementById('ar-css-' + obj.userData.cssUid);
        if (st) st.remove();
    }
}

export function getEditableObjects() {
    return editableObjects;
}

export function getSelectedObject() {
    return selectedObject;
}
