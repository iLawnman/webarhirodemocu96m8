export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(eventName, handler) {
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set());
    }
    this._listeners.get(eventName).add(handler);
    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    this._listeners.get(eventName)?.delete(handler);
  }

  emit(eventName, payload) {
    this._listeners.get(eventName)?.forEach((handler) => handler(payload));
  }
}
