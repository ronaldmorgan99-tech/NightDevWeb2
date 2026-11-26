import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  COLUMN_SPACING,
  DRIFT_SPEED,
  Z_FAR,
  Z_NEAR,
  columnHalfSpan,
  halfSpanAt,
  distanceFade,
  duneHeight,
  glowPulse,
  project,
  rowDistances,
  WAVE_AMPLITUDE,
  type GridView
} from '../lib/synthwaveGrid';
import './SynthwaveBackground.css';

/**
 * Animated synthwave scene used as the Servers page background: starfield + nebula,
 * a dark planet with a cyan rim, aurora curtains, layered mountains and a rolling neon
 * grid floor drawn on a canvas. Purely decorative: fixed behind all content, aria-hidden,
 * pointer-events: none. Honours prefers-reduced-motion by drawing a single static frame.
 */

/** Fallback horizon position inside the canvas (fraction of its height). The real value comes
 *  from the --sw-grid-horizon CSS variable so it can change per breakpoint with the mountains. */
const DEFAULT_HORIZON = 0.18;
/** Frame interval cap (~40 fps); the motion is slow so this is plenty and saves battery. */
const FRAME_MS = 25;
/** Time used for the static (reduced-motion) frame, picked so the crests look good. */
const STATIC_T = 7.5;

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function starShadows(count: number, seed: number, maxAlpha: number): string {
  const rand = seeded(seed);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = (rand() * 100).toFixed(2);
    // Stars live in the sky: keep them above the mountains.
    const y = (rand() * 60).toFixed(2);
    const a = (0.25 + rand() * (maxAlpha - 0.25)).toFixed(2);
    const tint = rand() > 0.82 ? '180,240,255' : rand() > 0.7 ? '235,190,255' : '255,255,255';
    out.push(`${x}vw ${y}vh 0 ${rand() > 0.9 ? 1 : 0}px rgba(${tint},${a})`);
  }
  return out.join(',');
}

/** A low-poly mountain silhouette in a 1440x300 viewBox: `peaks` summits between `low` and `high`
 *  (y values, smaller = taller), with a couple of jittered shoulders on each slope. */
function ridgePath(seed: number, peaks: number, high: number, low: number): string {
  const rand = seeded(seed);
  const pts: Array<[number, number]> = [[0, low + rand() * 20]];
  const span = 1440 / peaks;
  for (let i = 0; i < peaks; i++) {
    const peakX = i * span + span * (0.3 + rand() * 0.4);
    const peakY = high + rand() * (low - high) * 0.75;
    const valleyX = (i + 1) * span + (rand() - 0.5) * span * 0.2;
    const valleyY = low - rand() * (low - high) * 0.15;
    const prev = pts[pts.length - 1];
    // Shoulder on the way up, summit, shoulder on the way down, then the valley.
    pts.push([prev[0] + (peakX - prev[0]) * 0.55, prev[1] + (peakY - prev[1]) * (0.45 + rand() * 0.2)]);
    pts.push([peakX, peakY]);
    pts.push([peakX + (valleyX - peakX) * 0.4, peakY + (valleyY - peakY) * (0.3 + rand() * 0.25)]);
    pts.push([Math.min(1440, valleyX), valleyY]);
  }
  pts.push([1440, low]);
  return `M0 300 ${pts.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')} L1440 300 Z`;
}

function drawGrid(canvas: HTMLCanvasElement, t: number, horizonFrac = DEFAULT_HORIZON) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = canvas.width / Math.max(1, canvas.clientWidth);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return;

  const view: GridView = {
    width,
    height,
    horizon: horizonFrac * height
  };

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const pulse = glowPulse(t);
  const drift = t * DRIFT_SPEED;
  const halfSpan = columnHalfSpan(view);
  const sweepX = (((t * 0.06) % 1.5) - 0.25) * width;
  const sweepW = width * 0.12;

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#ff2bd6');
  gradient.addColorStop(0.32, '#c026ff');
  gradient.addColorStop(0.58, '#7b5cff');
  gradient.addColorStop(0.8, '#14c8ff');
  gradient.addColorStop(1, '#00f3ff');

  const heightAt = (x: number, z: number) => duneHeight(x, z + drift, t) * WAVE_AMPLITUDE;

  // Columns: lines running toward the horizon. Sample z non-linearly (dense near the camera).
  const columns: Array<Array<{ x: number; y: number }>> = [];
  const firstCol = Math.ceil(-halfSpan / COLUMN_SPACING);
  const lastCol = Math.floor(halfSpan / COLUMN_SPACING);
  const zSamples: number[] = [];
  const zStart = Z_NEAR * 0.6;
  for (let i = 0; i <= 48; i++) zSamples.push(zStart * Math.pow(Z_FAR / zStart, i / 48));
  for (let c = firstCol; c <= lastCol; c++) {
    const x = c * COLUMN_SPACING;
    columns.push(zSamples.map((z) => project(view, x, heightAt(x, z), z)));
  }

  // Rows: lines across the floor, sliding toward the viewer.
  const rows = rowDistances(t).map((z) => {
    const pts: Array<{ x: number; y: number; h: number }> = [];
    const samples = 72;
    const rowSpan = halfSpanAt(view, z);
    for (let i = 0; i <= samples; i++) {
      const x = -rowSpan + (i / samples) * rowSpan * 2;
      const h = duneHeight(x, z + drift, t);
      const p = project(view, x, h * WAVE_AMPLITUDE, z);
      pts.push({ x: p.x, y: p.y, h });
    }
    return { z, pts };
  });

  const strokePoly = (pts: Array<{ x: number; y: number }>) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  };

  ctx.strokeStyle = gradient;
  // Pass 1: wide soft glow. Pass 2: crisp core line.
  for (const pass of [
    { width: 5, alpha: 0.11 },
    { width: 1.25, alpha: 0.75 }
  ]) {
    ctx.lineWidth = pass.width;
    for (const col of columns) {
      ctx.globalAlpha = pass.alpha * pulse * 0.8;
      strokePoly(col);
    }
    for (const row of rows) {
      ctx.globalAlpha = pass.alpha * pulse * distanceFade(row.z);
      strokePoly(row.pts);
    }
  }

  // Crest highlights: brighter streaks along dune tops plus a slow shimmer sweeping across.
  ctx.lineWidth = 1.8;
  const buckets: Array<Array<[number, number, number, number]>> = [[], [], []];
  for (const row of rows) {
    const fade = distanceFade(row.z) ** 1.5;
    for (let i = 1; i < row.pts.length; i++) {
      const a = row.pts[i - 1];
      const b = row.pts[i];
      const crest = Math.max(0, ((a.h + b.h) / 2 - 0.45) / 0.4);
      const shimmer = Math.exp(-(((a.x + b.x) / 2 - sweepX) ** 2) / (sweepW * sweepW)) * 0.8;
      const level = (crest + shimmer) * fade;
      if (level < 0.2) continue;
      buckets[level > 0.75 ? 2 : level > 0.45 ? 1 : 0].push([a.x, a.y, b.x, b.y]);
    }
  }
  ctx.strokeStyle = '#e9f6ff';
  buckets.forEach((segments, level) => {
    if (segments.length === 0) return;
    ctx.globalAlpha = [0.16, 0.32, 0.55][level] * pulse;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of segments) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  });

  // Fade the floor into haze at the horizon.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'destination-out';
  const fog = ctx.createLinearGradient(0, view.horizon - 4, 0, view.horizon + (height - view.horizon) * 0.16);
  fog.addColorStop(0, 'rgba(0,0,0,1)');
  fog.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, width, view.horizon + (height - view.horizon) * 0.16);
  ctx.globalCompositeOperation = 'source-over';
}

function useGridCanvas(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let last = 0;
    const start = performance.now();
    let horizon = DEFAULT_HORIZON;
    const draw = (t: number) => drawGrid(canvas, t, horizon);

    const resize = () => {
      const maxDpr = window.innerWidth < 640 ? 1.5 : 2;
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      const fromCss = parseFloat(getComputedStyle(canvas).getPropertyValue('--sw-grid-horizon'));
      horizon = Number.isFinite(fromCss) && fromCss > 0 && fromCss < 1 ? fromCss : DEFAULT_HORIZON;
      draw(motion.matches ? STATIC_T : (performance.now() - start) / 1000);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      last = now;
      draw((now - start) / 1000);
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const play = () => {
      if (raf || motion.matches || document.hidden) return;
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => (document.hidden ? stop() : play());
    const onMotion = () => {
      stop();
      draw(STATIC_T);
      play();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    play();
    document.addEventListener('visibilitychange', onVisibility);
    motion.addEventListener('change', onMotion);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motion.removeEventListener('change', onMotion);
    };
  }, [ref]);
}

export default function SynthwaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useGridCanvas(canvasRef);

  const stars = useMemo(
    () => ({ small: starShadows(140, 7, 0.75), bright: starShadows(36, 23, 1) }),
    []
  );
  const ridges = useMemo(
    () => ({
      back: ridgePath(3, 5, 40, 210),
      mid: ridgePath(11, 7, 120, 250),
      front: ridgePath(19, 9, 200, 285)
    }),
    []
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="synthwave-bg" aria-hidden="true" data-testid="synthwave-background">
      <div className="sw-sky" />
      <div className="sw-nebula sw-nebula-left" />
      <div className="sw-nebula sw-nebula-right" />
      <div className="sw-stars" style={{ boxShadow: stars.small }} />
      <div className="sw-stars sw-stars-bright" style={{ boxShadow: stars.bright }} />

      <div className="sw-planet-wrap">
        <div className="sw-planet">
          <div className="sw-planet-rim" />
        </div>
      </div>

      <div className="sw-aurora">
        <span className="sw-ribbon sw-ribbon-1" />
        <span className="sw-ribbon sw-ribbon-2" />
        <span className="sw-ribbon sw-ribbon-3" />
        <span className="sw-ribbon sw-ribbon-4" />
      </div>

      <div className="sw-horizon-glow" />
      <div className="sw-floor" />
      <canvas ref={canvasRef} className="sw-grid" />

      <svg className="sw-mountains" viewBox="0 0 1440 300" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sw-ridge-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a1d6e" />
            <stop offset="1" stopColor="#170b33" />
          </linearGradient>
          <linearGradient id="sw-ridge-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a1356" />
            <stop offset="1" stopColor="#100726" />
          </linearGradient>
          <linearGradient id="sw-ridge-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1c0d3d" />
            <stop offset="1" stopColor="#0f0726" />
          </linearGradient>
        </defs>
        <path d={ridges.back} fill="url(#sw-ridge-back)" stroke="rgba(192,38,255,0.55)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path d={ridges.mid} fill="url(#sw-ridge-mid)" stroke="rgba(160,90,255,0.35)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={ridges.front} fill="url(#sw-ridge-front)" stroke="rgba(0,243,255,0.25)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="sw-vignette" />
    </div>,
    document.body
  );
}
