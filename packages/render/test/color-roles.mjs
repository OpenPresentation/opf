// FA-05: the preview resolves the color-scheme roles and link colors through core resolveColorRoles, the definition opf-pptx
// and the audit share (the cross-engine comparison is test/color-roles.mjs in opf-pptx). The designs name the gallery's `classic`
// theme and `cool-horizon` colour scheme, so the host catalog is registered (./catalog-harness.mjs).
import assert from 'node:assert/strict';
import { resolveColorRoles } from '@openpresentation/opf/composition';
import { defaultCatalog, renderSlideSvg } from './catalog-harness.mjs';

const cool = defaultCatalog.colorSchemes['cool-horizon'];
assert.ok(cool, 'the gallery cool-horizon colour scheme');
const fillOf = (svg, label) => {
  const found = new RegExp(`<(?:tspan|text)[^>]*? fill="(#[0-9A-Fa-f]{6})"[^>]*>${label}</(?:tspan|text)>`).exec(svg);
  assert.ok(found, `${label} run in the SVG`);
  return found[1].toUpperCase();
};
const one = (design, run) => renderSlideSvg({ design, slides: [{ title: 'T', text: [run] }] }, 0);

// Role overrides on a light slide: every role ColorRef and the default text.
const light = { theme: 'classic', colorScheme: { id: 'cool-horizon', surface: '#EEEEDD', text: '#334455', textSecondary: '#556677', background: '#FFF8E7', accent: '#FF00AA' } };
// The classic theme's own background is light1, so that is the slide background the roles resolve against.
const lightRoles = resolveColorRoles({ ...cool, ...light.colorScheme }, { background: cool.light1 });
assert.equal(lightRoles.dark, false);
for (const role of ['surface', 'text', 'textSecondary', 'background', 'accent']) {
  assert.equal(fillOf(one(light, { text: 'sample', color: role }), 'sample'), lightRoles[role].toUpperCase(), `${role} override`);
}
assert.equal(fillOf(one(light, { text: 'sample' }), 'sample'), '#334455', 'the text override is the default text color on a light slide');

// With no single-color background (a gradient) the scheme's background role is the default slide background.
const gradient = { theme: 'classic', background: { type: 'gradient', gradient: { angle: 90, stops: [{ color: '#FFFFFF', position: 0 }, { color: '#EEEEEE', position: 1 }] } }, colorScheme: light.colorScheme };
assert.equal(fillOf(one(gradient, { text: 'sample', color: 'background' }), 'sample'), '#FFF8E7');

// A dark slide keeps readable light1 text whatever the text override says; surface and textSecondary overrides still apply.
const dark = { theme: 'classic', background: '#10151C', colorScheme: { id: 'cool-horizon', text: '#334455', surface: '#202A36', textSecondary: '#8899AA' } };
const darkSvg = one(dark, { text: 'sample' });
assert.equal(fillOf(darkSvg, 'sample'), cool.light1.toUpperCase(), 'text override ignored on a dark slide');
assert.equal(fillOf(one(dark, { text: 'sample', color: 'surface' }), 'sample'), '#202A36');
assert.equal(fillOf(one(dark, { text: 'sample', color: 'textSecondary' }), 'sample'), '#8899AA');
assert.equal(fillOf(one(dark, { text: 'sample', color: 'background' }), 'sample'), '#10151C', 'the background role is the slide background');

// Links: underlined, in the scheme hyperlink color; a run color wins; a hard-to-read link color takes the text color.
const linkDesign = { theme: 'classic', colorScheme: { id: 'cool-horizon', hyperlink: '#AA3311' } };
const link = one(linkDesign, { text: 'link', link: 'https://example.com' });
assert.equal(fillOf(link, 'link'), '#AA3311');
assert.match(link, /text-decoration="underline"[^>]*>link</);
assert.equal(fillOf(one(linkDesign, { text: 'link', link: 'https://example.com', color: '#C0FFEE' }), 'link'), '#C0FFEE');
assert.equal(fillOf(one({ theme: 'classic', background: '#011842', colorScheme: { id: 'cool-horizon', hyperlink: '#0000EE' } }, { text: 'link', link: 'https://example.com' }), 'link'), cool.light1.toUpperCase(), 'a dark blue link on a navy slide takes the slide text color');
const plain = one(linkDesign, { text: 'plain' });
assert.doesNotMatch(plain, /text-decoration="underline"/, 'text with no link is not underlined');

console.log('Color roles: preview roles, dark-slide text, background role and link colors follow core resolveColorRoles.');
