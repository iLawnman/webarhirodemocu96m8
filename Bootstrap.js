import { EventBus } from '../core/EventBus.js';
import { FiniteStateMachine } from '../core/FiniteStateMachine.js';
import { QuestState, QuestTransitionTable } from '../domain/QuestStates.js';
import { ArTrackingAdapter } from '../ar/ArTrackingAdapter.js';
import { ArTargetPresenter } from '../ui/ArTargetPresenter.js';
import { AnswerButtonPresenter } from '../ui/AnswerButtonPresenter.js';
import { QuestFlowController } from './QuestFlowController.js';

function bootstrap() {
  const nftElement = document.querySelector('#imageTarget');
  const arTargetElement = document.querySelector('#arTarget');
  const answerButtonElement = document.querySelector('#answerButton');

  const eventBus = new EventBus();
  const stateMachine = new FiniteStateMachine(QuestTransitionTable, QuestState.WAITING_IMAGE);

  const arTrackingAdapter = new ArTrackingAdapter(nftElement, eventBus);
  const arTargetPresenter = new ArTargetPresenter(arTargetElement);
  const answerButtonPresenter = new AnswerButtonPresenter(answerButtonElement, eventBus);
  const questFlowController = new QuestFlowController(eventBus, stateMachine, arTargetPresenter);

  arTrackingAdapter.start();
  answerButtonPresenter.start();
  questFlowController.start();
}

window.addEventListener('load', bootstrap);
