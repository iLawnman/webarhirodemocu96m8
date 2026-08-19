// ===================== arsettings.js =====================
/**
 * ARSettings — загружает все CSS-темы из ./assets/arcss/
 * и рисует кнопки вдоль левого края для переключения темы artarget.
 *
 * Использование:
 *   const arSettings = new ARSettings();
 *   await arSettings.init();
 */

const ARCSS_DIR = './assets/arcss/';

/** Известные темы (fallback, если fetch каталога недоступен) */
const KNOWN_THEMES = [
    { id: 'neon', file: 'theme-neon.css', label: 'Neon' },
    { id: 'cyber', file: 'theme-cyber.css', label: 'Cyber' },
    { id: 'warm', file: 'theme-warm.css', label: 'Warm' }
];

export class ARSettings {
    constructor(options = {}) {
        this.cssDir = options.cssDir || ARCSS_DIR;
        this.themes = [];
        this.activeThemeId = null;
        this._styleEl = null;
        this._barEl = null;
        this._loadedCss = new Map(); // id → cssText
    }

    /**
     * Загрузка CSS и создание UI-кнопок.
     * Вызывать один раз при старте приложения (до или после создания artarget).
     */
    async init() {
        await this._loadThemes();
        this._ensureStyleElement();
        this._createThemeBar();

        const saved = this._readSavedTheme();
        const initial =
            this.themes.find((t) => t.id === saved) ||
            this.themes[0] ||
            null;

        if (initial) {
            await this.applyTheme(initial.id);
        }

        return this;
    }

    getThemes() {
        return this.themes.slice();
    }

    getActiveThemeId() {
        return this.activeThemeId;
    }

    /**
     * Применить тему по id.
     * @param {string} themeId
     */
    async applyTheme(themeId) {
        const theme = this.themes.find((t) => t.id === themeId);
        if (!theme) {
            console.warn('[ARSettings] Theme not found:', themeId);
            return;
        }

        let cssText = this._loadedCss.get(theme.id);
        if (!cssText) {
            cssText = await this._fetchCss(theme.url);
            if (cssText != null) this._loadedCss.set(theme.id, cssText);
        }

        if (cssText == null) {
            console.warn('[ARSettings] Failed to load CSS for', theme.id);
            return;
        }

        this._ensureStyleElement();
        this._styleEl.textContent = cssText;

        document.documentElement.setAttribute('data-ar-theme', theme.id);
        this.activeThemeId = theme.id;
        this._persistTheme(theme.id);
        this._updateBarActive();

        console.log('[ARSettings] Theme applied:', theme.id);
    }

    // ─── private ───────────────────────────────────────────────────────────────

    async _loadThemes() {
        const found = [];

        for (const known of KNOWN_THEMES) {
            const url = this.cssDir + known.file;
            try {
                const css = await this._fetchCss(url);
                if (css != null) {
                    this._loadedCss.set(known.id, css);
                    found.push({
                        id: known.id,
                        file: known.file,
                        label: known.label,
                        url
                    });
                }
            } catch (_) {
                // файл отсутствует — пропускаем
            }
        }

        this.themes = found.length ? found : KNOWN_THEMES.map((k) => ({
            id: k.id,
            file: k.file,
            label: k.label,
            url: this.cssDir + k.file
        }));
    }

    async _fetchCss(url) {
        try {
            const res = await fetch(url, { cache: 'no-cache' });
            if (!res.ok) return null;
            const text = await res.text();
            return text && text.trim() ? text : null;
        } catch (e) {
            console.warn('[ARSettings] fetch failed', url, e);
            return null;
        }
    }

    _ensureStyleElement() {
        if (this._styleEl && document.contains(this._styleEl)) return;
        let el = document.getElementById('ar-theme-style');
        if (!el) {
            el = document.createElement('style');
            el.id = 'ar-theme-style';
            document.head.appendChild(el);
        }
        this._styleEl = el;
    }

    _createThemeBar() {
        if (this._barEl) return;

        const bar = document.createElement('div');
        bar.id = 'ar-theme-bar';
        bar.setAttribute('aria-label', 'AR target themes');
        bar.style.cssText = `
      position: fixed;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      z-index: 100;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 6px;
      pointer-events: auto;
    `;

        if (!document.getElementById('ar-theme-bar-styles')) {
            const s = document.createElement('style');
            s.id = 'ar-theme-bar-styles';
            s.textContent = `
        #ar-theme-bar .ar-theme-btn {
          width: 44px;
          min-height: 44px;
          padding: 6px 4px;
          border: 2px solid rgba(255,255,255,0.35);
          border-radius: 0 10px 10px 0;
          border-left: none;
          background: rgba(0,0,0,0.65);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          cursor: pointer;
          writing-mode: horizontal-tb;
          line-height: 1.15;
          box-shadow: 2px 2px 8px rgba(0,0,0,0.4);
          transition: background 0.15s, border-color 0.15s, transform 0.12s;
        }
        #ar-theme-bar .ar-theme-btn:hover {
          background: rgba(20,20,30,0.9);
          transform: translateX(2px);
        }
        #ar-theme-bar .ar-theme-btn.active {
          border-color: #00ffaa;
          background: rgba(0,40,30,0.9);
          color: #00ffaa;
        }
        #ar-theme-bar .ar-theme-btn[data-theme="cyber"].active {
          border-color: #a855f7;
          color: #22d3ee;
          background: rgba(30,16,50,0.92);
        }
        #ar-theme-bar .ar-theme-btn[data-theme="warm"].active {
          border-color: #f59e0b;
          color: #fbbf24;
          background: rgba(40,24,8,0.92);
        }
      `;
            document.head.appendChild(s);
        }

        for (const theme of this.themes) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ar-theme-btn';
            btn.dataset.theme = theme.id;
            btn.title = `Тема: ${theme.label}`;
            btn.textContent = theme.label;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.applyTheme(theme.id);
            });
            bar.appendChild(btn);
        }

        document.body.appendChild(bar);
        this._barEl = bar;
    }

    _updateBarActive() {
        if (!this._barEl) return;
        this._barEl.querySelectorAll('.ar-theme-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.theme === this.activeThemeId);
        });
    }

    _persistTheme(id) {
        try {
            localStorage.setItem('ar-theme-id', id);
        } catch (_) {}
    }

    _readSavedTheme() {
        try {
            return localStorage.getItem('ar-theme-id');
        } catch (_) {
            return null;
        }
    }
}