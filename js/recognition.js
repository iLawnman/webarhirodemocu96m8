// ===================== recognition.js =====================
import * as THREE from 'three';
import { createArTargetSync } from './artarget.js';
import { playSound } from './audio.js';
import { QuestManager } from './quests.js';
import { Policies } from './policies.js';

export class ImageRecognition {
  /**
   * @param {import('./ui.js').UI} ui
   * @param {import('./settings.js').Settings} settings
   */
  constructor(ui, settings) {
    this.ui = ui;
    this.settings = settings;

    /** @type {Array<{bmp: ImageBitmap, name: string, src: string, source: string}>} */
    this.targetBitmaps = [];
    this.trackedMarkers = new Map();
    // waitingImage   — ждём распознавания маркера (показана панель "ИЩИТЕ!" + мигающая рамка)
    // recognizing    — маркер найден, 2с эффект + сбор поз, якорь ещё не создан
    // waitingInput   — якорь готов, панель вопроса открыта, ждём ответа
    // showingResult  — ответ дан, показана resultpanel
    this.state = 'waitingImage';

    this.questManager = new QuestManager();
    this.policies = new Policies(settings, this.questManager);

    this._raycaster = new THREE.Raycaster();
    this._pointerNdc = new THREE.Vector2(0, 0);
    this._boundOnSelect = null;
    this._boundOnClick = null;
    this._arScene = null;
    this._xrSession = null;

    this._tmpPos = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
  }

  static MANIFEST_URL = './assets/recognitionimages.json';
  static SMOOTH_FACTOR = 0.25;
  /** Длительность эффекта распознавания (мс) — должна совпадать с UI */
  static RECOG_EFFECT_MS = 2000;

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

  async init() {
    this.state = 'waitingImage';
    this.targetBitmaps = [];

    this.ui.log('Loading quest table & answers...', 'info');
    await this.questManager.loadData();
    if (this.questManager.isLoaded) {
      this.ui.log(`Quest data loaded: ${this.questManager.quests.size} quests, ${this.questManager.answers.size} answers`, 'ok');
    } else {
      this.ui.log('Failed to load quest data, falling back to default marker info', 'warn');
    }

    // policies после questManager (нужен currentQuestId и RecognitionImage)
    this.policies.init();
    this.ui.log(
        `Policies mode=${this.policies.mode} | expected="${this.policies.expectedMarker || '—'}"`,
        'info'
    );

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
    }

    const names = this.targetBitmaps.map(t => t.name).join(', ');
    this.ui.enableArButton();
    this.ui.log('state → waitingImage | markers: ' + names, 'info');
  }

  getBitmaps() {
    return this.targetBitmaps.map(t => t.bmp);
  }

  getTrackedImages(widthInMeters = 0.2) {
    return this.targetBitmaps
        .filter(t => t && t.bmp)
        .map(t => ({
          image: t.bmp,
          widthInMeters
        }));
  }

  getMarkerName(idx) {
    const entry = this.targetBitmaps[idx];
    return entry ? entry.name : ('T' + (idx + 1));
  }

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
   * Показывает панель "ИЩИТЕ!" + мигающую рамку.
   * При включённых политиках (mode ≥ 2) показывает ожидаемый маркер, иначе — случайный.
   */
  presentSearchPrompt(hintText) {
    this.state = 'waitingImage';
    this.ui.hideScanFrame();
    if (!this.targetBitmaps.length) return;

    let pick;
    if (this.policies.mode >= 2 && this.policies.expectedMarker) {
      pick = this.targetBitmaps.find(t => t.name === this.policies.expectedMarker)
          || this.targetBitmaps[0];
    } else {
      pick = this.targetBitmaps[Math.floor(Math.random() * this.targetBitmaps.length)];
    }

    this.ui.showQuestStart(pick.src, 'ИЩИТЕ!');
    this.ui.showScanFrameBlink();
  }

  reset(arScene) {
    for (const [, entry] of this.trackedMarkers) {
      if (entry.arTarget && arScene) {
        arScene.scene.remove(entry.arTarget);
      }
      this._disposeEntry(entry);
    }
    this.trackedMarkers.clear();
    this.state = 'waitingImage';

    this.policies.reset();

    this.ui.hideQuestStart();
    this.ui.hideResult();
    this.ui.hideScanFrame();
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

    if (this.state === 'waitingInput') {
      for (const [, entry] of this.trackedMarkers) {
        if (entry.arTarget && entry.arTarget.visible && !entry.dismissed) {
          this._handleOk(entry);
          return;
        }
      }
    }
  }

  _handleOk(entry) {
    if (entry.dismissed) return;
    const type = entry.questData?.answerType;
    if (type === 'Art' || type === 'AntiArt' || !type) {
      this._onQuestionAnswered(entry, true);
    }
  }

  _onQuestionAnswered(entry, value) {
    if (entry.dismissed) return;
    entry.dismissed = true;

    if (entry.arTarget) {
      const ud = entry.arTarget.userData || {};
      if (ud.panelEl) {
        ud.panelEl.style.display = 'none';
        if (ud.panelEl.parentNode) {
          ud.panelEl.parentNode.removeChild(ud.panelEl);
        }
      }
      if (ud.cssObject) {
        ud.cssObject.visible = false;
      }
      entry.arTarget.visible = false;

      if (this._arScene && entry.arTarget.parent) {
        this._arScene.scene.remove(entry.arTarget);
      }
    }

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

    // Продвигаем цепочку (strictUnique) до показа реакции
    if (questId) {
      const quest = this.questManager.quests.get(questId);
      if (quest) {
        const nextId = isCorrect ? quest.RightWayQuest : quest.WrongWayQuest;
        if (nextId) {
          this.policies.onQuestAdvanced(nextId);
          this.ui.log(
              `[Policy] advanced → ${nextId} | next expected="${this.policies.expectedMarker || '—'}"`,
              'info'
          );
        }
      }
    }

    const reactionText = this.questManager.getReactionText(questId, isCorrect);

    this.ui.showResult(isCorrect, reactionText, () => {
      this.presentSearchPrompt();
    });
  }

  /**
   * Усреднение собранных поз → { position, orientation } для createAnchor.
   */
  _computeStablePose(samples) {
    if (!samples || samples.length === 0) return null;

    const n = samples.length;
    let px = 0, py = 0, pz = 0;
    let qx = 0, qy = 0, qz = 0, qw = 0;

    // берём последнюю половину сэмплов (более стабильные)
    const start = Math.floor(n / 2);
    const count = n - start;
    for (let i = start; i < n; i++) {
      const s = samples[i];
      px += s.px; py += s.py; pz += s.pz;
      // простая сумма кватернионов (нормализуем в конце) — ок для близких ориентаций
      qx += s.qx; qy += s.qy; qz += s.qz; qw += s.qw;
    }
    px /= count; py /= count; pz /= count;
    qx /= count; qy /= count; qz /= count; qw /= count;
    const len = Math.hypot(qx, qy, qz, qw) || 1;
    qx /= len; qy /= len; qz /= len; qw /= len;

    return {
      position: { x: px, y: py, z: pz },
      orientation: { x: qx, y: qy, z: qz, w: qw }
    };
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

        // ─── Первое обнаружение ───
        if (!entry) {
          if (this.state !== 'waitingImage') continue;

          const markerName = this.getMarkerName(idx);

          // ── Policies gate ──
          const policyCheck = this.policies.canRecognize(markerName);
          if (!policyCheck.ok) {
            this.ui.log(`[Policy] REJECT "${markerName}": ${policyCheck.reason}`, 'warn');
            continue;
          }

          const bitmapEntry = this.targetBitmaps.find(t => t.name === markerName);
          const questData = this.questManager.getArTargetData(markerName);

          if (questData && questData.questId) {
            this.ui.log(`[Quest] Matched marker "${markerName}" to Quest ID "${questData.questId}"`, 'ok');
            if (questData.question) {
              this.ui.log(`[Quest] Question: "${questData.question}"`, 'info');
            }
          } else {
            this.ui.log(`[Quest] No quest match for marker "${markerName}". Using fallback data.`, 'warn');
          }

          const targetInfoData = {
            title: questData?.title || markerName,
            question: questData?.question || questData?.title || markerName,
            mainText: questData?.mainText || '',
            answerType: questData?.answerType || 'Slide',
            options: questData?.options || [],
            imageSrc: bitmapEntry ? bitmapEntry.src : '',
            questId: questData?.questId,
            questData
          };

          const arTarget = createArTargetSync(targetInfoData, {
            onAnswer: (value) => {
              const e = this.trackedMarkers.get(idx);
              if (e) this._onQuestionAnswered(e, value);
            }
          });

          if (!arTarget || !arTarget.isObject3D) {
            this.ui.log('[' + idx + '] createArTargetSync returned invalid object', 'err');
            continue;
          }

          // сразу ставим позу, но скрываем до конца эффекта
          const t0 = pose.transform;
          if (t0.position) {
            arTarget.position.set(t0.position.x, t0.position.y, t0.position.z);
          }
          if (t0.orientation) {
            arTarget.quaternion.set(
                t0.orientation.x, t0.orientation.y,
                t0.orientation.z, t0.orientation.w
            );
          }
          arTarget.visible = false;

          arScene.scene.add(arTarget);

          const now = performance.now();
          entry = {
            arTarget,
            lastState: trackingState,
            dismissed: false,
            questData,
            anchor: null,
            anchorCreating: false,
            // фаза распознавания
            recognizing: true,
            recogStart: now,
            poseSamples: [],
            effectDone: false,
            pendingAnchorPose: null
          };
          this.trackedMarkers.set(idx, entry);

          // StepByStep: помечаем маркер использованным сразу при старте flow
          this.policies.onRecognized(markerName);

          // UI: сразу прячем «ИЩИТЕ!», запускаем 2с эффект
          this.state = 'recognizing';
          this.ui.hideQuestStart();
          this.ui.log('[' + idx + '] Marker found → recognizing (2s effect)', 'ok');
          playSound('click');

          this.ui.playScanEffect(() => {
            // эффект закончился → обрабатываем собранные позы
            const e = this.trackedMarkers.get(idx);
            if (!e || e.dismissed) return;

            e.effectDone = true;
            e.pendingAnchorPose = this._computeStablePose(e.poseSamples);
            e.recognizing = false;

            // показываем AR-таргет
            if (e.arTarget) {
              e.arTarget.visible = true;
            }

            this.state = 'waitingInput';
            this.ui.log('[' + idx + '] Effect done → waitingInput (anchor next frame)', 'ok');
            this.ui.log('state → waitingInput', 'info');
          });
        }

        if (entry.dismissed) {
          entry.lastState = trackingState;
          continue;
        }

        const target = entry.arTarget;
        if (!target || !target.isObject3D) continue;

        // ─── Фаза recognizing: только сбор поз, якорь НЕ создаём ───
        if (entry.recognizing || !entry.effectDone) {
          const t = pose.transform;
          const pos = t.position;
          const ori = t.orientation;
          if (pos && ori &&
              Number.isFinite(pos.x) && Number.isFinite(ori.w)) {
            entry.poseSamples.push({
              px: pos.x, py: pos.y, pz: pos.z,
              qx: ori.x, qy: ori.y, qz: ori.z, qw: ori.w
            });
            // ограничиваем буфер
            if (entry.poseSamples.length > 120) {
              entry.poseSamples.shift();
            }
            // мягко обновляем скрытый таргет
            target.position.set(pos.x, pos.y, pos.z);
            target.quaternion.set(ori.x, ori.y, ori.z, ori.w);
          }
          entry.lastState = trackingState;
          continue;
        }

        // ─── После эффекта: создаём якорь один раз по стабильной позе ───
        if (!entry.anchor && !entry.anchorCreating && typeof frame.createAnchor === 'function') {
          entry.anchorCreating = true;

          let anchorPose = pose;
          // если есть усреднённая поза — подставляем её в XRRigidTransform
          if (entry.pendingAnchorPose && typeof XRRigidTransform !== 'undefined') {
            try {
              const p = entry.pendingAnchorPose.position;
              const o = entry.pendingAnchorPose.orientation;
              const transform = new XRRigidTransform(
                  { x: p.x, y: p.y, z: p.z },
                  { x: o.x, y: o.y, z: o.z, w: o.w }
              );
              // createAnchor принимает XRRigidTransform
              const createPromise = frame.createAnchor(transform, xrRefSpace);
              if (createPromise && typeof createPromise.then === 'function') {
                createPromise
                    .then((anchor) => {
                      if (entry && !entry.dismissed) {
                        entry.anchor = anchor;
                        this.ui.log('[' + idx + '] XRAnchor created (from averaged pose)', 'ok');
                      } else if (anchor && typeof anchor.delete === 'function') {
                        try { anchor.delete(); } catch (_) {}
                      }
                    })
                    .catch((err) => {
                      this.ui.log('[' + idx + '] createAnchor failed: ' + (err?.message || err), 'warn');
                      // fallback: попробуем с текущим pose
                      entry.anchorCreating = false;
                    })
                    .finally(() => {
                      if (entry) entry.anchorCreating = false;
                    });
                entry.pendingAnchorPose = null;
                entry.lastState = trackingState;
                continue;
              }
            } catch (err) {
              this.ui.log('[' + idx + '] XRRigidTransform/anchor error: ' + (err?.message || err), 'warn');
            }
          }

          // fallback — якорь из текущего image pose
          const createPromise = frame.createAnchor(pose.transform, xrRefSpace);
          if (createPromise && typeof createPromise.then === 'function') {
            createPromise
                .then((anchor) => {
                  if (entry && !entry.dismissed) {
                    entry.anchor = anchor;
                    this.ui.log('[' + idx + '] XRAnchor created', 'ok');
                  } else if (anchor && typeof anchor.delete === 'function') {
                    try { anchor.delete(); } catch (_) {}
                  }
                })
                .catch((err) => {
                  this.ui.log('[' + idx + '] createAnchor failed: ' + (err?.message || err), 'warn');
                })
                .finally(() => {
                  if (entry) entry.anchorCreating = false;
                });
          } else {
            entry.anchorCreating = false;
          }
        }

        // ─── Обновление позиции (якорь или сглаженный tracking) ───
        let usePose = pose;
        if (entry.anchor && entry.anchor.anchorSpace) {
          const anchorPose = frame.getPose(entry.anchor.anchorSpace, xrRefSpace);
          if (anchorPose && anchorPose.transform) {
            usePose = anchorPose;
          }
        }

        const t = usePose.transform;
        const pos = t.position;
        const ori = t.orientation;

        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z)) {
          this._tmpPos.set(pos.x, pos.y, pos.z);
          if (entry.anchor) {
            target.position.copy(this._tmpPos);
          } else {
            target.position.lerp(this._tmpPos, ImageRecognition.SMOOTH_FACTOR);
          }
        }

        if (ori &&
            Number.isFinite(ori.x) && Number.isFinite(ori.y) &&
            Number.isFinite(ori.z) && Number.isFinite(ori.w)) {
          this._tmpQuat.set(ori.x, ori.y, ori.z, ori.w);
          if (entry.anchor) {
            target.quaternion.copy(this._tmpQuat);
          } else {
            target.quaternion.slerp(this._tmpQuat, ImageRecognition.SMOOTH_FACTOR);
          }
        }

        entry.lastState = trackingState;

        if (target.scale) {
          target.scale.setScalar(trackingState === 'emulated' ? 0.7 : 1.0);
        }
      }

      // ─── Потеря трекинга ───
      for (const [idx, entry] of this.trackedMarkers) {
        if (!seen.has(idx) && entry.lastState !== 'lost') {
          entry.lastState = 'lost';
          this.ui.log('[' + idx + '] Tracking lost', 'warn');

          if (entry.arTarget && entry.arTarget.parent) {
            arScene.scene.remove(entry.arTarget);
          }
          this._disposeEntry(entry);
          this.trackedMarkers.delete(idx);

          if (!entry.dismissed) {
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

  _disposeEntry(entry) {
    if (!entry) return;

    if (entry.anchor && typeof entry.anchor.delete === 'function') {
      try {
        entry.anchor.delete();
      } catch (_) { /* ignore */ }
      entry.anchor = null;
    }

    const group = entry.arTarget;
    if (!group) return;

    group.traverse((obj) => {
      if (obj.element && obj.element.parentNode) {
        obj.element.parentNode.removeChild(obj.element);
      }
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

    entry.arTarget = null;
  }
}