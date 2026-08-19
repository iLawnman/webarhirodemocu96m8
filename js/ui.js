export class UI {
  constructor() {
    this.logPanel = document.getElementById('log-panel');
    this.logToggle = document.getElementById('log-toggle');
    this.btnAr = document.getElementById('btn-ar');
    this.btnEndAr = document.getElementById('btn-end-ar');
    this.hint = document.getElementById('hint');
    this.preview = document.getElementById('target-preview');

    // ── новые панели overlay-флоу ──
    this.curtain = document.getElementById('curtain-panel');
    this.curtainText = document.querySelector('.curtain-text');

    this.questStartPanel = document.getElementById('quest-start-panel');
    this.questStartImg = document.getElementById('quest-start-img');
    this.questStartText = document.getElementById('quest-start-text');

    this.resultPanel = document.getElementById('result-panel');
    this.resultSign = document.getElementById('result-sign');
    this.resultText = document.getElementById('result-text');
    this.resultCloseBtn = document.getElementById('result-close-btn');

    // Лог стартует свернутым
    this.logVisible = false;
    if (this.logPanel) this.logPanel.classList.add('collapsed');

    this.logToggle.addEventListener('click', () => {
      this.logVisible = !this.logVisible;
      this.logPanel.classList.toggle('collapsed', !this.logVisible);
    });

    this._onResultClose = null;

    if (this.resultCloseBtn) {
      this.resultCloseBtn.addEventListener('click', () => {
        const cb = this._onResultClose;
        this.hideResult();
        if (cb) cb();
      });
    }
  }

  log(msg, type = '') {
    const div = document.createElement('div');
    div.className = 'entry ' + type;
    const now = new Date();
    const t = now.toLocaleTimeString('ru-RU', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    div.textContent = `[${t}] ${msg}`;
    this.logPanel.appendChild(div);
    this.logPanel.scrollTop = this.logPanel.scrollHeight;
    console.log(`[${type || 'log'}] ${msg}`);
  }

  setHint(text) {
    this.hint.textContent = text;
  }

  setPreview(src) {
    this.preview.src = src;
    this.preview.style.display = 'block';
  }

  enableArButton() {
    this.btnAr.disabled = false;
    this.btnAr.style.display = 'block';
    // Инициализация завершена — текст «Инициализация AR…» скрывается
    if (this.curtainText) this.curtainText.classList.add('ready');
  }

  disableArButton() {
    this.btnAr.disabled = true;
    this.btnAr.style.display = 'none';
  }

  showEndArButton() {
    this.btnEndAr.style.display = 'block';
  }

  hideEndArButton() {
    this.btnEndAr.style.display = 'none';
  }

  onStartAR(handler) {
    this.btnAr.addEventListener('click', handler);
  }

  onEndAR(handler) {
    this.btnEndAr.addEventListener('click', handler);
  }

  // ───────────────────────── Curtain (штора инициализации) ─────────────────────────

  /** Показывает штору (закрывает сцену, пока инициализируется/переинициализируется WebXR). */
  showCurtain() {
    if (!this.curtain) return;
    this.curtain.classList.remove('hidden');
    // Вернуть текст «Инициализация AR…» при повторном показе шторы
    if (this.curtainText) this.curtainText.classList.remove('ready');
  }

  /** Прячет штору (уезжает вверх) — вызывается, когда пол установлен (сессия готова). */
  hideCurtain() {
    if (!this.curtain) return;
    this.curtain.classList.add('hidden');
  }

  // ───────────────────────── Quest-start panel ("ИЩИТЕ!") ─────────────────────────

  /**
   * @param {string} imageSrc Картинка одного из маркеров (recognitionimages)
   * @param {string} [text]
   */
  showQuestStart(imageSrc, text = 'ИЩИТЕ!') {
    if (!this.questStartPanel) return;
    if (this.questStartImg) {
      if (imageSrc) {
        this.questStartImg.src = imageSrc;
        this.questStartImg.style.display = 'block';
      } else {
        this.questStartImg.style.display = 'none';
      }
    }
    if (this.questStartText) this.questStartText.textContent = text;
    this.questStartPanel.classList.add('open');
  }

  hideQuestStart() {
    if (!this.questStartPanel) return;
    this.questStartPanel.classList.remove('open');
  }

  // ───────────────────────── Result panel ─────────────────────────

  /**
   * @param {boolean} isCorrect
   * @param {string} text Текст из RightReaction / WrongReaction
   * @param {Function} [onClose] callback вызывается по кнопке "Дальше"
   */
  showResult(isCorrect, text, onClose) {
    if (!this.resultPanel) return;
    this._onResultClose = onClose || null;
    this.resultPanel.classList.remove('result-ok', 'result-fail');
    this.resultPanel.classList.add(isCorrect ? 'result-ok' : 'result-fail');
    if (this.resultText) this.resultText.textContent = text || '';
    if (this.resultSign) this.resultSign.textContent = isCorrect ? '✓' : '✕';
    this.resultPanel.classList.add('open');
  }

  hideResult() {
    if (!this.resultPanel) return;
    this.resultPanel.classList.remove('open');
    this._onResultClose = null;
  }
}