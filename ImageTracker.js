import { EventEmitter } from '../core/EventEmitter.js';

export class ImageTracker extends EventEmitter {
  constructor(arSceneManager, config) {
    super();
    this._arSceneManager = arSceneManager;
    this._config = config;
    this.anchorGroup = new THREE.Group();
    this.anchorGroup.visible = false;
    this._arSceneManager.scene.add(this.anchorGroup);
    this._markerControls = null;
    this._lostTimeoutId = null;
  }

  init() {
    this._markerControls = new THREEx.ArMarkerControls(
      this._arSceneManager.arToolkitContext,
      this.anchorGroup,
      {
        type: 'nft',
        descriptorsUrl: this._config.nftMarker.descriptorsUrl,
        changeMatrixMode: 'modelViewMatrix',
      }
    );

    this.anchorGroup.addEventListener('nftMarkerFound', () => this._handleFound());
    this.anchorGroup.addEventListener('nftMarkerLost', () => this._handleLost());
  }

  _handleFound() {
    if (this._lostTimeoutId) {
      clearTimeout(this._lostTimeoutId);
      this._lostTimeoutId = null;
      return;
    }
    this.anchorGroup.visible = true;
    this.emit('imageFound', { anchorGroup: this.anchorGroup });
  }

  _handleLost() {
    this._lostTimeoutId = setTimeout(() => {
      this._lostTimeoutId = null;
      this.anchorGroup.visible = false;
      this.emit('imageLost', {});
    }, this._config.detection.lostToleranceMs);
  }
}
