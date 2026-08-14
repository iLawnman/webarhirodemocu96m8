<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0">
  <title>AR — Step 2 (якорь + waitingAnswer)</title>

  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/three.js/build/ar-threex.js"></script>

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      overflow: hidden; background: #000;
      font-family: system-ui, -apple-system, sans-serif;
    }
    video {
      position: fixed !important; top: 0 !important; left: 0 !important;
      width: 100% !important; height: 100% !important;
      object-fit: cover !important; z-index: 0 !important;
    }
    canvas {
      position: fixed !important; top: 0 !important; left: 0 !important;
      width: 100% !important; height: 100% !important; z-index: 1 !important;
    }
    #loader {
      position: fixed; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: #111; color: #fff; z-index: 20; font-size: 18px;
    }
    #status {
      position: fixed; top: 12px; right: 12px; z-index: 100 !important;
      background: rgba(0,0,0,0.75); color: #fff;
      padding: 10px 14px; border-radius: 10px;
      font-size: 13px; line-height: 1.55; min-width: 180px;
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.2);
      pointer-events: none; user-select: none;
    }
    #status .row { display: flex; justify-content: space-between; gap: 16px; }
    #status .label { opacity: 0.65; }
    #status .value { font-weight: 600; }
    #status .ok { color: #4ade80; }
    #status .search { color: #fbbf24; }
    #status .err { color: #f87171; }

    #hint {
      position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
      z-index: 100; padding: 10px 18px; border-radius: 20px;
      background: rgba(0,0,0,0.7); color: #fff; font-size: 14px;
      pointer-events: none; opacity: 0; transition: opacity 0.25s;
      border: 1px solid rgba(255,255,255,0.15);
    }
    #hint.show { opacity: 1; }
  </style>
</head>
<body>
  <div id="loader">Загрузка камеры…</div>

  <div id="status">
    <div class="row"><span class="label">Состояние</span><span class="value" id="st-ar">загрузка…</span></div>
    <div class="row"><span class="label">Маркер</span><span class="value" id="st-marker">—</span></div>
    <div class="row"><span class="label">FPS</span><span class="value" id="st-fps">—</span></div>
  </div>

  <div id="hint">Нажми на картинку</div>

  <script src="tree.js"></script>
  <script src="ar.js"></script>
  <script>
    setInterval(function () {
      var hint = document.getElementById('hint');
      if (!hint) return;
      if (typeof appState !== 'undefined' && appState === 'waitingAnswer') {
        hint.classList.add('show');
      } else {
        hint.classList.remove('show');
      }
    }, 200);
  </script>
</body>
</html>
