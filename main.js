import { AppConfig } from './config/AppConfig.js';
import { AppStateMachine } from './state/AppStateMachine.js';
import { AppStates } from './state/AppStates.js';
import { ArSceneManager } from './ar/ArSceneManager.js';
import { ImageTracker } from './ar/ImageTracker.js';
import { ArTargetView } from './target/ArTargetView.js';
import { AnswerButton } from './ui/AnswerButton.js';
import { AppController } from './app/AppController.js';

async function bootstrap() {
  const arSceneManager = new ArSceneManager(AppConfig);
  await arSceneManager.init();

  const imageTracker = new ImageTracker(arSceneManager, AppConfig);
  imageTracker.init();

  const arTargetView = new ArTargetView(AppConfig);
  const answerButton = new AnswerButton('Ответить');
  const stateMachine = new AppStateMachine(AppStates.WaitingImage);

  const appController = new AppController(
    stateMachine,
    imageTracker,
    arTargetView,
    answerButton
  );
  appController.start();

  arSceneManager.startRenderLoop();
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap();
});
