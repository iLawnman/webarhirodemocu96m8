/** 3D-сцена: инициализация, камера, контролы, выбор объектов + CSS2DRenderer */

export let scene, camera, renderer, css2dRenderer, orbitControls, transformControls;
export let selectedObject = null;
export const editableObjects = [];

let onSelectCallback = null;
let onDeselectCallback = null;
let onTransformChangeCallback = null;

export function setSceneCallbacks({ onSelect, onDeselect, onTransformChange }) {
    onSelectCallback = onSelect;
    onDeselectCallback = onDeselect;
    onTransformChangeCallback = onTransformChange;
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

    css2dRenderer = new THREE.CSS2DRenderer();
    css2dRenderer.setSize(container.clientWidth, container.clientHeight);
    css2dRenderer.domElement.style.position = 'absolute';
    css2dRenderer.domElement.style.top = '0';
    css2dRenderer.domElement.style.left = '0';
    css2dRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(css2dRenderer.domElement);

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
    animate();
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
    orbitControls.update();
    renderer.render(scene, camera);
    css2dRenderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.getElementById('viewport');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    css2dRenderer.setSize(container.clientWidth, container.clientHeight);
}

export function selectObject(obj) {
    selectedObject = obj;
    transformControls.attach(obj);
    if (onSelectCallback) onSelectCallback(obj);
}

export function deselectObject() {
    selectedObject = null;
    transformControls.detach();
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
