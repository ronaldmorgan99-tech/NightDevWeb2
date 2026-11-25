import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeMenuPosition } from '../src/lib/postMenu.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');
const layout = read('../src/layouts/MainLayout.tsx');
const app = read('../src/App.tsx');
const home = read('../src/pages/HomePage.tsx');
const forums = read('../src/pages/ForumsPage.tsx');
const menu = read('../src/components/PostOverflowMenu.tsx');
const servers = read('../src/pages/ServersPage.tsx');
const store = read('../src/pages/StorePage.tsx');
const css = read('../src/index.css');

// 1. Navigation breakpoints
test('hamburger and mobile menu show below lg, matching the desktop nav breakpoint', () => {
  assert.match(layout, /<nav className="hidden lg:flex/);
  assert.match(layout, /className="lg:hidden p-2[^"]*"\s+aria-label=\{isMobileMenuOpen \? 'Close menu' : 'Open menu'\}/);
  assert.match(layout, /id="mobile-menu"\s+className="lg:hidden /);
  assert.doesNotMatch(layout, /md:hidden/, 'no navigation element should hide at md while the desktop nav is still hidden');
});

test('mobile menu offers Home, Sign In and Join Now, and auth buttons do not wrap', () => {
  assert.match(layout, /\{ label: 'Home', path: '\/', icon: Home \}, \.\.\.navItems/);
  assert.match(layout, /data-testid="mobile-auth-links"/);
  assert.match(layout, /to="\/login"[\s\S]{0,400}Sign In/);
  assert.match(layout, /to="\/register"[\s\S]{0,400}Join Now/);
  assert.match(layout, /btn-holographic px-4 py-2 text-\[10px\] whitespace-nowrap/);
  assert.match(layout, /btn-neon-cyan px-4 py-2 text-\[10px\] whitespace-nowrap/);
});

test('mobile menu closes on route change', () => {
  assert.match(layout, /setIsMobileMenuOpen\(false\);\s*\}, \[location\.pathname, location\.search, location\.hash\]\);/);
});

// 2 + 3. Post menu
test('post menu renders in a portal with fixed positioning and closes on route/hash/?post= change', () => {
  assert.match(menu, /createPortal\(/);
  assert.match(menu, /position: 'fixed'/);
  assert.match(menu, /computeMenuPosition\(/);
  assert.match(menu, /useLocation\(\)/);
  assert.match(menu, /const locationKey = `\$\{location\.pathname\}\$\{location\.search\}\$\{location\.hash\}`/);
  assert.match(menu, /if \(isOpen\) onOpenChange\(false\);/);
  assert.match(menu, /insideMenu/, 'clicks inside the portaled menu must not count as outside clicks');
});

test('computeMenuPosition prefers opening above the button, right-aligned, so post text stays visible', () => {
  const pos = computeMenuPosition({ top: 400, bottom: 424, right: 900 }, { width: 1280, height: 900 }, 200);
  assert.deepEqual(pos, { top: 192, left: 692, width: 208, placement: 'above' });
});

test('computeMenuPosition opens below when the sticky header leaves no room above', () => {
  const pos = computeMenuPosition({ top: 120, bottom: 144, right: 900 }, { width: 1280, height: 900 }, 200, 208, 8, 8, 88);
  assert.equal(pos.placement, 'below');
  assert.equal(pos.top, 152);
});

test('computeMenuPosition keeps the menu inside a narrow viewport and below the header', () => {
  const pos = computeMenuPosition({ top: 100, bottom: 124, right: 60 }, { width: 200, height: 600 }, 150);
  assert.equal(pos.width, 184);
  assert.equal(pos.left, 8);
  const tiny = computeMenuPosition({ top: 10, bottom: 30, right: 380 }, { width: 390, height: 120 }, 300, 208, 8, 8, 88);
  assert.ok(tiny.top >= 88);
  assert.ok(tiny.left + tiny.width <= 390 - 8);
});

// 4 + 5. Servers stats
test('servers page has four distinct stat cards (no duplicate Players card, no orphan)', () => {
  const block = servers.slice(servers.indexOf('data-testid="server-stats"'), servers.indexOf('].map((stat)'));
  const labels = [...block.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Players Online', 'Nodes Online', 'Network Status', 'Telemetry']);
  assert.equal(new Set(labels).size, labels.length);
  assert.match(servers, /grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="server-stats"/);
  assert.doesNotMatch(servers, /'Active Players'/);
});

// 6. Store cards
test('store card animation stagger is capped and long titles do not collide with the price', () => {
  assert.match(store, /delay: Math\.min\(idx, 6\) \* 0\.05/);
  assert.doesNotMatch(store, /delay: idx \* 0\.1/);
  assert.match(store, /min-w-0 break-words text-2xl/);
  assert.match(store, /shrink-0 text-2xl font-black text-neon-green/);
});

// 7. Focus ring
test('site-wide focus-visible ring is cyan and cannot be removed by outline-none utilities', () => {
  assert.match(css, /\[role="menuitem"\][^{]*\):focus-visible \{\s*outline: 2px solid var\(--color-neon-cyan\) !important;/);
  assert.match(css, /\[role="menuitem"\]:focus-visible \{\s*outline-offset: -2px;/);
});

// 8. Home vs Forums
test('"/" renders HomePage and "/forums" renders ForumsPage', () => {
  assert.match(app, /<Route index element=\{<Suspense fallback=\{<LoadingFallback \/>\}><HomePage \/><\/Suspense>\} \/>/);
  assert.match(app, /<Route path="forums" element=\{<Suspense fallback=\{<LoadingFallback \/>\}><ForumsPage \/><\/Suspense>\} \/>/);
});

test('Home has the hero, news, network nodes and a Browse forums link; Forums is a clean index', () => {
  assert.match(home, /THE DIGITAL/);
  assert.match(home, /LATEST NEWS/);
  assert.match(home, /LIVE NETWORK NODES/);
  assert.match(home, /to="\/forums"[^>]*data-testid="home-browse-forums"/);
  assert.doesNotMatch(forums, /THE DIGITAL|LATEST NEWS|LIVE NETWORK NODES|fetchNews/);
  assert.match(forums, /aria-label="Breadcrumb"/);
  assert.match(forums, /Community <span className="text-neon-cyan">Forums<\/span>/);
});

test('Forums nav item is no longer highlighted on Home', () => {
  assert.match(layout, /if \(path === '\/'\) return location\.pathname === '\/';/);
  assert.doesNotMatch(layout, /return location\.pathname === '\/' \|\| location\.pathname\.startsWith\('\/forums'\)/);
});
