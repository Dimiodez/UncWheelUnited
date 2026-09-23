import { describe, expect, it } from "vitest";
import { SandyGameModel } from "./GameModel";

describe("SandyGameModel", () => {
  it("scores touches and grows a capped combo multiplier", () => {
    const game = new SandyGameModel();
    game.start();
    for (let index = 0; index < 5; index += 1) game.registerTouch("Kick");
    expect(game.snapshot()).toMatchObject({ score: 600, combo: 5, multiplier: 2, bestCombo: 5 });
    expect(game.registerTouch("Header")).toBe(200);
  });

  it("allows three drops before game over and resets the combo", () => {
    const game = new SandyGameModel();
    game.start();
    game.registerTouch("Volley");
    expect(game.registerDrop()).toBe(false);
    expect(game.snapshot()).toMatchObject({ dropsRemaining: 2, combo: 0, phase: "start" });
    game.start();
    expect(game.registerDrop()).toBe(false);
    game.start();
    expect(game.registerDrop()).toBe(true);
    expect(game.snapshot().phase).toBe("gameover");
  });

  it("scales difficulty gradually and preserves the loaded high score", () => {
    const game = new SandyGameModel(1200);
    game.start();
    game.tick(55);
    expect(game.snapshot()).toMatchObject({ difficulty: 2, highScore: 1200 });
  });

  it("returns to a safe ready state without erasing the high score", () => {
    const game = new SandyGameModel(1200);
    game.start();
    game.registerTouch("Header");
    game.resetToReady();
    expect(game.snapshot()).toMatchObject({
      phase: "start",
      score: 0,
      dropsRemaining: 3,
      highScore: 1200,
      lastContact: "Ball attached · jump to start"
    });
  });
});
