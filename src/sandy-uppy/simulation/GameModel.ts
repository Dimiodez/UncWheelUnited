export type SandyGamePhase = "start" | "playing" | "paused" | "gameover";

export type SandySnapshot = {
  phase: SandyGamePhase;
  score: number;
  combo: number;
  multiplier: number;
  dropsRemaining: number;
  bestCombo: number;
  highScore: number;
  difficulty: number;
  secondsSurvived: number;
  lastContact: string;
};

export class SandyGameModel {
  private phase: SandyGamePhase = "start";
  private score = 0;
  private combo = 0;
  private dropsRemaining = 3;
  private bestCombo = 0;
  private highScore: number;
  private secondsSurvived = 0;
  private lastContact = "Ready";

  constructor(highScore = 0) {
    this.highScore = highScore;
  }

  resetToReady() {
    this.phase = "start";
    this.score = 0;
    this.combo = 0;
    this.dropsRemaining = 3;
    this.bestCombo = 0;
    this.secondsSurvived = 0;
    this.lastContact = "Ball attached · jump to start";
  }

  start() {
    this.score = 0;
    this.combo = 0;
    this.dropsRemaining = 3;
    this.bestCombo = 0;
    this.secondsSurvived = 0;
    this.lastContact = "First touch";
    this.phase = "playing";
  }

  tick(deltaSeconds: number) {
    if (this.phase === "playing") this.secondsSurvived += Math.max(0, deltaSeconds);
  }

  registerTouch(contact: string) {
    if (this.phase !== "playing") return 0;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const points = 100 * this.multiplier;
    this.score += points;
    this.highScore = Math.max(this.highScore, this.score);
    this.lastContact = contact;
    return points;
  }

  registerDrop() {
    if (this.phase !== "playing") return false;
    this.dropsRemaining = Math.max(0, this.dropsRemaining - 1);
    this.combo = 0;
    this.lastContact = this.dropsRemaining ? "Saved by the sand" : "Full time";
    if (this.dropsRemaining === 0) this.phase = "gameover";
    return this.phase === "gameover";
  }

  pause() {
    if (this.phase === "playing") this.phase = "paused";
  }

  resume() {
    if (this.phase === "paused") this.phase = "playing";
  }

  get multiplier() {
    return Math.min(6, 1 + Math.floor(this.combo / 5));
  }

  get difficulty() {
    return Math.min(2.5, 1 + this.secondsSurvived / 55);
  }

  snapshot(): SandySnapshot {
    return {
      phase: this.phase,
      score: this.score,
      combo: this.combo,
      multiplier: this.multiplier,
      dropsRemaining: this.dropsRemaining,
      bestCombo: this.bestCombo,
      highScore: this.highScore,
      difficulty: this.difficulty,
      secondsSurvived: this.secondsSurvived,
      lastContact: this.lastContact
    };
  }
}
