// Low-level canvas helpers for drawing crisp, detailed pixel art.

export type G = CanvasRenderingContext2D;

export function cnv(w: number, h: number): [HTMLCanvasElement, G] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}

export function rr(g: G, x: number, y: number, w: number, h: number, r: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  if ((g as any).roundRect) (g as any).roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
  g.fill();
}

export function rrStroke(g: G, x: number, y: number, w: number, h: number, r: number, color: string, lw = 2) {
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.beginPath();
  if ((g as any).roundRect) (g as any).roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
  g.stroke();
}

export function oval(g: G, cx: number, cy: number, rx: number, ry: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

export function poly(g: G, pts: number[][], color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fill();
}

// Draw an image onto a rounded, outlined "sticker" style body.
export function shadow(g: G, cx: number, cy: number, rx: number, ry: number, alpha = 0.18) {
  g.fillStyle = `rgba(20,30,50,${alpha})`;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}
