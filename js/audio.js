let audioCtx = null;
const audioBuffers = new Map();

function getCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

/**
 * Fallback click generated through Web Audio API.
 */
function playGeneratedClick() {
    try {
        const ctx = getCtx();
        const t0 = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(1800, t0);
        osc.frequency.exponentialRampToValueAtTime(400, t0 + 0.04);

        gain.gain.setValueAtTime(0.22, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t0);
        osc.stop(t0 + 0.06);
    } catch (error) {
        console.warn('[Audio] Failed to generate fallback click:', error);
    }
}

/**
 * Загрузка звукового файла в память Web Audio API.
 */
async function loadAudioFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const ctx = getCtx();
    return await ctx.decodeAudioData(arrayBuffer);
}

/**
 * Инициализация и предзагрузка всех доступных звуков на старте.
 * Никаких конкретных имен файлов в коде: имя ключа берется из имени файла.
 */
export async function initAudio() {
    // Вариант 1: Для Vite / Webpack (автоматически видит все .mp3 в папке assets)
    let modules = {};
    if (import.meta && import.meta.glob) {
        modules = import.meta.glob('../assets/*.mp3', { eager: true, as: 'url' });
    }

    const entries = Object.entries(modules);

    // Вариант 2: Запасной список путей, если проект без сборщика
    const filesToLoad = entries.length > 0
        ? entries.map(([path, url]) => ({ path, url: url.default || url }))
        : ['./assets/click.mp3'].map(url => ({ path: url, url }));

    await Promise.allSettled(
        filesToLoad.map(async ({ path, url }) => {
            // Извлекаем имя ключа (например, "click" из "./assets/click.mp3")
            const key = path.split('/').pop().replace(/\.[^/.]+$/, "");
            try {
                const buffer = await loadAudioFile(url);
                audioBuffers.set(key, buffer);
            } catch (err) {
                console.warn(`[Audio] Не удалось загрузить звук "${key}":`, err);
            }
        })
    );
}

/**
 * Воспроизведение предзагруженного звука по ключу.
 */
export function playSound(soundKey) {
    if (!soundKey || !audioBuffers.has(soundKey)) {
        if (soundKey) {
            console.warn(`[Audio] Sound "${soundKey}" not preloaded. Using fallback.`);
        }
        playGeneratedClick();
        return;
    }

    try {
        const ctx = getCtx();
        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();

        source.buffer = audioBuffers.get(soundKey);
        gainNode.gain.value = 0.6;

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(0);
    } catch (error) {
        console.warn(`[Audio] Failed to play "${soundKey}":`, error);
        playGeneratedClick();
    }
}

export function enableClickSounds() {
    const handler = () => {
        playSound('click');
    };

    document.addEventListener('pointerdown', handler, {
        passive: true
    });
}

// Автозапуск предзагрузки и навешивание событий
if (typeof document !== 'undefined') {
    const start = () => {
        initAudio();
        enableClickSounds();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
}