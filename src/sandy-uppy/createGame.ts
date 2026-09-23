import Phaser from "phaser";
import type { InputController } from "./input/InputController";
import { SandyUppyScene, type SandyCommand } from "./phaser/SandyUppyScene";
import type { SandySnapshot } from "./simulation/GameModel";

export function createSandyUppyGame(parent: HTMLElement, inputController: InputController, onSnapshot: (snapshot: SandySnapshot) => void) {
  const scene = new SandyUppyScene();
  scene.configure({ inputController, onSnapshot });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    backgroundColor: "#74d9ff",
    pixelArt: true,
    antialias: false,
    transparent: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scene
  });

  return {
    game,
    command(command: SandyCommand) {
      (game.scene.getScene("sandy-uppy") as SandyUppyScene | undefined)?.handleCommand(command);
    }
  };
}
