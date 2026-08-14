import { QuestEvent } from '../domain/QuestStates.js';

export class ArTrackingAdapter {
  constructor(nftElement, eventBus) {
    this._nftElement = nftElement;
    this._eventBus = eventBus;
    this._onMarkerFound = this._onMarkerFound.bind(this);
    this._onMarkerLost = this._onMarkerLost.bind(this);
  }

  start() {
    this._nftElement.addEventListener('markerFound', this._onMarkerFound);
    this._nftElement.addEventListener('markerLost', this._onMarkerLost);
  }

  stop() {
    this._nftElement.removeEventListener('markerFound', this._onMarkerFound);
    this._nftElement.removeEventListener('markerLost', this._onMarkerLost);
  }

  _onMarkerFound() {
    this._eventBus.emit(QuestEvent.IMAGE_FOUND);
  }

  _onMarkerLost() {
    this._eventBus.emit(QuestEvent.IMAGE_LOST);
  }
}
