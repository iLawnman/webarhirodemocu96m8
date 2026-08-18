// js/arscene.js
import * as THREE from 'three';

export class ARScene {
  constructor(ui) {
    this.ui = ui;
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.xr.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    document.body.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.setupStaticFloor();

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setupLighting() {
    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    light.position.set(0, 2, 0);
    this.scene.add(light);

    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(1, 3, 2);
    this.scene.add(dir);
  }

  setupStaticFloor() {
    const gridHelper = new THREE.GridHelper(10, 20, 0x00ff00, 0x444444);
    gridHelper.position.set(0, 0, 0);
    this.scene.add(gridHelper);

    const boxGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const boxMat = new THREE.MeshNormalMaterial();
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(0, 0.1, -1);
    this.scene.add(box);
  }

  createSphereMesh(color = 0xff00ff) {
    const geo = new THREE.SphereGeometry(0.08, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.3,
      roughness: 0.4,
      emissive: color,
      emissiveIntensity: 0.15
    });
    return new THREE.Mesh(geo, mat);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}