import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

export class Reco3DObject {
  /**
   * @param {Object} detectedObject Данные распознанного 3D/2D объекта
   * @param {string} detectedObject.label Название объекта
   * @param {number} [detectedObject.score] Точность (0..1)
   * @param {Array<number>} [detectedObject.box] Размеры [w, h, d]
   */
  constructor(detectedObject = {}) {
    this.label = detectedObject.label || 'Unknown Object';
    this.score = detectedObject.score ?? 1.0;
    this.boxSize = detectedObject.box || [0.15, 0.15, 0.15];

    this.group = new THREE.Group();
    this.group.name = `reco3d_${this.label}_${Math.floor(Math.random() * 10000)}`;

    this.boxMesh = this._createBoundingBox();
    this.group.add(this.boxMesh);

    this.infoPanel = this._createInfoPanel();
    this.group.add(this.infoPanel);

    this.group.userData = {
      label: this.label,
      score: this.score,
      recoObject: this
    };
  }

  _createBoundingBox() {
    const [w, h, d] = this.boxSize;
    const geometry = new THREE.BoxGeometry(w, h, d);
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, linewidth: 2 });
    return new THREE.LineSegments(edges, lineMat);
  }

  _createInfoPanel() {
    const el = document.createElement('div');
    el.className = 'ar-css3d-panel reco-3d-info-panel';
    el.style.cssText = `
      background: rgba(10, 20, 30, 0.85);
      border: 1px solid #00e5ff;
      border-radius: 8px;
      padding: 8px 12px;
      color: #ffffff;
      font-family: sans-serif;
      font-size: 14px;
      box-shadow: 0 0 10px rgba(0, 229, 255, 0.4);
      pointer-events: auto;
      white-space: nowrap;
    `;

    const titleEl = document.createElement('div');
    titleEl.style.fontWeight = 'bold';
    titleEl.style.color = '#00e5ff';
    titleEl.textContent = this.label;

    const scoreEl = document.createElement('div');
    scoreEl.style.fontSize = '11px';
    scoreEl.style.opacity = '0.8';
    scoreEl.textContent = `Conf: ${(this.score * 100).toFixed(1)}%`;

    el.appendChild(titleEl);
    el.appendChild(scoreEl);

    const cssObj = new CSS3DObject(el);
    cssObj.name = 'RecoInfoPanel';
    cssObj.position.set(0, this.boxSize[1] / 2 + 0.05, 0);
    cssObj.scale.set(0.0005, 0.0005, 0.0005);
    return cssObj;
  }

  updateData(detectedObject) {
    if (detectedObject.score !== undefined) {
      this.score = detectedObject.score;
      const scoreEl = this.infoPanel.element.querySelector('div:nth-child(2)');
      if (scoreEl) scoreEl.textContent = `Conf: ${(this.score * 100).toFixed(1)}%`;
    }
  }

  getObject3D() {
    return this.group;
  }

  dispose() {
    this.group.traverse((obj) => {
      if (obj.element && obj.element.parentNode) {
        obj.element.parentNode.removeChild(obj.element);
      }
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}