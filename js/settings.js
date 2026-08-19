// ===================== settings.js =====================
export class Settings {
    static URL = './assets/settings.json';

    constructor() {
        /** @type {Record<string, string>} */
        this.data = {};
        this.isLoaded = false;
    }

    /**
     * Парсит таблицу settings.json (первая строка — заголовки, вторая — значения).
     * Остальные строки игнорируются.
     */
    async load() {
        try {
            const res = await fetch(Settings.URL);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const raw = await res.json();

            if (!Array.isArray(raw) || raw.length < 2) {
                throw new Error('Invalid settings format');
            }

            const headers = raw[0];
            const values = raw[1];

            headers.forEach((header, index) => {
                if (header) {
                    this.data[header] = values[index] !== undefined ? String(values[index]) : '';
                }
            });

            this.isLoaded = true;
        } catch (err) {
            console.error('Settings load failed:', err);
            this.isLoaded = false;
        }
    }

    get(key, defaultValue = '') {
        return this.data[key] !== undefined ? this.data[key] : defaultValue;
    }

    /** Числовое значение unigue_targets (опечатка в исходном JSON сохранена) */
    get uniqueTargets() {
        const v = parseInt(this.get('unigue_targets', '0'), 10);
        return Number.isFinite(v) ? v : 0;
    }
}