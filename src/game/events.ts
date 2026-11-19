// Shared events + types for the React <-> Phaser bridge.
// Phaser emits to React; React dispatches back via a small dispatcher.

export type GamePhase = "boot" | "title" | "playing" | "paused" | "dead" | "won" | "gameover";

export interface HudState {
  score: number;
  flowers: number;
  lives: number;
  love: number; // romance meter (0-100)
  time: number;
  mega: boolean;
  megaTimer: number; // seconds left in mega form
}

// React -> Phaser
export const CMD = {
  START: "cmd:start",
  RESUME: "cmd:resume",
  PAUSE: "cmd:pause",
  RESTART: "cmd:restart",
} as const;

// Phaser -> React
export const EVT = {
  HUD: "evt:hud",
  PHASE: "evt:phase",
  READY: "evt:ready",
} as const;

export type Events =
  | { type: typeof EVT.HUD; payload: HudState }
  | { type: typeof EVT.PHASE; payload: GamePhase }
  | { type: typeof EVT.READY; payload: undefined };

// A minimal event bus so React and Phaser share one channel without
// importing each other's types.
export class Bridge {
  private handlers: { [k: string]: ((payload: any) => void)[] } = {};
  on(channel: string, fn: (payload: any) => void): () => void {
    (this.handlers[channel] ||= []).push(fn);
    return () => {
      this.handlers[channel] = this.handlers[channel].filter((f) => f !== fn);
    };
  }
  emit(channel: string, payload?: any) {
    (this.handlers[channel] || []).forEach((f) => f(payload));
  }
}

export interface GameConfig {
  width: number;
  height: number;
  parent?: string | HTMLElement;
  bridge: Bridge;
  audio?: import("./audio").AudioEngine;
  input?: import("./input").Input;
}
