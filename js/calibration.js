import * as THREE from 'three';

export class CalibrationManager {
  constructor(ui, arScene) {
    this.ui = ui;
    this.arScene = arScene;
    
    this.reticle = null;
    this.featurePoints = null;
    this.calibrationGroup = new THREE.Group();
    
    this.hitTestSource = null;
    this.calibratedMatrix = null;
    this.isCalibrating = false;

    this.initCalibrationVisuals();
  }

  initCalibrationVisuals() {
    // 1. Прицел (Зеленый круг)
    const ringGeo = new THREE.RingGeometry(0.1, 0.14, 32).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide });
    this.reticle = new THREE.Mesh(ringGeo, ringMat);

    // 2. Точки отслеживания (Feature Points)
    const count = 80;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 0.05 + Math.random() * 0.45;
      const theta = Math.random() * Math.PI * 2;
      positions[i * 3] = r * Math.cos(theta);
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      positions[i * 3 + 2] = r * Math.sin(theta);
    }

    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pointsMat = new THREE.PointsMaterial({
      color: 0x00ff88,
      size: 0.012,
      transparent: true,
      opacity: 0.8
    });

    this.featurePoints = new THREE.Points(pointsGeo, pointsMat);

    this.calibrationGroup.add(this.reticle);
    this.calibrationGroup.add(this.featurePoints);
    this.calibrationGroup.matrixAutoUpdate = false;
    this.calibrationGroup.visible = false;
  }

  async startCalibration(session, refSpace) {
    this.arScene.add(this.calibrationGroup);
    this.ui.setHint('Сканируйте поверхност пола...');

    const viewerSpace = await session.requestReferenceSpace('viewer');
    this.hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    this.isCalibrating = true;

    return new Promise((resolve) => {
      this.onSelectHandler = () => {
        if (this.calibrationGroup.visible) {
          this.calibratedMatrix = this.calibrationGroup.matrix.clone();
          this.isCalibrating = false;
          this.calibrationGroup.visible = false;
          this.arScene.remove(this.calibrationGroup);
          
          if (this.hitTestSource) {
            this.hitTestSource.cancel();
            this.hitTestSource = null;
          }

          session.removeEventListener('select', this.onSelectHandler);
          resolve(this.calibratedMatrix);
        }
      };

      session.addEventListener('select', this.onSelectHandler);
    });
  }

  // Метод вызывается из единого цикла onXRFrame в app.js
  update(frame, refSpace) {
    if (!this.isCalibrating || !this.hitTestSource) return;

    const hitResults = frame.getHitTestResults(this.hitTestSource);
    if (hitResults.length > 0) {
      const hit = hitResults[0];
      const pose = hit.getPose(refSpace);

      this.calibrationGroup.visible = true;
      this.calibrationGroup.matrix.fromArray(pose.transform.matrix);
      
      if (this.featurePoints) {
        this.featurePoints.rotation.y += 0.02;
      }

      this.ui.setHint('Пол найден! Нажмите на экран для фиксации.');
    } else {
      this.calibrationGroup.visible = false;
      this.ui.setHint('Сканируйте пол камерой...');
    }
  }
}