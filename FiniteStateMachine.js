export class FiniteStateMachine {
  constructor(transitionTable, initialState) {
    this._transitionTable = transitionTable;
    this._currentState = initialState;
  }

  get currentState() {
    return this._currentState;
  }

  canHandle(eventName) {
    const transitions = this._transitionTable[this._currentState];
    return Boolean(transitions && transitions[eventName]);
  }

  handle(eventName) {
    const transitions = this._transitionTable[this._currentState];
    const nextState = transitions ? transitions[eventName] : undefined;
    if (!nextState) return null;
    const previousState = this._currentState;
    this._currentState = nextState;
    return { previousState, nextState };
  }
}
