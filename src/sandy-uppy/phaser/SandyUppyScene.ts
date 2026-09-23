import Phaser from "phaser";
import { BeachModel } from "../simulation/BeachModel";
import { rankedRun } from "../save/RankedRun";
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
  private beach = new BeachModel();
  private beachArt!: Phaser.GameObjects.Graphics;
  private oceanArt!: Phaser.GameObjects.Graphics;
  private slideId = 0;
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
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(41, 65).setOffset(1, 7);
    this.physics.add.collider(this.player, ground);

    this.ball = this.physics.add.sprite(380, 300, "sandy-ball");
    this.ball.setCircle(11).setBounce(0.9).setCollideWorldBounds(true).setDepth(6);
    this.ball.setGravityY(500);
    this.physics.add.collider(this.player, this.ball, () => this.handlePlayerContact());

    this.beachArt = this.add.graphics().setDepth(4);

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
    this.beach.reset();
    this.beachArt.clear();
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
    this.updateBeach(0);
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
    this.slideId++;
    this.slideDirection = direction === "left" ? -1 : 1;
    this.slideUntil = this.time.now + 260;
    this.nextSlideAt = this.time.now + 470;
    this.player.setFlipX(this.slideDirection < 0).setTexture("sandy-slide");
    this.popText(this.player.x, this.player.y - 58, "SLIDE!", "#8de5ef");
  }

  update(time: number, delta: number) {
    this.paintWaves(time / 1000);
    const phase = this.model.snapshot().phase;
    if (phase === "start") {
      this.updateReadyState(time);
      return;
    }
    if (phase !== "playing") return;
    this.model.tick(delta / 1000);
    const difficulty = this.model.snapshot().difficulty;
    this.updateBeach(Math.min(delta / 1000, .05));
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
    if (this.ball.y >= GROUND_Y - 12 && ballBody.velocity.y > 0) {this.handleDrop(); if(this.model.snapshot().phase !== "playing") return;}
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
    if (now < this.obstacleSaveUntil) {
      this.obstacleSaveUntil = 0;
      this.ball.setPosition(this.player.x, this.player.y - 58).setVelocity(0,-425).setGravityY(500);
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
      (this.ball.body as Phaser.Physics.Arcade.Body).enable=false;
      this.ball.setGravityY(0).setVelocity(0,0).setPosition(this.player.x,this.player.y-54);
      this.player.setVelocity(0,0).setAlpha(1);
      this.slideUntil=0; this.controls.clearMovement(); this.controls.consumeJump();
      this.gull?.destroy(); this.gull=undefined; this.warning?.destroy(); this.warning=undefined;
      this.nextGullAt=this.time.now+6500; this.warningAt=this.nextGullAt-1300;
      this.popText(this.player.x,this.player.y-75,"Jump to restart","#ffdd55");
    }
    this.emitSnapshot(true);
  }

  private updateBeach(dt:number) {
    this.beach.tick(dt);
    const grounded=this.player.y>GROUND_Y-85;
    if(this.time.now<this.slideUntil&&grounded){
      const points=this.beach.tackle(this.player.x,this.slideId);
      for(const hit of this.beach.lastTackles)rankedRun.record(hit.kind,this.model.snapshot().secondsSurvived,hit.id);
      if(points){this.model.reward(points,"Beach cleared!");this.popText(this.player.x,this.player.y-70,"+"+points+" · TACKLE!","#fff1a8");}
    }else if(grounded&&this.beach.castles.some(c=>Math.abs(c.x-this.player.x)<35))this.enterSandcastle();
    if(this.beach.catchCan(this.player.x,this.player.y)){
      const gained=this.model.extraLife();this.popText(this.player.x,this.player.y-60,gained?"GOOSE MODE +1 LIFE":"LIVES FULL","#8de5ef");
      this.emitSnapshot(true);
    }
    const art=this.beachArt;art.clear();
    for(const c of this.beach.castles){
      art.fillStyle(c.hp===2?0xc88736:0xe1a64d).fillRect(c.x-22,GROUND_Y-24,44,24).fillRect(c.x-20,GROUND_Y-38,12,17).fillRect(c.x+8,GROUND_Y-38,12,17);
      art.fillStyle(0x6b492a).fillRect(c.x-5,GROUND_Y-15,10,15);
      if(c.hp===1)art.lineStyle(3,0x6b492a).lineBetween(c.x-10,GROUND_Y-24,c.x+7,GROUND_Y-4);
      art.fillStyle(0xffe476).fillRect(c.x-16,GROUND_Y-46,c.hp*15,4);
    }
    for(const b of this.beach.builders){
      art.fillStyle(0xf4b680).fillRect(b.x-7,GROUND_Y-54,14,14);
      art.fillStyle(0x35baa5).fillRect(b.x-11,GROUND_Y-40,22,22);
      art.fillStyle(0x223753).fillRect(b.x-10,GROUND_Y-18,7,18).fillRect(b.x+3,GROUND_Y-18,7,18);
      art.fillStyle(0xfad45c).fillRect(b.x-12,GROUND_Y-58,24,5);
      art.fillStyle(0xe78a44).fillRect(b.x+13,GROUND_Y-15,13,15);
      if(b.progress>0){art.fillStyle(0x223753).fillRect(b.x-20,GROUND_Y-68,40,5);art.fillStyle(0xffdf72).fillRect(b.x-20,GROUND_Y-68,40*b.progress,5);}
    }
    if(this.beach.goose){const x=this.beach.goose.x;art.fillStyle(0xffffff).fillRect(x-20,104,35,14).fillRect(x+10,87,9,24).fillRect(x+15,83,13,10).fillRect(x-6,90+Math.sin(this.beach.elapsed*12)*9,9,20);art.fillStyle(0xf1a43b).fillRect(x+28,87,10,5);}
    if(this.beach.can){const {x,y}=this.beach.can;art.fillStyle(0x28b9d5).fillRect(x-9,y-14,18,28);art.fillStyle(0xffffff).fillRect(x-9,y-14,18,3);art.fillStyle(0xf24e40).fillRect(x-6,y-4,12,8);}
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
    let deflected = false;
    // One controlled nudge per gull; no moving-body impulse or repeated boosts.
    this.physics.add.overlap(this.ball, this.gull, () => {
      if (!this.gull || deflected || this.model.snapshot().phase !== "playing") return;
      deflected = true;
      const ballBody = this.ball.body as Phaser.Physics.Arcade.Body;
      const sideways = Phaser.Math.Clamp(-ballBody.velocity.x * 0.45 + this.gullDirection * 35, -180, 180);
      const upward = Phaser.Math.Clamp(Math.abs(ballBody.velocity.y) * 0.65, 230, 330);
      this.ball.setVelocity(sideways, -upward);
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
    art.fillStyle(0xf4d27b).fillRect(0, 250, WORLD_WIDTH, WORLD_HEIGHT - 250);
    art.fillStyle(0xe8bd62).fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);
    for (let x = 20; x < WORLD_WIDTH; x += 57) art.fillStyle(0xd6a652, 0.55).fillRect(x, 410 + (x % 41), 7, 3);
    const clouds = [[110, 82], [155, 70], [205, 88], [515, 115], [560, 104]];
    clouds.forEach(([x, y]) => art.fillStyle(0xffffff, 0.72).fillCircle(x, y, 27));
    this.add.text(22, 20, "SANDY BUMS BEACH", { color: "#073153", fontFamily: "monospace", fontSize: "13px", fontStyle: "bold" }).setAlpha(0.72);
    this.oceanArt = this.add.graphics().setDepth(1);
    this.paintWaves(0);
  }

  private paintWaves(seconds: number) {
    const art = this.oceanArt;
    art.clear();
    const tide = 351 + Math.sin(seconds * .48) * 14;
    // Pixel-wide strips give the shoreline a soft, stepped arcade silhouette.
    for (let x = 0; x < WORLD_WIDTH; x += 6) {
      const shore = Math.round((tide + Math.sin(x * .017 + seconds * 1.1) * 5 + Math.sin(x * .041 - seconds * .7) * 2) / 2) * 2;
      art.fillStyle(0xc9ae70, .55).fillRect(x, 337, 6, shore + 14 - 337);
      art.fillStyle(0x148cba).fillRect(x, 250, 6, shore - 250);
      art.fillStyle(0x20b5cb).fillRect(x, 281, 6, shore - 281);
      art.fillStyle(0x65d4d5, .8).fillRect(x, shore - 19, 6, 19);
      art.fillStyle(0xd8fff0, .85).fillRect(x, shore - 3, 6, 4);
      art.fillStyle(0xffffff, .35).fillRect(x, 250, 6, 2);
    }
    // Successive crests travel toward shore, widening and breaking into foam.
    for (let wave = 0; wave < 3; wave++) {
      const progress = ((seconds * .13 + wave / 3) % 1);
      const y = 258 + progress * (tide - 265);
      const alpha = Math.sin(progress * Math.PI) * .7;
      for (let x = -24; x < WORLD_WIDTH; x += 6) {
        const crest = Math.round((y + Math.sin(x * .022 + wave * 2 + seconds * .6) * (2 + progress * 4)) / 2) * 2;
        const broken = Math.sin(x * .075 + wave * 3 + seconds) > -.55;
        art.fillStyle(0x087da9, alpha * .4).fillRect(x, crest + 4, 6, 4);
        if (broken) art.fillStyle(0xe3fff5, alpha).fillRect(x, crest, 6, progress > .6 ? 4 : 2);
      }
    }
    // A quiet visual hint during the final twelve active seconds before a flyover.
    const untilGoose = this.beach.nextGoose - this.beach.elapsed;
    if (untilGoose > 0 && untilGoose <= 12) {
      const x = 130 + (12 - untilGoose) * 42;
      const y = 309 + Math.sin(seconds * 2.3) * 2;
      art.lineStyle(2, 0xd8fff0, .65).beginPath().moveTo(x - 36, y + 12).lineTo(x - 17, y + 9).lineTo(x + 22, y + 12).strokePath();
      art.fillStyle(0x143653).fillRect(x - 19, y - 3, 36, 16).fillRect(x + 9, y - 22, 10, 28).fillRect(x + 13, y - 26, 18, 12);
      art.fillStyle(0xfff9e9).fillRect(x - 16, y, 30, 10).fillRect(x + 12, y - 20, 4, 24).fillRect(x + 16, y - 23, 12, 6);
      art.fillStyle(0xf8ae35).fillRect(x + 30, y - 20, 9, 4);
      art.fillStyle(0x143653).fillRect(x + 24, y - 22, 2, 2);
      art.fillStyle(0xbcd7dc).fillRect(x - 10, y + 2, 17, 3);
    }
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
    gull.lineStyle(10, 0x143653).beginPath().moveTo(6, 13).lineTo(17, 7).lineTo(27, 14).lineTo(37, 7).lineTo(48, 13).strokePath();
    gull.lineStyle(5, 0xfffdf2).beginPath().moveTo(6, 13).lineTo(17, 7).lineTo(27, 14).lineTo(37, 7).lineTo(48, 13).strokePath();
    gull.fillStyle(0x143653).fillEllipse(27, 16, 17, 12);
    gull.fillStyle(0xfffdf2).fillEllipse(27, 15, 11, 7);
    gull.fillStyle(0xf8ae35).fillRect(32, 14, 6, 3);
    gull.generateTexture("sandy-gull", 54, 26).destroy();
  }
}

