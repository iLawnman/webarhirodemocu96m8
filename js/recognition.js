import * as THREE from 'three';
import { createArTargetSync } from './artarget.js';
import { playSound } from './audio.js';
import { QuestManager } from './quests.js';

export class ImageRecognition {
  constructor(ui) {
    this.ui = ui;
    /** @type {Array<{bmp: ImageBitmap, name: string, src: string, source: string}>} */
    this.targetBitmaps = [];
    this.trackedMarkers = new Map();
    // waitingImage   — ждём распознавания маркера (показана панель "ИЩИТЕ!")
    // waitingInput   — маркер найден, открыта questionpanel, ждём ответа пользователя
    // showingResult  — ответ дан, показана resultpanel
    this.state = 'waitingImage';

    // Менеджер квестов для сопоставления RecognitionImage -> Quest
    this.questManager = new QuestManager();

    this._raycaster = new THREE.Raycaster();
    this._pointerNdc = new THREE.Vector2(0, 0);
    this._boundOnSelect = null;
    this._boundOnClick = null;
    this._arScene = null;
    this._xrSession = null;
  }

  /** Путь к манифесту со списком маркеров */
  static MANIFEST_URL = './assets/recognitionimages.json';

  async makeGeneratedBitmap() {
    this.ui.log('Generating fallback bitmap...', 'warn');
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#e0e0e0';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `hsl(${Math.random() * 360},70%,50%)`;
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 25 + 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 512, Math.random() * 512);
      ctx.lineTo(Math.random() * 512, Math.random() * 512);
      ctx.stroke();
    }
    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    const bmp = await createImageBitmap(blob);
    this.ui.log('Fallback bitmap 512x512 ready', 'ok');
    return bmp;
  }

  /**
   * Загружает манифест recognitionimages.json.
   * Поддерживаемые форматы:
   *   ["T1.jpg", "T2.jpg"]
   *   [{ "name": "T1", "src": "T1.jpg" }, ...]
   *   { "images": [ ... ] }
   * Пути без префикса считаются относительно ./assets/
   */
  async loadImageList() {
    const url = ImageRecognition.MANIFEST_URL;
    this.ui.log('Loading image list from: ' + url, 'info');
    try {
      const res = await fetch(url);
      this.ui.log('Manifest fetch: ' + res.status + ' ' + res.statusText, res.ok ? 'ok' : 'warn');
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      let items = Array.isArray(data) ? data : (data.images || data.markers || []);
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Empty or invalid image list');
      }

      return items.map((item, i) => {
        if (typeof item === 'string') {
          const name = item.replace(/\.[^.]+$/, '') || ('T' + (i + 1));
          const src = item.startsWith('./') || item.startsWith('/') || item.startsWith('http')
              ? item
              : './assets/' + item;
          return { name, src };
        }
        const name = item.name || item.id || ('T' + (i + 1));
        let src = item.src || item.url || item.path || item.file;
        if (!src) throw new Error('Item #' + i + ' has no src');
        if (!src.startsWith('./') && !src.startsWith('/') && !src.startsWith('http')) {
          src = './assets/' + src;
        }
        return { name, src };
      });
    } catch (e) {
      this.ui.log('Manifest load failed: ' + e.message, 'err');
      return null;
    }
  }

  async loadTargetImage(src) {
    this.ui.log('Loading target from: ' + src, 'info');
    try {
      this.ui.log('Trying fetch...', 'info');
      const res = await fetch(src);
      this.ui.log('Fetch status: ' + res.status + ' ' + res.statusText, res.ok ? 'ok' : 'warn');
      if (res.ok) {
        const blob = await res.blob();
        this.ui.log('Blob: size=' + blob.size + ' type=' + blob.type, 'info');
        const bmp = await createImageBitmap(blob);
        this.ui.log('Bitmap from fetch: ' + bmp.width + 'x' + bmp.height, 'ok');
        return { bmp, source: 'fetch' };
      }
    } catch (e) {
      this.ui.log('Fetch failed: ' + e.message, 'err');
    }

    this.ui.log('Trying Image() loader...', 'warn');
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.ui.log('Image loaded: ' + img.width + 'x' + img.height, 'ok');
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        c.toBlob(async (blob) => {
          const bmp = await createImageBitmap(blob);
          this.ui.log('Bitmap from Image(): ' + bmp.width + 'x' + bmp.height, 'ok');
          resolve({ bmp, source: 'image' });
        }, 'image/png');
      };
      img.onerror = () => {
        this.ui.log('Image() failed', 'err');
        resolve(null);
      };
      img.src = src;
    });
  }

  /**
   * Загружает список картинок из манифеста, таблицы квестов и готовит ImageBitmap[] для XR Image Tracking.
   * При ошибке манифеста или загрузки — fallback на сгенерированный маркер.
   */
  async init() {
    this.state = 'waitingImage';
    this.targetBitmaps = [];

    // Загрузка таблиц квестов и ответов
    this.ui.log('Loading quest table & answers...', 'info');
    await this.questManager.loadData();
    if (this.questManager.isLoaded) {
      this.ui.log(`Quest data loaded: ${this.questManager.quests.size} quests, ${this.questManager.answers.size} answers`, 'ok');
    } else {
      this.ui.log('Failed to load quest data, falling back to default marker info', 'warn');
    }

    const list = await this.loadImageList();

    if (list && list.length) {
      this.ui.log('Found ' + list.length + ' image(s) in manifest', 'info');
      for (const item of list) {
        const result = await this.loadTargetImage(item.src);
        if (result && result.bmp) {
          this.targetBitmaps.push({
            bmp: result.bmp,
            name: item.name,
            src: item.src,
            source: result.source
          });
          this.ui.log('Ready: ' + item.name + ' via ' + result.source, 'ok');
        } else {
          this.ui.log('Skip failed: ' + item.src, 'err');
        }
      }
    }

    if (this.targetBitmaps.length === 0) {
      this.ui.log('No images loaded, using generated fallback', 'err');
      const bmp = await this.makeGeneratedBitmap();
      this.targetBitmaps.push({ bmp, name: 'T1', src: '(generated)', source: 'generated' });

      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(32, 32, 64, 64);
      // this.ui.setPreview(c.toDataURL());
    } else {
      // this.ui.setPreview(this.targetBitmaps[0].src);
    }

    const names = this.targetBitmaps.map(t => t.name).join(', ');
    this.ui.enableArButton();
    this.ui.log('state → waitingImage | markers: ' + names, 'info');
  }

  /** Массив ImageBitmap (сырой). */
  getBitmaps() {
    return this.targetBitmaps.map(t => t.bmp);
  }

  /**
   * Готовый массив для XRSessionInit.trackedImages.
   * Использование:
   *   trackedImages: recognition.getTrackedImages(0.2)
   */
  getTrackedImages(widthInMeters = 0.2) {
    return this.targetBitmaps
        .filter(t => t && t.bmp)
        .map(t => ({
          image: t.bmp,
          widthInMeters
        }));
  }

  /** Имя маркера по индексу из getImageTrackingResults(). */
  getMarkerName(idx) {
    const entry = this.targetBitmaps[idx];
    return entry ? entry.name : ('T' + (idx + 1));
  }

  /** Обратная совместимость (первый битмап). */
  get targetBitmap() {
    return this.targetBitmaps[0]?.bmp ?? null;
  }

  attachInput(xrSession, arScene) {
    this._xrSession = xrSession;
    this._arScene = arScene;

    this._boundOnSelect = (ev) => this._onSelect(ev);
    xrSession.addEventListener('select', this._boundOnSelect);

    this._boundOnClick = (ev) => this._onCanvasTap(ev);
    arScene.renderer.domElement.addEventListener('click', this._boundOnClick);
    arScene.renderer.domElement.addEventListener('touchend', this._boundOnClick, { passive: true });
  }

  detachInput() {
    if (this._xrSession && this._boundOnSelect) {
      this._xrSession.removeEventListener('select', this._boundOnSelect);
    }
    if (this._arScene && this._boundOnClick) {
      this._arScene.renderer.domElement.removeEventListener('click', this._boundOnClick);
      this._arScene.renderer.domElement.removeEventListener('touchend', this._boundOnClick);
    }
    this._xrSession = null;
    this._arScene = null;
    this._boundOnSelect = null;
    this._boundOnClick = null;
  }

  /**
   * Показывает панель "ИЩИТЕ!" со случайной картинкой из списка распознаваемых
   * маркеров. Вызывается когда пол установлен (сессия готова) и когда
   * пользователь возвращается в режим поиска (маркер потерян / ответ дан).
   * @param {string} [hintText]
   */
  presentSearchPrompt(hintText) {
    this.state = 'waitingImage';
    if (!this.targetBitmaps.length) return;

    const pick = this.targetBitmaps[Math.floor(Math.random() * this.targetBitmaps.length)];
    this.ui.showQuestStart(pick.src, 'ИЩИТЕ!');

    // const names = this.targetBitmaps.map(t => t.name).join(', ');
    // this.ui.setHint(hintText || ('Покажите одну из картинок: ' + names));
  }

  /**
   * Полный сброс состояния распознавания (используется при завершении AR-сессии):
   * убирает все AR-цели со сцены, закрывает все overlay-панели.
   * @param {import('./arscene.js').ARScene} [arScene]
   */
  reset(arScene) {
    for (const [, entry] of this.trackedMarkers) {
      if (entry.arTarget) {
        if (arScene) arScene.scene.remove(entry.arTarget);
        this._disposeTarget(entry.arTarget);
      }
    }
    this.trackedMarkers.clear();
    this.state = 'waitingImage';

    this.ui.hideQuestStart();
    this.ui.hideQuestion();
    this.ui.hideResult();
  }

  _onSelect(ev) {
    if (this.state !== 'waitingInput' || !this._arScene) return;
    this._pointerNdc.set(0, 0);
    this._tryHitOk();
  }

  _onCanvasTap(ev) {
    if (this.state !== 'waitingInput' || !this._arScene) return;
    const rect = this._arScene.renderer.domElement.getBoundingClientRect();
    let clientX, clientY;
    if (ev.changedTouches && ev.changedTouches.length) {
      clientX = ev.changedTouches[0].clientX;
      clientY = ev.changedTouches[0].clientY;
    } else {
      clientX = ev.clientX;
      clientY = ev.clientY;
    }
    this._pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this._tryHitOk();
  }

  _tryHitOk() {
    if (!this._arScene) return;
    const camera = this._arScene.camera;
    if (!camera) return;
    this._raycaster.setFromCamera(this._pointerNdc, camera);

    for (const [, entry] of this.trackedMarkers) {
      if (!entry.arTarget || !entry.arTarget.visible || entry.dismissed) continue;
      const ud = entry.arTarget.userData || {};
      const okPanel = ud.okPanel || ud.okButton
          || (ud.panels && (ud.panels.okPanel || ud.panels.okButton));
      if (!okPanel) continue;
      const hits = this._raycaster.intersectObject(okPanel, false);
      if (hits.length > 0) {
        this._handleOk(entry);
        return;
      }
    }

    // mobile UX: one visible target → any tap = OK
    if (this.state === 'waitingInput') {
      for (const [, entry] of this.trackedMarkers) {
        if (entry.arTarget && entry.arTarget.visible && !entry.dismissed) {
          this._handleOk(entry);
          return;
        }
      }
    }
  }

  /**
   * Тап по 3D OK-кнопке / по маркеру. Настоящий ответ на вопрос всегда даётся
   * через 2D questionpanel (см. _openQuestionPanel/_onQuestionAnswered).
   * Тап по 3D-объекту работает только как ярлык подтверждения для типов
   * без выбора (Art/AntiArt/без совпадения в quest-таблице) — для Button/
   * Slide/InputField он игнорируется, чтобы не подменять реальный ответ.
   */
  _handleOk(entry) {
    if (entry.dismissed) return;
    const type = entry.questData?.answerType;
    if (type === 'Art' || type === 'AntiArt' || !type) {
      this._onQuestionAnswered(entry, true);
    }
  }

  /**
   * Открывает 2D questionpanel с картинкой распознанного маркера и вопросом
   * из questtable.json, подключает обработчик ответа.
   */
  _openQuestionPanel(entry, markerName) {
    const questData = entry.questData;
    const bitmapEntry = this.targetBitmaps.find(t => t.name === markerName);

    const data = {
      imageSrc: bitmapEntry ? bitmapEntry.src : '',
      question: questData?.question || questData?.title || markerName,
      mainText: questData?.mainText || '',
      answerType: questData?.answerType || 'Slide',
      options: questData?.options || []
    };

    this.ui.showQuestion(data, (value) => this._onQuestionAnswered(entry, value));
  }

  /**
   * Пользователь дал ответ (через questionpanel или через тап-ярлык).
   * Валидирует ответ, прячет AR-цель и questionpanel, показывает resultPanel
   * с текстом из RightReaction/WrongReaction.
   */
  _onQuestionAnswered(entry, value) {
    if (entry.dismissed) return;
    entry.dismissed = true;

    if (entry.arTarget) {
      entry.arTarget.visible = false;
    }
    this.ui.hideQuestion();

    const questData = entry.questData;
    const questId = questData?.questId;

    let isCorrect = true;
    if (questId && this.questManager.quests.has(questId)) {
      isCorrect = this.questManager.validateAnswer(questId, value);
    }

    this.state = 'showingResult';
    this.ui.log(
        `[Quest ${questId || '?'}] answer=${JSON.stringify(value)} → ${isCorrect ? 'CORRECT' : 'WRONG'}`,
        isCorrect ? 'ok' : 'warn'
    );

    const reactionText = this.questManager.getReactionText(questId, isCorrect);

    this.ui.showResult(isCorrect, reactionText, () => {
      this.presentSearchPrompt();
    });
  }

  processTracking(frame, xrRefSpace, frameCount, arScene) {
    try {
      if (!frame || typeof frame.getImageTrackingResults !== 'function') return;

      const results = frame.getImageTrackingResults();
      if (!results) return;

      const seen = new Set();

      for (const result of results) {
        if (!result) continue;

        const trackingState = result.trackingState;
        const idx = result.index;
        seen.add(idx);

        const pose = frame.getPose(result.imageSpace, xrRefSpace);
        if (!pose || !pose.transform) continue;

        let entry = this.trackedMarkers.get(idx);

        if (!entry) {
          if (this.state !== 'waitingImage') continue;

          const markerName = this.getMarkerName(idx);

          // Поиск квеста по имени маркера (recognitionImage == markerName)
          const questData = this.questManager.getArTargetData(markerName);

          if (questData && questData.questId) {
            this.ui.log(`[Quest] Matched marker "${markerName}" to Quest ID "${questData.questId}"`, 'ok');
            if (questData.question) {
              this.ui.log(`[Quest] Question: "${questData.question}"`, 'info');
            }
          } else {
            this.ui.log(`[Quest] No quest match for marker "${markerName}". Using fallback data.`, 'warn');
          }

          // Формируем объект данных для создания 3D панели ARTarget
          const targetInfoData = {
            title: questData?.title || markerName,
            subtitle: questData?.question || 'AR Target', // Вывод вопроса quest.question
            textLabel: questData?.questId ? `QUEST ${questData.questId}` : 'MARKER',
            imgLabel: 'IMAGE',
            okText: 'OK',
            questData: questData // Сохраняем полный контекст квеста
          };

          // Синхронный create — никаких Promise в frame loop
          const arTarget = createArTargetSync(targetInfoData, {
            onOk: () => {
              const e = this.trackedMarkers.get(idx);
              if (e) this._handleOk(e);
            }
          });

          if (!arTarget || !arTarget.isObject3D) {
            this.ui.log('[' + idx + '] createArTargetSync returned invalid object', 'err');
            continue;
          }

          arScene.scene.add(arTarget);
          entry = { arTarget, lastState: trackingState, dismissed: false, questData };
          this.trackedMarkers.set(idx, entry);

          this.state = 'waitingInput';
          this.ui.log('[' + idx + '] AR Target created for marker: ' + markerName + ' (state=' + trackingState + ')', 'ok');
          this.ui.log('state → waitingInput', 'info');

          // Картинка найдена: прячем "ИЩИТЕ!", открываем панель вопроса
          this.ui.hideQuestStart();
          this._openQuestionPanel(entry, markerName);

          playSound("click");
        }

        if (entry.dismissed) {
          entry.lastState = trackingState;
          continue;
        }

        const target = entry.arTarget;
        if (!target || !target.isObject3D) continue;

        const t = pose.transform;
        const pos = t.position;
        const ori = t.orientation;

        if (target.position && pos &&
            Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z)) {
          target.position.set(pos.x, pos.y, pos.z);
        }

        if (target.quaternion && ori &&
            Number.isFinite(ori.x) && Number.isFinite(ori.y) &&
            Number.isFinite(ori.z) && Number.isFinite(ori.w)) {
          target.quaternion.set(ori.x, ori.y, ori.z, ori.w);
        }

        entry.lastState = trackingState;

        if (target.scale) {
          target.scale.setScalar(trackingState === 'emulated' ? 0.7 : 1.0);
        }
      }

      for (const [idx, entry] of this.trackedMarkers) {
        if (!seen.has(idx) && entry.lastState !== 'lost') {
          entry.lastState = 'lost';
          this.ui.log('[' + idx + '] Tracking lost', 'warn');

          if (entry.arTarget) {
            arScene.scene.remove(entry.arTarget);
            this._disposeTarget(entry.arTarget);
          }
          this.trackedMarkers.delete(idx);

          // Если ответ ещё не был дан (маркер потерян до завершения вопроса) —
          // закрываем questionpanel и возвращаемся к поиску.
          if (!entry.dismissed) {
            this.ui.hideQuestion();
            this.ui.log('state → waitingImage (lost before answer)', 'info');
            this.presentSearchPrompt('Маркер потерян. Покажите картинку снова.');
          }
        }
      }
    } catch (e) {
      if (frameCount % 60 === 0) {
        this.ui.log('getImageTrackingResults err: ' + (e && e.message ? e.message : String(e)), 'err');
      }
    }
  }

  _disposeTarget(group) {
    if (!group) return;
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      }
    });
  }
}