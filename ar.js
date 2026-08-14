// ar.js — распознавание маркера → якорь → waitingAnswer → waitImage

var arToolkitSource, arToolkitContext, arMarkerControls;

// Состояния: search | waitingAnswer | waitImage
var appState = 'search';
var markerWasVisible = false;

var lastTime = performance.now();
var frames = 0;
var fps = 0;

function setStatus(arText, arClass, markerText, markerClass) {
  var elAr = document.getElementById('st-ar');
  var elMarker = document.getElementById('st-marker');
  if (elAr) {
    elAr.textContent = arText;
    elAr.className = 'value ' + (arClass || '');
  }
  if (elMarker) {
    elMarker.textContent = markerText;
    elMarker.className = 'value ' + (markerClass || '');
  }
}

function setStateLabel(text, cls) {
  setStatus(
    appState === 'search' ? 'поиск' : (appState === 'waitingAnswer' ? 'ждём ответ' : 'waitImage'),
    appState === 'waitImage' ? 'ok' : 'search',
    text,
    cls || ''
  );
}

function hideLoader() {
  var loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
}

function updateFps() {
  frames++;
  var now = performance.now();
  if (now - lastTime >= 1000) {
    fps = Math.round((frames * 1000) / (now - lastTime));
    frames = 0;
    lastTime = now;
    var el = document.getElementById('st-fps');
    if (el) el.textContent = fps;
  }
}

function goToWaitingAnswer() {
  if (appState !== 'search') return;

  createAnchorFromMarker();
  appState = 'waitingAnswer';

  setStatus('ждём ответ', 'search', 'нажми на картинку', 'ok');
  console.log('[AR] state → waitingAnswer (якорь зафиксирован)');
}

function goToWaitImage() {
  if (appState !== 'waitingAnswer') return;

  hideArTarget();
  appState = 'waitImage';

  setStatus('waitImage', 'ok', 'готово', 'ok');
  console.log('[AR] state → waitImage');
}

/** Вызывается из tree.js при клике по asset.png */
function onArTargetClicked() {
  goToWaitImage();
}

function initAR() {
  setStatus('инициализация…', 'search', '—', '');

  arToolkitSource = new THREEx.ArToolkitSource({
    sourceType: 'webcam',
    sourceWidth: window.innerWidth > window.innerHeight ? 1280 : 720,
    sourceHeight: window.innerWidth > window.innerHeight ? 720 : 1280
  });

  arToolkitSource.init(function onReady() {
    var video = arToolkitSource.domElement;
    if (video) {
      video.style.cssText =
        'position:fixed!important;top:0!important;left:0!important;width:100%!important;height:100%!important;object-fit:cover!important;z-index:0!important;';
    }

    onResizeAR();
    hideLoader();
    setStatus('поиск', 'search', 'наведи на Hiro', 'search');
    appState = 'search';
  });

  setTimeout(function () {
    hideLoader();
  }, 4000);

  window.addEventListener('resize', function () {
    onResizeAR();
    onResize();
  });

  arToolkitContext = new THREEx.ArToolkitContext({
    cameraParametersUrl: 'camera_para.dat',
    detectionMode: 'mono',
    maxDetectionRate: 30,
    canvasWidth: 640,
    canvasHeight: 480
  });

  arToolkitContext.init(function onCompleted() {
    camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
  });

  arMarkerControls = new THREEx.ArMarkerControls(arToolkitContext, markerRoot, {
    type: 'pattern',
    patternUrl: 'assets/hiro.patt',
    changeMatrixMode: 'modelViewMatrix'
  });

  markerRoot.visible = false;
}

function onResizeAR() {
  if (!arToolkitSource) return;
  try {
    arToolkitSource.onResizeElement();
    arToolkitSource.copyElementSizeTo(renderer.domElement);
    if (arToolkitContext && arToolkitContext.arController !== null) {
      arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);
    }
  } catch (e) {}

  var video = arToolkitSource.domElement;
  if (video) {
    video.style.cssText =
      'position:fixed!important;top:0!important;left:0!important;width:100%!important;height:100%!important;object-fit:cover!important;z-index:0!important;';
  }
}

function updateAR() {
  if (!arToolkitSource || arToolkitSource.ready === false) return;

  arToolkitContext.update(arToolkitSource.domElement);

  if (appState !== 'search') return;

  var visible = markerRoot.visible === true;

  if (visible && !markerWasVisible) {
    markerWasVisible = true;
    setTimeout(function () {
      if (appState === 'search' && markerRoot.visible) {
        goToWaitingAnswer();
      }
    }, 120);
  }

  if (!visible) {
    markerWasVisible = false;
  }
}

// ===== Запуск =====
initThree();
initAR();

function animate() {
  requestAnimationFrame(animate);
  updateAR();
  updateFps();
  render();
}
animate();
