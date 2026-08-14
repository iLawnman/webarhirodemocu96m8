export class AnswerButton {
  constructor(labelText) {
    this._element = document.createElement('button');
    this._element.textContent = labelText;
    this._element.className = 'ar-answer-button';
    this._element.style.display = 'none';
    document.body.appendChild(this._element);
    this._clickHandler = null;
    this._element.addEventListener('click', () => this._clickHandler?.());
  }

  onClick(handler) {
    this._clickHandler = handler;
  }

  show() {
    this._element.style.display = 'block';
  }

  hide() {
    this._element.style.display = 'none';
  }
}
