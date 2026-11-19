// Level design for "Lilo's Island" — 176 columns, 5 themed zones, with
// interactive systems: bump blocks, moving platforms, a switch+gate, and
// reactive props (swaying hibiscus, fireflies).

import { TILE, LEVEL_COLS, LEVEL_ROWS } from "./config";

export const G = 30; // surface row

// Tile codes
//  ' '  empty        '#'  grass block (solid)
//  '1'  sand block   'H'  solid stone/hard block
//  'B'  brick        'P'  power bump (solid, pops a power-up)
//  'b'  flower bump (solid, pops a flower)
//  'W'  wood one-way '='  stone one-way
//  '^'  spikes (hazard)   'g'  goo (solid + harmful)
//  'W2' shallow water (solid + slows)
//  'L'  checkpoint  'G'  goal  'X'  cave marker
//  'T'  switch      'E'  gate  'p'  hibiscus prop  'f'  firefly
//  'S'  scrub       'D'  drone 'o'  orchid  'C'  cube  'M'  mushroom

export interface Mover {
  x: number;
  y: number;
  dx: number; // travel distance px
  dy: number;
  speed: number; // px/s
  vertical: boolean;
}

export interface Prop {
  x: number;
  y: number;
  kind: "hibiscus" | "firefly";
}

export interface LevelData {
  cols: number;
  rows: number;
  grid: string[][]; // [row][col]
  start: { x: number; y: number };
  movers: Mover[];
  switches: { x: number; y: number }[];
  gates: { x: number; y: number }[];
  props: Prop[];
  enemies: { kind: "scrub" | "drone"; x: number; y: number; hovering: boolean }[];
  orchids: { x: number; y: number }[];
  cubes: { x: number; y: number }[];
  powerups: { x: number; y: number }[];
  checkpoints: { x: number; y: number }[];
  goal: { x: number; y: number };
  cave: { x: number; y: number } | null;
  palms: number[];
  bushes: number[];
  tufts: number[];
  anemones: number[];
}

export const SOLID = new Set(["#", "1", "H", "B", "P", "b", "g", "W2"]);
export const ONEWAY = new Set(["W", "="]);
export const HAZARD = new Set(["^", "g"]);

export function buildLevel(): LevelData {
  const cols = LEVEL_COLS;
  const grid: string[][] = Array.from({ length: LEVEL_ROWS }, () =>
    Array.from({ length: cols }, () => " ")
  );

  const fill = (a: number, b: number, fromRow = G, toRow = LEVEL_ROWS - 1, t = "#") => {
    for (let c = a; c <= b; c++)
      for (let r = fromRow; r <= toRow; r++) if (r >= 0 && r < LEVEL_ROWS) grid[r][c] = t;
  };
  const set = (c: number, r: number, t: string) => {
    if (r >= 0 && r < LEVEL_ROWS && c >= 0 && c < cols) grid[r][c] = t;
  };
  const row = (c0: number, c1: number, r: number, t: string) => {
    for (let c = c0; c <= c1; c++) set(c, r, t);
  };
  const pit = (a: number, b: number) => {
    for (let c = a; c <= b; c++) for (let r = G; r < LEVEL_ROWS; r++) grid[r][c] = " ";
    row(a, b, LEVEL_ROWS - 1, "^");
  };
  const goo = (a: number, b: number) => row(a, b, G, "g");
  const orch = (cs: number[], r: number) => cs.forEach((c) => set(c, r, "o"));
  const scrub = (c: number) => set(c, G - 1, "S");
  const drone = (c: number, r = G - 4) => set(c, r, "D");
  const hibiscus = (cs: number[]) => cs.forEach((c) => set(c, G - 1, "p"));
  const firefly = (cs: number[], r = G - 3) => cs.forEach((c) => set(c, r, "f"));
  const palm = (cs: number[]) => cs.forEach((c) => palms.push(c));
  const bush = (cs: number[]) => cs.forEach((c) => bushes.push(c));
  const tuft = (cs: number[]) => cs.forEach((c) => tufts.push(c));
  const anem = (cs: number[]) => cs.forEach((c) => anemones.push(c));

  const movers: Mover[] = [];
  const switches: { x: number; y: number }[] = [];
  const gates: { x: number; y: number }[] = [];
  const props: Prop[] = [];
  const enemies: LevelData["enemies"] = [];
  const orchids: LevelData["orchids"] = [];
  const cubes: LevelData["cubes"] = [];
  const powerups: LevelData["powerups"] = [];
  const checkpoints: LevelData["checkpoints"] = [];
  let cave: LevelData["cave"] = null;
  let goal = { x: 164 * TILE, y: G * TILE };

  const palms: number[] = [];
  const bushes: number[] = [];
  const tufts: number[] = [];
  const anemones: number[] = [];

  // =====================================================================
  // ZONE A — GRASSLAND INTRO (0-33)
  // =====================================================================
  fill(0, 33);
  bush([2, 5, 7, 12, 14]);
  tuft([3, 6, 8, 10, 13, 15]);
  palm([1, 20]);
  hibiscus([4, 9]);
  orch([5, 6, 7, 10, 11], G - 1);
  scrub(13);
  pit(17, 19);
  pit(23, 28);
  row(24, 25, G - 3, "B");
  orch([24, 25], G - 4);
  row(26, 27, G - 5, "W");
  orch([26, 27], G - 6);
  set(31, G - 3, "b");
  set(32, G - 3, "P"); // power bump

  // =====================================================================
  // ZONE B — HILLS (34-64)
  // =====================================================================
  fill(34, 64);
  tuft([35, 38, 41, 44, 48]);
  bush([36, 40, 45]);
  palm([37, 46]);
  fill(38, 41, G - 2, G - 2);
  fill(42, 43, G - 3, G - 1);
  orch([39, 40, 41], G - 3);
  orch([42, 43], G - 4);
  set(48, G, "L"); // checkpoint
  pit(51, 54);
  // moving plank over the pit (kept low + slow so it's reachable and rideable)
  movers.push({ x: 49 * TILE, y: (G - 3) * TILE, dx: 5 * TILE, dy: 0, speed: 44, vertical: false });
  orch([52, 53], G - 4);
  scrub(56);
  drone(58, G - 5);
  fill(60, 63, G - 2, G - 2);
  orch([61, 62], G - 3);
  tuft([62]);

  // =====================================================================
  // ZONE C — JUMBA'S LAB CAVE (65-97)
  // =====================================================================
  fill(65, 97, G, LEVEL_ROWS - 1, "H");
  cave = { x: 68 * TILE, y: G * TILE };
  set(68, G, "X");
  tuft([66, 72]);
  row(67, 69, G - 3, "=");
  row(72, 74, G - 6, "=");
  row(77, 79, G - 9, "=");
  orch([68, 73, 78], G - 2);
  cubes.push({ x: 73 * TILE + TILE / 2, y: (G - 7) * TILE + TILE / 2 });
  drone(75, G - 8);
  goo(76, 79); // 4 wide — crossable; 5+ was effectively an uncrossable wall
  row(74, 75, G - 4, "W");
  row(82, 84, G - 3, "=");
  orch([82, 83], G - 4);
  set(85, G - 5, "P"); // power bump on the ledge
  cubes.push({ x: 85 * TILE + TILE / 2, y: (G - 6) * TILE + TILE / 2 });
  drone(87, G - 5);
  scrub(90);
  // switch + gate: press the switch to open Jumba's sealed door
  set(92, G - 1, "T");
  set(95, G - 1, "E");
  // fireflies drift through the cave mouth
  firefly([70, 82, 90], G - 4);

  // =====================================================================
  // ZONE D — BEACH (98-133)
  // =====================================================================
  fill(98, 133, G, LEVEL_ROWS - 1, "1");
  row(102, 104, G, "W2");
  row(118, 120, G, "W2");
  anem([101, 116, 128, 131]);
  palm([99, 112, 125, 132]);
  tuft([105, 110, 122, 127]);
  // wide gap crossed by a moving plank (kept low + slow so it's rideable and
  // reachable from the water shore — a full jump reaches ~3 tiles)
  pit(105, 111);
  movers.push({ x: 103 * TILE, y: (G - 3) * TILE, dx: 6 * TILE, dy: 0, speed: 44, vertical: false });
  powerups.push({ x: 113 * TILE + TILE / 2, y: (G - 2) * TILE + TILE / 2 });
  // raised sand ledge — 3-tall so it's a jumpable step (a 6-tall block is an
  // impassable wall). The vertical elevator stays as an OPTIONAL bonus to a
  // high cube, not the only way through.
  fill(125, 129, G - 3, G - 1, "1");
  orch([126, 128], G - 4);
  cubes.push({ x: 127 * TILE + TILE / 2, y: (G - 7) * TILE + TILE / 2 });
  movers.push({ x: 127 * TILE, y: (G - 7) * TILE, dx: 0, dy: 4 * TILE, speed: 45, vertical: true });
  drone(121, G - 4);
  scrub(129);
  orch([126, 127], G - 1);
  set(131, G - 2, "M");
  // glowing water: fireflies shimmer over the pools
  firefly([103, 119], G - 3);

  // =====================================================================
  // ZONE E — FINAL STRETCH + GOAL (134-169)
  // =====================================================================
  fill(134, 169, G, LEVEL_ROWS - 1, "1");
  palm([136, 145, 155, 165]);
  tuft([138, 142, 150, 158, 162]);
  bush([140, 152]);
  hibiscus([142, 158]);
  pit(140, 143);
  row(141, 142, G - 4, "W");
  orch([141, 142], G - 5);
  scrub(148);
  drone(152, G - 5);
  fill(155, 158, G - 2, G - 2, "1");
  orch([156, 157], G - 3);
  set(160, G - 3, "b");
  set(161, G - 3, "b");
  set(164, G, "G"); // goal
  fill(166, cols - 1, G, LEVEL_ROWS - 1, "H"); // end wall

  // =====================================================================
  // Scan grid for runtime spawn lists
  // =====================================================================
  for (let r = 0; r < LEVEL_ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c];
      const cx = c * TILE + TILE / 2;
      const cy = r * TILE + TILE / 2;
      switch (t) {
        case "S":
          enemies.push({ kind: "scrub", x: c * TILE + 2, y: r * TILE + 4, hovering: false });
          grid[r][c] = " ";
          break;
        case "D":
          enemies.push({ kind: "drone", x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, hovering: true });
          grid[r][c] = " ";
          break;
        case "o":
          orchids.push({ x: cx, y: cy });
          grid[r][c] = " ";
          break;
        case "C":
          cubes.push({ x: cx, y: cy });
          grid[r][c] = " ";
          break;
        case "M":
          powerups.push({ x: cx, y: cy });
          grid[r][c] = " ";
          break;
        case "L":
          checkpoints.push({ x: cx, y: r * TILE });
          break;
        case "G":
          goal = { x: cx, y: r * TILE };
          break;
        case "X":
          grid[r][c] = " ";
          break;
        case "T":
          switches.push({ x: cx, y: r * TILE });
          grid[r][c] = " ";
          break;
        case "E":
          gates.push({ x: cx, y: r * TILE });
          grid[r][c] = " ";
          break;
        case "p":
          props.push({ x: cx, y: r * TILE, kind: "hibiscus" });
          grid[r][c] = " ";
          break;
        case "f":
          props.push({ x: cx, y: cy, kind: "firefly" });
          grid[r][c] = " ";
          break;
      }
    }
  }

  return {
    cols,
    rows: LEVEL_ROWS,
    grid,
    start: { x: 3 * TILE + TILE / 2, y: (G - 1) * TILE },
    movers,
    switches,
    gates,
    props,
    enemies,
    orchids,
    cubes,
    powerups,
    checkpoints,
    goal,
    cave,
    palms,
    bushes,
    tufts,
    anemones,
  };
}
