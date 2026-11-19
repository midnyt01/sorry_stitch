// Framework-agnostic input state: keyboard (browser) + touch (React UI).
// The Phaser scene reads this each frame; React writes into `touch`.

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  a: boolean;
}

export class Input {
  state: InputState = { left: false, right: false, up: false, down: false, a: false };
  touch = { left: false, right: false, jump: false, a: false, down: false };
  private keys: Record<string, boolean> = {};
  private onKeyDown = (e: KeyboardEvent) => {
    if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyA", "KeyD", "KeyW", "KeyS", "ShiftLeft", "ShiftRight"].includes(
        e.code
      )
    ) {
      e.preventDefault();
    }
    this.keys[e.code] = true;
    this.recompute();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
    this.recompute();
  };

  attach() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }
  detach() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }
  recompute() {
    const k = this.keys;
    const t = this.touch;
    this.state.left = !!(k["ArrowLeft"] || k["KeyA"] || t.left);
    this.state.right = !!(k["ArrowRight"] || k["KeyD"] || t.right);
    this.state.up = !!(k["ArrowUp"] || k["KeyW"] || k["Space"] || t.jump);
    this.state.down = !!(k["ArrowDown"] || k["KeyS"] || t.down);
    this.state.a = !!(k["ShiftLeft"] || k["ShiftRight"] || k["KeyK"] || t.a);
  }
}
