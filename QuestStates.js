export const QuestState = Object.freeze({
  WAITING_IMAGE: 'waitingImage',
  WAITING_ANSWER: 'waitingAnswer',
});

export const QuestEvent = Object.freeze({
  IMAGE_FOUND: 'imageFound',
  IMAGE_LOST: 'imageLost',
  ANSWER_CLICKED: 'answerClicked',
});

export const QuestTransitionTable = Object.freeze({
  [QuestState.WAITING_IMAGE]: {
    [QuestEvent.IMAGE_FOUND]: QuestState.WAITING_ANSWER,
  },
  [QuestState.WAITING_ANSWER]: {
    [QuestEvent.ANSWER_CLICKED]: QuestState.WAITING_IMAGE,
  },
});
