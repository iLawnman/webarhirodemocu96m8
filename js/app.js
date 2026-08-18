import { UI } from './ui.js';
import { ImageRecognition } from './recognition.js';
import { ARScene } from './arscene.js';
import { playSound } from "./audio.js";

export class App {
  constructor() {
    this.ui = new UI();
    this.recognition = new ImageRecognition(this.ui);
    this.arScene = new ARScene(this.ui);

    this.xrSession = null;
    this.imageTrackingEnabled = false;
    this.frameCount = 0;

    this.arScene.renderer.xr.setReferenceSpaceType('local-floor');

    this.init();
  }

  async init() {
    this.ui.log('App init (WebGL / Three.js WebXR)...', 'info');

    // Штора активна с самого старта, пока идёт инициализация
    this.ui.showCurtain();

    await this.recognition.init();

    this.ui.onStartAR(() => this.startAR());
    this.ui.onEndAR(() => this.endAR());

    this.arScene.renderer.setAnimationLoop((timestamp, frame) => {
      this.onXRFrame(timestamp, frame);
    });
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

    const sessionInit = {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['image-tracking', 'dom-overlay'],
      trackedImages,
      domOverlay: { root: document.body }
    };

    try {
      this.xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
    } catch (e) {
      this.ui.log('Session with dom-overlay failed, retrying without it...', 'warn');
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
      playSound("click");
    }

    await this.arScene.renderer.xr.setSession(this.xrSession);
    this.ui.log('Renderer session set (WebGL + local-floor)', 'ok');

    // Показываем кнопку End AR после успешного старта сессии
    this.ui.showEndArButton();
    this.imageTrackingEnabled = true;

    this.recognition.attachInput(this.xrSession, this.arScene);

    // Пол установлен (сессия готова) → штора уезжает вверх,
    // сверху выезжает панель "ИЩИТЕ!" со случайным маркером
    this.ui.hideCurtain();
    this.recognition.presentSearchPrompt();

    this.xrSession.addEventListener('end', () => {
      this.ui.log('Session ended', 'warn');
      this.imageTrackingEnabled = false;
      this.recognition.detachInput();
      this.recognition.reset(this.arScene);
      this.xrSession = null;
      this.frameCount = 0;

      // Возвращаем UI в первоначальное состояние
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
