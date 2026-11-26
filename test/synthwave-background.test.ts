import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  Z_FAR,
  Z_NEAR,
  ROW_SPACING,
  columnHalfSpan,
  distanceFade,
  duneHeight,
  glowPulse,
  halfSpanAt,
  project,
  rowDistances
} from '../src/lib/synthwaveGrid.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');
const component = read('../src/components/SynthwaveBackground.tsx');
const css = read('../src/components/SynthwaveBackground.css');
const servers = read('../src/pages/ServersPage.tsx');
const view = { width: 1280, height: 360, horizon: 64 };

test('Servers page renders the synthwave background as a decorative, non-interactive layer', () => {
  assert.match(servers, /import SynthwaveBackground from '\.\.\/components\/SynthwaveBackground';/);
  assert.match(servers, /<SynthwaveBackground \/>/);
  assert.match(component, /createPortal\(/);
  assert.match(component, /aria-hidden="true"/);
  assert.match(css, /\.synthwave-bg \{[^}]*position: fixed;[^}]*z-index: -1;[^}]*pointer-events: none;/s);
});

test('background honours reduced motion, pauses when hidden and caps device pixel ratio', () => {
  assert.match(component, /prefers-reduced-motion: reduce/);
  assert.match(component, /visibilitychange/);
  assert.match(component, /Math\.min\(window\.devicePixelRatio \|\| 1, maxDpr\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important;/);
});

test('dune height stays within 0..1 and changes over time (the floor undulates)', () => {
  let changed = false;
  for (let x = -10; x <= 10; x += 0.7) {
    for (let z = 0; z <= 30; z += 1.3) {
      const a = duneHeight(x, z, 0);
      assert.ok(a >= 0 && a <= 1, `height ${a} out of range`);
      if (Math.abs(a - duneHeight(x, z, 2)) > 1e-3) changed = true;
    }
  }
  assert.ok(changed);
});

test('rows drift toward the viewer and wrap, staying inside the visible range', () => {
  const a = rowDistances(0);
  const b = rowDistances(0.5);
  assert.ok(a.length > 10);
  assert.ok(b[0] < a[0], 'first row moves closer over time');
  for (const z of [...a, ...b]) assert.ok(z > 0 && z <= Z_FAR);
  assert.ok(a[1] - a[0] - ROW_SPACING < 1e-9);
});

test('projection puts flat ground at Z_NEAR on the bottom edge and converges to the horizon', () => {
  assert.ok(Math.abs(project(view, 0, 0, Z_NEAR).y - view.height) < 1e-6);
  const far = project(view, 0, 0, 1e6);
  assert.ok(Math.abs(far.y - view.horizon) < 0.01);
  assert.equal(project(view, 0, 0, 3).x, view.width / 2);
  // Rows span past both screen edges.
  const edge = project(view, halfSpanAt(view, 5), 0, 5);
  assert.ok(edge.x > view.width);
  assert.ok(columnHalfSpan(view) <= 60);
});

test('glow pulse and distance fade stay in sensible ranges', () => {
  for (let t = 0; t < 20; t += 0.37) {
    const g = glowPulse(t);
    assert.ok(g >= 0.6 && g <= 1);
  }
  assert.equal(distanceFade(Z_NEAR), 1);
  assert.equal(distanceFade(Z_FAR), 0);
});
