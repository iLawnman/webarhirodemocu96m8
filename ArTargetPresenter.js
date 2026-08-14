export class ArTargetPresenter {
  constructor(arTargetElement) {
    this._arTargetElement = arTargetElement;
  }

  show() {
    this._arTargetElement.setAttribute('visible', 'true');
  }

  hide() {
    this._arTargetElement.setAttribute('visible', 'false');
  }
}
