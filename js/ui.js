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

    this.questStartPanel = document.getElementById('quest-start-panel');
    this.questStartImg = document.getElementById('quest-start-img');
    this.questStartText = document.getElementById('quest-start-text');

    this.questionPanel = document.getElementById('question-panel');
    this.questionImg = document.getElementById('question-img');
    this.questionText = document.getElementById('question-text');
    this.questionBody = document.getElementById('question-body');

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

    this._onQuestionSubmit = null;
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

  // ───────────────────────── Question panel ─────────────────────────

  /**
   * @param {object} data
   * @param {string} [data.imageSrc] Картинка распознанного маркера
   * @param {string} [data.question] Текст вопроса (Question из questtable.json)
   * @param {string} [data.mainText] Текст ответа-заглушки (Slide без вариантов)
   * @param {'Slide'|'Button'|'InputField'|'Art'|'AntiArt'} [data.answerType]
   * @param {Array}  [data.options]
   * @param {Function} onSubmit callback(value) — вызывается когда пользователь дал ответ
   */
  showQuestion(data, onSubmit) {
    if (!this.questionPanel) return;
    this._onQuestionSubmit = onSubmit || null;

    if (this.questionImg) {
      if (data.imageSrc) {
        this.questionImg.src = data.imageSrc;
        this.questionImg.style.display = 'block';
      } else {
        this.questionImg.style.display = 'none';
      }
    }
    if (this.questionText) this.questionText.textContent = data.question || '';

    this._renderQuestionBody(data);
    this.questionPanel.classList.add('open');
  }

  hideQuestion() {
    if (!this.questionPanel) return;
    this.questionPanel.classList.remove('open');
    if (this.questionBody) this.questionBody.innerHTML = '';
    this._onQuestionSubmit = null;
  }

  _renderQuestionBody(data) {
    if (!this.questionBody) return;
    this.questionBody.innerHTML = '';

    const type = data.answerType || 'Slide';
    const options = data.options || [];

    if (type === 'Button') {
      const grid = document.createElement('div');
      grid.className = 'quest-options-grid';
      options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'quest-btn';
        btn.textContent = opt.text || `Вариант ${idx + 1}`;
        btn.addEventListener('click', () => this._submitAnswer(idx + 1));
        grid.appendChild(btn);
      });
      this.questionBody.appendChild(grid);

    } else if (type === 'InputField') {
      const wrap = document.createElement('div');
      wrap.className = 'quest-input-block';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'quest-input';
      input.placeholder = 'Введите ответ...';
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._submitAnswer(input.value);
      });

      const submitBtn = document.createElement('button');
      submitBtn.className = 'quest-submit-btn';
      submitBtn.textContent = 'OK';
      submitBtn.addEventListener('click', () => this._submitAnswer(input.value));

      wrap.appendChild(input);
      wrap.appendChild(submitBtn);
      this.questionBody.appendChild(wrap);

    } else if (type === 'Art' || type === 'AntiArt') {
      // Найден/не найден артефакт — только подтверждение
      const btn = document.createElement('button');
      btn.className = 'quest-submit-btn quest-ok-btn';
      btn.textContent = 'OK';
      btn.addEventListener('click', () => this._submitAnswer(true));
      this.questionBody.appendChild(btn);

    } else {
      // Slide (по умолчанию)
      let idx = 0;
      const total = Math.max(options.length, 1);

      const slideContent = document.createElement('div');
      slideContent.className = 'slide-content';
      slideContent.textContent = options[0]?.text || data.mainText || '';

      const update = () => {
        slideContent.textContent = options[idx]?.text || data.mainText || '';
      };

      const prev = document.createElement('button');
      prev.className = 'slide-nav prev';
      prev.textContent = '◄';
      prev.addEventListener('click', () => {
        idx = (idx - 1 + total) % total;
        update();
      });

      const next = document.createElement('button');
      next.className = 'slide-nav next';
      next.textContent = '►';
      next.addEventListener('click', () => {
        idx = (idx + 1) % total;
        update();
      });

      const slider = document.createElement('div');
      slider.className = 'quest-slider';
      slider.appendChild(prev);
      slider.appendChild(slideContent);
      slider.appendChild(next);
      this.questionBody.appendChild(slider);

      const okBtn = document.createElement('button');
      okBtn.className = 'quest-submit-btn quest-ok-btn';
      okBtn.textContent = 'OK';
      okBtn.addEventListener('click', () => this._submitAnswer(idx + 1));
      this.questionBody.appendChild(okBtn);
    }
  }

  _submitAnswer(value) {
    if (this._onQuestionSubmit) {
      const cb = this._onQuestionSubmit;
      this._onQuestionSubmit = null;
      cb(value);
    }
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
