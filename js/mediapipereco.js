import { Reco3DObject } from './reco3dobject.js';

export class MediaPipeReco {
  /**
   * @param {import('./ui.js').UI} ui
   * @param {import('./mediapipe.js').MediaPipeService} mediaPipeService
   */
  constructor(ui, mediaPipeService) {
    this.ui = ui;
    this.mediaPipeService = mediaPipeService;
    this.reco3dObjects = new Map();
  }

  processDetection(entry, arScene) {
    if (!this.mediaPipeService || !this.mediaPipeService.isReady) return;
    const bitmapEntry = entry.bitmapEntry;
    if (!bitmapEntry || !bitmapEntry.bmp) return;

    const detections = this.mediaPipeService.detect(bitmapEntry.bmp);
    if (detections && detections.length > 0) {
      this.ui.showDetectedObjectsInfo(detections);

      const det = detections[0];
      const recoKey = `${entry.markerName}_${det.label}`;

      if (!this.reco3dObjects.has(recoKey)) {
        const recoObj = new Reco3DObject({
          label: det.label,
          score: det.score,
          box: [0.12, 0.12, 0.12]
        });

        const obj3D = recoObj.getObject3D();
        obj3D.position.copy(entry.arTarget.position);
        obj3D.position.y += 0.15;
        obj3D.quaternion.copy(entry.arTarget.quaternion);

        arScene.scene.add(obj3D);
        this.reco3dObjects.set(recoKey, recoObj);
        this.ui.log(`[MediaPipeReco] Created 3D Object: ${det.label}`, 'ok');
      } else {
        const recoObj = this.reco3dObjects.get(recoKey);
        recoObj.updateData(det);
        const obj3D = recoObj.getObject3D();
        obj3D.position.copy(entry.arTarget.position);
        obj3D.position.y += 0.15;
        obj3D.quaternion.copy(entry.arTarget.quaternion);
      }
    }
  }

  clear(arScene) {
    for (const [, recoObj] of this.reco3dObjects) {
      if (arScene) arScene.scene.remove(recoObj.getObject3D());
      recoObj.dispose();
    }
    this.reco3dObjects.clear();
  }
}