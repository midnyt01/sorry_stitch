// The whole game world, rendered on PIXI.js. Hand-rolled AABB + tile
// physics, entities, camera, particles, and all the "feel". Replaces Phaser.

import { Application, Container, Graphics, Sprite, TilingSprite, Text, TextStyle, Texture } from "pixi.js";
import { PHYS, PAL, TILE, VIEW_W, VIEW_H, LEVEL_ROWS, WATER } from "./config";
import { buildLevel, SOLID, G } from "./levels";
import type { LevelData } from "./levels";
import { createTextures } from "./art";
import type { AudioEngine } from "./audio";
import type { Input } from "./input";
import { CMD, EVT } from "./events";
import type { Bridge, GamePhase, HudState } from "./events";

// --- easing (from the animation-principles skill) ---
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;
const easeOutBack = (t: number) => {
  const c1 = 1.70158, c2 = c1 * 1.525;
  return 1 + c2 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// target is any object holding the animated props (Sprite, Point, a scale
// magnitude, a Graphics, etc.). Keys are read/written directly on target.
interface Tween {
  target: any;
  from: Record<string, number>;
  to: Record<string, number>;
  t: number;
  dur: number;
  ease: (x: number) => number;
  onDone?: () => void;
}
interface Mover {
  spr: Sprite; baseX: number; baseY: number; w: number; h: number;
  x: number; y: number; dx: number; dy: number; speed: number;
  vertical: boolean; prog: number; dxF: number; dyF: number;
}
interface Enemy {
  spr: Sprite; kind: "scrub" | "drone"; x: number; y: number; vx: number; vy: number;
  dir: 1 | -1; dead: boolean; deadT: number; baseX: number; baseY: number; hoverT: number;
  active: boolean; turnT: number; walkT: number; bw: number; bh: number; hovering: boolean;
}
interface Item {
  spr: Sprite; kind: "flower" | "cube" | "power"; baseX: number; baseY: number;
  spinT: number; bobT: number; popT: number; taken: boolean;
}
interface Prop { spr: Sprite; kind: "hibiscus" | "firefly"; t: number; baseX: number; baseY: number; }
interface Sway { spr: Sprite; baseX: number; phase: number; amp: number; kick: number; h: number; }
interface Particle { spr: Sprite; vx: number; vy: number; life: number; max: number; }
interface Popup { txt: Text; t: number; dur: number; }
interface SwitchObj { spr: Sprite; gate: Sprite; pressed: boolean; }
interface Bump { col: number; row: number; power: boolean; }

export interface WorldServices { bridge: Bridge; audio: AudioEngine; input: Input; }

export class World {
  private app: Application;
  private tex: Record<string, Texture>;
  private level!: LevelData;
  private bridge: Bridge; private audio: AudioEngine; private inputCtl: Input;

  // containers
  private bg = new Container();
  private worldC = new Container();
  private fx = new Container();
  private heartsLayer = new Container();
  private terrain = new Graphics();
  private sky!: Sprite; private sun!: Sprite; private hills!: TilingSprite; private clouds!: TilingSprite;
  private sorry!: Text;

  // player
  private player!: Sprite;
  private shadow!: Sprite;
  private shadowGroundY = 0;
  private px = 0; private py = 0; private vx = 0; private vy = 0;
  private bw = PHYS.playerW; private bh = PHYS.playerH;
  private flip = false; private scaleMag = { x: 1, y: 1 };
  private runT = 0;
  private blockedD = false; private blockedU = false;

  // entities
  private movers: Mover[] = [];
  private enemies: Enemy[] = [];
  private items: Item[] = [];
  private baseItemCount = 0;
  private props: Prop[] = [];
  private swaying: Sway[] = [];
  private switches: SwitchObj[] = [];
  private riding: Mover | null = null; // platform the player is currently standing on
  private waterRects: { x: number; y: number }[] = [];
  private hazardRects: { x: number; y: number; w: number; h: number }[] = [];
  private checkpoints: { x: number; y: number; flag: Sprite; reached: boolean }[] = [];
  private goalFlag!: Sprite;
  private lilo: Sprite | null = null;
  private winTargetX = 0;
  private projectiles: { spr: Sprite; vx: number; life: number }[] = [];
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private waves: Sprite[] = [];
  private bumps: Bump[] = [];
  // ambient drifting hearts (romance layer, behind the clouds)
  private hearts: { spr: Sprite; vx: number; vy: number; spin: number }[] = [];
  private heartTimer = 0;

  // state
  phase: GamePhase = "title";
  score = 0; flowers = 0;
  love = 0; // romance meter — grows as she/he collects orchids & hearts
  lives = PHYS.startLives;
  timeLeft = PHYS.timeLimit;
  private mega = false; private megaTimer = 0;
  private deathBusy = false;

  // feel
  private prevUp = false; private prevA = false;
  private coyoteT = 0; private jumpBufT = 0; private cutting = false;
  private stompLock = 0; private lastThrow = -10; private invulnT = 0;
  private lastSplash = 0; private runningDustT = 0; private hudT = 0;
  private wasGrounded = false; private onewayGroundT = 0; private fallPeak = 0;
  private lastBumpAt = -10; private checkpoint = { x: 0, y: 0 };
  private windT = 0;

  // camera
  private camX = 0; private camY = 0;
  private shakeT = 0; private shakeDist = 0; private shakeMult = 1;

  private tweens: Tween[] = [];
  private destroyed = false;
  private autoStart: boolean;

  // collision grids
  private collide: boolean[][] = [];
  private solidKey: (string | null)[][] = [];
  private onewayKey: (string | null)[][] = [];
  private bumpUsed: boolean[][] = [];
  private cols = 0; private rows = 0;

  constructor(app: Application, services: WorldServices, autoStart = false) {
    this.app = app;
    this.bridge = services.bridge;
    this.audio = services.audio;
    this.inputCtl = services.input;
    this.autoStart = autoStart;
    this.tex = createTextures();
    this.build();
  }

  // ------------------------------------------------------------ build
  private build() {
    this.level = buildLevel();
    this.cols = this.level.cols;
    this.rows = this.level.rows;
    this.buildCollision();
    this.buildBackground();
    this.buildScenery();
    this.buildMovers();
    this.buildEnemies();
    this.buildItems();
    this.buildFlags();
    this.buildSwitches();
    this.buildWaves();
    this.buildProps();
    this.buildPlayer();
    this.seedBumps();
    this.wireBridge();
    if (this.autoStart) this.start();
  }

  private buildCollision() {
    for (let r = 0; r < this.rows; r++) {
      this.collide.push(new Array(this.cols).fill(false));
      this.solidKey.push(new Array(this.cols).fill(null));
      this.onewayKey.push(new Array(this.cols).fill(null));
      this.bumpUsed.push(new Array(this.cols).fill(false));
      for (let c = 0; c < this.cols; c++) {
        const ch = this.level.grid[r][c];
        switch (ch) {
          case "#": {
            const above = r > 0 ? this.level.grid[r - 1][c] : " ";
            this.collide[r][c] = true;
            this.solidKey[r][c] = SOLID.has(above as string) ? "tile-dirt" : "tile-grass-top";
            break;
          }
          case "1": this.collide[r][c] = true; this.solidKey[r][c] = "tile-sand-top"; break;
          case "H": this.collide[r][c] = true; this.solidKey[r][c] = "tile-stone"; break;
          case "B": this.collide[r][c] = true; this.solidKey[r][c] = "tile-brick"; break;
          case "P":
          case "b":
            this.collide[r][c] = true; this.solidKey[r][c] = "block-bump"; break;
          case "g":
            this.collide[r][c] = true; this.solidKey[r][c] = "tile-goo";
            this.hazardRects.push({ x: c * TILE, y: r * TILE - 20, w: TILE, h: TILE });
            break;
          case "W2":
            this.collide[r][c] = true; this.solidKey[r][c] = "tile-water-0";
            this.waterRects.push({ x: c * TILE, y: r * TILE });
            break;
          case "^":
            this.solidKey[r][c] = "tile-spike";
            this.hazardRects.push({ x: c * TILE, y: r * TILE + 10, w: TILE, h: TILE - 10 });
            break;
          case "W": this.onewayKey[r][c] = "tile-wood"; break;
          case "=": this.onewayKey[r][c] = "tile-stone"; break;
        }
      }
    }
  }

  private solidAt(r: number, c: number) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    return this.collide[r][c];
  }
  private oneWayAt(r: number, c: number) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    return this.onewayKey[r][c] !== null;
  }

  private buildBackground() {
    this.sky = new Sprite(this.tex["bg-sky"]);
    this.sky.width = VIEW_W; this.sky.height = VIEW_H; this.sky.position.set(0, 0);
    this.sun = new Sprite(this.tex["sun"]); this.sun.anchor.set(0.5); this.sun.position.set(VIEW_W - 80, 64);
    this.hills = new TilingSprite(this.tex["hill-layer"], VIEW_W, 90);
    this.hills.anchor.set(0, 1); this.hills.position.set(0, VIEW_H - 18); this.hills.tileScale.set(0.9, 1);
    this.clouds = new TilingSprite(this.tex["cloud"], VIEW_W, 44);
    this.clouds.anchor.set(0, 0); this.clouds.position.set(0, 40); this.clouds.tileScale.set(VIEW_W / 90, 1);
    // "I'M SORRY CUDDLES" — a big, highlighted message that still reads as far
    // background: white fill + a wide soft-pink GLOW (dropShadow with distance
    // 0 and a large blur) makes it "light up" like a distant neon sign, while
    // staying behind the clouds and drifting slowly keeps it clearly *in* the
    // sky rather than plastered on the foreground.
    this.sorry = new Text({
      text: "I'M SORRY\nCUDDLES",
      style: new TextStyle({
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 42,
        lineHeight: 52,
        align: "center",
        fill: 0xffffff, // bright = highlighted
        stroke: { color: 0xff5f93, width: 3 },
        letterSpacing: 2,
        dropShadow: { color: 0xff8fb8, blur: 14, distance: 0, angle: 0, alpha: 0.9 }, // soft halo = glow
      }),
    });
    this.sorry.anchor.set(0.5, 0.5); // center the whole block
    this.sorry.alpha = 0.55;
    this.sorry.position.set(VIEW_W / 2, 120);
    // Child order = render order (Container isn't sortable by default):
    // sky & sun first (behind), then the message, then hills & clouds on top.
    // So "I'M SORRY CUDDLES" sits in the sky, drifting *behind* the clouds.
    this.bg.addChild(this.sky, this.sun, this.sorry, this.hills, this.clouds);
    this.app.stage.addChild(this.bg);
    this.app.stage.addChild(this.worldC);
    this.worldC.addChild(this.terrain, this.heartsLayer, this.fx);
    if (this.level.cave) {
      const cave = new Sprite(this.tex["cave"]);
      cave.anchor.set(0.5, 1); cave.position.set(this.level.cave.x, this.level.cave.y - 88 + 160);
      this.worldC.addChild(cave);
      this.tween(cave, { alpha: 0.55 }, 1500, easeOutCubic, undefined, true);
    }
  }

  private addScenery(cols: number[], key: string, h: number, sway: boolean) {
    for (const c of cols) {
      const spr = new Sprite(this.tex[key]);
      spr.anchor.set(0.5, 1); spr.position.set(c * TILE + TILE / 2, G * TILE + 32);
      this.worldC.addChild(spr);
      if (sway) this.swaying.push({ spr, baseX: c * TILE + TILE / 2, phase: Math.random() * 6.28, amp: 0.035 + (Math.min(h, 140) / 140) * 0.05, kick: 0, h });
    }
  }
  private buildScenery() {
    this.addScenery(this.level.palms, "palm", 128, true);
    this.addScenery(this.level.bushes, "bush", 32, false);
    this.addScenery(this.level.tufts, "tuft", 24, true);
    this.addScenery(this.level.anemones, "anemone", 44, true);
  }

  private buildMovers() {
    for (const m of this.level.movers) {
      const vertical = m.vertical;
      const spr = new Sprite(this.tex[vertical ? "mover-v" : "mover-h"]);
      spr.anchor.set(0, 0); spr.zIndex = 2; spr.position.set(m.x, m.y);
      this.worldC.addChild(spr);
      this.movers.push({
        spr, baseX: m.x, baseY: m.y, w: vertical ? 64 : 96, h: 32,
        x: m.x, y: m.y, dx: m.dx, dy: m.dy, speed: m.speed, vertical, prog: 0, dxF: 0, dyF: 0,
      });
    }
  }

  private enemyKey(e: { kind: "scrub" | "drone"; hovering: boolean }) {
    return e.kind === "scrub" ? "scrub-0" : e.hovering ? "drone-hover" : "drone-ground";
  }
  private makeEnemySprite(e: Enemy): Sprite {
    const spr = new Sprite(this.tex[this.enemyKey(e)]);
    spr.anchor.set(0.5, 1); spr.zIndex = 4; spr.position.set(e.x, e.y);
    this.worldC.addChild(spr);
    return spr;
  }
  private buildEnemies() {
    for (const e of this.level.enemies) {
      const eObj: Enemy = {
        spr: null as unknown as Sprite, kind: e.kind, x: e.x, y: e.y, vx: 0, vy: 0, dir: -1,
        dead: false, deadT: 0, baseX: e.x, baseY: e.y, hoverT: Math.random() * 6,
        active: false, turnT: 2 + Math.random() * 2.5, walkT: 0,
        bw: e.kind === "scrub" ? 22 : 26, bh: e.kind === "scrub" ? 14 : 20,
        hovering: e.kind === "drone" && e.hovering,
      };
      eObj.spr = this.makeEnemySprite(eObj);
      this.enemies.push(eObj);
    }
  }

  private addItem(kind: Item["kind"], frame: string, x: number, y: number) {
    const spr = new Sprite(this.tex[frame]);
    spr.anchor.set(0.5, 0.5); spr.zIndex = 3; spr.position.set(x, y);
    this.worldC.addChild(spr);
    this.items.push({ spr, kind, baseX: x, baseY: y, spinT: Math.random() * 3, bobT: Math.random() * 3, popT: 0, taken: false });
  }
  private buildItems() {
    for (const o of this.level.orchids) this.addItem("flower", "flower-0", o.x, o.y);
    for (const c of this.level.cubes) this.addItem("cube", "cube-0", c.x, c.y);
    for (const p of this.level.powerups) this.addItem("power", "mushroom-0", p.x, p.y);
    this.baseItemCount = this.items.length;
  }

  private buildFlags() {
    for (const cp of this.level.checkpoints) {
      const flag = new Sprite(this.tex["flag-check"]);
      flag.anchor.set(0.5, 0); flag.zIndex = 1; flag.position.set(cp.x, cp.y - 96);
      this.worldC.addChild(flag);
      this.checkpoints.push({ x: cp.x, y: cp.y, flag, reached: false });
    }
    this.goalFlag = new Sprite(this.tex["flag-goal"]);
    this.goalFlag.anchor.set(0.5, 0); this.goalFlag.zIndex = 1;
    this.goalFlag.position.set(this.level.goal.x, this.level.goal.y - 96);
    this.worldC.addChild(this.goalFlag);
  }

  private buildSwitches() {
    for (const s of this.level.switches) {
      const spr = new Sprite(this.tex["switch-idle"]);
      spr.anchor.set(0.5, 1); spr.zIndex = 2; spr.position.set(s.x, s.y);
      this.worldC.addChild(spr);
      const gate = new Sprite(this.tex["gate-closed"]);
      gate.anchor.set(0.5, 1); gate.zIndex = 2;
      gate.position.set(s.x + 2.5 * TILE, s.y + TILE);
      this.worldC.addChild(gate);
      this.switches.push({ spr, gate, pressed: false });
    }
  }

  private buildWaves() {
    for (const w of this.waterRects) {
      const spr = new Sprite(this.tex["tile-water-0"]);
      spr.anchor.set(0, 0); spr.zIndex = 3; spr.alpha = 0.85; spr.position.set(w.x, w.y + 4);
      this.worldC.addChild(spr);
      this.waves.push(spr);
    }
  }

  private buildProps() {
    for (const p of this.level.props) {
      if (p.kind === "hibiscus") {
        const spr = new Sprite(this.tex["prop-hibiscus"]);
        spr.anchor.set(0.5, 1); spr.zIndex = 2; spr.position.set(p.x, p.y);
        this.worldC.addChild(spr);
        this.props.push({ spr, kind: "hibiscus", t: Math.random() * 10, baseX: p.x, baseY: p.y });
      } else {
        const spr = new Sprite(this.tex["prop-firefly"]);
        spr.anchor.set(0.5, 0.5); spr.zIndex = 3; spr.blendMode = "add"; spr.position.set(p.x, p.y);
        this.worldC.addChild(spr);
        this.props.push({ spr, kind: "firefly", t: Math.random() * 10, baseX: p.x, baseY: p.y });
      }
    }
  }

  private buildPlayer() {
    this.player = new Sprite(this.tex["stitch-idle"]);
    this.player.anchor.set(0.5, 1); this.player.zIndex = 6;
    this.player.position.set(this.level.start.x, this.level.start.y);
    this.worldC.addChild(this.player);
    this.shadow = new Sprite(this.tex["player-shadow"]);
    this.shadow.anchor.set(0.5, 0.5); this.shadow.zIndex = 5;
    this.shadow.position.set(this.level.start.x, this.level.start.y + 2);
    this.worldC.addChild(this.shadow);
    this.px = this.level.start.x; this.py = this.level.start.y;
    this.checkpoint = { x: this.px, y: this.py };
    this.shadowGroundY = this.py;
    this.camX = clamp(this.px - VIEW_W / 2, 0, this.cols * TILE - VIEW_W);
    this.camY = clamp(this.py - VIEW_H * 0.6, 0, LEVEL_ROWS * TILE - VIEW_H);
  }

  private seedBumps() {
    this.bumps = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.solidKey[r][c] === "block-bump") {
          this.bumps.push({ col: c, row: r, power: this.level.grid[r][c] === "P" });
          this.bumpUsed[r][c] = false;
        }
  }

  private wireBridge() {
    this.bridge.on(CMD.START, () => this.start());
    this.bridge.on(CMD.PAUSE, () => this.pauseAll());
    this.bridge.on(CMD.RESUME, () => this.resume());
    this.bridge.on(CMD.RESTART, () => this.restart());
    this.bridge.emit(EVT.READY, undefined);
    this.bridge.emit(EVT.PHASE, this.phase);
    this.emitHud();
  }

  // ------------------------------------------------------------ control
  start() {
    if (this.phase === "playing") return;
    this.phase = "playing";
    this.audio.startMusic();
    this.bridge.emit(EVT.PHASE, this.phase);
    this.emitHud();
  }
  pauseAll() {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.audio.stopMusic();
    this.bridge.emit(EVT.PHASE, this.phase);
  }
  resume() {
    if (this.phase !== "paused") return;
    this.phase = "playing";
    this.audio.startMusic();
    this.bridge.emit(EVT.PHASE, this.phase);
  }
  restart() {
    this.resetState();
    this.start();
  }

  private resetState() {
    this.score = 0; this.flowers = 0; this.love = 0; this.lives = PHYS.startLives;
    this.timeLeft = PHYS.timeLimit; this.megaTimer = 0; this.deathBusy = false;
    this.invulnT = 0; this.cutting = false; this.coyoteT = 0; this.jumpBufT = 0; this.stompLock = 0;
    this.lilo = null;
    this.riding = null;
    this.setMega(false, true);
    this.px = this.level.start.x; this.py = this.level.start.y; this.vx = 0; this.vy = 0;
    this.checkpoint = { x: this.px, y: this.py }; this.shadowGroundY = this.py;
    // remove transient items popped from bump blocks during the last run,
    // then restore the base collectibles.
    for (let i = this.items.length - 1; i >= this.baseItemCount; i--) {
      const it = this.items[i];
      if (it.spr && (it.spr as any).position !== null) it.spr.destroy();
      this.items.splice(i, 1);
    }
    for (const it of this.items) {
      it.taken = false; it.popT = 0;
      if (!it.spr || (it.spr as any).position === null) continue; // was destroyed — skip
      it.spr.visible = true;
      it.spr.position.set(it.baseX, it.baseY); it.spr.scale.set(1);
    }
    for (const e of this.enemies) {
      e.dead = false; e.deadT = 0; e.vy = 0;
      e.x = e.baseX; e.y = e.baseY;
      // If the sprite was ever destroyed (PIXI v8 nulls its position/scale),
      // recreate it so we never write to a null again.
      if (!e.spr || (e.spr as any).position === null) e.spr = this.makeEnemySprite(e);
      e.spr.visible = true; e.spr.alpha = 1; e.spr.scale.set(1); e.spr.rotation = 0;
      e.spr.position.set(e.baseX, e.baseY);
      e.spr.texture = this.tex[this.enemyKey(e)];
    }
    for (const cp of this.checkpoints) { cp.reached = false; cp.flag.tint = 0xffffff; }
    for (const s of this.switches) {
      s.pressed = false; s.spr.texture = this.tex["switch-idle"]; s.gate.texture = this.tex["gate-closed"];
      s.gate.position.set(s.spr.position.x + 2.5 * TILE, s.spr.position.y + TILE);
      s.gate.scale.set(1);
    }
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) if (this.bumpUsed[r][c]) this.bumpUsed[r][c] = false;
    for (const p of this.projectiles) p.spr.destroy();
    this.projectiles = [];
    for (const p of this.particles) p.spr.destroy();
    this.particles = [];
    for (const p of this.popups) p.txt.destroy();
    this.popups = [];
    for (const h of this.hearts) h.spr.destroy();
    this.hearts = [];
    this.tweens = [];
    this.player.visible = true; this.player.rotation = 0; this.player.scale.set(1); this.scaleMag.x = 1; this.scaleMag.y = 1;
    this.shadow.visible = true;
    this.phase = "title";
  }

  // ------------------------------------------------------------ tween
  private tween(target: any, to: Record<string, number>, ms: number, ease: (x: number) => number, onDone?: () => void, yoyo = false) {
    const from: Record<string, number> = {};
    for (const k in to) from[k] = target[k];
    this.tweens.push({ target, from, to, t: 0, dur: ms / 1000, ease, onDone });
    if (yoyo) this.tweens.push({ target, from: to, to: from, t: 0, dur: ms / 1000, ease });
  }
  private updateTweens(dt: number) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      const tgt: any = tw.target;
      // In PIXI v8 a destroyed container has a null `.position`, so writing its
      // props throws and would wedge the whole frame loop. Drop any tween whose
      // target was destroyed out-of-band (e.g. a popup Text removed early).
      if (tgt == null || tgt.position === null) {
        this.tweens.splice(i, 1);
        continue;
      }
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      const e = tw.ease(k);
      try {
        for (const p in tw.to) tw.target[p] = tw.from[p] + (tw.to[p] - tw.from[p]) * e;
      } catch {
        this.tweens.splice(i, 1);
        continue;
      }
      if (k >= 1) { this.tweens.splice(i, 1); tw.onDone?.(); }
    }
  }
  private get elapsed() { return this.app.ticker.elapsedMS / 1000; }

  // ------------------------------------------------------------ main loop
  tick(deltaMS: number) {
    if (this.destroyed) return;
    const dt = Math.min(deltaMS, 40) / 1000;
    this.updateTweens(dt);

    // ambient (always alive)
    this.sun.rotation += dt * (Math.PI * 2 / 60);
    this.updateWaves(dt);
    this.updateProps(dt);
    this.updateSwaying(dt);
    this.updateMovers(dt);
    this.updateItems(dt);
    this.updateDeadEnemies(dt);
    this.updateParticles(dt);
    this.updatePopups(dt);
    this.updateHearts(dt);

    if (this.phase !== "playing" || this.deathBusy) {
      if (this.phase === "won") this.updateWin(dt);
      this.render();
      return;
    }

    // timer
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.die(); this.render(); return; }

    // throw (edge, mega only)
    if (this.inputCtl.state.a && !this.prevA && this.mega && this.elapsed - this.lastThrow > 0.24) {
      this.lastThrow = this.elapsed; this.throwBall();
    }
    this.prevA = this.inputCtl.state.a;

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateSwitches();
    this.updateProjectiles(dt);
    this.updateCheckpoints();
    this.updateGoal();

    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.emitHud(); }

    this.render();
  }

  // ------------------------------------------------------------ player
  private updatePlayer(dt: number) {
    const st = this.inputCtl.state;
    this.onewayGroundT = Math.max(0, this.onewayGroundT - dt);
    const onGround = this.blockedD || this.onewayGroundT > 0;
    this.bw = this.mega ? 32 : PHYS.playerW;
    this.bh = this.mega ? 40 : PHYS.playerH;

    let inWater = false;
    for (const w of this.waterRects)
      if (this.px + 11 > w.x && this.px - 11 < w.x + 32 && this.py > w.y - 4 && this.py < w.y + 32) { inWater = true; break; }
    for (const hz of this.hazardRects)
      if (this.px + 8 > hz.x && this.px - 8 < hz.x + hz.w && this.py > hz.y && this.py - this.bh < hz.y + hz.h) {
        this.hurt(this.vx > 0 ? 1 : -1); break;
      }

    // horizontal
    let dir = 0;
    if (st.left && !st.right) dir = -1;
    else if (st.right && !st.left) dir = 1;
    const accel = (onGround ? PHYS.runAccel : PHYS.airAccel) * (inWater ? WATER.slow : 1);
    if (dir !== 0) {
      this.vx = clamp(this.vx + dir * accel * dt, -PHYS.runSpeed, PHYS.runSpeed);
      this.flip = dir === -1;
    } else {
      const drag = (onGround ? PHYS.friction : PHYS.airDrag) * dt;
      if (this.vx > 0) this.vx = Math.max(0, this.vx - drag);
      else if (this.vx < 0) this.vx = Math.min(0, this.vx + drag);
    }
    this.collideX(dt);

    // jump buffer + coyote
    if (st.up && !this.prevUp) this.jumpBufT = PHYS.jumpBuffer;
    if (onGround) { this.coyoteT = PHYS.coyote; this.fallPeak = 0; }
    else if (this.coyoteT > 0) this.coyoteT -= dt;
    if (this.jumpBufT > 0) this.jumpBufT -= dt;
    if (this.jumpBufT > 0 && this.coyoteT > 0 && this.stompLock <= 0) {
      this.doJump(); this.jumpBufT = 0; this.coyoteT = 0;
    }

    // vertical (asymmetric gravity + apex hang)
    let g = this.vy > 0 ? PHYS.fallGravity : PHYS.gravity;
    if (this.vy > -PHYS.apexHangWindow && this.vy < PHYS.apexHangWindow && st.up && !this.cutting) g = PHYS.gravity * PHYS.apexHangCancel;
    this.vy += g * dt;
    if (!st.up && this.vy < 0 && !this.cutting) { this.vy *= PHYS.jumpCutFactor; this.cutting = true; }
    if (st.up && this.vy < 0) this.cutting = false;
    this.prevUp = st.up;
    this.vy = Math.min(this.vy, PHYS.maxFall);

    if (inWater) {
      if (st.up) this.vy = -280;
      this.vy = clamp(this.vy, -320, 150);
      if (this.elapsed - this.lastSplash > 0.14) { this.lastSplash = this.elapsed; this.puff(this.px + 10, this.py - 4, "dot-white", 4); this.audio.sfx("splash"); }
    }

    this.collideY(dt);
    this.applyMovers();
    this.checkStomps();
    if (this.stompLock > 0) this.stompLock -= dt;
    if (this.mega) { this.megaTimer -= dt; if (this.megaTimer <= 0) this.setMega(false, true); }

    if (onGround && Math.abs(this.vx) > 130) {
      this.runningDustT -= dt;
      if (this.runningDustT <= 0) { this.runningDustT = 0.09; this.puff(this.px + (this.vx > 0 ? 4 : 18), this.py, "dot-white", 1); }
    }
    const grounded = this.blockedD;
    if (grounded) {
      if (!this.wasGrounded && this.fallPeak > 340) { this.squash(1.18, 0.72); this.puff(this.px + 8, this.py, "dot-white", 3); }
      this.fallPeak = 0;
    } else if (this.vy > 0) this.fallPeak = Math.max(this.fallPeak, this.vy);
    this.wasGrounded = grounded;

    if (this.invulnT > 0) { this.invulnT -= dt; this.player.alpha = Math.floor(this.elapsed / 0.08) % 2 ? 0.35 : 1; }
    else this.player.alpha = 1;

    this.player.rotation = this.vx !== 0 ? Math.min(1, Math.abs(this.vx) / PHYS.runSpeed) * 0.09 : 0;

    // grounding shadow
    if (grounded) this.shadowGroundY = this.py;
    const airH = Math.max(0, this.shadowGroundY - this.py);
    const sh = clamp(1 - airH / 220, 0.35, 1);
    this.shadow.position.set(this.px, this.shadowGroundY);
    this.shadow.scale.set(sh, sh * 0.85);
    this.shadow.alpha = airH < 4 ? 0.9 : clamp(0.9 - airH / 240, 0.2, 0.9);

    this.setPlayerAnim(dt);
    if (this.py > LEVEL_ROWS * TILE + 40) this.die();
  }

  private collideX(dt: number) {
    this.px += this.vx * dt;
    const hw = this.bw / 2;
    const r0 = Math.floor((this.py - this.bh + 0.01) / TILE);
    const r1 = Math.floor((this.py - 0.01) / TILE);
    if (this.vx > 0) {
      const c = Math.floor((this.px + hw) / TILE);
      for (let r = r0; r <= r1; r++) if (this.solidAt(r, c)) { this.px = c * TILE - hw - 0.01; this.vx = 0; break; }
    } else if (this.vx < 0) {
      const c = Math.floor((this.px - hw) / TILE);
      for (let r = r0; r <= r1; r++) if (this.solidAt(r, c)) { this.px = (c + 1) * TILE + hw + 0.01; this.vx = 0; break; }
    }
  }

  private collideY(dt: number) {
    this.blockedD = false; this.blockedU = false;
    const oldPy = this.py;
    this.py += this.vy * dt;
    const hw = this.bw / 2;
    const c0 = Math.floor((this.px - hw + 0.01) / TILE);
    const c1 = Math.floor((this.px + hw - 0.01) / TILE);
    if (this.vy > 0) {
      const r = Math.floor(this.py / TILE);
      for (let c = c0; c <= c1; c++) if (this.solidAt(r, c)) { this.py = r * TILE; this.vy = 0; this.blockedD = true; break; }
      if (!this.blockedD)
        for (let c = c0; c <= c1; c++) {
          const r2 = Math.floor(this.py / TILE);
          if (this.oneWayAt(r2, c) && oldPy <= r2 * TILE + 1 && this.py > r2 * TILE) {
            this.py = r2 * TILE; this.vy = 0; this.blockedD = true; this.onewayGroundT = 0.12; break;
          }
        }
      // (moving platforms are handled by applyMovers' snap, not here —
      // doing it in both places double-applies and drifts the player off)
    } else if (this.vy < 0) {
      const r = Math.floor((this.py - this.bh) / TILE);
      for (let c = c0; c <= c1; c++) if (this.solidAt(r, c)) { this.py = (r + 1) * TILE + this.bh + 0.01; this.vy = 0; this.blockedU = true; break; }
    }
    this.bumpCheck();
  }

  private bumpCheck() {
    if (this.phase !== "playing" || this.deathBusy) return;
    if (!this.blockedU || this.elapsed - this.lastBumpAt < 0.22) return;
    const topRow = Math.floor((this.py - this.bh) / TILE);
    const cols = [Math.floor((this.px - 4) / TILE), Math.floor((this.px + 4) / TILE)];
    for (const r of [topRow, topRow - 1])
      for (const c of cols) {
        if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) continue;
        if (this.solidKey[r][c] === "block-bump" && !this.bumpUsed[r][c]) {
          this.lastBumpAt = this.elapsed;
          this.bumpUsed[r][c] = true;
          this.solidKey[r][c] = "block-bump-used";
          this.audio.sfx("block");
          this.shake(50, 0.003);
          this.popItem(c * TILE + 16, r * TILE, this.bumps.find((b) => b.col === c && b.row === r)?.power ? "power" : "flower");
          return;
        }
      }
  }

  // Carry the player on a moving platform. "riding" pins us to the platform in
  // BOTH directions (up AND down) each frame, and only releases when we jump
  // off or walk/run off its edges. This is the only place movers move the
  // player, so nothing double-applies.
  private applyMovers() {
    if (this.phase !== "playing" || this.deathBusy) return;

    // release the current platform if we jumped off it or drifted off its edge
    if (this.riding) {
      const r = this.riding;
      const withinX = this.px + 12 > r.x && this.px - 12 < r.x + r.w;
      const nearTop = this.py <= r.y + 6 && this.py >= r.y - 30;
      if (this.vy < -40 || !withinX || !nearTop) this.riding = null;
    }

    // land: pick the topmost platform our feet cross while falling
    if (!this.riding) {
      for (const m of this.movers) {
        const withinX = this.px + 12 > m.x && this.px - 12 < m.x + m.w;
        if (!withinX) continue;
        if (this.vy >= -10 && this.py >= m.y - 2 && this.py < m.y + 30) {
          this.riding = m;
          break;
        }
      }
    }

    if (!this.riding) return;
    const m = this.riding;
    this.px += m.dxF;       // carry horizontally
    this.py = m.y;         // pin feet to the platform top (follows it up & down)
    this.vy = 0;            // riding = grounded
    this.blockedD = true;
    this.onewayGroundT = 0.12;
  }

  private checkStomps() {
    for (const e of this.enemies) {
      if (e.dead || this.deathBusy) continue;
      const hw = this.bw / 2, ew = e.bw / 2;
      const overlapX = this.px + hw > e.x - ew && this.px - hw < e.x + ew;
      const top = this.py - this.bh;
      const overlapY = top < e.y && this.py > e.y - e.bh;
      if (!overlapX || !overlapY) continue;
      const feetOn = this.py - e.y < 24;
      if (this.vy > 40 && feetOn && !e.hovering) {
        this.killEnemy(e, false);
        this.stompLock = 0.14;
        this.vy = this.inputCtl.state.up ? PHYS.stompBounceHold : PHYS.stompBounce;
        this.shake(90, 0.006);
        this.puff(e.x, e.y, e.kind === "drone" ? "dot-red" : "dot-gold", 8);
        this.audio.sfx("stomp");
        const pts = e.kind === "drone" ? 200 : 100;
        this.score += pts;
        this.popup(e.x, e.y - 24, `+${pts}`, "#FFD54A");
        this.emitHud();
      } else if (this.invulnT <= 0) this.hurt(e.dir * -1);
    }
  }

  private doJump() {
    this.vy = this.mega ? PHYS.jumpVel * 1.06 : PHYS.jumpVel;
    this.cutting = false;
    this.squash(0.82, 1.22);
    this.puff(this.px + 12, this.py, "dot-white", 3);
    this.audio.sfx("jump");
  }

  private squash(sx: number, sy: number) {
    this.scaleMag.x = sx;
    this.scaleMag.y = sy;
    this.tween(this.scaleMag, { x: 1, y: 1 }, 160, easeOutCubic);
  }

  private setPlayerAnim(dt: number) {
    const moving = Math.abs(this.vx) > 40;
    let key: string; let runMode = false;
    const prefix = this.mega ? "stitch-mega" : "stitch";
    if (this.deathBusy) key = "stitch-dead";
    else if (this.invulnT > 0) key = "stitch-hurt";
    else if (this.mega) {
      if (this.blockedD || this.onewayGroundT > 0) { key = moving ? prefix + "-run" : prefix + "-idle"; runMode = moving; }
      else key = prefix + "-jump";
    } else {
      if (this.blockedD || this.onewayGroundT > 0) { key = moving ? "stitch-run" : "stitch-idle"; runMode = moving; }
      else key = this.vy < 0 ? "stitch-jump" : "stitch-fall";
    }
    if (runMode) {
      this.runT += dt;
      this.player.texture = this.tex[`${key}-${Math.floor(this.runT * 13) % 4}`];
    } else {
      this.runT = 0;
      this.player.texture = this.tex[key];
    }
  }

  private throwBall() {
    const face = this.flip ? -1 : 1;
    const spr = new Sprite(this.tex["dot-cube"]);
    spr.anchor.set(0.5, 0.5); spr.blendMode = "add"; spr.zIndex = 5;
    spr.position.set(this.px + face * 14, this.py - 22);
    this.worldC.addChild(spr);
    this.projectiles.push({ spr, vx: face * 430, life: 1.1 });
    this.audio.sfx("throw");
  }

  // ------------------------------------------------------------ enemies
  private updateEnemies(dt: number) {
    const camCx = this.camX + VIEW_W / 2;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.active = Math.abs(e.x - camCx) < VIEW_W * 0.8;
      if (!e.active) continue;
      e.hoverT += dt; e.walkT += dt;
      if (e.kind === "scrub") {
        e.vx = e.dir * 42;
        e.spr.texture = this.tex[`scrub-${Math.floor(e.walkT * 8) % 2}`];
        this.stepEnemy(e, dt);
        if ((e as any).onGround) {
          const fx = e.dir > 0 ? e.x + 16 : e.x - 8;
          const col = Math.floor(fx / TILE), row = Math.floor((e.y + 10) / TILE);
          if (!this.solidAt(row + 1, col) && !this.oneWayAt(row + 1, col)) e.dir = (e.dir * -1) as 1 | -1;
        }
      } else {
        e.turnT -= dt;
        if (e.turnT <= 0) { e.turnT = 3 + Math.random() * 2.5; e.dir = (e.dir * -1) as 1 | -1; }
        e.vx = e.dir * 34;
        this.stepEnemy(e, dt);
        if (e.hovering) e.spr.position.y = e.baseY + Math.sin(e.hoverT * 2.2) * 10;
      }
      e.spr.scale.x = e.dir < 0 ? 1 : -1; // textures face left by default
      if (e.spr.position.y > LEVEL_ROWS * TILE + 40) { e.dead = true; e.deadT = 0; e.spr.visible = false; }
    }
  }

  private stepEnemy(e: Enemy, dt: number) {
    (e as any).onGround = false;
    e.x += e.vx * dt;
    const hw = e.bw / 2;
    const r0 = Math.floor((e.y - e.bh + 0.01) / TILE);
    const r1 = Math.floor((e.y - 0.01) / TILE);
    if (e.vx > 0) { const c = Math.floor((e.x + hw) / TILE); for (let r = r0; r <= r1; r++) if (this.solidAt(r, c)) { e.x = c * TILE - hw - 0.01; e.dir = -1 as 1 | -1; break; } }
    else if (e.vx < 0) { const c = Math.floor((e.x - hw) / TILE); for (let r = r0; r <= r1; r++) if (this.solidAt(r, c)) { e.x = (c + 1) * TILE + hw + 0.01; e.dir = 1 as 1 | -1; break; } }
    if (!e.hovering) {
      e.vy = Math.min(e.vy + PHYS.gravity * dt, PHYS.maxFall);
      e.y += e.vy * dt;
      const r = Math.floor(e.y / TILE);
      for (let c = Math.floor((e.x - hw + 0.01) / TILE); c <= Math.floor((e.x + hw - 0.01) / TILE); c++)
        if (this.solidAt(r, c)) { e.y = r * TILE; e.vy = 0; (e as any).onGround = true; break; }
    }
    e.spr.position.set(e.x, e.y);
  }

  private updateDeadEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.dead) continue;
      e.deadT += dt;
      // Hide (never destroy) — a destroyed PIXI sprite's scale/position become
      // null and would crash a later resetState. Hiding keeps the sprite
      // restorable when the run restarts.
      if (e.deadT >= 0.45) {
        e.spr.visible = false;
        continue;
      }
      e.spr.alpha = Math.max(0, 1 - e.deadT * 2.2);
      const s = 1 + e.deadT;
      e.spr.scale.set(s * Math.abs(e.spr.scale.x || 1), Math.max(0.1, 1 - e.deadT * 3));
    }
  }

  private killEnemy(e: Enemy, byBall: boolean) {
    if (e.dead) return;
    e.dead = true; e.deadT = 0;
    this.audio.sfx(byBall ? "squish" : "stomp");
    if (byBall) {
      const pts = e.kind === "drone" ? 200 : 100;
      this.score += pts;
      this.puff(e.x, e.y, "dot-red", 10);
      this.popup(e.x, e.y - 24, `+${pts}`, "#FFD54A");
      this.emitHud();
    }
  }

  // ------------------------------------------------------------ interactives
  private updateMovers(dt: number) {
    for (const m of this.movers) {
      const span = m.vertical ? m.dy : m.dx;
      if (span === 0) { m.dxF = 0; m.dyF = 0; continue; }
      m.prog += m.speed * dt;
      const cycle = m.prog % (2 * span);
      const off = span - Math.abs(cycle - span);
      const nx = m.vertical ? m.baseX : m.baseX + off;
      const ny = m.vertical ? m.baseY + off : m.baseY;
      m.dxF = nx - m.x; m.dyF = ny - m.y;
      m.x = nx; m.y = ny;
      m.spr.position.set(m.x, m.y);
    }
  }

  private updateSwitches() {
    for (const s of this.switches) {
      if (s.pressed) continue;
      if (Math.abs(this.px - s.spr.position.x) < TILE && Math.abs(this.py - s.spr.position.y) < TILE * 1.6) {
        s.pressed = true;
        s.spr.texture = this.tex["switch-pressed"];
        this.audio.sfx("checkpoint");
        this.puff(s.spr.position.x, s.spr.position.y - 24, "dot-gold", 6);
        this.popup(s.spr.position.x, s.spr.position.y - 46, "OPEN!", "#5ADF7B");
        this.tween(s.gate, { y: s.gate.y - 64 }, 520, easeOutCubic, () => { s.gate.texture = this.tex["gate-open"]; });
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.spr.x += p.vx * dt;
      p.spr.rotation += 12 * dt;
      const r = Math.floor(p.spr.y / TILE), c = Math.floor(p.spr.x / TILE);
      let hit = false;
      // enemies
      for (const e of this.enemies) {
        if (e.dead) continue;
        const ew = e.bw / 2;
        if (p.spr.x + 6 > e.x - ew && p.spr.x - 6 < e.x + ew && p.spr.y + 6 > e.y - e.bh && p.spr.y - 6 < e.y) {
          this.killEnemy(e, true); hit = true; break;
        }
      }
      if (this.solidAt(r, c)) {
        if (this.solidKey[r][c] === "block-bump" && !this.bumpUsed[r][c]) {
          this.bumpUsed[r][c] = true; this.solidKey[r][c] = "block-bump-used"; this.audio.sfx("block");
          this.popItem(c * TILE + 16, r * TILE, this.bumps.find((b) => b.col === c && b.row === r)?.power ? "power" : "flower");
        }
        this.puff(p.spr.x, p.spr.y, "dot-cube", 4);
        p.spr.destroy(); this.projectiles.splice(i, 1); continue;
      }
      if (hit) { p.spr.destroy(); this.projectiles.splice(i, 1); continue; }
      if (p.life <= 0 || p.spr.x > this.cols * TILE || p.spr.x < 0) { p.spr.destroy(); this.projectiles.splice(i, 1); }
    }
  }

  private updateCheckpoints() {
    for (const cp of this.checkpoints)
      if (!cp.reached && this.px > cp.x) {
        cp.reached = true;
        this.checkpoint = { x: cp.x, y: this.py };
        cp.flag.tint = 0xffd54a;
        this.audio.sfx("checkpoint");
        this.puff(cp.x, cp.y - 40, "dot-gold", 8);
        this.popup(cp.x, cp.y - 60, "CHECKPOINT", "#FFD54A");
      }
  }

  private updateGoal() {
    if (this.phase !== "playing") return;
    if (this.px > this.level.goal.x) this.win();
  }

  private win() {
    if (this.phase === "won") return;
    this.phase = "won";
    this.audio.sfx("flag"); this.audio.stopMusic();
    this.shake(160, 0.008);
    this.winTargetX = this.level.goal.x + TILE * 2.2;
    this.lilo = new Sprite(this.tex["lilo"]);
    this.lilo.anchor.set(0.5, 1); this.lilo.zIndex = 6;
    this.lilo.position.set(this.winTargetX, this.level.goal.y);
    this.lilo.alpha = 0; this.worldC.addChild(this.lilo);
    this.tween(this.lilo, { alpha: 1 }, 500, easeOutCubic);
    // a shower of hearts — the romantic payoff for making it home
    this.heartBurst(this.winTargetX, this.level.goal.y - 60, 18);
    this.popup(this.px + 20, this.py - 80, "I'M SORRY CUDDLES", PAL.flowerPink);
    this.love = 100;
    this.bridge.emit(EVT.PHASE, this.phase);
    this.emitHud();
  }
  private updateWin(dt: number) {
    this.px += (this.winTargetX - this.px) * 0.1;
    // gentle, continuous hearts + petals rising off the reunion spot
    if (this.lilo && Math.random() < 0.35) {
      const x = this.lilo.x + rand(-60, 60);
      this.puff(x, this.lilo.y - 120 - Math.random() * 60, "dot-petal", 1);
      if (Math.random() < 0.4) this.heartBurst(x, this.lilo.y - 140, 1);
    }
  }

  // ------------------------------------------------------------ damage
  private hurt(dirFrom: number) {
    if (this.invulnT > 0 || this.deathBusy || this.phase !== "playing") return;
    if (this.mega) {
      this.setMega(false);
      this.invulnT = PHYS.invulnTime;
      this.vx = -dirFrom * 360; this.vy = -300;
      this.shake(140, 0.008); this.audio.sfx("hurt");
    } else this.die();
  }

  private die() {
    if (this.deathBusy || this.phase !== "playing") return;
    this.deathBusy = true; this.phase = "dead"; this.lives--;
    this.audio.sfx("die"); this.audio.stopMusic();
    this.vy = -300;
    this.tween(this.player, { rotation: Math.PI * 5 }, 620, easeInCubic, () => this.afterDeath());
    this.bridge.emit(EVT.PHASE, this.phase);
    this.emitHud();
  }

  private afterDeath() {
    if (this.lives <= 0) {
      this.phase = "gameover"; this.deathBusy = false;
      this.player.visible = false; this.shadow.visible = false;
      this.bridge.emit(EVT.PHASE, this.phase); return;
    }
    this.px = this.checkpoint.x; this.py = this.checkpoint.y; this.vx = 0; this.vy = 0;
    this.shadowGroundY = this.py;
    this.riding = null;
    this.setMega(false, true);
    this.invulnT = PHYS.invulnTime; this.cutting = false; this.coyoteT = 0; this.jumpBufT = 0; this.stompLock = 0;
    this.deathBusy = false;
    this.player.visible = true; this.player.rotation = 0; this.player.scale.set(1);
    this.shadow.visible = true;
    this.phase = "playing";
    this.audio.startMusic();
    this.camX = clamp(this.px - VIEW_W / 2, 0, this.cols * TILE - VIEW_W);
    this.camY = clamp(this.py - VIEW_H * 0.6, 0, LEVEL_ROWS * TILE - VIEW_H);
    this.bridge.emit(EVT.PHASE, this.phase);
    this.emitHud();
  }

  private setMega(on: boolean, silent = false) {
    if (this.mega === on && !silent) return;
    this.mega = on; this.megaTimer = on ? 8 : 0;
    if (on) {
      this.player.texture = this.tex["stitch-mega-idle"];
      this.puff(this.px, this.py - 24, "dot-mush", 10);
      if (!silent) this.audio.sfx("powerup");
      this.popup(this.px + 14, this.py - 64, "MEGA!", "#5AE0C0");
    } else this.player.texture = this.tex["stitch-idle"];
    this.emitHud();
  }

  // ------------------------------------------------------------ items
  private updateItems(dt: number) {
    for (const it of this.items) {
      if (it.taken) continue;
      it.spinT += dt; it.bobT += dt;
      if (it.popT > 0) { it.popT -= dt; continue; }
      it.spr.position.set(it.baseX, it.baseY + Math.sin(it.bobT * 3) * 4);
      if (it.kind === "flower") it.spr.texture = this.tex[`flower-${Math.floor(it.spinT * 6) % 3}`];
      else if (it.kind === "cube") it.spr.texture = this.tex[`cube-${Math.floor(it.spinT * 4) % 3}`];
      else it.spr.texture = this.tex[`mushroom-${Math.floor(it.spinT * 5) % 2}`];
      if (Math.abs(it.spr.x - (this.px + 11)) < 24 && Math.abs(it.spr.y - (this.py - 14)) < 30 && this.phase === "playing") this.collectItem(it);
    }
  }

  private collectItem(it: Item) {
    it.taken = true; it.spr.visible = false;
    const x = it.spr.x, y = it.spr.y;
    if (it.kind === "flower") {
      this.flowers++; this.love = Math.min(100, this.love + 10); this.score += 50;
      this.audio.sfx("collect");
      this.heartBurst(x, y, 4);
      this.puff(x, y, "dot-petal", 5); this.popup(x, y - 14, "+50", "#F27BB8");
    } else if (it.kind === "cube") {
      this.lives++; this.love = Math.min(100, this.love + 15); this.score += 500;
      this.audio.sfx("cube");
      this.heartBurst(x, y, 8);
      this.puff(x, y, "dot-cube", 10); this.popup(x, y - 14, "+1UP", "#5AE0C0");
    } else {
      if (this.mega) this.score += 1000;
      this.love = Math.min(100, this.love + 5);
      this.setMega(true);
      this.heartBurst(x, y, 6);
      this.puff(x, y, "dot-mush", 12);
    }
    this.emitHud();
  }

  // a soft burst of little hearts (romance feedback on a good moment)
  private heartBurst(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const spr = new Sprite(this.tex["heart"]);
      spr.anchor.set(0.5, 0.5); spr.blendMode = "add"; spr.zIndex = 8;
      spr.scale.set(0.9);
      spr.position.set(x, y);
      this.fx.addChild(spr);
      const a = Math.random() * Math.PI * 2;
      const sp = rand(60, 150);
      this.particles.push({ spr, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.9, max: 0.9 });
    }
  }

  private popItem(x: number, y: number, kind: "flower" | "power") {
    const frame = kind === "power" ? "mushroom-0" : "flower-0";
    const spr = new Sprite(this.tex[frame]);
    spr.anchor.set(0.5, 0.5); spr.zIndex = 3; spr.position.set(x, y + 24);
    this.worldC.addChild(spr);
    const it: Item = { spr, kind, baseX: x, baseY: y - 26, spinT: 0, bobT: 0, popT: 0.45, taken: false };
    this.items.push(it);
    this.tween(spr, { y: y - 26 }, 420, easeOutBack, () => { it.popT = 0; it.spr.y = it.baseY; });
  }

  // ------------------------------------------------------------ ambient
  private updateWaves(dt: number) {
    for (const w of this.waves) {
      (w as any).wt = ((w as any).wt ?? 0) + dt;
      w.texture = this.tex[(w as any).wt % 0.8 < 0.4 ? "tile-water-0" : "tile-water-1"];
      w.alpha = 0.5 + 0.35 * Math.abs(Math.sin((w as any).wt * 4));
    }
  }

  private updateProps(dt: number) {
    const playing = this.phase === "playing";
    for (const pr of this.props) {
      pr.t += dt;
      if (pr.kind === "hibiscus") {
        const near = playing && Math.abs(this.px - pr.baseX) < 90;
        const lean = near ? clamp((this.px - pr.baseX) / 90, -1, 1) * 16 : 0;
        pr.spr.rotation = (Math.sin(pr.t * 1.6) * 6 + lean) * (Math.PI / 180);
        if (near && this.elapsed - ((pr.spr as any).lastPuff ?? 0) > 0.9) { (pr.spr as any).lastPuff = this.elapsed; this.puff(pr.baseX, pr.baseY - 30, "dot-petal", 3); }
      } else {
        const near = playing && Math.abs(this.px - pr.baseX) < 70;
        const spd = near ? 3.2 : 1.1;
        pr.spr.x = pr.baseX + Math.sin(pr.t * spd) * (near ? 30 : 16);
        pr.spr.y = pr.baseY + Math.cos(pr.t * spd * 0.7) * 10;
        pr.spr.alpha = 0.4 + 0.6 * Math.abs(Math.sin(pr.t * (near ? 6 : 2.5)));
        pr.spr.scale.set(near ? 1.35 : 1);
      }
    }
  }

  private updateSwaying(dt: number) {
    this.windT += dt;
    const gust = Math.sin(this.windT * 0.5) * 0.6 + Math.sin(this.windT * 1.7) * 0.4;
    const playing = this.phase === "playing" && !this.deathBusy;
    for (const s of this.swaying) {
      if (playing && Math.abs(this.px - s.baseX) < 70) s.kick = Math.min(1, s.kick + dt * 6);
      else s.kick = Math.max(0, s.kick - dt * 2.2);
      s.spr.rotation = Math.sin(s.phase + this.windT * 1.2) * s.amp + gust * s.amp * 0.8 + Math.sin(this.windT * 10 + s.phase) * s.kick * 0.06;
    }
  }

  // ambient drifting hearts (romance layer) — gentle, non-interactive.
  // They float in world space near the camera and slowly sink/drift left.
  private updateHearts(dt: number) {
    this.heartTimer -= dt;
    if (this.heartTimer <= 0 && this.hearts.length < 10) {
      this.heartTimer = 0.5 + Math.random() * 0.7;
      const sx = this.camX + Math.random() * VIEW_W;
      const sy = this.camY - 20;
      const spr = new Sprite(this.tex["heart-particle"]);
      spr.anchor.set(0.5, 0.5);
      spr.zIndex = 1; // behind the terrain/character, in the far space
      spr.alpha = 0;
      spr.position.set(sx, sy);
      this.heartsLayer.addChild(spr);
      this.hearts.push({
        spr,
        vx: rand(-14, -6), // drift left as the "wind"
        vy: rand(18, 40),
        spin: rand(-0.6, 0.6),
      });
    }
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.spr.x += h.vx * dt;
      h.spr.y += h.vy * dt;
      h.spr.rotation += h.spin * dt;
      // fade in near the top of the view, fade out near the bottom
      const t = clamp((h.spr.y - this.camY) / VIEW_H, 0, 1);
      h.spr.alpha = Math.min(t * 4, 1, (1 - t) * 4) * 0.7;
      if (h.spr.y > this.camY + VIEW_H + 40 || h.spr.x < this.camX - 60) {
        h.spr.destroy();
        this.hearts.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------ fx
  private puff(x: number, y: number, texKey: string, n: number) {
    if (this.particles.length > 120) return;
    for (let i = 0; i < n; i++) {
      const spr = new Sprite(this.tex[texKey]);
      spr.anchor.set(0.5, 0.5); spr.blendMode = "add"; spr.zIndex = 7; spr.scale.set(1);
      spr.position.set(x, y);
      this.fx.addChild(spr);
      this.particles.push({ spr, vx: rand(-70, 70), vy: rand(-90, 10), life: 0.5, max: 0.5 });
    }
  }
  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { p.spr.destroy(); this.particles.splice(i, 1); continue; }
      p.vy += 130 * dt;
      p.spr.x += p.vx * dt; p.spr.y += p.vy * dt;
      const k = p.life / p.max;
      p.spr.scale.set(k); p.spr.alpha = k;
    }
  }
  private popup(x: number, y: number, text: string, color: string) {
    const style = new TextStyle({
      fontFamily: "'Press Start 2P', monospace",
      fontSize: 9,
      fill: color,
      stroke: { color: "#14243D", width: 3 },
    });
    const t = new Text({ text, style });
    t.anchor.set(0.5); t.zIndex = 8; t.position.set(x, y);
    this.fx.addChild(t);
    this.popups.push({ txt: t, t: 0, dur: 0.85 });
    this.tween(t, { y: y - 30 }, 850, easeOutCubic);
  }
  private updatePopups(dt: number) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.t += dt; p.txt.alpha = Math.max(0, 1 - p.t / p.dur);
      if (p.t >= p.dur) { p.txt.destroy(); this.popups.splice(i, 1); }
    }
  }
  private shake(dist: number, mult: number) { this.shakeDist = dist; this.shakeMult = mult; this.shakeT = 0.3; }

  private emitHud() {
    this.bridge.emit(EVT.HUD, {
      score: this.score, flowers: this.flowers, lives: this.lives,
      love: this.love,
      time: Math.max(0, Math.ceil(this.timeLeft)), mega: this.mega, megaTimer: this.megaTimer,
    } satisfies HudState);
  }

  // ------------------------------------------------------------ render
  private render() {
    const worldW = this.cols * TILE, worldH = LEVEL_ROWS * TILE;
    const desX = clamp(this.px - VIEW_W / 2, 0, worldW - VIEW_W);
    const desY = clamp(this.py - 40 - VIEW_H / 2, 0, worldH - VIEW_H);
    this.camX += (desX - this.camX) * 0.15;
    this.camY += (desY - this.camY) * 0.15;
    if (this.shakeT > 0) {
      this.shakeT -= 1 / 60;
      this.worldC.position.set(-this.camX + (Math.random() - 0.5) * this.shakeDist * this.shakeMult, -this.camY + (Math.random() - 0.5) * this.shakeDist * this.shakeMult);
    } else this.worldC.position.set(-this.camX, -this.camY);
    this.hills.tilePosition.x = -this.camX * 0.28;
    this.clouds.tilePosition.x = -this.camX * 0.18 - (this.app.ticker.elapsedMS % 100000) * 0.004;
    // the far-sky message hovers near the center with a very slow parallax
    // drift + a soft bob, so it reads as distant background (things far away
    // move slowly), not a foreground element. It never jumps — just eases.
    // The glow + high opacity keep it prominent; the slow drift keeps it far.
    this.sorry.position.x = VIEW_W / 2 - this.camX * 0.02;
    this.sorry.position.y = 120 + Math.sin(this.app.ticker.elapsedMS * 0.0004) * 8;
    this.sorry.alpha = 0.55 + Math.sin(this.app.ticker.elapsedMS * 0.0007) * 0.08;

    // terrain (only visible tiles)
    this.terrain.clear();
    const g = this.terrain;
    const c0 = Math.max(0, Math.floor(this.camX / TILE) - 1);
    const c1 = Math.min(this.cols - 1, Math.ceil((this.camX + VIEW_W) / TILE) + 1);
    const r0 = Math.max(0, Math.floor(this.camY / TILE) - 1);
    const r1 = Math.min(this.rows - 1, Math.ceil((this.camY + VIEW_H) / TILE) + 1);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const k = this.solidKey[r][c];
        if (k) g.texture(this.tex[k], 0xffffff, c * TILE, r * TILE, TILE, TILE);
        const ok = this.onewayKey[r][c];
        if (ok) g.texture(this.tex[ok], 0xffffff, c * TILE, r * TILE, TILE, TILE);
      }

    // player sprite transform (feet-anchored, flip, squash magnitude)
    this.player.position.set(this.px, this.py);
    this.player.scale.set((this.flip ? -1 : 1) * this.scaleMag.x, this.scaleMag.y);
  }

  destroy() {
    this.destroyed = true;
    this.worldC.destroy({ children: true });
    this.bg.destroy({ children: true });
  }
}
