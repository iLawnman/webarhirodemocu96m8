import { QuestEvent, QuestState } from '../domain/QuestStates.js';

export class QuestFlowController {
  constructor(eventBus, stateMachine, arTargetPresenter) {
    this._eventBus = eventBus;
    this._stateMachine = stateMachine;
    this._arTargetPresenter = arTargetPresenter;
    this._onImageFound = this._onImageFound.bind(this);
    this._onAnswerClicked = this._onAnswerClicked.bind(this);
  }

  start() {
    this._eventBus.on(QuestEvent.IMAGE_FOUND, this._onImageFound);
    this._eventBus.on(QuestEvent.ANSWER_CLICKED, this._onAnswerClicked);
    this._syncPresenterWithState();
  }

  _onImageFound() {
    const transition = this._stateMachine.handle(QuestEvent.IMAGE_FOUND);
    if (transition) this._syncPresenterWithState();
  }

  _onAnswerClicked() {
    const transition = this._stateMachine.handle(QuestEvent.ANSWER_CLICKED);
    if (transition) this._syncPresenterWithState();
  }

  _syncPresenterWithState() {
    if (this._stateMachine.currentState === QuestState.WAITING_ANSWER) {
      this._arTargetPresenter.show();
    } else {
      this._arTargetPresenter.hide();
    }
  }
}
