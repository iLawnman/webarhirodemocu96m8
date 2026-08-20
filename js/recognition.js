import * as THREE from 'three';
import { ImageReco } from './imagereco.js';
import { QuestManager } from './quests.js';
import { Policies } from './policies.js';
import { createArTarget } from './artarget.js';
import { Reco3DObject } from './reco3dobject.js';
import { MediaPipeReco } from './mediapipe.js';
import { playSound } from './audio.js';

export class ImageRecognition {
  /**
   * @param {import('./ui.js').UI} ui
   * @param {import('./settings.js').Settings} settings
   */
  constructor(ui, settings) {
    this.ui = ui;
    this.settings = settings;

    this.questManager = new QuestManager();
    this.policies = new Policies(this.settings, this.questManager);

    this.imageReco = new ImageReco(
      this.ui,
      this.settings,
      this.questManager,
      this.policies
    );

    this.mediaPipeReco = new MediaPipeReco(this.ui, this.mediaPipeReco);

    this.trackedMarkers = new Map();
    this.xrSession = null;

    this._tmpPos = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();

    this.SCANNED_FRAMES_THRESHOLD = 120;
  }

  async init() {
    this.ui.log('Initializing ImageRecognition...', 'info');

    await this.questManager.loadData();
    if (this.questManager.isLoaded) {
      this.ui.log('Quests & Answers loaded successfully', 'ok');
    } else {
      this.ui.log('Quests load failed/fallback mode', 'warn');
    }

    this.policies.init();

    await this.imageReco.init();

    this.ui.log('ImageRecognition fully initialized', 'ok');
  }

  getTrackedImages(widthInMeters = 0.2) {
    return this.imageReco.getTrackedImages(widthInMeters);
  }

  attachInput(session, arScene) {
    this.xrSession = session;
  }

  detachInput() {
    this.xrSession = null;
  }

  presentSearchPrompt() {
    const expected = this.policies.expectedMarker;
    if (expected) {
      this.ui.setHint(`Наведите камеру на маркер: ${expected}`);
    } else {
      this.ui.setHint('Наведите камеру на любой маркер');
    }
  }

  reset(arScene) {
    for (const [idx, entry] of this.trackedMarkers.entries()) {
      this.disposeEntry(entry, arScene);
    }
    this.trackedMarkers.clear();
    this.policies.reset();
    this.mediaPipeReco.clear(arScene);
  }

  /**
   * Основной цикл процессинга трекинга WebXR кадра
   */
  processTracking(frame, refSpace, frameCount, arScene) {
    const results = frame.getImageTrackingResults ? frame.getImageTrackingResults() : [];

    for (const result of results) {
      const idx = result.index;
      const markerName = this.imageReco.getMarkerName(idx);
      const state = result.trackingState;

      let entry = this.trackedMarkers.get(idx);

      if (state === 'tracked') {
        const pose = frame.getPose(result.imageSpace, refSpace);
        if (!pose) continue;

        const pos = pose.transform.position;
        const ori = pose.transform.orientation;

        if (!entry) {
          const check = this.policies.canRecognize(markerName);
          if (!check.ok) {
            this.ui.log(`Policy block [${markerName}]: ${check.reason}`, 'warn');
            continue;
          }

          entry = {
            markerName,
            bitmapEntry: this.imageReco.targetBitmaps[idx],
            samples: [],
            scannedFrames: 0,
            isStable: false,
            isCompletingScan: false,
            scannerObject: null,
            arTarget: null,
            anchor: null
          };

          this.trackedMarkers.set(idx, entry);
          this.policies.onRecognized(markerName);

          this.ui.log(`Started scanning marker: ${markerName}`, 'info');
          playSound('scan_start');
        }

        if (!entry.isStable) {
          entry.samples.push({
            px: pos.x, py: pos.y, pz: pos.z,
            qx: ori.x, qy: ori.y, qz: ori.z, qw: ori.w
          });

          if (!entry.scannerObject) {
            const scanner = new Reco3DObject({ radius: 0.1, color: 0x00ffaa });
            const obj3D = scanner.getObject3D();
            obj3D.position.set(pos.x, pos.y, pos.z);
            obj3D.quaternion.set(ori.x, ori.y, ori.z, ori.w);

            arScene.scene.add(obj3D);
            entry.scannerObject = scanner;
          } else {
            const obj3D = entry.scannerObject.getObject3D();
            obj3D.position.set(pos.x, pos.y, pos.z);
            obj3D.quaternion.set(ori.x, ori.y, ori.z, ori.w);
          }

          entry.scannedFrames++;
          const progress = Math.min(100, Math.floor((entry.scannedFrames / this.SCANNED_FRAMES_THRESHOLD) * 100));
          entry.scannerObject.updateProgress(progress);

          if (entry.scannedFrames >= this.SCANNED_FRAMES_THRESHOLD && !entry.isCompletingScan) {
            entry.isCompletingScan = true;
            this.finishScanning(entry, markerName, arScene);
          }
        } else if (entry.arTarget) {
          // Если таргет уже создан и активен, плавно подтягиваем его к текущему трекингу маркера
          this._tmpPos.set(pos.x, pos.y, pos.z);
          this._tmpQuat.set(ori.x, ori.y, ori.z, ori.w);

          entry.arTarget.position.lerp(this._tmpPos, ImageReco.SMOOTH_FACTOR);
          entry.arTarget.quaternion.slerp(this._tmpQuat, ImageReco.SMOOTH_FACTOR);

          this.mediaPipeReco.processDetection(entry, arScene);
        }

      } else if (state === 'emulated') {
        if (entry && entry.arTarget) {
          // Во время эмуляции оставляем таргет видимым в зафиксированной позиции
        }
      }
    }
  }

  async finishScanning(entry, markerName, arScene) {
    this.ui.log(`Marker ${markerName} threshold reached. Playing scan effect...`, 'info');
    playSound('scan_success');

    // Дожидаемся полного завершения UI анимации сканирования
    await new Promise((resolve) => {
      this.ui.playScanEffect(() => resolve());
    });

    if (entry.scannerObject) {
      arScene.scene.remove(entry.scannerObject.getObject3D());
      entry.scannerObject.dispose();
      entry.scannerObject = null;
    }

    entry.isStable = true;
    this.ui.log(`Marker ${markerName} successfully scanned & stabilized!`, 'ok');

    const stablePose = this.imageReco.computeStablePose(entry.samples);
    await this.createTargetObject(entry, stablePose, arScene);
  }

  async createTargetObject(entry, stablePose, arScene) {
    const targetData = this.questManager.getArTargetData(entry.markerName);

    const onAnswerHandler = (userAnswer) => {
      this.handleUserAnswer(entry, targetData.questId, userAnswer, arScene);
    };

    const targetGroup = await createArTarget(targetData, {
      onAnswer: onAnswerHandler
    });

    if (stablePose) {
      targetGroup.position.set(
        stablePose.position.x,
        stablePose.position.y,
        stablePose.position.z
      );
      targetGroup.quaternion.set(
        stablePose.orientation.x,
        stablePose.orientation.y,
        stablePose.orientation.z,
        stablePose.orientation.w
      );
    }

    targetGroup.visible = true;

    // Включаем pointer-events на DOM-элементах CSS3DObject
    targetGroup.traverse((obj) => {
      if (obj.element) {
        obj.element.style.pointerEvents = 'auto';
      }
    });

    arScene.scene.add(targetGroup);
    entry.arTarget = targetGroup;

    this.ui.setHint(`Ответьте на вопрос: ${targetData.title || entry.markerName}`);
  }

  handleUserAnswer(entry, questId, userAnswer, arScene) {
    const isCorrect = this.questManager.validateAnswer(questId, userAnswer);
    const reactionText = this.questManager.getReactionText(questId, isCorrect);

    this.ui.log(`Answer for ${questId}: ${userAnswer} | Correct: ${isCorrect}`, isCorrect ? 'ok' : 'warn');

    if (isCorrect) {
      playSound('correct');
    } else {
      playSound('wrong');
    }

    this.ui.showResultPanel(reactionText, isCorrect, () => {
      const quest = this.questManager.quests.get(questId);
      const nextQuestId = isCorrect
        ? (quest?.RightWayQuest || quest?.NextWayQuest)
        : (quest?.WrongWayQuest || quest?.NextWayQuest);

      this.policies.onQuestAdvanced(nextQuestId);
      this.disposeEntry(entry, arScene);
      this.presentSearchPrompt();
    });
  }

  disposeEntry(entry, arScene) {
    if (!entry) return;

    if (entry.scannerObject) {
      if (arScene) arScene.scene.remove(entry.scannerObject.getObject3D());
      entry.scannerObject.dispose();
      entry.scannerObject = null;
    }

    if (entry.arTarget) {
      if (arScene) arScene.scene.remove(entry.arTarget);
    }

    this.imageReco.disposeEntry(entry);
  }
}