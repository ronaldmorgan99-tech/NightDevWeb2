/**
 * Pure math for the Servers page synthwave background: a rolling "dune" terrain under a
 * perspective camera. Kept free of DOM/canvas code so it can be unit tested.
 */

export type GridView = {
  /** Canvas width in CSS px. */
  width: number;
  /** Canvas height in CSS px. */
  height: number;
  /** Y (CSS px, inside the canvas) of the vanishing horizon. */
  horizon: number;
};

/** Camera height above the floor, in world units. */
export const CAMERA_HEIGHT = 1;
/** Nearest and farthest grid rows, in world units in front of the camera. */
export const Z_NEAR = 0.85;
export const Z_FAR = 26;
/** World spacing between grid lines. */
export const ROW_SPACING = 0.9;
export const COLUMN_SPACING = 0.55;
/** Peak dune height, in world units (camera is 1 unit up). */
export const WAVE_AMPLITUDE = 0.46;
/** World units per second the floor slides toward the viewer. */
export const DRIFT_SPEED = 0.55;

/** Focal length in px so the nearest row lands on the bottom edge of the canvas. */
export function focalLength(view: GridView): number {
  return ((view.height - view.horizon) * Z_NEAR) / CAMERA_HEIGHT;
}

/**
 * Normalised dune height in [0, 1] at world (x, worldZ) and time t (seconds).
 * Two crossing swells give rolling dunes; the power curve sharpens the crests.
 */
export function duneHeight(x: number, worldZ: number, t: number): number {
  const a = Math.sin(x * 1.05 + worldZ * 0.55 + t * 0.35);
  const b = Math.sin(x * 0.48 - worldZ * 0.72 - t * 0.22 + 1.7);
  const c = Math.sin(worldZ * 0.25 + x * 0.16 + t * 0.15);
  const raw = 0.5 + 0.5 * (0.55 * a + 0.3 * b + 0.15 * c);
  return Math.pow(Math.min(1, Math.max(0, raw)), 1.6);
}

/** Project a world point (x, height h, distance z) to canvas px. */
export function project(view: GridView, x: number, h: number, z: number): { x: number; y: number } {
  const f = focalLength(view);
  return {
    x: view.width / 2 + (x / z) * f,
    y: view.horizon + ((CAMERA_HEIGHT - h) / z) * f
  };
}

/** Distances of the visible grid rows at time t; rows slide toward the viewer and wrap. */
export function rowDistances(t: number): number[] {
  const offset = (t * DRIFT_SPEED) % ROW_SPACING;
  const rows: number[] = [];
  // Start a little in front of Z_NEAR so the first rows (lifted by dunes) still reach the bottom edge.
  for (let z = Z_NEAR * 0.7 + ROW_SPACING - offset; z <= Z_FAR; z += ROW_SPACING) rows.push(z);
  return rows;
}

/** Half-width (world units) visible at distance z, plus a margin so lines run off both edges. */
export function halfSpanAt(view: GridView, z: number): number {
  return ((view.width / 2) / focalLength(view)) * z * 1.15 + COLUMN_SPACING;
}

/** Half-width (world units) the columns cover: wide enough to fan out to both screen edges
 *  over most of the floor, capped so very wide screens don't draw hundreds of lines. */
export function columnHalfSpan(view: GridView): number {
  return Math.min(halfSpanAt(view, Z_FAR * 0.55), 60);
}

/** 0..1 fade for a row at distance z: fades out toward the horizon. */
export function distanceFade(z: number): number {
  const t = (Z_FAR - z) / (Z_FAR - Z_NEAR);
  return Math.min(1, Math.max(0, t)) ** 2.2;
}

/** 0..1 overall glow pulse at time t (slow breathing, never fully dark). */
export function glowPulse(t: number): number {
  return 0.8 + 0.2 * Math.sin(t * 1.1);
}
