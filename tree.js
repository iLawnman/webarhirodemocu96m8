// tree.js — сцена, рендерер, якорь, arTarget

var scene, camera, renderer;
var markerRoot;          // только для чтения позиции маркера
var worldAnchor = null;  // зафиксированный якорь в мире
var arTarget = null;     // группа с asset.png
var assetMesh = null;

var raycaster = new THREE.Raycaster();
var pointer = new THREE.Vector2();

function initThree() {
  scene = new THREE.Scene();

  camera = new THREE.Camera();
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setClearColor(new THREE.Color(0x000000), 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.zIndex = '1';
  document.body.appendChild(renderer.domElement);

  // Маркер-группа: только для трекинга, контент к ней НЕ привязываем
  markerRoot = new THREE.Group();
  scene.add(markerRoot);
  markerRoot.visible = false;

  var light = new THREE.AmbientLight(0xffffff, 1);
  scene.add(light);

  window.addEventListener('resize', onResize);

  // Клик / тап по arTarget
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
}

function onResize() {
  if (renderer) {
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

function render() {
  renderer.render(scene, camera);
}

/** Создаёт якорь в мире по текущей матрице маркера и вешает на него arTarget */
function createAnchorFromMarker() {
  if (worldAnchor) {
    scene.remove(worldAnchor);
    worldAnchor = null;
    arTarget = null;
    assetMesh = null;
  }

  markerRoot.updateMatrixWorld(true);
  worldAnchor = new THREE.Group();
  worldAnchor.matrix.copy(markerRoot.matrixWorld);
  worldAnchor.matrix.decompose(
    worldAnchor.position,
    worldAnchor.quaternion,
    worldAnchor.scale
  );
  worldAnchor.matrixAutoUpdate = true;
  scene.add(worldAnchor);

  arTarget = new THREE.Group();
  worldAnchor.add(arTarget);

  var geometry = new THREE.PlaneGeometry(1, 1);
  var texture = new THREE.TextureLoader().load('asset.png');
  var material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  });

  assetMesh = new THREE.Mesh(geometry, material);
  assetMesh.rotation.x = -Math.PI / 2;
  assetMesh.name = 'arTargetHit';
  arTarget.add(assetMesh);

  return worldAnchor;
}

/** Скрыть arTarget (переход в waitImage) */
function hideArTarget() {
  if (arTarget) {
    arTarget.visible = false;
  }
  if (worldAnchor) {
    worldAnchor.visible = false;
  }
}

function onPointerDown(event) {
  if (typeof appState === 'undefined' || appState !== 'waitingAnswer') return;
  if (!assetMesh || !arTarget || !arTarget.visible) return;

  var rect = renderer.domElement.getBoundingClientRect();
  var x = (event.clientX - rect.left) / rect.width;
  var y = (event.clientY - rect.top) / rect.height;

  pointer.x = x * 2 - 1;
  pointer.y = -(y * 2 - 1);

  raycaster.setFromCamera(pointer, camera);
  var hits = raycaster.intersectObject(assetMesh, false);

  if (hits.length > 0) {
    if (typeof onArTargetClicked === 'function') {
      onArTargetClicked();
    }
  }
}
