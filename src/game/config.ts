// Shared constants, tuning and palette for Stitch: Lilo's Island (Phaser).

export const VIEW_W = 800;
export const VIEW_H = 480;
export const TILE = 32;
export const LEVEL_COLS = 176;
export const LEVEL_ROWS = 40;

// Arcade-physics tuning (units: px / s and px / s^2)
export const PHYS = {
  gravity: 2000, // rise gravity (world-wide: enemies + player ascending)
  fallGravity: 3100, // player-only descending gravity — floaty up, snappy down
  runSpeed: 252,
  runAccel: 1650,
  airAccel: 1250,
  friction: 1500,
  airDrag: 140,
  jumpVel: -648, // ~3.3 tile peak
  stompBounce: -500,
  stompBounceHold: -640,
  coyote: 0.11,
  jumpBuffer: 0.13,
  jumpCutFactor: 0.34, // tight variable-height control
  apexHangWindow: 90, // px/s: within this of the apex, a held jump lingers
  apexHangCancel: 0.8, // fraction of gravity cancelled at the apex (weight)
  maxFall: 720,
  playerW: 22,
  playerH: 26,
  megaH: 32,
  invulnTime: 2.4,
  timeLimit: 300,
  startLives: 3,
};

export const WATER = { slow: 0.55 };

// Cohesive original palette
export const PAL = {
  skyTop: "#4FB8EE",
  skyMid: "#8ADCF5",
  skyBottom: "#D9F4FC",
  sun: "#FFE36E",
  sunCore: "#FFF6C9",
  cloud: "#FFFFFF",
  island: "#3E8FA3",
  islandDark: "#2E6E82",
  hill: "#4FBF7F",
  hillDark: "#379E62",
  grassLight: "#7ED85E",
  grassMid: "#55BE45",
  grassDark: "#3D9636",
  dirt: "#B06B3C",
  dirtLight: "#C57F4B",
  dirtDark: "#84502D",
  sand: "#F2D48F",
  sandLight: "#FAE3AC",
  sandDark: "#D3A55E",
  stone: "#98A5B2",
  stoneLight: "#BCC9D6",
  stoneDark: "#5E6B78",
  brick: "#C98A4B",
  brickLight: "#DEA366",
  brickDark: "#8F5B2B",
  power: "#F5B942",
  powerLight: "#FFD27A",
  powerDark: "#B97A22",
  wood: "#9C6A3F",
  woodLight: "#BE8557",
  woodDark: "#6E4526",
  water: "#4CC2E8",
  waterLight: "#8EDDF2",
  waterDeep: "#2A94CC",
  foam: "#EAFBFF",
  goo: "#57C98A",
  gooDark: "#2E8F5F",
  gooLight: "#9BE8BC",
  outline: "#14243D",
  stitchBlue: "#4A9BE8",
  stitchBlueL: "#8CC3F2",
  stitchBlueD: "#2E6FB0",
  stitchEar: "#F3AFC6",
  stitchBelly: "#BFE3F5",
  scrub: "#9A6B45",
  scrubL: "#B5855E",
  scrubD: "#663F23",
  drone: "#A7B4C2",
  droneL: "#C9D4DE",
  droneD: "#5E6B78",
  redLight: "#FF5A5A",
  greenLight: "#5ADF7B",
  mushCap: "#A46BE0",
  mushCapD: "#7A48B8",
  mushSpot: "#FFF4FB",
  cube: "#5AE0C0",
  cubeD: "#1F9E80",
  flowerPink: "#F27BB8",
  flowerPurple: "#9C6BD6",
  flowerCenter: "#FFE66D",
  liloHair: "#4A2E1E",
  liloHairL: "#6B4630",
  liloSkin: "#E8B98A",
  liloSkinD: "#C99A6F",
  liloDress: "#F0624A",
  liloDressD: "#C74632",
  gold: "#FFD54A",
  white: "#FFFFFF",
  black: "#141821",
};

export const ANIM = {
  runFps: 10,
  idleFps: 3,
  scrubFps: 8,
  droneFps: 8,
};
