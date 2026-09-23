import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import type { InputController } from "../input/InputController";
import { highScoreStore } from "../save/HighScoreStore";
import { SandyGameModel, type SandySnapshot } from "../simulation/GameModel";

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const GROUND_Y = 486;
const PLAYER_START_Y = GROUND_Y - 36;
const PLAYER_GRAVITY = 980;
const PLAYER_JUMP_SPEED = 410;

export type SandyCommand = "start" | "pause" | "resume" | "restart";

type SandySceneConfig = {
  inputController: InputController;
  onSnapshot: (snapshot: SandySnapshot) => void;
};

const CONTACTS = [
  ["sandy-kick-left", "Left-foot flick"],
  ["sandy-kick-right", "Right-foot kick"],
  ["sandy-knee", "Knee touch"],
  ["sandy-chest", "Chest control"],
  ["sandy-volley", "Beach volley"]
] as const;

export class SandyUppyScene extends Phaser.Scene {
  private controls!: InputController;
  private onSnapshot!: (snapshot: SandySnapshot) => void;
  private model = new SandyGameModel();
  private audioManager = new AudioManager();
  private player!: Phaser.Physics.Arcade.Sprite;
  private ball!: Phaser.Physics.Arcade.Sprite;
  private sandcastle!: Phaser.Physics.Arcade.Sprite;
  private gull?: Phaser.Physics.Arcade.Sprite;
  private warning?: Phaser.GameObjects.Container;
  private lastGroundedAt = 0;
  private contactCooldownUntil = 0;
  private contactPoseUntil = 0;
  private slowedUntil = 0;
  private nextCastleMessageAt = 0;
  private slideUntil = 0;
  private nextSlideAt = 0;
  private slideDirection = 1;
  private obstacleSaveUntil = 0;
  private nextGullAt = 0;
  private warningAt = 0;
  private gullDirection = 1;
  private lastHudAt = 0;

  constructor() {
    super("sandy-uppy");
  }

  configure(config: SandySceneConfig) {
    this.controls = config.inputController;
    this.onSnapshot = config.onSnapshot;
  }

  init(config?: SandySceneConfig) {
    if (config?.inputController) this.configure(config);
    this.model = new SandyGameModel(highScoreStore.load());
  }

  create() {
    this.makeTextures();
    this.paintBeach();
    this.createAnimations();

    const ground = this.add.rectangle(WORLD_WIDTH / 2, GROUND_Y + 18, WORLD_WIDTH, 36, 0xd8aa59, 0);
    this.physics.add.existing(ground, true);

    this.player = this.physics.add.sprite(360, PLAYER_START_Y, "sandy-idle-a");
    this.player.setCollideWorldBounds(true).setGravityY(PLAYER_GRAVITY).setMaxVelocity(320, 720).setPushable(false).setDepth(5);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(27, 65).setOffset(8, 7);
    this.physics.add.collider(this.player, ground);

    this.ball = this.physics.add.sprite(380, 300, "sandy-ball");
    this.ball.setCircle(11).setBounce(0.9).setCollideWorldBounds(true).setDepth(6);
    this.ball.setGravityY(500);
    this.physics.add.collider(this.player, this.ball, () => this.handlePlayerContact());

    this.sandcastle = this.physics.add.staticSprite(690, GROUND_Y, "sandy-sandcastle").setOrigin(0.5, 1).setDepth(4);
    this.sandcastle.refreshBody();
    this.physics.add.overlap(this.player, this.sandcastle, () => this.enterSandcastle());

    this.controls.attach(() => this.togglePause(), () => this.handleJumpRequest(), (direction) => this.triggerSlide(direction));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.controls.detach());
    this.prepareReadyState();
  }

  handleCommand(command: SandyCommand) {
    if (command === "start") this.startFromJump();
    if (command === "restart") this.prepareReadyState();
    if (command === "pause") this.pauseRun();
    if (command === "resume") this.resumeRun();
  }

  private prepareReadyState() {
    this.model.resetToReady();
    this.controls.consumeJump();
    this.controls.clearMovement();
    this.controls.resetGestures();
    this.player.setPosition(360, PLAYER_START_Y).setVelocity(0, 0).setGravityY(PLAYER_GRAVITY).setAlpha(1);
    const ballBody = this.ball.body as Phaser.Physics.Arcade.Body;
    ballBody.enable = false;
    this.ball.setPosition(this.player.x, this.player.y - 54).setVelocity(0, 0).setAlpha(1);
    this.ball.setGravityY(0);
    this.gull?.destroy();
    this.gull = undefined;
    this.warning?.destroy();
    this.warning = undefined;
    this.contactCooldownUntil = 0;
    this.contactPoseUntil = 0;
    this.slowedUntil = 0;
    this.nextCastleMessageAt = 0;
    this.slideUntil = 0;
    this.nextSlideAt = 0;
    this.obstacleSaveUntil = 0;
    this.lastGroundedAt = performance.now();
    this.nextGullAt = this.time.now + 6500;
    this.warningAt = this.nextGullAt - 1300;
    this.physics.resume();
    this.emitSnapshot(true);
  }

  private startFromJump() {
    if (this.model.snapshot().phase !== "start") return;
    this.model.start();
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const ballBody = this.ball.body as Phaser.Physics.Arcade.Body;
    ballBody.enable = true;
    this.ball.setPosition(this.player.x, this.player.y - 58).setGravityY(500);
    this.ball.setVelocity(playerBody.velocity.x * 0.2, -365);
    this.player.setVelocityY(-PLAYER_JUMP_SPEED);
    this.controls.consumeJump();
    this.lastGroundedAt = performance.now();
    this.emitSnapshot(true);
  }

  private pauseRun() {
    if (this.model.snapshot().phase !== "playing") return;
    this.model.pause();
    this.physics.pause();
    this.emitSnapshot(true);
  }

  private resumeRun() {
    if (this.model.snapshot().phase !== "paused") return;
    this.model.resume();
    this.physics.resume();
    this.emitSnapshot(true);
  }

  private togglePause() {
    const phase = this.model.snapshot().phase;
    if (phase === "playing") this.pauseRun();
    else if (phase === "paused") this.resumeRun();
  }

  private handleJumpRequest() {
    if (this.model.snapshot().phase === "start") this.startFromJump();
  }

  private triggerSlide(direction: "left" | "right") {
    const phase = this.model.snapshot().phase;
    if (phase !== "start" && phase !== "playing") return;
    if (this.time.now < this.nextSlideAt) return;
    this.slideDirection = direction === "left" ? -1 : 1;
    this.slideUntil = this.time.now + 260;
    this.nextSlideAt = this.time.now + 470;
    this.player.setFlipX(this.slideDirection < 0).setTexture("sandy-slide");
    this.popText(this.player.x, this.player.y - 58, "SLIDE!", "#8de5ef");
  }

  update(time: number, delta: number) {
    const phase = this.model.snapshot().phase;
    if (phase === "start") {
      this.updateReadyState(time);
      return;
    }
    if (phase !== "playing") return;
    this.model.tick(delta / 1000);
    const difficulty = this.model.snapshot().difficulty;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.bottom > GROUND_Y + 1 && body.velocity.y >= 0) {
      this.player.setY(PLAYER_START_Y).setVelocityY(0);
      body.updateFromGameObject();
    }
    const nearGround = body.bottom >= GROUND_Y - 2 && body.velocity.y >= 0;
    const grounded = body.onFloor() || body.blocked.down || body.touching.down || nearGround;
    if (grounded) this.lastGroundedAt = performance.now();

    const slowed = time < this.slowedUntil;
    const sliding = time < this.slideUntil;
    const direction = sliding ? this.slideDirection : Number(this.controls.right) - Number(this.controls.left);
    const speed = sliding ? (slowed ? 360 : 485) : 235 / (slowed ? 2.35 : 1);
    this.player.setVelocityX(direction * speed);
    if (direction) this.player.setFlipX(direction < 0);
    if (slowed) this.player.setTint(0xffd05a);
    else this.player.clearTint();

    if (this.controls.hasBufferedJump() && performance.now() - this.lastGroundedAt <= 125) {
      this.player.setVelocityY(-PLAYER_JUMP_SPEED);
      this.controls.consumeJump();
    }

    if (sliding) this.player.setTexture("sandy-slide");
    else if (time >= this.contactPoseUntil) {
      if (!grounded) this.player.setTexture("sandy-jump");
      else if (direction) this.player.play("sandy-run", true);
      else this.player.play("sandy-idle", true);
    }

    const ballBody = this.ball.body as Phaser.Physics.Arcade.Body;
    if (this.ball.y >= GROUND_Y - 12 && ballBody.velocity.y > 0) this.handleDrop();
    const maxBallSpeed = 420 + difficulty * 50;
    ballBody.velocity.x = Phaser.Math.Clamp(ballBody.velocity.x, -maxBallSpeed, maxBallSpeed);
    ballBody.velocity.y = Phaser.Math.Clamp(ballBody.velocity.y, -560, 590 + difficulty * 35);

    if (!this.warning && !this.gull && time >= this.warningAt) this.showGullWarning();
    if (!this.gull && time >= this.nextGullAt) this.spawnGull();
    if (this.gull && (this.gull.x < -80 || this.gull.x > WORLD_WIDTH + 80)) {
      this.gull.destroy();
      this.gull = undefined;
      this.scheduleGull(time, difficulty);
    }
    this.emitSnapshot(false, time);
  }

  private updateReadyState(time: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.bottom > GROUND_Y + 1 && body.velocity.y >= 0) {
      this.player.setY(PLAYER_START_Y).setVelocityY(0);
      body.updateFromGameObject();
    }
    const slowed = time < this.slowedUntil;
    const sliding = time < this.slideUntil;
    const direction = sliding ? this.slideDirection : Number(this.controls.right) - Number(this.controls.left);
    const speed = sliding ? (slowed ? 360 : 485) : 235 / (slowed ? 2.35 : 1);
    this.player.setVelocityX(direction * speed);
    if (direction) this.player.setFlipX(direction < 0);
    if (slowed) this.player.setTint(0xffd05a);
    else this.player.clearTint();
    if (sliding) this.player.setTexture("sandy-slide");
    else if (direction) this.player.play("sandy-run", true);
    else this.player.play("sandy-idle", true);
    this.ball.setPosition(this.player.x, this.player.y - 54).setVelocity(0, 0);
    this.emitSnapshot(false, time);
  }

  private handlePlayerContact() {
    const now = this.time.now;
    if (now < this.contactCooldownUntil || this.model.snapshot().phase !== "playing") return;
    this.contactCooldownUntil = now + 190;
    const header = this.ball.y < this.player.y - 28;
    const [texture, label] = header ? ["sandy-header", "Header"] : CONTACTS[Phaser.Math.Between(0, CONTACTS.length - 1)];
    this.player.anims.stop();
    this.player.setTexture(texture);
    this.contactPoseUntil = now + 230;
    const offset = Phaser.Math.Clamp((this.ball.x - this.player.x) * 3.8, -210, 210);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.ball.setVelocity(offset + playerBody.velocity.x * 0.28, -405 - this.model.snapshot().difficulty * 22);
    const points = this.model.registerTouch(label);
    this.audioManager.touch(this.model.snapshot().combo);
    this.popText(this.ball.x, this.ball.y - 18, `+${points} · ${label}`, "#fff1a8");
    this.emitSnapshot(true);
  }

  private handleDrop() {
    const now = this.time.now;
    if (now < this.contactCooldownUntil) return;
    this.contactCooldownUntil = now + 360;
    const recoveryX = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-95, 95), 70, WORLD_WIDTH - 70);
    this.ball.setPosition(recoveryX, GROUND_Y - 13).setVelocity((this.player.x - recoveryX) * 1.35, -425);
    this.ball.setGravityY(365);
    this.time.delayedCall(900, () => this.ball?.setGravityY(500));
    if (now < this.obstacleSaveUntil) {
      this.obstacleSaveUntil = 0;
      this.audioManager.obstacle();
      this.popText(this.ball.x, GROUND_Y - 45, "SAND SAVE!", "#8de5ef");
      this.emitSnapshot(true);
      return;
    }
    const gameOver = this.model.registerDrop();
    this.audioManager.drop();
    this.cameras.main.shake(120, 0.006);
    if (gameOver) {
      this.physics.pause();
      this.ball.setAlpha(0.75);
      this.player.setVelocity(0, 0);
      highScoreStore.save(this.model.snapshot().highScore);
      this.audioManager.gameOver();
    } else {
      this.player.setAlpha(0.55);
      this.time.delayedCall(650, () => this.player?.setAlpha(1));
      this.popText(this.ball.x, GROUND_Y - 45, "DROP!", "#ff5b5b");
    }
    this.emitSnapshot(true);
  }

  private enterSandcastle() {
    this.slowedUntil = this.time.now + 120;
    if (this.model.snapshot().phase === "playing") this.obstacleSaveUntil = this.time.now + 1100;
    if (this.time.now < this.nextCastleMessageAt) return;
    this.nextCastleMessageAt = this.time.now + 650;
    this.audioManager.obstacle();
    this.popText(this.player.x, this.player.y - 58, "SLOWED", "#ffe476");
  }

  private showGullWarning() {
    const x = this.gullDirection > 0 ? 34 : WORLD_WIDTH - 34;
    const marker = this.add.text(0, 0, "!", { color: "#081a2c", fontFamily: "monospace", fontSize: "20px", fontStyle: "bold" }).setOrigin(0.5);
    const badge = this.add.circle(0, 0, 17, 0xffdd55);
    this.warning = this.add.container(x, 170, [badge, marker]).setDepth(10);
    this.tweens.add({ targets: this.warning, scale: 1.18, duration: 240, yoyo: true, repeat: 3 });
  }

  private spawnGull() {
    this.warning?.destroy();
    this.warning = undefined;
    const fromLeft = this.gullDirection > 0;
    this.gull = this.physics.add.sprite(fromLeft ? -45 : WORLD_WIDTH + 45, Phaser.Math.Between(135, 275), "sandy-gull").setDepth(5).setFlipX(!fromLeft);
    this.gull.setVelocityX(this.gullDirection * (145 + this.model.snapshot().difficulty * 32));
    this.gull.setImmovable(true);
    this.physics.add.collider(this.ball, this.gull, () => {
      if (!this.gull) return;
      const ballBody = this.ball.body as Phaser.Physics.Arcade.Body;
      this.ball.setVelocity(-ballBody.velocity.x * 0.75 + this.gullDirection * 70, -Math.abs(ballBody.velocity.y) - 80);
      this.obstacleSaveUntil = this.time.now + 1100;
      this.audioManager.obstacle();
      this.popText(this.gull.x, this.gull.y - 24, "GULL DEFLECTION", "#ffffff");
    });
  }

  private scheduleGull(now: number, difficulty: number) {
    this.gullDirection *= -1;
    this.nextGullAt = now + Phaser.Math.Between(5200, 7600) / Math.sqrt(difficulty);
    this.warningAt = this.nextGullAt - 1300;
  }

  private emitSnapshot(force: boolean, now = this.time.now) {
    if (!force && now - this.lastHudAt < 100) return;
    this.lastHudAt = now;
    this.onSnapshot(this.model.snapshot());
  }

  private popText(x: number, y: number, copy: string, color: string) {
    const text = this.add.text(x, y, copy, { color, fontFamily: "monospace", fontSize: "14px", fontStyle: "bold", stroke: "#08203a", strokeThickness: 4 }).setOrigin(0.5).setDepth(12);
    this.tweens.add({ targets: text, y: y - 30, alpha: 0, duration: 650, onComplete: () => text.destroy() });
  }

  private paintBeach() {
    const art = this.add.graphics();
    art.fillStyle(0x74d9ff).fillRect(0, 0, WORLD_WIDTH, 300);
    art.fillStyle(0xffe66e).fillCircle(790, 92, 46);
    art.fillStyle(0xffffff, 0.75).fillRect(0, 250, WORLD_WIDTH, 18);
    art.fillStyle(0x18a8c7).fillRect(0, 268, WORLD_WIDTH, 88);
    for (let x = 0; x < WORLD_WIDTH; x += 48) art.fillStyle(x % 96 ? 0x83e1ea : 0xc8f6ee).fillRect(x, 286 + (x % 3) * 10, 34, 5);
    art.fillStyle(0xf4d27b).fillRect(0, 356, WORLD_WIDTH, WORLD_HEIGHT - 356);
    art.fillStyle(0xe8bd62).fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);
    for (let x = 20; x < WORLD_WIDTH; x += 57) art.fillStyle(0xd6a652, 0.55).fillRect(x, 410 + (x % 41), 7, 3);
    const clouds = [[110, 82], [155, 70], [205, 88], [515, 115], [560, 104]];
    clouds.forEach(([x, y]) => art.fillStyle(0xffffff, 0.72).fillCircle(x, y, 27));
    this.add.text(22, 20, "SANDY BUMS BEACH", { color: "#073153", fontFamily: "monospace", fontSize: "13px", fontStyle: "bold" }).setAlpha(0.72);
  }

  private createAnimations() {
    this.anims.create({ key: "sandy-idle", frames: [{ key: "sandy-idle-a" }, { key: "sandy-idle-b" }], frameRate: 2.4, repeat: -1 });
    this.anims.create({ key: "sandy-run", frames: [{ key: "sandy-run-a" }, { key: "sandy-run-b" }], frameRate: 10, repeat: -1 });
    this.player?.play("sandy-idle");
  }

  private makeTextures() {
    const makePlayer = (key: string, pose: "idle-a" | "idle-b" | "run-a" | "run-b" | "jump" | "slide" | "kick-left" | "kick-right" | "header" | "knee" | "chest" | "volley") => {
      const g = this.add.graphics();
      g.fillStyle(0x142f52).fillRect(14, 23, 17, 28);
      g.fillStyle(0xf05366).fillRect(14, 23, 17, 8);
      g.fillStyle(0xf4b680).fillRect(16, 8, 14, 15);
      g.fillStyle(0x6b3b20).fillRect(16, 6, 14, 5);
      const bob = pose === "idle-b" ? 1 : 0;
      g.fillStyle(0x142f52);
      if (pose === "run-a") { g.fillRect(9, 49, 9, 18); g.fillRect(27, 48, 9, 14); }
      else if (pose === "run-b") { g.fillRect(12, 49, 9, 14); g.fillRect(24, 49, 9, 19); }
      else if (pose === "jump") { g.fillRect(8, 49, 14, 8); g.fillRect(27, 48, 10, 8); }
      else if (pose === "slide") { g.fillRect(5, 50, 18, 8); g.fillRect(23, 47, 19, 8); }
      else if (pose === "kick-left") { g.fillRect(5, 47, 20, 8); g.fillRect(25, 49, 8, 18); }
      else if (pose === "kick-right" || pose === "volley") { g.fillRect(17, 49, 8, 18); g.fillRect(24, pose === "volley" ? 40 : 47, 17, 8); }
      else if (pose === "knee") { g.fillRect(12, 49, 8, 17); g.fillRect(24, 48, 13, 9); }
      else { g.fillRect(13, 49 + bob, 8, 18); g.fillRect(25, 49 + bob, 8, 18); }
      g.fillStyle(0xf4b680);
      if (pose === "header") { g.fillRect(4, 24, 11, 6); g.fillRect(31, 24, 10, 6); }
      else if (pose === "chest") { g.fillRect(5, 31, 12, 6); g.fillRect(29, 31, 12, 6); }
      else { g.fillRect(8, 27 + bob, 7, 18); g.fillRect(31, 27 + bob, 7, 18); }
      g.generateTexture(`sandy-${key}`, 46, 72);
      g.destroy();
    };
    (["idle-a", "idle-b", "run-a", "run-b", "jump", "slide", "kick-left", "kick-right", "header", "knee", "chest", "volley"] as const).forEach((pose) => makePlayer(pose, pose));

    const ball = this.add.graphics();
    ball.fillStyle(0xf8f2df).fillCircle(12, 12, 11).fillStyle(0x173759).fillCircle(12, 12, 4).fillRect(5, 4, 4, 4).fillRect(17, 5, 4, 4).fillRect(5, 17, 4, 4).fillRect(17, 17, 4, 4);
    ball.generateTexture("sandy-ball", 24, 24).destroy();

    const castle = this.add.graphics();
    castle.fillStyle(0xc88736).fillRect(5, 15, 36, 19).fillRect(7, 7, 9, 10).fillRect(29, 7, 9, 10).fillTriangle(4, 8, 12, 0, 19, 8).fillTriangle(26, 8, 34, 0, 42, 8).fillStyle(0x6b492a).fillRect(19, 23, 8, 11);
    castle.generateTexture("sandy-sandcastle", 46, 34).destroy();

    const gull = this.add.graphics();
    gull.lineStyle(5, 0xf8f7ec).beginPath().moveTo(2, 13).lineTo(15, 7).lineTo(25, 14).lineTo(35, 7).lineTo(48, 13).strokePath();
    gull.lineStyle(2, 0x143653).beginPath().moveTo(18, 12).lineTo(25, 17).lineTo(32, 12).strokePath();
    gull.generateTexture("sandy-gull", 50, 24).destroy();
  }
}
