export const AppConfig = Object.freeze({
  camera: {
    sourceType: 'webcam',
  },
  nftMarker: {
    descriptorsUrl: './assets/markers/target-image',
  },
  targetImage: {
    textureUrl: './assets/target-plane.png',
    width: 1,
    height: 1,
  },
  detection: {
    lostToleranceMs: 800,
  },
});
