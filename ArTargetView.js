export class ArTargetView {
  constructor(config) {
    this._config = config;
    this.group = new THREE.Group();
    this.group.visible = false;
    this._buildPlane();
  }

  _buildPlane() {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(this._config.targetImage.textureUrl);
    const geometry = new THREE.PlaneGeometry(
      this._config.targetImage.width,
      this._config.targetImage.height
    );
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    this._plane = new THREE.Mesh(geometry, material);
    this._plane.rotation.x = -Math.PI / 2;
    this.group.add(this._plane);
  }

  attachTo(anchorGroup) {
    anchorGroup.add(this.group);
  }

  show() {
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }
}
