import * as THREE from 'three';

export class QuestManager {
    constructor(questTableUrl = './assets/questtable.json', answersUrl = './assets/answers.json') {
        this.questTableUrl = questTableUrl;
        this.answersUrl = answersUrl;

        this.quests = new Map();
        this.answers = new Map();
        this.currentQuestId = 'Start';
        this.isLoaded = false;
    }

    /**
     * Загрузка и парсинг JSON-файлов таблиц
     */
    async loadData() {
        try {
            const [questRes, answerRes] = await Promise.all([
                fetch(this.questTableUrl),
                fetch(this.answersUrl)
            ]);

            const rawQuests = await questRes.json();
            const rawAnswers = await answerRes.json();

            this.quests = this._parseTable(rawQuests);
            this.answers = this._parseTable(rawAnswers);
            this.isLoaded = true;
        } catch (err) {
            console.error('Failed to load quest data:', err);
        }
    }

    /**
     * Преобразует двухмерный массив таблицы в Map объектов.
     * Работает по заголовкам из первой строки — подхватывает ВСЕ колонки
     * (включая RightReaction/WrongReaction/Artefact/NextWayQuest и т.д.),
     * ничего не нужно перечислять вручную.
     */
    _parseTable(dataArray) {
        if (!dataArray || dataArray.length < 2) return new Map();

        const headers = dataArray[0];
        const resultMap = new Map();

        for (let i = 1; i < dataArray.length; i++) {
            const row = dataArray[i];
            if (!row || !row[0]) continue;

            const obj = {};
            headers.forEach((header, index) => {
                if (header) {
                    obj[header] = row[index] !== undefined ? row[index] : '';
                }
            });

            // В questtable первичный ключ - id (например, Start, Q02...)
            // В answers первичный ключ - id (например, A01, A02...)
            resultMap.set(obj.id, obj);
        }

        return resultMap;
    }

    /**
     * Возвращает данные квеста по распознанному таргету (например, 'T1')
     */
    getQuestByTarget(targetName) {
        if (!this.isLoaded) return null;

        for (const [id, quest] of this.quests.entries()) {
            if (quest.RecognitionImage === targetName || quest.SignImage === targetName) {
                return quest;
            }
        }
        return null;
    }

    /**
     * Формирует полные данные для построения ARTarget на основе QuestID/TargetName
     */
    getArTargetData(targetName) {
        const quest = this.getQuestByTarget(targetName);
        if (!quest) {
            return {
                title: targetName,
                textLabel: 'MARKER',
                subtitle: 'AR Target',
                answerType: 'None'
            };
        }

        this.currentQuestId = quest.id;

        // Сбор списка связанной информации из answers.json
        const answerIds = quest.AnswerList
            ? quest.AnswerList.split(',').map(s => s.trim())
            : [];

        const answerObjects = answerIds
            .map(id => this.answers.get(id))
            .filter(Boolean);

        // Главный объект карточки задания (первый ответ)
        const mainAnswer = answerObjects[0] || {};
        const answerType = mainAnswer.AnswerType || 'Slide';

        // Конструирование данных для вариантов ответа в зависимости от типа
        let optionsData = [];

        if (answerType === 'Slide') {
            // Для Slide варианты — это последующие ответы из списка
            optionsData = answerObjects.slice(1).map(ans => ({
                id: ans.id,
                text: ans.MainTxt_Text || ans.Question || '',
                image: ans.AnswerPicture_Image || ''
            }));
        } else if (answerType === 'Button') {
            // Варианты для кнопок (от 2 до 4 штук)
            optionsData = answerObjects.slice(1).map(ans => ({
                id: ans.id,
                text: ans.MainTxt_Text || ans.Question || '',
                isCorrect: false
            }));
        } else if (answerType === 'InputField') {
            // Допустимые правильные варианты ввода
            optionsData = answerObjects.slice(1).map(ans => ({
                id: ans.id,
                validText: (ans.MainTxt_Text || '').trim().toLowerCase()
            }));
        }
        // Art / AntiArt — вариантов нет, это одиночное подтверждение находки/ненаходки

        return {
            questId: quest.id,
            title: mainAnswer.TitleText_Text || quest.id,
            question: mainAnswer.Question || quest.Question,
            mainText: mainAnswer.MainTxt_Text || '',
            helpUp: mainAnswer.HelpUpText_Text || '',
            helpDown: mainAnswer.HelpDownText_Text || '',
            answerType: answerType,
            options: optionsData,
            sound: mainAnswer.Sound_Sound || '',
            music: mainAnswer.Music_Music || ''
        };
    }

    /**
     * Проверка правильности выбранного или введенного ответа.
     * userInputValue:
     *   number  — индекс кнопки/слайда (сравнивается с RightWayIndx)
     *   string  — текст, введенный в InputField
     *   boolean — простое подтверждение (Art/AntiArt и другие безальтернативные
     *             ответы, где нет RightWayIndx) — true всегда считается верным
     */
    validateAnswer(questId, userInputValue) {
        const quest = this.quests.get(questId);
        if (!quest) return false;

        if (typeof userInputValue === 'boolean') {
            return userInputValue === true;
        }

        const rightWayIndex = parseInt(quest.RightWayIndx, 10);
        const answerIds = quest.AnswerList ? quest.AnswerList.split(',').map(s => s.trim()) : [];

        // Проверка для кнопок или слайдера по индексу
        if (typeof userInputValue === 'number') {
            return userInputValue === rightWayIndex;
        }

        // Проверка для InputField текстового значения
        if (typeof userInputValue === 'string') {
            const formattedInput = userInputValue.trim().toLowerCase();

            // Ищем совпадения среди ответов
            for (let i = 1; i < answerIds.length; i++) {
                const ans = this.answers.get(answerIds[i]);
                if (ans && ans.MainTxt_Text && ans.MainTxt_Text.trim().toLowerCase() === formattedInput) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Текст реакции (RightReaction / WrongReaction) для resultPanel.
     * @param {string} questId
     * @param {boolean} isCorrect
     * @returns {string}
     */
    getReactionText(questId, isCorrect) {
        const quest = this.quests.get(questId);
        if (!quest) return isCorrect ? 'Верно!' : 'Неверно.';

        const text = isCorrect ? quest.RightReaction : quest.WrongReaction;
        return text || (isCorrect ? 'Верно!' : 'Неверно.');
    }
}

/**
 * Вспомогательная функция генерирования HTML для разметки dynamic panel template
 */
export function buildQuestPanelHtml(targetData) {
    const { title, question, mainText, answerType, options } = targetData;

    let interactiveContentHtml = '';

    switch (answerType) {
        case 'Button':
            interactiveContentHtml = `
        <div class="quest-options-grid">
          ${options.map((opt, idx) => `
            <button class="quest-btn" data-index="${idx + 1}">${opt.text}</button>
          `).join('')}
        </div>
      `;
            break;

        case 'InputField':
            interactiveContentHtml = `
        <div class="quest-input-block">
          <input type="text" class="quest-input" placeholder="Введите ответ..." />
          <button class="quest-submit-btn">OK</button>
        </div>
      `;
            break;

        case 'Slide':
        default:
            interactiveContentHtml = `
        <div class="quest-slider">
          <button class="slide-nav prev">◄</button>
          <div class="slide-content">${options[0]?.text || mainText}</div>
          <button class="slide-nav next">►</button>
        </div>
      `;
            break;
    }

    return `
    <div class="panel quest-panel">
      <div class="quest-header">${title}</div>
      <div class="quest-body">
        <p class="quest-question">${question}</p>
        ${interactiveContentHtml}
      </div>
    </div>
  `;
}
