import { AppStates } from '../state/AppStates.js';

export class AppController {
  constructor(stateMachine, imageTracker, arTargetView, answerButton) {
    this._stateMachine = stateMachine;
    this._imageTracker = imageTracker;
    this._arTargetView = arTargetView;
    this._answerButton = answerButton;
  }

  start() {
    this._imageTracker.on('imageFound', () => this._handleImageFound());
    this._imageTracker.on('imageLost', () => this._handleImageLost());
    this._answerButton.onClick(() => this._handleAnswerPressed());
    this._stateMachine.on('stateChanged', ({ next }) => this._applyState(next));
    this._applyState(this._stateMachine.state);
  }

  _handleImageFound() {
    if (this._stateMachine.state !== AppStates.WaitingImage) return;
    this._arTargetView.attachTo(this._imageTracker.anchorGroup);
    this._stateMachine.transition(AppStates.WaitingAnswer);
  }

  _handleImageLost() {
    if (this._stateMachine.state === AppStates.WaitingAnswer) return;
    this._stateMachine.transition(AppStates.WaitingImage);
  }

  _handleAnswerPressed() {
    if (this._stateMachine.state !== AppStates.WaitingAnswer) return;
    this._stateMachine.transition(AppStates.WaitingImage);
  }

  _applyState(state) {
    if (state === AppStates.WaitingAnswer) {
      this._arTargetView.show();
      this._answerButton.show();
    } else {
      this._arTargetView.hide();
      this._answerButton.hide();
    }
  }
}
