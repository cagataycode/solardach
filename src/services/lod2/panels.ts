import type { Vec3 } from "./geometry";
import {
  add,
  cross,
  dot,
  normalize,
  pointInPolygon2D,
  ringNormal,
  scale,
  sub,
  tiltAndAzimuth,
} from "./geometry";

/** Standard residential module, ~430 Wp. */
export const PANEL = {
  longM: 1.722,
  shortM: 1.134,
  kwp: 0.43,
  gapM: 0.02,
  edgeMarginM: 0.35,
};

export interface PanelRect {
  /** 4 corners in EPSG:25832 3D coordinates. */
  corners: [Vec3, Vec3, Vec3, Vec3];
}

/**
 * Fill a planar roof polygon with a regular panel grid. The polygon is
 * projected onto an in-plane (u, v) basis (u along the ridge, v up-slope),
 * a grid is fitted in 2D, and accepted rectangles are mapped back to 3D.
 * Tries portrait and landscape, returns whichever fits more panels.
 */
export function layoutPanels(ring: Vec3[]): PanelRect[] {
  if (ring.length < 3) return [];
  const { tiltDeg } = tiltAndAzimuth(ring);
  if (tiltDeg > 75) return []; // effectively a wall

  let n = ringNormal(ring);
  if (n[2] < 0) n = scale(n, -1);
  const w = normalize(n);

  // In-plane basis: u horizontal (ridge direction), v up-slope.
  // Flat roofs have no ridge — align the grid with the longest roof edge
  // instead of east-west, otherwise rotated buildings get diagonal layouts.
  let u: Vec3;
  if (tiltDeg < 5) {
    u = longestEdgeDirection(ring);
  } else {
    u = normalize(cross([0, 0, 1], w));
  }
  const v = normalize(cross(w, u));

  const origin = ring[0];
  const poly2d: Array<[number, number]> = ring.map((p) => {
    const d = sub(p, origin);
    return [dot(d, u), dot(d, v)];
  });

  const portrait = fitGrid(poly2d, PANEL.shortM, PANEL.longM);
  const landscape = fitGrid(poly2d, PANEL.longM, PANEL.shortM);
  const best = portrait.length >= landscape.length ? portrait : landscape;

  return best.map(([x0, y0, x1, y1]) => ({
    corners: [
      to3d(x0, y0, origin, u, v),
      to3d(x1, y0, origin, u, v),
      to3d(x1, y1, origin, u, v),
      to3d(x0, y1, origin, u, v),
    ],
  }));
}

function to3d(x: number, y: number, origin: Vec3, u: Vec3, v: Vec3): Vec3 {
  return add(origin, add(scale(u, x), scale(v, y)));
}

/** Horizontal direction of the longest polygon edge (for flat-roof grids). */
function longestEdgeDirection(ring: Vec3[]): Vec3 {
  let best: Vec3 = [1, 0, 0];
  let bestLen = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len > bestLen) {
      bestLen = len;
      best = [dx / len, dy / len, 0];
    }
  }
  return best;
}

/** Returns accepted rects as [x0, y0, x1, y1] in plane coordinates. */
function fitGrid(
  poly: Array<[number, number]>,
  panelW: number,
  panelH: number
): Array<[number, number, number, number]> {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const minX = Math.min(...xs) + PANEL.edgeMarginM;
  const maxX = Math.max(...xs) - PANEL.edgeMarginM;
  const minY = Math.min(...ys) + PANEL.edgeMarginM;
  const maxY = Math.max(...ys) - PANEL.edgeMarginM;

  const stepX = panelW + PANEL.gapM;
  const stepY = panelH + PANEL.gapM;
  const rects: Array<[number, number, number, number]> = [];

  for (let y = minY; y + panelH <= maxY; y += stepY) {
    for (let x = minX; x + panelW <= maxX; x += stepX) {
      const corners: Array<[number, number]> = [
        [x, y],
        [x + panelW, y],
        [x + panelW, y + panelH],
        [x, y + panelH],
        [x + panelW / 2, y + panelH / 2],
      ];
      // Margin-aware acceptance: every corner + center must be inside.
      if (corners.every(([cx, cy]) => pointInPolygon2D(cx, cy, poly))) {
        rects.push([x, y, x + panelW, y + panelH]);
      }
    }
  }
  return rects;
}
