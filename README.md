# AR Image Target — структура

## Запуск
Нужен HTTPS или localhost (доступ к камере). Например:
```
npx serve .
```

## Ассеты, которые нужно добавить
- `assets/markers/target-image.fset`, `.fset3`, `.iset` — NFT-дескрипторы, сгенерированные из вашей картинки через [NFT Marker Creator](https://carnaux.github.io/NFT-Marker-Creator/). Путь без расширения указывается в `AppConfig.nftMarker.descriptorsUrl`.
- `assets/target-plane.png` — текстура, которая появится поверх якоря (сейчас — простая плоскость `PlaneGeometry`).

## Модули
- `src/state/` — конечный автомат приложения (`waitingImage` → `waitingAnswer` → `waitingImage`), не знает про AR и рендер.
- `src/ar/ArSceneManager.js` — three.js рендерер/сцена/камера + инициализация `THREEx.ArToolkitSource/Context`.
- `src/ar/ImageTracker.js` — обёртка над `THREEx.ArMarkerControls` (NFT), отдаёт события `imageFound`/`imageLost`, содержит anchor-группу.
- `src/target/ArTargetView.js` — 3D-объект (картинка), который цепляется к anchor'у.
- `src/ui/AnswerButton.js` — DOM-кнопка поверх canvas, не знает про three.js.
- `src/app/AppController.js` — единственное место, где эти модули связаны друг с другом через события.
- `src/main.js` — точка входа, композиция зависимостей.

## Дальнейшее усложнение
- Добавить `Recognizing`-фазу (между found-событием и полным появлением arTarget) — достаточно расширить `AppStates` и `AppController._applyState`.
- Несколько разных картинок/квестов — сделать `ImageTracker`/`ArTargetView` фабриками по конфигу маркера, а не синглтонами.
- 3D-кнопка вместо DOM — заменить `AnswerButton` на raycast-версию, не трогая `AppController` (интерфейс `onClick/show/hide` остаётся тем же).
