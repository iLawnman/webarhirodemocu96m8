import { EventEmitter } from '../core/EventEmitter.js';

export class AppStateMachine extends EventEmitter {
  constructor(initialState) {
    super();
    this._state = initialState;
  }

  get state() {
    return this._state;
  }

  transition(nextState) {
    if (nextState === this._state) return;
    const previous = this._state;
    this._state = nextState;
    this.emit('stateChanged', { previous, next: nextState });
  }
}
