import * as THREE from 'three';
import { createArTargetSync } from './artarget.js';
import { playSound } from './audio.js';

export class ImageReco {
  /**
   * @param {import('./ui.js').UI} ui
   * @param {import('./settings.js').Settings} settings
   * @param {import('./quests.js').QuestManager} questManager
   * @param {import('./policies.js').Policies} policies
   */
  constructor(ui, settings, questManager, policies) {
    this.ui = ui;
    this.settings = settings;
    this.questManager = questManager;
    this.policies = policies;

    /** @type {Array<{bmp: ImageBitmap, name: string, src: string, source: string}>} */
    this.targetBitmaps = [];
    this.trackedMarkers = new Map();

    this._tmpPos = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
  }

  static MANIFEST_URL = './assets/recognitionimages.json';
  static SMOOTH_FACTOR = 0.25;

  async init() {
    this.targetBitmaps = [];
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

  async loadImageList() {
    const url = ImageReco.MANIFEST_URL;
    this.ui.log('Loading image list from: ' + url, 'info');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      let items = Array.isArray(data) ? data : (data.images || data.markers || []);
      if (!Array.isArray(items) || items.length === 0) throw new Error('Empty image list');

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
    try {
      const res = await fetch(src);
      if (res.ok) {
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
        return { bmp, source: 'fetch' };
      }
    } catch (e) {
      this.ui.log('Fetch failed: ' + e.message, 'err');
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        c.toBlob(async (blob) => {
          const bmp = await createImageBitmap(blob);
          resolve({ bmp, source: 'image' });
        }, 'image/png');
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async makeGeneratedBitmap() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 512, 512);
    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    return await createImageBitmap(blob);
  }

  computeStablePose(samples) {
    if (!samples || samples.length === 0) return null;
    const n = samples.length;
    let px = 0, py = 0, pz = 0;
    let qx = 0, qy = 0, qz = 0, qw = 0;

    const start = Math.floor(n / 2);
    const count = n - start;
    for (let i = start; i < n; i++) {
      const s = samples[i];
      px += s.px; py += s.py; pz += s.pz;
      qx += s.qx; qy += s.qy; qz += s.qz; qw += s.qw;
    }
    px /= count; py /= count; pz /= count;
    qx /= count; qy /= count; qz /= count; qw /= count;
    const len = Math.hypot(qx, qy, qz, qw) || 1;
    return {
      position: { x: px, y: py, z: pz },
      orientation: { x: qx / len, y: qy / len, z: qz / len, w: qw / len }
    };
  }

  disposeEntry(entry) {
    if (!entry) return;
    if (entry.anchor && typeof entry.anchor.delete === 'function') {
      try { entry.anchor.delete(); } catch (_) {}
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