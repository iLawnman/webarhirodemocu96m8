// ===================== app.js =====================
import { UI } from './ui.js';
import { ImageRecognition } from './recognition.js';
import { ARScene } from './arscene.js';
import { playSound } from './audio.js';
import { Settings } from './settings.js';
import { ARSettings } from './arsettings.js';

export class App {
  constructor() {
    this.ui = new UI();
    this.settings = new Settings();
    this.arSettings = new ARSettings();
    this.recognition = null;
    this.arScene = new ARScene(this.ui);

    this.xrSession = null;
    this.imageTrackingEnabled = false;
    this.frameCount = 0;

    this.arScene.renderer.xr.setReferenceSpaceType('local-floor');

    this.init();
  }

  async init() {
    this.ui.log('App init (WebGL / Three.js WebXR)...', 'info');

    this.ui.showCurtain();

    this.ui.log('Loading AR CSS themes...', 'info');
    try {
      await this.arSettings.init();
      this.ui.log(
          `AR themes ready | count=${this.arSettings.getThemes().length} active=${this.arSettings.getActiveThemeId()}`,
          'ok'
      );
    } catch (e) {
      this.ui.log('AR themes failed: ' + (e && e.message ? e.message : e), 'warn');
    }

    this.ui.log('Loading settings...', 'info');
    await this.settings.load();
    if (this.settings.isLoaded) {
      this.ui.log(
          `Settings loaded | unique_targets=${this.settings.uniqueTargets}`,
          'ok'
      );
    } else {
      this.ui.log('Settings failed to load, using defaults (unique_targets=0)', 'warn');
    }

    this.recognition = new ImageRecognition(this.ui, this.settings);
    await this.recognition.init();

    this.ui.onStartAR(() => this.startAR());
    this.ui.onEndAR(() => this.endAR());

    this.arScene.renderer.setAnimationLoop((timestamp, frame) => {
      this.onXRFrame(timestamp, frame);
    });

    // Активируем UI и снимаем блокирующую шторку после завершения всей инициализации
    this.ui.enableArButton();
    this.ui.hideCurtain();
    this.ui.setHint('Нажмите Start AR для запуска');
  }

  async startAR() {
    this.ui.disableArButton();
    this.ui.log('>>> Start AR clicked', 'info');

    if (!navigator.xr) {
      this.ui.log('navigator.xr missing', 'err');
      this.ui.setHint('WebXR не поддерживается');
      this.ui.enableArButton();
      return;
    }

    const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
    if (!supported) {
      this.ui.setHint('immersive-ar не поддерживается');
      this.ui.enableArButton();
      return;
    }

    const trackedImages = this.recognition.getTrackedImages(0.2);

    if (!trackedImages.length) {
      this.ui.log('No tracked images available', 'err');
      this.ui.setHint('Нет загруженных маркеров');
      this.ui.enableArButton();
      return;
    }

    this.ui.log('trackedImages: ' + trackedImages.length, 'info');

    // Направляем domOverlay строго на элемент CSS3D-слоя для корректного перехвата нажатий
    const sessionInit = {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['image-tracking', 'dom-overlay', 'anchors'],
      trackedImages,
      domOverlay: { root: this.arScene.cssRenderer.domElement }
    };

    try {
      this.xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
    } catch (e) {
      this.ui.log('Session with dom-overlay/anchors failed, retrying without them...', 'warn');
      try {
        this.xrSession = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['image-tracking'],
          trackedImages
        });
      } catch (e2) {
        this.ui.log('Session request FAILED: ' + e2.message, 'err');
        this.ui.setHint('Ошибка запуска AR: ' + e2.message);
        this.ui.enableArButton();
        return;
      }
      playSound('click');
    }

    await this.arScene.renderer.xr.setSession(this.xrSession);
    this.ui.log('Renderer session set (WebGL + local-floor)', 'ok');

    const domOverlayType = this.xrSession.domOverlayState?.type;
    if (domOverlayType) {
      this.ui.log(`dom-overlay ГРАНТОВАН, type="${domOverlayType}" — CSS3D-кнопки должны получать клики`, 'ok');
    } else {
      this.ui.log(
          'dom-overlay НЕ гранован браузером (domOverlayState отсутствует)',
          'err'
      );
    }

    this.ui.showEndArButton();
    this.imageTrackingEnabled = true;

    this.recognition.attachInput(this.xrSession, this.arScene);

    this.ui.hideCurtain();
    this.recognition.presentSearchPrompt();

    this.xrSession.addEventListener('end', () => {
      this.ui.log('Session ended', 'warn');
      this.imageTrackingEnabled = false;
      this.recognition.detachInput();
      this.recognition.reset(this.arScene);
      this.xrSession = null;
      this.frameCount = 0;

      this.ui.hideEndArButton();
      this.ui.enableArButton();
      this.ui.showCurtain();
    });
  }

  async endAR() {
    if (this.xrSession) {
      await this.xrSession.end();
    }
  }

  onXRFrame(timestamp, frame) {
    if (!frame) {
      this.arScene.render();
      return;
    }

    this.frameCount++;

    if (this.imageTrackingEnabled) {
      const refSpace = this.arScene.renderer.xr.getReferenceSpace();
      if (refSpace) {
        this.recognition.processTracking(frame, refSpace, this.frameCount, this.arScene);
      }
    }

    this.arScene.render();
  }
}

new App();