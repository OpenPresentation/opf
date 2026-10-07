// FA-05 follow-up: the `surfaceAlt` role keeps banded table rows visible on light and dark slides.
// Banded rows used `background`, which since FA-05 is the slide background; on a theme whose background is dark2
// (minimal) that equals the dark `surface` of the plain rows, so the bands vanished.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { colorContrast, resolveColorRef, resolveColorRoles, SURFACE_ALT_MIN_CONTRAST, surfaceAltColor } from '../dist/index.js';

const catalog = new URL('../../../spec/catalogs/', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, catalog), 'utf8'));
const schemes = readdirSync(new URL('color-schemes/', catalog)).filter((file) => file.endsWith('.json') && file !== 'index.json').map((file) => read(`color-schemes/${file}`));

function assertBand(roles, label) {
  assert.notEqual(roles.surfaceAlt, roles.surface, `${label}: band differs from the plain rows`);
  assert.ok(colorContrast(roles.surfaceAlt, roles.surface) >= SURFACE_ALT_MIN_CONTRAST, `${label}: band is visible next to the surface`);
  const base = colorContrast(roles.text, roles.surface);
  assert.ok(colorContrast(roles.text, roles.surfaceAlt) >= Math.min(4.5, base), `${label}: text keeps its contrast on the band`);
}

test('dark theme (minimal: dark2 background) and light theme (classic) keep the band distinct with readable text', () => {
  const minimal = read('themes/minimal.json'), classic = read('themes/classic.json');
  const minimalScheme = read(`color-schemes/${minimal.colorScheme}.json`);
  const dark = resolveColorRoles(minimalScheme, { background: minimalScheme[minimal.background.slot] });
  assert.equal(dark.dark, true);
  assert.equal(dark.background, dark.surface, 'the collision this fixes: the slide background is the dark surface');
  assertBand(dark, 'minimal');
  assert.ok(colorContrast(dark.text, dark.surfaceAlt) >= 4.5);
  const classicScheme = read(`color-schemes/${classic.colorScheme}.json`);
  const light = resolveColorRoles(classicScheme);
  assert.equal(light.dark, false);
  assertBand(light, 'classic');
  assert.ok(colorContrast(light.text, light.surfaceAlt) >= 4.5);
});

test('every catalog color scheme on its default and on a dark2 background', () => {
  for (const scheme of schemes) {
    assertBand(resolveColorRoles(scheme), `${scheme.id} default`);
    assertBand(resolveColorRoles(scheme, { background: scheme.dark2 }), `${scheme.id} on dark2`);
    assertBand(resolveColorRoles(scheme, { background: scheme.dark1 }), `${scheme.id} on dark1`);
  }
});

test('the surfaceAlt ColorRef resolves from the surface and text roles an engine passes, so the preview and the export agree', () => {
  const scheme = read('color-schemes/cool-horizon.json');
  const roles = resolveColorRoles(scheme, { background: scheme.dark2 });
  const engineRoles = { primary: roles.primary, secondary: roles.secondary, accent: roles.accent, background: roles.background, surface: roles.surface, text: roles.text, textSecondary: roles.textSecondary };
  assert.equal(resolveColorRef('surfaceAlt', { colorScheme: scheme, roles: engineRoles, fallback: '#000000' }), roles.surfaceAlt);
  assert.equal(resolveColorRef('surfaceAlt', { colorScheme: scheme, roles: { ...engineRoles, surfaceAlt: '#123456' }, fallback: '#000000' }), '#123456');
  // Without roles it follows the scheme's light defaults (surface light2, text dark1).
  assert.equal(resolveColorRef('surfaceAlt', { colorScheme: scheme, fallback: '#000000' }), surfaceAltColor(scheme.light2, scheme.dark1));
});

test('surfaceAltColor: darker band on light, lighter on dark, and away from the text when the pair is close', () => {
  const light = surfaceAltColor('#F8FAFC', '#0F172A');
  assert.ok(colorContrast(light, '#000000') < colorContrast('#F8FAFC', '#000000'), 'a light band is darker');
  const dark = surfaceAltColor('#1E293B', '#FFFFFF');
  assert.ok(colorContrast(dark, '#FFFFFF') < colorContrast('#1E293B', '#FFFFFF'), 'a dark band is lighter');
  // Low-contrast pair: moving towards the text would lose readability, so the band moves away from it.
  const close = surfaceAltColor('#777777', '#FFFFFF');
  assert.ok(colorContrast(close, '#777777') >= SURFACE_ALT_MIN_CONTRAST);
  assert.ok(colorContrast('#FFFFFF', close) >= colorContrast('#FFFFFF', '#777777'));
  assert.equal(surfaceAltColor('#FFFFFF', '#000000'), surfaceAltColor('#ffffff', '#000'));
});
