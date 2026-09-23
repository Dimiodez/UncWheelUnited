export type SandyAction = "left" | "right";

export class InputController {
  left = false;
  right = false;
  private jumpBufferedUntil = 0;
  private pauseHandler?: () => void;
  private jumpHandler?: () => void;
  private slideHandler?: (direction: SandyAction) => void;
  private lastDirectionTap: Record<SandyAction, number> = { left: 0, right: 0 };

  private onKeyDown = (event: KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "KeyA", "KeyD", "KeyW", "Escape", "KeyP"].includes(event.code)) event.preventDefault();
    if (!event.repeat && (event.code === "ArrowLeft" || event.code === "KeyA")) this.pressDirection("left");
    if (!event.repeat && (event.code === "ArrowRight" || event.code === "KeyD")) this.pressDirection("right");
    if (!event.repeat && ["ArrowUp", "Space", "KeyW"].includes(event.code)) this.queueJump();
    if (!event.repeat && ["Escape", "KeyP"].includes(event.code)) this.pauseHandler?.();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") this.left = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") this.right = false;
  };

  attach(pauseHandler: () => void, jumpHandler?: () => void, slideHandler?: (direction: SandyAction) => void) {
    this.pauseHandler = pauseHandler;
    this.jumpHandler = jumpHandler;
    this.slideHandler = slideHandler;
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
  }

  detach() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.left = false;
    this.right = false;
    this.pauseHandler = undefined;
    this.jumpHandler = undefined;
    this.slideHandler = undefined;
    this.resetGestures();
  }

  setHeld(action: SandyAction, held: boolean) {
    if (held && !this[action]) this.registerDirectionTap(action);
    this[action] = held;
  }

  private pressDirection(action: SandyAction) {
    if (!this[action]) this.registerDirectionTap(action);
    this[action] = true;
  }

  private registerDirectionTap(action: SandyAction) {
    const now = performance.now();
    if (this.lastDirectionTap[action] > 0 && now - this.lastDirectionTap[action] <= 280) this.slideHandler?.(action);
    this.lastDirectionTap[action] = now;
  }

  clearMovement() {
    this.left = false;
    this.right = false;
  }

  resetGestures() {
    this.lastDirectionTap = { left: 0, right: 0 };
  }

  queueJump() {
    this.jumpBufferedUntil = performance.now() + 150;
    this.jumpHandler?.();
  }

  hasBufferedJump(now = performance.now()) {
    return now <= this.jumpBufferedUntil;
  }

  consumeJump() {
    this.jumpBufferedUntil = 0;
  }
}
