// ===================== ui.js =====================
export class UI {
  constructor() {
    this.logPanel = document.getElementById('log-panel');
    this.logToggle = document.getElementById('log-toggle');
    this.btnAr = document.getElementById('btn-ar');
    this.btnEndAr = document.getElementById('btn-end-ar');
    this.hint = document.getElementById('hint');
    this.preview = document.getElementById('target-preview');

    this.curtain = document.getElementById('curtain-panel');
    this.curtainText = document.querySelector('.curtain-text');

    this.questStartPanel = document.getElementById('quest-start-panel');
    this.questStartImg = document.getElementById('quest-start-img');
    this.questStartText = document.getElementById('quest-start-text');

    this.resultPanel = document.getElementById('result-panel');
    this.resultSign = document.getElementById('result-sign');
    this.resultText = document.getElementById('result-text');
    this.resultCloseBtn = document.getElementById('result-close-btn');

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

    this._injectScanFrameStyles();
    this.scanFrame = this._createScanFrame();
    this.recoOverlay = this._createRecoOverlay();
    this._scanEffectTimer = null;
  }

  _injectScanFrameStyles() {
    if (document.getElementById('ar-scan-frame-styles')) return;
    const style = document.createElement('style');
    style.id = 'ar-scan-frame-styles';
    style.textContent = `
      #ar-scan-frame {
        position: fixed;
        top: 50%;
        left: 50%;
        width: min(70vw, 380px);
        height: min(70vw, 380px);
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 40;
        display: none;
        box-sizing: border-box;
      }
      #ar-scan-frame.visible { display: block; }

      #ar-scan-frame .corner {
        position: absolute;
        width: 28px;
        height: 28px;
        border-color: #00ffaa;
        border-style: solid;
        border-width: 0;
      }
      #ar-scan-frame .corner.tl { top: 0; left: 0; border-top-width: 3px; border-left-width: 3px; border-top-left-radius: 4px; }
      #ar-scan-frame .corner.tr { top: 0; right: 0; border-top-width: 3px; border-right-width: 3px; border-top-right-radius: 4px; }
      #ar-scan-frame .corner.bl { bottom: 0; left: 0; border-bottom-width: 3px; border-left-width: 3px; border-bottom-left-radius: 4px; }
      #ar-scan-frame .corner.br { bottom: 0; right: 0; border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 4px; }

      #ar-scan-frame.blink .corner {
        animation: ar-scan-blink 1.1s ease-in-out infinite;
      }
      @keyframes ar-scan-blink {
        0%, 100% { opacity: 0.35; border-color: #00ffaa88; }
        50% { opacity: 1; border-color: #00ffaa; }
      }

      #ar-scan-frame .scan-line {
        position: absolute;
        left: 8%;
        right: 8%;
        height: 2px;
        background: linear-gradient(90deg, transparent, #00ffaa, #ffffff, #00ffaa, transparent);
        box-shadow: 0 0 12px #00ffaa, 0 0 24px #00ffaa88;
        opacity: 0;
        top: 10%;
        pointer-events: none;
      }
      #ar-scan-frame .scan-fill {
        position: absolute;
        inset: 6px;
        background: radial-gradient(circle at center, rgba(0,255,170,0.18) 0%, transparent 70%);
        opacity: 0;
        pointer-events: none;
      }
      #ar-scan-frame.effect .scan-line {
        opacity: 1;
        animation: ar-scan-line 2s linear forwards;
      }
      #ar-scan-frame.effect .scan-fill {
        animation: ar-scan-fill 2s ease-out forwards;
      }
      #ar-scan-frame.effect .corner {
        animation: ar-scan-corner-pulse 0.5s ease-in-out infinite;
        border-color: #00ffcc;
      }
      @keyframes ar-scan-line {
        0% { top: 8%; opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { top: 90%; opacity: 0; }
      }
      @keyframes ar-scan-fill {
        0% { opacity: 0; transform: scale(0.85); }
        40% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.05); }
      }
      @keyframes ar-scan-corner-pulse {
        0%, 100% { opacity: 1; filter: drop-shadow(0 0 2px #00ffaa); }
        50% { opacity: 0.6; filter: drop-shadow(0 0 10px #00ffaa); }
      }

      #ar-reco-overlay {
        position: fixed;
        top: 15px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.75);
        border: 1px solid #00e5ff;
        border-radius: 20px;
        padding: 6px 16px;
        color: #00e5ff;
        font-family: sans-serif;
        font-size: 13px;
        z-index: 50;
        display: none;
        pointer-events: none;
        box-shadow: 0 0 8px rgba(0,229,255,0.4);
      }
    `;
    document.head.appendChild(style);
  }

  _createScanFrame() {
    const el = document.createElement('div');
    el.id = 'ar-scan-frame';
    el.innerHTML = `
      <div class="corner tl"></div>
      <div class="corner tr"></div>
      <div class="corner bl"></div>
      <div class="corner br"></div>
      <div class="scan-fill"></div>
      <div class="scan-line"></div>
    `;
    document.body.appendChild(el);
    return el;
  }

  _createRecoOverlay() {
    const el = document.createElement('div');
    el.id = 'ar-reco-overlay';
    document.body.appendChild(el);
    return el;
  }

  showDetectedObjectsInfo(detections) {
    if (!this.recoOverlay) return;
    if (!detections || detections.length === 0) {
      this.hideDetectedObjectsInfo();
      return;
    }
    const infoStr = detections
      .map(d => `${d.label} (${(d.score * 100).toFixed(0)}%)`)
      .join(', ');
    this.recoOverlay.textContent = `Распознано: ${infoStr}`;
    this.recoOverlay.style.display = 'block';
  }

  hideDetectedObjectsInfo() {
    if (this.recoOverlay) this.recoOverlay.style.display = 'none';
  }

  showScanFrameBlink() {
    if (!this.scanFrame) return;
    if (this._scanEffectTimer) {
      clearTimeout(this._scanEffectTimer);
      this._scanEffectTimer = null;
    }
    this.scanFrame.classList.remove('effect');
    this.scanFrame.classList.add('visible', 'blink');
  }

  playScanEffect(onDone) {
    if (!this.scanFrame) {
      if (typeof onDone === 'function') onDone();
      return;
    }
    if (this._scanEffectTimer) {
      clearTimeout(this._scanEffectTimer);
      this._scanEffectTimer = null;
    }
    this.scanFrame.classList.remove('blink');
    this.scanFrame.classList.add('visible', 'effect');

    const line = this.scanFrame.querySelector('.scan-line');
    const fill = this.scanFrame.querySelector('.scan-fill');
    if (line) {
      line.style.animation = 'none';
      void line.offsetWidth;
      line.style.animation = '';
    }
    if (fill) {
      fill.style.animation = 'none';
      void fill.offsetWidth;
      fill.style.animation = '';
    }

    this._scanEffectTimer = setTimeout(() => {
      this._scanEffectTimer = null;
      this.hideScanFrame();
      if (typeof onDone === 'function') onDone();
    }, 2000);
  }

  hideScanFrame() {
    if (!this.scanFrame) return;
    if (this._scanEffectTimer) {
      clearTimeout(this._scanEffectTimer);
      this._scanEffectTimer = null;
    }
    this.scanFrame.classList.remove('visible', 'blink', 'effect');
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

  showCurtain() {
    if (!this.curtain) return;
    this.curtain.classList.remove('hidden');
    if (this.curtainText) this.curtainText.classList.remove('ready');
  }

  hideCurtain() {
    if (!this.curtain) return;
    this.curtain.classList.add('hidden');
  }

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