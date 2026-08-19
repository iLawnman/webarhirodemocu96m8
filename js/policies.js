// ===================== policies.js =====================
/**
 * Политики распознавания маркеров.
 *
 * unique_targets (из settings):
 *   0 / 1 — выкл (можно расширить позже)
 *   2    — strictUnique + StepByStep
 *
 * strictUnique  — разрешён только маркер текущего ожидаемого квеста
 *                 (RecognitionImage / SignImage текущего QuestID)
 * StepByStep    — каждый маркер можно распознать только один раз за сессию
 *
 * При отказе — только лог (без UI-панелей).
 */
export class Policies {
    /**
     * @param {import('./settings.js').Settings} settings
     * @param {import('./quests.js').QuestManager} questManager
     */
    constructor(settings, questManager) {
        this.settings = settings;
        this.questManager = questManager;

        /** @type {number} */
        this.mode = 0;

        /** StepByStep: уже использованные маркеры */
        this.usedMarkers = new Set();

        /** strictUnique: текущий ожидаемый маркер (T1, T2, …) */
        this.expectedMarker = null;
    }

    init() {
        this.mode = this.settings.uniqueTargets;
        this.usedMarkers.clear();
        this._updateExpectedFromCurrentQuest();
    }

    /** Обновить expectedMarker из questManager.currentQuestId */
    _updateExpectedFromCurrentQuest() {
        const qid = this.questManager.currentQuestId;
        const quest = this.questManager.quests.get(qid);
        if (quest) {
            this.expectedMarker = quest.RecognitionImage || quest.SignImage || null;
        } else {
            this.expectedMarker = null;
        }
    }

    /**
     * Проверка, можно ли запускать quest-flow для данного маркера.
     * @param {string} markerName  например 'T3'
     * @returns {{ ok: boolean, reason?: string }}
     */
    canRecognize(markerName) {
        // 0/1 — политики выключены
        if (this.mode < 2) {
            return { ok: true };
        }

        // StepByStep: уже использовали
        if (this.usedMarkers.has(markerName)) {
            return {
                ok: false,
                reason: `StepByStep: marker "${markerName}" already used this session`
            };
        }

        // strictUnique: только ожидаемый
        if (this.expectedMarker && markerName !== this.expectedMarker) {
            return {
                ok: false,
                reason: `strictUnique: expected "${this.expectedMarker}", got "${markerName}"`
            };
        }

        return { ok: true };
    }

    /**
     * Вызывается после успешного старта распознавания (effect / ARTarget создан).
     * @param {string} markerName
     */
    onRecognized(markerName) {
        if (this.mode < 2) return;
        this.usedMarkers.add(markerName);
    }

    /**
     * Вызывается после ответа на вопрос — продвигаем цепочку.
     * @param {string} nextQuestId  RightWayQuest / WrongWayQuest
     */
    onQuestAdvanced(nextQuestId) {
        if (!nextQuestId) return;
        this.questManager.currentQuestId = nextQuestId;
        this._updateExpectedFromCurrentQuest();
    }

    /** Сброс на новую сессию / reset */
    reset() {
        this.usedMarkers.clear();
        this.questManager.currentQuestId = 'Start';
        this._updateExpectedFromCurrentQuest();
    }
}