/** 3D point in EPSG:25832 (easting, northing, height in meters). */
export type Vec3 = [number, number, number];

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
export function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
export function normalize(a: Vec3): Vec3 {
  const l = length(a);
  return l === 0 ? [0, 0, 0] : scale(a, 1 / l);
}

/** Newell's method — robust polygon normal for possibly non-convex rings. */
export function ringNormal(ring: Vec3[]): Vec3 {
  let nx = 0,
    ny = 0,
    nz = 0;
  for (let i = 0; i < ring.length; i++) {
    const c = ring[i];
    const n = ring[(i + 1) % ring.length];
    nx += (c[1] - n[1]) * (c[2] + n[2]);
    ny += (c[2] - n[2]) * (c[0] + n[0]);
    nz += (c[0] - n[0]) * (c[1] + n[1]);
  }
  return [nx, ny, nz];
}

/** True 3D area of a planar ring (half the normal magnitude). */
export function ringArea3D(ring: Vec3[]): number {
  return length(ringNormal(ring)) / 2;
}

/**
 * Tilt from horizontal in degrees (0 = flat roof, 90 = wall) and azimuth of
 * the downslope direction in degrees from north (0=N, 90=E, 180=S, 270=W).
 */
export function tiltAndAzimuth(ring: Vec3[]): { tiltDeg: number; azimuthDeg: number | null } {
  let n = ringNormal(ring);
  if (n[2] < 0) n = scale(n, -1); // ensure upward-facing normal
  const nu = normalize(n);
  const tiltDeg = (Math.acos(Math.min(1, Math.max(-1, nu[2]))) * 180) / Math.PI;
  if (tiltDeg < 5) return { tiltDeg, azimuthDeg: null }; // flat: no meaningful azimuth
  // Horizontal component of the normal points downslope.
  const azimuthDeg = ((Math.atan2(nu[0], nu[1]) * 180) / Math.PI + 360) % 360;
  return { tiltDeg, azimuthDeg };
}

export function azimuthToCompass(azimuthDeg: number | null): string {
  if (azimuthDeg === null) return "FLAT";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  return dirs[Math.round(azimuthDeg / 45) % 8];
}

/** 2D point-in-polygon (ray casting) on the easting/northing plane. */
export function pointInRing2D(x: number, y: number, ring: Vec3[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** 2D point-in-polygon for projected (u,v) coordinates. */
export function pointInPolygon2D(
  x: number,
  y: number,
  poly: Array<[number, number]>
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
