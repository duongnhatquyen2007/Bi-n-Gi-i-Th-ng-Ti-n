import { GAME_CONFIG } from "./config.js";
import { AssetLoader } from "./AssetLoader.js";
import { SaveHistoryManager } from "./SaveHistoryManager.js";
import { SoundManager } from "./SoundManager.js";
import { UIManager } from "./UIManager.js";
import { GameLoop } from "./GameLoop.js";

async function bootstrapGame() {
  const canvas = document.getElementById("gameCanvas");
  const assetLoader = new AssetLoader();
  await assetLoader.loadAll();

  const saveManager = new SaveHistoryManager();
  const soundManager = new SoundManager();

  let gameLoop = null;

  const uiManager = new UIManager(saveManager, soundManager, {
    onFinishIntro: () => {
      try {
        localStorage.setItem(GAME_CONFIG.STORAGE.INTRO_SEEN_KEY, "1");
      } catch {}
      uiManager.showMenu();
    },
    onStartTrip: (routeId, cargoId) => {
      gameLoop?.startTrip(routeId, cargoId);
    },
    onRestartTrip: () => {
      gameLoop?.restartTrip();
    },
    onReturnToMenu: () => {
      gameLoop?.returnToMenu();
    },
    onTogglePause: () => {
      gameLoop?.togglePause();
    },
    onHorn: () => {
      gameLoop?.triggerHorn();
    },
    onToggleLights: () => {
      gameLoop?.toggleLights();
    },
    onHandbrakePressed: () => {
      gameLoop?.onHandbrakePressed();
    },
    onInteractPressed: () => {
      gameLoop?.onInteractPressed();
    },
  });

  gameLoop = new GameLoop({
    canvas,
    assetLoader,
    saveManager,
    soundManager,
    uiManager,
  });

  gameLoop.startLoop();

  let introSeen = false;
  try {
    introSeen = localStorage.getItem(GAME_CONFIG.STORAGE.INTRO_SEEN_KEY) === "1";
  } catch {}

  if (!introSeen) {
    uiManager.showIntro();
  } else {
    uiManager.showMenu();
  }
}

bootstrapGame();
