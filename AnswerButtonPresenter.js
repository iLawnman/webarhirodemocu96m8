import { QuestEvent } from '../domain/QuestStates.js';

export class AnswerButtonPresenter {
  constructor(buttonElement, eventBus) {
    this._buttonElement = buttonElement;
    this._eventBus = eventBus;
    this._onClick = this._onClick.bind(this);
  }

  start() {
    this._buttonElement.addEventListener('click', this._onClick);
  }

  stop() {
    this._buttonElement.removeEventListener('click', this._onClick);
  }

  _onClick() {
    this._eventBus.emit(QuestEvent.ANSWER_CLICKED);
  }
}
