export class ArSceneManager {
  constructor(config) {
    this._config = config;
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.scene.add(this.camera);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0px';
    this.renderer.domElement.style.left = '0px';
    document.body.appendChild(this.renderer.domElement);

    this.arToolkitSource = new THREEx.ArToolkitSource({
      sourceType: this._config.camera.sourceType,
    });

    this.arToolkitContext = null;
  }

  async init() {
    await new Promise((resolve) => {
      this.arToolkitSource.init(resolve);
    });
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this.arToolkitContext = new THREEx.ArToolkitContext({
      cameraParametersUrl:
        'https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/data/camera_para.dat',
      detectionMode: 'mono',
    });

    await new Promise((resolve) => {
      this.arToolkitContext.init(() => {
        this.camera.projectionMatrix.copy(this.arToolkitContext.getProjectionMatrix());
        resolve();
      });
    });
  }

  startRenderLoop(onFrame) {
    const tick = () => {
      requestAnimationFrame(tick);
      if (this.arToolkitSource.ready) {
        this.arToolkitContext.update(this.arToolkitSource.domElement);
      }
      onFrame?.();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  _resize() {
    this.arToolkitSource.onResizeElement();
    this.arToolkitSource.copyElementSizeTo(this.renderer.domElement);
    if (this.arToolkitContext?.arController) {
      this.arToolkitSource.copyElementSizeTo(this.arToolkitContext.arController.canvas);
    }
  }
}
