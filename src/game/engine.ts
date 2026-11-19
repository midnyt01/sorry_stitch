// Owns the PIXI.js app + the React<->world bridge. Replaces the Phaser engine.
import { Application } from "pixi.js";
import { VIEW_W, VIEW_H } from "./config";
import { World } from "./world";
import { Bridge, CMD, EVT } from "./events";
import type { HudState, GamePhase } from "./events";
import { AudioEngine } from "./audio";
import { Input } from "./input";

export class GameEngine {
  private app: Application | null = null;
  private world: World | null = null;
  bridge = new Bridge();
  audio = new AudioEngine();
  input = new Input();

  onHud?: (h: HudState) => void;
  onPhase?: (p: GamePhase) => void;

  async init(parent: HTMLElement, autoStart = false): Promise<void> {
    this.input.attach();
    this.bridge.on(EVT.HUD, (h) => this.onHud?.(h as HudState));
    this.bridge.on(EVT.PHASE, (p) => this.onPhase?.(p as GamePhase));

    this.app = new Application();
    await this.app.init({
      width: VIEW_W,
      height: VIEW_H,
      background: "#4FB8EE",
      antialias: false,
      resolution: 1,
      autoDensity: true,
    });
    // v8 exposes the element as `app.canvas` (falls back to renderer.view).
    const canvas = ((this.app as any).canvas ?? (this.app.renderer as any).view) as HTMLCanvasElement;
    canvas.style.imageRendering = "pixelated";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    parent.appendChild(canvas);

    this.world = new World(this.app, { bridge: this.bridge, audio: this.audio, input: this.input }, autoStart);
    const world = this.world;

    this.app.ticker.add((ticker) => {
      world.tick(ticker.deltaMS);
    });

    // Dev handle so the running world can be inspected from the console/tools.
    (window as any).__stitch = { app: this.app, world: this.world };
  }

  start() {
    this.bridge.emit(CMD.START);
  }
  pauseAll() {
    this.bridge.emit(CMD.PAUSE);
  }
  resume() {
    this.bridge.emit(CMD.RESUME);
  }
  restart() {
    this.bridge.emit(CMD.RESTART);
  }

  destroy() {
    this.input.detach();
    this.audio.stopMusic();
    if (this.world) this.world.destroy();
    if (this.app) this.app.destroy(true);
    delete (window as any).__stitch;
  }

  get worldHandle() {
    return this.world;
  }
}
