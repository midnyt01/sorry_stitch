// Detailed programmatic pixel art, registered as Phaser textures.
// Everything is drawn at native pixel size and shown with nearest-neighbor
// scaling, so it reads as crisp retro pixel art.

import { cnv, rr, rrStroke, oval, poly, G } from "./px";
import { PAL } from "./config";
import { Texture } from "pixi.js";

type Frame = HTMLCanvasElement;

// ===========================================================================
// STITCH — 36 x 48. Big ears, expressive eyes, wide grin, two arms, two feet.
// ===========================================================================
function stitch(
  g: G,
  pose: "idle" | "run0" | "run1" | "run2" | "run3" | "jump" | "fall" | "hurt" | "dead"
) {
  const P = PAL;
  const W = 36;

  // 4-frame run articulation (facing right). Row =
  //   [bodyBob, footLiftL, footDXL, footLiftR, footDXR, earFlop, armSwing]
  // f0 lead foot up + body low, f1 passing + body up, f2 opposite, f3 passing + up.
  const rf = pose === "run0" ? 0 : pose === "run1" ? 1 : pose === "run2" ? 2 : pose === "run3" ? 3 : -1;
  const running = rf >= 0;
  const RUN = [
    [0, 0, -3, 3, 4, 2, -3], // f0
    [-2, 1, 2, 1, -2, 0, 0], // f1
    [0, 3, 4, 0, -3, 2, 3], // f2
    [-2, 1, -2, 1, 2, 0, 0], // f3
  ];
  const bob = running ? RUN[rf][0] : 0;

  // ---- ears (two long ears) ----
  const earW = 9;
  const earTop = pose === "jump" || pose === "fall" ? 0 : 2 + bob;
  const flop = running ? RUN[rf][5] : 0;
  for (const side of [0, 1] as const) {
    const ex = side === 0 ? 4 : W - 4 - earW;
    const tilt = side === 0 ? -flop * 0.4 : flop * 0.4;
    g.save();
    g.translate(ex + earW / 2, earTop + 4);
    g.rotate(tilt * (Math.PI / 180));
    rr(g, -earW / 2, -earTop - 4, earW, 20, 4, P.stitchBlue);
    rr(g, -earW / 2 + 2, -earTop - 2, earW - 4, 16, 3, P.stitchEar);
    rr(g, earW / 2 - 3, -earTop - 4, 3, 20, 2, P.stitchBlueD);
    g.restore();
  }

  // ---- head / body blob (bobs up/down over the run cycle) ----
  const bodyTop = 14 + bob;
  rr(g, 3, bodyTop, W - 6, 26, 11, P.stitchBlue);
  // top light
  rr(g, 5, bodyTop + 2, W - 10, 9, 6, P.stitchBlueL);
  // belly patch
  rr(g, 9, bodyTop + 15, W - 18, 11, 5, P.stitchBelly);
  // outline
  rrStroke(g, 3, bodyTop, W - 6, 26, 11, P.outline, 1.5);

  // ---- eyes (two big) ----
  const eyeY = bodyTop + 8;
  for (const ex of [10, 20]) {
    oval(g, ex + 2, eyeY, 4.2, 4.8, P.white);
    if (pose === "hurt" || pose === "dead") {
      // closed eyes
      g.strokeStyle = P.black;
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(ex + 2, eyeY + 1, 2.4, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
    } else {
      const look = running ? 1 : 0;
      const py = pose === "fall" ? 1.5 : 0.6;
      oval(g, ex + 2 + look, eyeY + py, 1.9, 2.3, P.black);
      oval(g, ex + 1.4 + look, eyeY - 1, 0.8, 0.8, P.white);
    }
  }

  // ---- nose ----
  oval(g, 17, bodyTop + 11.5, 2.6, 2, P.stitchBlueD);

  // ---- mouth (grin) ----
  const my = bodyTop + 13.5;
  g.strokeStyle = P.black;
  g.lineWidth = 1.6;
  g.beginPath();
  if (pose === "hurt") g.arc(17, my + 3, 3.5, 1.15 * Math.PI, 1.85 * Math.PI); // frown
  else if (pose === "fall" || pose === "dead") g.ellipse(17, my + 1.5, 3, 3.6, 0, 0, 7); // open
  else g.moveTo(8, my), g.quadraticCurveTo(17, my + 4.5, 26, my);
  g.stroke();
  // tongue
  if (pose !== "hurt") {
    poly(g, [[13, my + 1.5], [21, my + 1.5], [17, my + 4]], P.stitchEar);
  }

  // ---- arms (counter-swing with the legs; raised when airborne) ----
  const armY = bodyTop + 20;
  const up = pose === "jump" ? -6 : 0;
  const armSw = running ? RUN[rf][6] : 0;
  for (const side of [0, 1] as const) {
    const ax = side === 0 ? 0 : W - 6;
    const oy = up + (side === 1 ? armSw : -armSw);
    rr(g, ax, armY + oy, 7, 10, 3.5, P.stitchBlue);
    rr(g, ax + 2, armY + oy, 3, 8, 2, P.stitchBlueD);
    rrStroke(g, ax, armY + oy, 7, 10, 3.5, P.outline, 1);
  }

  // ---- feet (each foot lifts and reaches forward on its stride frame) ----
  const fy = bodyTop + 26;
  const flL = running ? RUN[rf][1] : 0;
  const dxL = running ? RUN[rf][2] : 0;
  const flR = running ? RUN[rf][3] : 0;
  const dxR = running ? RUN[rf][4] : 0;
  for (const [fxBase, fl, dx] of [
    [9, flL, dxL],
    [18, flR, dxR],
  ] as [number, number, number][]) {
    const fxp = fxBase + 3 + dx;
    oval(g, fxp, fy + 4 - fl, 6, 4, P.stitchBlue);
    oval(g, fxp, fy + 3 - fl, 6, 3, P.stitchBlueD);
    rrStroke(g, fxBase - 1 + dx, fy + 1 - fl, 10, 6, 3, P.outline, 1);
  }
}

function stitchCanvas(pose: Parameters<typeof stitch>[1]): Frame {
  const [c, g] = cnv(36, 48);
  stitch(g, pose);
  return c;
}

function stitchMegaCanvas(pose: "idle" | "run0" | "run1" | "run2" | "run3" | "jump"): Frame {
  const [c, g] = cnv(40, 52);
  g.save();
  g.translate(2, 2);
  stitch(g, pose);
  g.restore();
  // powered-up aura
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    oval(g, 20 + Math.cos(a) * 16, 26 + Math.sin(a) * 20, 2, 2, "rgba(120,220,255,0.5)");
  }
  g.globalCompositeOperation = "source-over";
  return c;
}

// ===========================================================================
// SCRUB — 28 x 28. Grumpy brown blob, 2 walk frames.
// ===========================================================================
function scrub(g: G, f: number) {
  const P = PAL;
  const bob = f % 2 ? 1 : 0;
  rr(g, 4, 9 + bob, 20, 14, 7, P.scrub);
  rr(g, 5, 10 + bob, 18, 5, 3, P.scrubD);
  oval(g, 7, 12 + bob, 4, 3, P.scrubL); // highlight
  // feet
  const s1 = f % 2 ? -1 : 1;
  oval(g, 9, 23, 4, 2.5, P.scrubD);
  oval(g, 19, 23 + s1 * 0.5, 4, 2.5, P.scrubD);
  // brows
  g.strokeStyle = P.black;
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(8, 13 + bob);
  g.lineTo(13, 15 + bob);
  g.moveTo(20, 13 + bob);
  g.lineTo(15, 15 + bob);
  g.stroke();
  // eyes
  oval(g, 10, 16 + bob, 2, 2.3, P.black);
  oval(g, 18, 16 + bob, 2, 2.3, P.black);
  oval(g, 10.5, 15.4 + bob, 0.7, 0.7, P.white);
  oval(g, 18.5, 15.4 + bob, 0.7, 0.7, P.white);
  // frown
  g.strokeStyle = P.black;
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(14, 21 + bob, 3, 1.15 * Math.PI, 1.85 * Math.PI);
  g.stroke();
}
function scrubCanvas(f: number): Frame {
  const [c, g] = cnv(28, 28);
  scrub(g, f);
  return c;
}

// ===========================================================================
// DRONE — 32 x 32. Jumba's hover robot with a single big eye.
// ===========================================================================
function drone(g: G, hovering: boolean) {
  const P = PAL;
  // top fin
  poly(g, [[13, 10], [19, 10], [16, 3]], P.droneD);
  // body
  rr(g, 5, 10, 22, 16, 7, P.drone);
  rr(g, 7, 12, 18, 4, 3, P.droneL);
  rrStroke(g, 5, 10, 22, 16, 7, P.outline, 1.4);
  // eye
  oval(g, 16, 18, 6.5, 6.5, P.black);
  oval(g, 16, 18, 4.5, 4.5, P.redLight);
  oval(g, 14, 16, 1.4, 1.4, P.white);
  // rivets
  g.fillStyle = P.droneD;
  g.fillRect(6, 22, 2, 2);
  g.fillRect(24, 22, 2, 2);
  // bottom: thruster glow (hover) or wheels (ground)
  if (hovering) {
    g.globalCompositeOperation = "lighter";
    oval(g, 9, 27, 3, 4, P.cube);
    oval(g, 23, 27, 3, 4, P.cube);
    g.globalCompositeOperation = "source-over";
  } else {
    oval(g, 9, 27, 3.5, 3.5, P.black);
    oval(g, 23, 27, 3.5, 3.5, P.black);
  }
}
function droneCanvas(hovering: boolean): Frame {
  const [c, g] = cnv(32, 32);
  drone(g, hovering);
  return c;
}

// ===========================================================================
// LILO — 120 x 150, arms up for a hug.
// ===========================================================================
function lilo(g: G) {
  const P = PAL;
  const cx = 60;
  // back hair
  g.fillStyle = P.liloHair;
  g.beginPath();
  g.ellipse(cx, 62, 34, 40, 0, 0, 7);
  g.fill();
  poly(g, [[cx - 30, 60], [cx - 40, 120], [cx - 18, 100]], P.liloHair);
  poly(g, [[cx + 30, 60], [cx + 40, 120], [cx + 18, 100]], P.liloHair);
  // face
  oval(g, cx, 66, 26, 28, P.liloSkin);
  oval(g, cx - 8, 56, 12, 6, P.liloSkin);
  // front hair fringe
  g.fillStyle = P.liloHairL;
  poly(g, [[cx - 24, 52], [cx + 24, 52], [cx + 18, 64], [cx - 18, 64]], P.liloHairL);
  // closed happy eyes
  g.strokeStyle = P.black;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx - 10, 66, 4, 0, Math.PI);
  g.arc(cx + 10, 66, 4, 0, Math.PI);
  g.stroke();
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(cx - 14, 65);
  g.lineTo(cx - 16, 62);
  g.moveTo(cx + 14, 65);
  g.lineTo(cx + 16, 62);
  g.stroke();
  // blush + smile
  oval(g, cx - 15, 73, 4, 2.5, "rgba(240,120,120,0.5)");
  oval(g, cx + 15, 73, 4, 2.5, "rgba(240,120,120,0.5)");
  g.strokeStyle = P.black;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, 74, 9, 0.1 * Math.PI, 0.9 * Math.PI);
  g.stroke();
  // dress
  poly(g, [[cx - 18, 92], [cx + 18, 92], [cx + 26, 150], [cx - 26, 150]], P.liloDress);
  poly(g, [[cx - 18, 92], [cx + 18, 92], [cx + 16, 104], [cx - 16, 104]], P.liloDressD);
  rrStroke(g, cx - 18, 92, 36, 4, 2, P.outline, 1);
  // lei
  for (let i = 0; i < 6; i++) oval(g, cx - 14 + i * 5.6, 96, 3, 3, i % 2 ? P.flowerPink : P.gold);
  // arms reaching up
  g.fillStyle = P.liloSkin;
  g.beginPath();
  g.ellipse(cx - 22, 96, 7, 15, -0.35, 0, 7);
  g.ellipse(cx + 22, 96, 7, 15, 0.35, 0, 7);
  g.fill();
}
function liloCanvas(): Frame {
  const [c, g] = cnv(120, 150);
  lilo(g);
  return c;
}

// ===========================================================================
// ITEMS
// ===========================================================================
function flower(g: G, rot: number) {
  const P = PAL;
  g.save();
  g.translate(12, 12);
  g.rotate(rot);
  for (let i = 0; i < 5; i++) {
    g.rotate((Math.PI * 2) / 5);
    oval(g, 0, -6, 3.6, 5.5, P.flowerPink);
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.beginPath();
    g.ellipse(0, -7, 1.6, 2.4, 0, 0, 7);
    g.fill();
  }
  g.fillStyle = P.flowerCenter;
  g.beginPath();
  g.arc(0, 0, 3.2, 0, 7);
  g.fill();
  g.restore();
}
function flowerCanvas(rot: number): Frame {
  const [c, g] = cnv(24, 24);
  flower(g, rot);
  return c;
}

function cube(g: G, rot: number) {
  const P = PAL;
  g.save();
  g.translate(12, 12);
  g.rotate(rot);
  rr(g, -8, -8, 16, 16, 4, P.cube);
  rr(g, -6, -6, 12, 12, 3, P.cubeD);
  rrStroke(g, -8, -8, 16, 16, 4, P.outline, 1.5);
  g.fillStyle = P.white;
  g.font = "bold 9px monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("626", 0, 0);
  g.restore();
}
function cubeCanvas(rot: number): Frame {
  const [c, g] = cnv(24, 24);
  cube(g, rot);
  return c;
}

function mushroom(g: G, f: number) {
  const P = PAL;
  const bob = f % 2 ? 1 : 0;
  // stem
  rr(g, 8, 14 + bob, 10, 10, 3, "#F4E8C8");
  g.fillStyle = P.black;
  g.fillRect(10, 19 + bob, 1.5, 3);
  g.fillRect(15, 19 + bob, 1.5, 3);
  // cap
  oval(g, 13, 12 + bob, 12, 10, P.mushCap);
  oval(g, 13, 9 + bob, 12, 7, P.mushCapD);
  g.fillStyle = P.mushSpot;
  g.beginPath();
  g.arc(6, 10 + bob, 2.4, 0, 7);
  g.arc(19, 10 + bob, 2.4, 0, 7);
  g.arc(13, 14 + bob, 2, 0, 7);
  g.arc(13, 5 + bob, 1.6, 0, 7);
  g.fill();
}
function mushroomCanvas(f: number): Frame {
  const [c, g] = cnv(26, 26);
  mushroom(g, f);
  return c;
}

// ===========================================================================
// TILES (32 x 32)
// ===========================================================================
function dirtFace(g: G, sand = false) {
  const P = PAL;
  g.fillStyle = sand ? P.sand : P.dirt;
  g.fillRect(0, 0, 32, 32);
  // speckles
  for (let i = 0; i < 10; i++) {
    g.fillStyle = sand ? P.sandDark : P.dirtDark;
    g.globalAlpha = 0.5;
    g.fillRect(((i * 13) % 28) + 2, ((i * 9) % 28) + 2, 4, 3);
    g.globalAlpha = 1;
  }
}
function grassTopCanvas(): Frame {
  const [c, g] = cnv(32, 32);
  dirtFace(g);
  const P = PAL;
  g.fillStyle = P.grassMid;
  g.fillRect(0, 0, 32, 12);
  g.fillStyle = P.grassLight;
  g.fillRect(0, 0, 32, 7);
  // grass blades
  g.fillStyle = P.grassLight;
  for (let x = 1; x < 32; x += 6) g.fillRect(x, 7, 3, 4);
  g.fillStyle = P.grassDark;
  for (let x = 4; x < 32; x += 8) g.fillRect(x, 11, 2, 3);
  // top rim light
  g.fillStyle = "rgba(255,255,255,0.25)";
  g.fillRect(0, 0, 32, 2);
  return c;
}
function dirtSideCanvas(): Frame {
  const [c, g] = cnv(32, 32);
  dirtFace(g);
  g.fillStyle = PAL.dirtDark;
  g.fillRect(0, 0, 32, 3);
  g.fillRect(30, 0, 2, 32);
  return c;
}
function sandTopCanvas(): Frame {
  const [c, g] = cnv(32, 32);
  dirtFace(g, true);
  g.fillStyle = PAL.sandLight;
  g.fillRect(0, 0, 32, 6);
  g.fillStyle = "rgba(255,255,255,0.3)";
  g.fillRect(0, 0, 32, 2);
  return c;
}
function brickCanvas(): Frame {
  const [c, g] = cnv(32, 32);
  const P = PAL;
  g.fillStyle = P.brick;
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = P.brickLight;
  g.fillRect(0, 0, 32, 4);
  g.fillStyle = P.brickDark;
  g.fillRect(0, 28, 32, 4);
  g.fillStyle = "rgba(0,0,0,0.2)";
  g.fillRect(0, 10, 32, 2);
  g.fillRect(0, 21, 32, 2);
  g.fillRect(10, 3, 2, 7);
  g.fillRect(22, 12, 2, 9);
  g.fillRect(8, 23, 2, 7);
  rrStroke(g, 0, 0, 32, 32, 0, P.outline, 1.5);
  return c;
}
function powerCanvas(): Frame {
  const [c, g] = cnv(32, 32);
  const P = PAL;
  g.fillStyle = P.power;
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = P.powerLight;
  g.fillRect(0, 0, 32, 5);
  g.fillStyle = P.powerDark;
  g.fillRect(0, 27, 32, 5);
  g.fillStyle = P.white;
  g.fillRect(4, 4, 3, 3);
  // rivets
  g.fillStyle = P.powerDark;
  g.fillRect(3, 25, 4, 4);
  g.fillRect(25, 3, 4, 4);
  // "?" glow center
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.font = "bold 12px monospace";
  g.textAlign = "center";
  g.fillText("?", 16, 22);
  rrStroke(g, 0, 0, 32, 32, 0, P.outline, 1.5);
  return c;
}
function woodCanvas(): Frame {
  const [c, g] = cnv(32, 32);
  const P = PAL;
  g.clearRect(0, 0, 32, 32);
  rr(g, 0, 8, 32, 14, 3, P.wood);
  g.fillStyle = P.woodLight;
  g.fillRect(2, 10, 28, 3);
  g.fillStyle = P.woodDark;
  g.fillRect(0, 20, 32, 2);
  // nails
  g.fillStyle = P.black;
  g.fillRect(4, 13, 2, 2);
  g.fillRect(26, 13, 2, 2);
  return c;
}
function stoneCanvas(): Frame {
  const [c, g] = cnv(32, 32);
  const P = PAL;
  g.fillStyle = P.stone;
  g.fillRect(0, 4, 32, 28);
  g.fillStyle = P.stoneLight;
  g.fillRect(0, 4, 32, 3);
  g.fillStyle = P.stoneDark;
  g.fillRect(0, 29, 32, 3);
  g.fillRect(29, 7, 3, 22);
  g.fillStyle = "rgba(255,255,255,0.2)";
  g.fillRect(3, 8, 26, 2);
  rrStroke(g, 0, 4, 32, 28, 3, P.outline, 1);
  return c;
}
function waterCanvas(f: number): Frame {
  const [c, g] = cnv(32, 32);
  const P = PAL;
  g.clearRect(0, 0, 32, 32);
  g.fillStyle = P.water;
  g.fillRect(0, 8, 32, 24);
  g.fillStyle = P.waterDeep;
  g.fillRect(0, 16, 32, 16);
  // animated surface
  g.fillStyle = P.foam;
  const shift = f % 2 ? 0 : 4;
  for (let x = -4; x < 36; x += 8) g.fillRect(x + shift, 8, 5, 3);
  g.fillStyle = "rgba(255,255,255,0.35)";
  for (let x = 2; x < 32; x += 10) g.fillRect(x, 20 + f * 2, 6, 1);
  return c;
}
function spikeCanvas(): Frame {
  const [c, g] = cnv(32, 32);
  const P = PAL;
  g.fillStyle = P.stoneDark;
  g.fillRect(0, 26, 32, 6);
  for (let i = 0; i < 4; i++) {
    const x = (32 / 4) * i;
    poly(g, [[x + 1, 26], [x + 7, 26], [x + 4, 12]], P.stone);
    poly(g, [[x + 1, 26], [x + 4, 26], [x + 4, 16]], P.stoneDark);
  }
  return c;
}
function gooCanvas(): Frame {
  const [c, g] = cnv(32, 32);
  const P = PAL;
  g.fillStyle = P.gooDark;
  g.fillRect(0, 10, 32, 22);
  g.fillStyle = P.goo;
  g.beginPath();
  g.moveTo(0, 32);
  g.lineTo(0, 14);
  for (let x = 0; x <= 32; x += 8) g.quadraticCurveTo(x + 4, 6, x + 8, 14);
  g.lineTo(32, 32);
  g.fill();
  g.fillStyle = P.gooLight;
  g.beginPath();
  g.arc(8, 20, 2, 0, 7);
  g.arc(22, 17, 1.6, 0, 7);
  g.arc(27, 24, 2.2, 0, 7);
  g.fill();
  return c;
}

// bump block ("?" popper) and its broken variant
function bumpBlockCanvas(state: "intact" | "used"): Frame {
  const [c, g] = cnv(32, 32);
  const P = PAL;
  if (state === "intact") {
    g.fillStyle = P.power;
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = P.powerLight;
    g.fillRect(0, 0, 32, 5);
    g.fillStyle = P.powerDark;
    g.fillRect(0, 27, 32, 5);
    g.fillStyle = P.white;
    g.font = "bold 16px monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("?", 16, 18);
    rrStroke(g, 0, 0, 32, 32, 0, P.outline, 1.5);
  } else {
    g.fillStyle = P.brickDark;
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(0, 0, 32, 3);
    g.fillRect(0, 29, 32, 3);
    rrStroke(g, 0, 0, 32, 32, 0, P.outline, 1.5);
  }
  return c;
}

// gate + switch
function gateCanvas(open: boolean): Frame {
  const [c, g] = cnv(32, 64);
  const P = PAL;
  g.clearRect(0, 0, 32, 64);
  if (open) {
    g.globalAlpha = 0.25;
    g.fillStyle = P.cube;
    g.fillRect(14, 8, 4, 48);
    g.globalAlpha = 1;
    return c;
  }
  rr(g, 10, 4, 12, 56, 4, P.stoneDark);
  rr(g, 12, 6, 8, 52, 3, P.stone);
  // Jumba hazard stripes
  g.fillStyle = P.gold;
  for (let i = 0; i < 6; i++) g.fillRect(12, 10 + i * 10, 8, 5);
  rrStroke(g, 10, 4, 12, 56, 4, P.outline, 1.5);
  return c;
}
function switchCanvas(pressed: boolean): Frame {
  const [c, g] = cnv(32, 32);
  const P = PAL;
  const dy = pressed ? 3 : 0;
  // base
  rr(g, 6, 24, 20, 6, 2, P.stoneDark);
  // stem
  g.fillStyle = P.stone;
  g.fillRect(14, 12 + dy, 4, 12);
  // button
  oval(g, 16, 12 + dy, 7, 5, pressed ? P.redLight : P.greenLight);
  oval(g, 13, 10 + dy, 3, 2, "rgba(255,255,255,0.5)");
  rrStroke(g, 9, 7 + dy, 14, 10, 5, P.outline, 1.5);
  return c;
}

// prop: swaying hibiscus plant
function hibiscusCanvas(): Frame {
  const [c, g] = cnv(32, 44);
  const P = PAL;
  g.strokeStyle = P.grassDark;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(16, 44);
  g.quadraticCurveTo(14, 28, 16, 18);
  g.stroke();
  // leaves
  g.fillStyle = P.grassMid;
  g.beginPath();
  g.ellipse(12, 36, 5, 3, -0.6, 0, 7);
  g.ellipse(20, 34, 5, 3, 0.6, 0, 7);
  g.fill();
  flower(g, 0.3);
  return c;
}

// firefly (glow dot)
function fireflyCanvas(): Frame {
  const [c, g] = cnv(16, 16);
  g.globalCompositeOperation = "lighter";
  oval(g, 8, 8, 7, 7, "rgba(255,240,150,0.15)");
  oval(g, 8, 8, 3, 3, "rgba(255,240,150,0.6)");
  oval(g, 8, 8, 1.5, 1.5, "#FFF7CC");
  g.globalCompositeOperation = "source-over";
  return c;
}

// palm, bush, tuft, anemone, cave, flags
function palmCanvas(): Frame {
  const [c, g] = cnv(96, 128);
  const P = PAL;
  // trunk
  g.strokeStyle = P.wood;
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(48, 126);
  g.quadraticCurveTo(54, 70, 44, 30);
  g.stroke();
  g.strokeStyle = P.woodDark;
  g.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(40 + i, 110 - i * 15);
    g.lineTo(58 - i, 110 - i * 15);
    g.stroke();
  }
  // fronds
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.5;
    g.save();
    g.translate(44, 30);
    g.rotate(a);
    poly(g, [[0, 0], [42, 6], [38, -3], [0, -3]], i % 2 ? P.grassDark : P.grassMid);
    poly(g, [[0, 0], [40, 3], [38, -1], [0, -1]], P.grassLight);
    g.restore();
  }
  // coconuts
  g.fillStyle = P.woodDark;
  g.beginPath();
  g.arc(40, 35, 4, 0, 7);
  g.arc(50, 36, 4, 0, 7);
  g.fill();
  return c;
}
function bushCanvas(): Frame {
  const [c, g] = cnv(40, 32);
  const P = PAL;
  oval(g, 12, 22, 12, 10, P.grassDark);
  oval(g, 28, 22, 12, 10, P.grassMid);
  oval(g, 20, 16, 13, 10, P.grassMid);
  oval(g, 14, 12, 6, 4, P.grassLight);
  for (const [fx, fy] of [[12, 14], [30, 12], [20, 20]] as const) {
    for (let i = 0; i < 5; i++) {
      g.save();
      g.translate(fx, fy);
      g.rotate((i / 5) * Math.PI * 2);
      oval(g, 0, -3, 1.8, 3, P.flowerPink);
      g.restore();
    }
    oval(g, fx, fy, 1.5, 1.5, P.gold);
  }
  return c;
}
function tuftCanvas(): Frame {
  const [c, g] = cnv(28, 24);
  g.strokeStyle = PAL.grassDark;
  g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const x = 3 + i * 4;
    g.beginPath();
    g.moveTo(x, 22);
    g.quadraticCurveTo(x + (i % 2 ? 3 : -3), 12, x + (i % 2 ? 4 : -2), 6 + (i % 3) * 2);
    g.stroke();
  }
  g.strokeStyle = PAL.grassLight;
  for (let i = 0; i < 3; i++) {
    const x = 5 + i * 8;
    g.beginPath();
    g.moveTo(x, 22);
    g.lineTo(x, 10 + i * 2);
    g.stroke();
  }
  return c;
}
function anemoneCanvas(): Frame {
  const [c, g] = cnv(40, 44);
  const P = PAL;
  g.strokeStyle = P.stitchBlueL;
  g.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const x = 8 + i * 3.2;
    g.beginPath();
    g.moveTo(x, 42);
    g.lineTo(x + (i % 2 ? 4 : -4), 24);
    g.stroke();
    oval(g, x + (i % 2 ? 4 : -4), 22, 2.5, 2.5, P.flowerPurple);
  }
  oval(g, 20, 42, 18, 5, P.stoneDark);
  return c;
}
function caveCanvas(): Frame {
  const [c, g] = cnv(160, 160);
  const P = PAL;
  g.fillStyle = P.stoneDark;
  g.beginPath();
  g.arc(80, 128, 80, Math.PI, 0);
  g.fill();
  g.fillStyle = P.stone;
  g.beginPath();
  g.arc(80, 128, 66, Math.PI, 0);
  g.fill();
  g.fillStyle = P.stoneLight;
  g.beginPath();
  g.arc(80, 128, 66, Math.PI * 1.15, Math.PI * 1.4);
  g.fill();
  // cave mouth
  g.fillStyle = P.black;
  g.beginPath();
  g.arc(80, 126, 42, Math.PI, 0);
  g.fill();
  // glow inside
  g.globalCompositeOperation = "lighter";
  g.fillStyle = "rgba(90,224,192,0.25)";
  g.beginPath();
  g.arc(80, 122, 30, Math.PI, 0);
  g.fill();
  g.globalCompositeOperation = "source-over";
  // sign
  g.fillStyle = P.cubeD;
  g.fillRect(54, 150, 52, 10);
  g.fillStyle = P.white;
  g.font = "bold 9px monospace";
  g.textAlign = "center";
  g.fillText("LAB 626", 80, 158);
  return c;
}
function flagCanvas(goal: boolean): Frame {
  const [c, g] = cnv(40, 128);
  const P = PAL;
  g.fillStyle = "#D8D8D8";
  g.fillRect(18, 4, 4, 124);
  g.fillStyle = P.gold;
  g.beginPath();
  g.arc(20, 3, 4, 0, 7);
  g.fill();
  const fy = 6;
  g.fillStyle = goal ? P.flowerPink : P.white;
  poly(g, [[22, fy], [22, fy + 26], [44, fy + 13]], goal ? P.flowerPink : P.white);
  g.fillStyle = goal ? P.gold : P.stitchBlue;
  g.beginPath();
  g.arc(30, fy + 13, 4, 0, 7);
  g.fill();
  return c;
}

// parallax background layers (drawn onto wide canvases, tiled)
function cloudCanvas(): Frame {
  const [c, g] = cnv(90, 44);
  g.fillStyle = PAL.cloud;
  oval(g, 24, 24, 18, 13, PAL.cloud);
  oval(g, 48, 18, 22, 15, PAL.cloud);
  oval(g, 70, 26, 16, 12, PAL.cloud);
  g.fillStyle = "rgba(180,220,240,0.5)";
  oval(g, 48, 30, 30, 8, "rgba(180,220,240,0.5)");
  return c;
}
function sunCanvas(): Frame {
  const [c, g] = cnv(72, 72);
  g.fillStyle = PAL.sun;
  g.beginPath();
  g.arc(36, 36, 22, 0, 7);
  g.fill();
  g.fillStyle = PAL.sunCore;
  g.beginPath();
  g.arc(29, 29, 9, 0, 7);
  g.fill();
  return c;
}
function islandCanvas(): Frame {
  const [c, g] = cnv(240, 120);
  g.fillStyle = PAL.island;
  g.beginPath();
  g.arc(60, 120, 60, Math.PI, 0);
  g.arc(150, 120, 90, Math.PI, 0);
  g.fill();
  g.fillStyle = PAL.islandDark;
  g.beginPath();
  g.arc(150, 120, 90, Math.PI * 0.9, Math.PI * 1.2);
  g.fill();
  return c;
}
function hillLayerCanvas(): Frame {
  const [c, g] = cnv(240, 90);
  g.fillStyle = PAL.hill;
  g.beginPath();
  g.arc(50, 90, 55, Math.PI, 0);
  g.arc(150, 90, 75, Math.PI, 0);
  g.fill();
  g.fillStyle = PAL.hillDark;
  g.beginPath();
  g.arc(190, 90, 40, Math.PI, 0);
  g.fill();
  return c;
}

// parallax + engine extras
function skyCanvas(): Frame {
  const [c, g] = cnv(100, 240);
  const grad = g.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, PAL.skyTop);
  grad.addColorStop(0.55, PAL.skyMid);
  grad.addColorStop(1, PAL.skyBottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 100, 240);
  return c;
}
function moverHCanvas(): Frame {
  const [c, g] = cnv(96, 32);
  const P = PAL;
  rr(g, 0, 6, 96, 20, 6, P.stone);
  g.fillStyle = P.stoneLight;
  g.fillRect(4, 8, 88, 4);
  g.fillStyle = P.stoneDark;
  g.fillRect(0, 22, 96, 4);
  // Jumba's hazard stripe on the edges
  g.fillStyle = P.gold;
  g.fillRect(4, 12, 6, 10);
  g.fillRect(86, 12, 6, 10);
  rrStroke(g, 0, 6, 96, 20, 6, P.outline, 1.5);
  return c;
}
function moverVCanvas(): Frame {
  const [c, g] = cnv(64, 32);
  const P = PAL;
  rr(g, 0, 6, 64, 20, 6, P.stone);
  g.fillStyle = P.stoneLight;
  g.fillRect(4, 8, 56, 4);
  g.fillStyle = P.stoneDark;
  g.fillRect(0, 22, 64, 4);
  g.fillStyle = P.gold;
  g.fillRect(4, 12, 6, 10);
  g.fillRect(54, 12, 6, 10);
  rrStroke(g, 0, 6, 64, 20, 6, P.outline, 1.5);
  return c;
}
// a small glossy pixel heart (romance item + celebration particles)
function heartCanvas(): Frame {
  const [c, g] = cnv(14, 14);
  const P = PAL;
  const pink = P.flowerPink;
  const dark = "#c8557f";
  const hi = "#ffd0e6";
  // two lobes + point, drawn as overlapping circles/triangles
  g.fillStyle = pink;
  g.beginPath();
  g.arc(4, 5, 3.2, 0, 7);
  g.arc(10, 5, 3.2, 0, 7);
  g.fill();
  poly(g, [[1.2, 7], [12.8, 7], [7, 12.5]], pink);
  // soft outline
  g.strokeStyle = dark;
  g.lineWidth = 1;
  g.beginPath();
  g.arc(4, 5, 3.2, 0, 7);
  g.arc(10, 5, 3.2, 0, 7);
  g.stroke();
  // highlight
  g.fillStyle = hi;
  g.beginPath();
  g.arc(3.4, 4.2, 1.2, 0, 7);
  g.fill();
  return c;
}
// soft grounding shadow (dark radial ellipse) — sits under the player on the
// ground and scales/fades as they rise into the air
function shadowCanvas(): Frame {
  const w = 32, h = 12;
  const [c, g] = cnv(w, h);
  const grad = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
  grad.addColorStop(0, "rgba(10,20,40,0.55)");
  grad.addColorStop(0.7, "rgba(10,20,40,0.28)");
  grad.addColorStop(1, "rgba(10,20,40,0)");
  g.fillStyle = grad;
  g.save();
  g.translate(w / 2, h / 2);
  g.scale(1, 0.5);
  g.beginPath();
  g.arc(0, 0, w / 2, 0, 7);
  g.fill();
  g.restore();
  return c;
}
function dot(color: string, r: number, soft = true): Frame {
  const s = r * 4;
  const [c, g] = cnv(s, s);
  g.globalCompositeOperation = "lighter";
  if (soft) {
    g.fillStyle = "rgba(255,255,255,0.15)";
    g.beginPath();
    g.arc(r * 2, r * 2, r * 2, 0, 7);
    g.fill();
  }
  g.fillStyle = color;
  g.beginPath();
  g.arc(r * 2, r * 2, r, 0, 7);
  g.fill();
  return c;
}

// ===========================================================================
// Registration
// ===========================================================================
export interface ArtKeys {
  // stitch
  "stitch-idle": Frame;
  "stitch-run-0": Frame;
  "stitch-run-1": Frame;
  "stitch-run-2": Frame;
  "stitch-run-3": Frame;
  "stitch-jump": Frame;
  "stitch-fall": Frame;
  "stitch-hurt": Frame;
  "stitch-dead": Frame;
  // mega
  "stitch-mega-idle": Frame;
  "stitch-mega-run-0": Frame;
  "stitch-mega-run-1": Frame;
  "stitch-mega-run-2": Frame;
  "stitch-mega-run-3": Frame;
  "stitch-mega-jump": Frame;
  // enemies
  "scrub-0": Frame;
  "scrub-1": Frame;
  "drone-hover": Frame;
  "drone-ground": Frame;
  // lilo
  lilo: Frame;
  // items
  "flower-0": Frame;
  "flower-1": Frame;
  "flower-2": Frame;
  "cube-0": Frame;
  "cube-1": Frame;
  "cube-2": Frame;
  "mushroom-0": Frame;
  "mushroom-1": Frame;
  // tiles
  "tile-grass-top": Frame;
  "tile-dirt": Frame;
  "tile-sand-top": Frame;
  "tile-brick": Frame;
  "tile-power": Frame;
  "tile-wood": Frame;
  "tile-stone": Frame;
  "tile-water-0": Frame;
  "tile-water-1": Frame;
  "tile-spike": Frame;
  "tile-goo": Frame;
  "block-bump": Frame;
  "block-bump-used": Frame;
  "gate-closed": Frame;
  "gate-open": Frame;
  "switch-idle": Frame;
  "switch-pressed": Frame;
  "prop-hibiscus": Frame;
  "prop-firefly": Frame;
  // world
  palm: Frame;
  bush: Frame;
  tuft: Frame;
  anemone: Frame;
  cave: Frame;
  "flag-goal": Frame;
  "flag-check": Frame;
  cloud: Frame;
  sun: Frame;
  island: Frame;
  "hill-layer": Frame;
}

export function artFrames(): ArtKeys {
  return {
    "stitch-idle": stitchCanvas("idle"),
    "stitch-run-0": stitchCanvas("run0"),
    "stitch-run-1": stitchCanvas("run1"),
    "stitch-run-2": stitchCanvas("run2"),
    "stitch-run-3": stitchCanvas("run3"),
    "stitch-jump": stitchCanvas("jump"),
    "stitch-fall": stitchCanvas("fall"),
    "stitch-hurt": stitchCanvas("hurt"),
    "stitch-dead": stitchCanvas("dead"),
    "stitch-mega-idle": stitchMegaCanvas("idle"),
    "stitch-mega-run-0": stitchMegaCanvas("run0"),
    "stitch-mega-run-1": stitchMegaCanvas("run1"),
    "stitch-mega-run-2": stitchMegaCanvas("run2"),
    "stitch-mega-run-3": stitchMegaCanvas("run3"),
    "stitch-mega-jump": stitchMegaCanvas("jump"),
    "scrub-0": scrubCanvas(0),
    "scrub-1": scrubCanvas(1),
    "drone-hover": droneCanvas(true),
    "drone-ground": droneCanvas(false),
    lilo: liloCanvas(),
    "flower-0": flowerCanvas(0),
    "flower-1": flowerCanvas(0.6),
    "flower-2": flowerCanvas(1.2),
    "cube-0": cubeCanvas(0),
    "cube-1": cubeCanvas(0.4),
    "cube-2": cubeCanvas(0.8),
    "mushroom-0": mushroomCanvas(0),
    "mushroom-1": mushroomCanvas(1),
    "tile-grass-top": grassTopCanvas(),
    "tile-dirt": dirtSideCanvas(),
    "tile-sand-top": sandTopCanvas(),
    "tile-brick": brickCanvas(),
    "tile-power": powerCanvas(),
    "tile-wood": woodCanvas(),
    "tile-stone": stoneCanvas(),
    "tile-water-0": waterCanvas(0),
    "tile-water-1": waterCanvas(1),
    "tile-spike": spikeCanvas(),
    "tile-goo": gooCanvas(),
    "block-bump": bumpBlockCanvas("intact"),
    "block-bump-used": bumpBlockCanvas("used"),
    "gate-closed": gateCanvas(false),
    "gate-open": gateCanvas(true),
    "switch-idle": switchCanvas(false),
    "switch-pressed": switchCanvas(true),
    "prop-hibiscus": hibiscusCanvas(),
    "prop-firefly": fireflyCanvas(),
    palm: palmCanvas(),
    bush: bushCanvas(),
    tuft: tuftCanvas(),
    anemone: anemoneCanvas(),
    cave: caveCanvas(),
    "flag-goal": flagCanvas(true),
    "flag-check": flagCanvas(false),
    cloud: cloudCanvas(),
    sun: sunCanvas(),
    island: islandCanvas(),
    "hill-layer": hillLayerCanvas(),
  };
}

// Build a PIXI texture map from every drawn frame + engine extras.
// The game cycles frames itself (see world.ts setPlayerAnim / item spin),
// so no PIXI animations are needed — just the raw textures.
export function createTextures(): Record<string, Texture> {
  const frames = artFrames();
  const out: Record<string, Texture> = {};
  const put = (k: string, img: HTMLCanvasElement) => {
    out[k] = Texture.from(img as any);
  };
  for (const [k, img] of Object.entries(frames)) put(k, img);
  const extras: [string, HTMLCanvasElement][] = [
    ["bg-sky", skyCanvas()],
    ["mover-h", moverHCanvas()],
    ["mover-v", moverVCanvas()],
    ["dot-white", dot("#FFFFFF", 2)],
    ["dot-petal", dot(PAL.flowerPink, 2)],
    ["dot-gold", dot(PAL.gold, 2)],
    ["dot-cube", dot(PAL.cube, 3)],
    ["dot-red", dot(PAL.redLight, 3)],
    ["dot-mush", dot(PAL.mushCap, 3)],
    ["heart", heartCanvas()],
    ["heart-particle", heartCanvas()],
    ["player-shadow", shadowCanvas()],
  ];
  for (const [k, img] of extras) put(k, img);
  return out;
}

// A single canvas (idle stitch + a few tiles) for the reference sheet.
export function sheetCanvas(): HTMLCanvasElement {
  const f = artFrames();
  const [c, g] = cnv(400, 200);
  g.imageSmoothingEnabled = false;
  g.drawImage(f["stitch-idle"], 10, 10);
  g.drawImage(f["scrub-0"], 60, 20);
  g.drawImage(f["drone-hover"], 100, 20);
  g.drawImage(f["tile-grass-top"], 140, 20);
  g.drawImage(f["block-bump"], 172, 20);
  g.drawImage(f["prop-hibiscus"], 210, 30);
  return c;
}

