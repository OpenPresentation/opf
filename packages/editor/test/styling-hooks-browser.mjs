import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startWorkspacePage, deck } from './support/workspace-page.mjs';
import { buildStyles } from '../scripts/build-styles.mjs';

// CE-29 in a real browser: the styling hooks of the editor's chrome. (1) The layered stylesheet: an unlayered host rule with one class beats the
// package's rule in styles.layered.css and not in styles.css. (2) The `icons` option of every part that draws an icon: path data, an element
// and a function render, the default is unchanged in size, a typo throws. (3) The component tokens (bar, deck title, overlay layer) change the
// computed styles of the bar and the title, and their defaults equal the old look. (4) Every CSS example of docs/styling.md takes effect on the
// layered stylesheet.
const checks = [];
const mark = (name) => checks.push(name);
const chrome = { channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined };
const styles = await buildStyles(new URL('../src/styles/', import.meta.url));

// ---- 1. layers -------------------------------------------------------------------------------------------------------------------------------
{
  const browser = await chromium.launch(chrome);
  try {
    const probe = async (stylesheet) => {
      const page = await browser.newPage();
      // The host's rules come BEFORE the package sheet: at equal specificity the later (package) rule would win, which is the case layers fix.
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>
        .opf-nav-counter { color: rgb(255, 0, 0); }
        .opf-design-menu-popover { width: 400px; }
      </style><body><div class="opf-ui"><span class="opf-nav-counter">01 / 03</span>
        <div class="opf-design-menu"><div class="opf-design-menu-popover">x</div></div></div></body>`);
      await page.addStyleTag({ content: stylesheet });
      const result = await page.evaluate(() => ({
        color: getComputedStyle(document.querySelector('.opf-nav-counter')).color,
        width: getComputedStyle(document.querySelector('.opf-design-menu-popover')).width,
        // The tokens are inside the layer too: a host's unlayered `.opf-ui` rule wins over them, whatever its specificity.
      }));
      await page.close();
      return result;
    };
    const plain = await probe(styles.css);
    const layered = await probe(styles.layered);
    assert.equal(plain.color, 'rgb(20, 25, 36)', 'plain styles.css: the package rule (same specificity, later) beats the host rule');
    assert.notEqual(plain.color, 'rgb(255, 0, 0)');
    assert.equal(plain.width, '296px', 'plain styles.css: a two-class package rule beats a one-class host rule');
    assert.equal(layered.color, 'rgb(255, 0, 0)', 'layered: a host rule with one class beats the package rule');
    assert.equal(layered.width, '400px', 'layered: it also beats a rule with more specificity');
    mark('an unlayered one-class host rule beats the package in styles.layered.css and not in styles.css');
  } finally {
    await browser.close();
  }
}

const parts = `
  import * as expand from './src/editor-expand.js';
  import * as pill from './src/review-pill.js';
  import * as help from './src/shortcuts-sheet.js';
  import * as design from './src/design-menu.js';
  import * as nav from './src/slide-navigator.js';
  import * as strip from './src/thumbnail-strip.js';
  import * as toolbar from './src/toolbar.js';
  import * as actions from './src/toolbar-actions.js';
  import * as presenter from './src/presenter.js';
  import * as element from './src/element.js';
  window.opfParts = { expand, pill, help, design, nav, strip, toolbar, actions, presenter, element };
`;
const BODY = '<div id="stage" class="opf-ui" style="padding:12px;display:flex;flex-direction:column;gap:8px"></div><div id="editor" style="width:1000px;height:600px"></div>';

// ---- 2. icons --------------------------------------------------------------------------------------------------------------------------------
{
  const app = await startWorkspacePage({ bundle: { extraEntry: parts }, body: BODY });
  const { page, errors } = app;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  try {
    await ev(() => {
      const SVG = 'http://www.w3.org/2000/svg';
      // A host's own icon: an element with a marker circle, in a 16-unit box and its own paint.
      window.own = (marker) => { const svg = document.createElementNS(SVG, 'svg'); svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('data-marker', marker); const c = document.createElementNS(SVG, 'circle'); c.setAttribute('r', '5'); c.setAttribute('cx', '8'); c.setAttribute('cy', '8'); c.setAttribute('fill', 'currentColor'); svg.append(c); return svg; };
      window.fresh = (id) => { document.querySelector(`#${id}`)?.remove(); const host = document.createElement('div'); host.id = id; document.querySelector('#stage').append(host); return host; };
      window.icon = (selector) => {
        const svg = document.querySelector(selector);
        if (!svg) return null;
        const box = svg.getBoundingClientRect();
        return { cls: svg.getAttribute('class'), name: svg.getAttribute('data-opf-icon'), aria: svg.getAttribute('aria-hidden'), focusable: svg.getAttribute('focusable'), d: svg.querySelector('path')?.getAttribute('d') ?? null, marker: svg.getAttribute('data-marker'), width: Math.round(box.width), height: Math.round(box.height) };
      };
      window.session = (slides = 3) => window.opfWs.createEditorSession({ name: 'Icons', design: { theme: 'classic', fontScheme: 'roboto' }, slides: Array.from({ length: slides }, (_, index) => ({ id: `s${index + 1}`, title: `Slide ${index + 1}`, text: `Words ${index + 1}` })) }, { catalogs: [window.opfWs.gallery] });
    });
    const icon = (selector) => ev((s) => window.icon(s), selector);

    // -- expand: expand and collapse ------------------------------------------------------------------------------------------------------
    await ev(() => { const host = window.fresh('x1'); window.ctl = window.opfParts.expand.createExpandController(document.querySelector('#editor')); window.opfParts.expand.createExpandButton(host, { controller: window.ctl }); });
    assert.deepEqual(await icon('#x1 svg'), { cls: 'opf-icon opf-expand-icon', name: 'expand', aria: 'true', focusable: 'false', d: 'M15 3h6v6', marker: null, width: 16, height: 16 }, 'default expand icon: same size and path as before');
    await ev(() => window.ctl.expand(true));
    assert.equal((await icon('#x1 svg')).name, 'collapse');
    await ev(() => window.ctl.collapse());
    await ev(() => { const host = window.fresh('x2'); window.btn = window.opfParts.expand.createExpandButton(host, { controller: window.ctl, icons: { expand: 'M3 12h18', collapse: () => window.own('collapse') } }); });
    assert.equal((await icon('#x2 svg')).d, 'M3 12h18', 'path data');
    assert.equal((await icon('#x2 svg')).width, 16);
    await ev(() => window.ctl.expand(true));
    const collapsed = await icon('#x2 svg');
    assert.equal(collapsed.marker, 'collapse', 'a function returning an element');
    assert.equal(collapsed.cls, 'opf-icon opf-expand-icon');
    assert.equal(collapsed.aria, 'true');
    assert.equal(collapsed.width, 16, 'the part\'s CSS sizes a host element');
    await ev(() => { window.ctl.collapse(); window.ctl.destroy(); });
    mark('expand: default unchanged; path data, function and element icons for expand and collapse');

    // -- review pill: every state ---------------------------------------------------------------------------------------------------------
    await ev(() => { const host = window.fresh('p1'); window.pill1 = window.opfParts.pill.createReviewPill(host); });
    const defaults = {};
    const counts = (error, warning, info, extra = {}) => ({ error, warning, info, total: error + warning + info, all: error + warning + info, sources: [], unavailable: false, ...extra });
    const states = { checking: null, error: counts(1, 0, 0), warning: counts(0, 1, 0), info: counts(0, 0, 1), valid: counts(0, 0, 0), unavailable: counts(0, 0, 0, { unavailable: true }) };
    for (const [name, value] of Object.entries(states)) {
      await ev((v) => window.pill1.update(v), value);
      const shown = await icon('#p1 svg');
      assert.equal(shown.name, name, `the pill shows the ${name} glyph`);
      defaults[name] = shown.width;
    }
    assert.deepEqual(defaults, { checking: 14, error: 14, warning: 14, info: 14, valid: 14, unavailable: 14 }, 'default glyphs keep their 14px');
    await ev((paths) => { const host = window.fresh('p2'); window.pill2 = window.opfParts.pill.createReviewPill(host, { icons: { valid: paths.valid, error: () => window.own('error'), warning: paths.warning, info: window.own('info'), checking: paths.checking, unavailable: paths.unavailable } }); },
      { valid: 'M1 1h2', warning: 'M2 2h2', checking: 'M3 3h2', unavailable: 'M4 4h2' });
    const seen = {};
    for (const [name, value] of Object.entries(states)) {
      await ev((v) => window.pill2.update(v), value);
      const shown = await icon('#p2 svg');
      assert.equal(shown.name, name);
      seen[name] = shown.marker ?? shown.d;
      assert.equal(shown.width, 14, 'a custom glyph is sized by the pill');
    }
    assert.deepEqual(seen, { checking: 'M3 3h2', error: 'error', warning: 'M2 2h2', info: 'info', valid: 'M1 1h2', unavailable: 'M4 4h2' });
    mark('review pill: all six glyphs replaceable; defaults 14px');

    // -- help button: help and close -----------------------------------------------------------------------------------------------------
    await ev(() => { const host = window.fresh('h1'); window.opfParts.help.createHelpButton(host, { bindKey: false, getShortcuts: () => [{ label: 'Undo', keys: ['Mod-z'] }] }); });
    assert.deepEqual({ ...(await icon('#h1 svg')), d: undefined }, { cls: 'opf-icon opf-help-icon', name: 'help', aria: 'true', focusable: 'false', d: undefined, marker: null, width: 18, height: 18 });
    await page.click('#h1 button');
    assert.equal(await ev(() => document.querySelector('.opf-shortcuts-close').textContent), '×', 'the close button reads × by default');
    await page.keyboard.press('Escape');
    await ev(() => { const host = window.fresh('h2'); window.opfParts.help.createHelpButton(host, { bindKey: false, getShortcuts: () => [{ label: 'Undo', keys: ['Mod-z'] }], icons: { help: () => window.own('help'), close: 'M6 6l12 12M18 6L6 18' } }); });
    assert.equal((await icon('#h2 svg')).marker, 'help');
    await page.click('#h2 button');
    const closeIcon = await icon('.opf-shortcuts-close svg');
    assert.equal(closeIcon.name, 'close');
    assert.equal(closeIcon.d, 'M6 6l12 12M18 6L6 18');
    assert.equal(closeIcon.width, 16);
    assert.equal(await ev(() => document.querySelector('.opf-shortcuts-close').textContent), '', 'the × is replaced');
    assert.equal(await ev(() => document.querySelector('.opf-shortcuts-close').getAttribute('aria-label')), 'Close', 'the name stays on the button');
    await page.keyboard.press('Escape');
    mark('help: the button icon and the close icon (default ×)');

    // -- design menu: trigger, close, check -----------------------------------------------------------------------------------------------
    await ev(() => { const host = window.fresh('d1'); window.opfParts.design.createDesignMenu(host, { editor: window.session(), catalogs: [window.opfWs.gallery] }); });
    assert.deepEqual({ ...(await icon('#d1 .opf-design-menu-trigger svg')), d: undefined }, { cls: 'opf-icon', name: 'trigger', aria: 'true', focusable: 'false', d: undefined, marker: null, width: 14, height: 14 }, 'default trigger icon 14px');
    assert.equal(await ev(() => document.querySelector('#d1 .opf-design-menu-close svg').getAttribute('width')), '18', 'default close icon 18px (hidden until the sheet opens)');
    await ev(() => { const host = window.fresh('d2'); window.dm = window.opfParts.design.createDesignMenu(host, { editor: window.session(), catalogs: [window.opfWs.gallery], icons: { trigger: () => window.own('trigger'), close: 'M5 5l14 14', check: 'M4 12l5 5L20 6' } }); });
    assert.equal((await icon('#d2 .opf-design-menu-trigger svg')).marker, 'trigger');
    assert.equal((await icon('#d2 .opf-design-menu-trigger svg')).width, 14, 'sized by the part when the element has no size');
    assert.equal((await icon('#d2 .opf-design-menu-close svg')).d, 'M5 5l14 14');
    await page.click('#d2 .opf-design-menu-trigger');
    const check = await icon('#d2 .opf-design-menu-item[aria-checked="true"] .opf-design-menu-check svg');
    assert.equal(check?.d, 'M4 12l5 5L20 6', 'the chosen row shows the custom check');
    await page.keyboard.press('Escape');
    mark('design menu: trigger, close and check');

    // -- slide navigator -------------------------------------------------------------------------------------------------------------------
    await ev(() => { const host = window.fresh('n1'); window.opfParts.nav.createSlideNavigator(host, { editor: window.session() }); });
    assert.equal((await icon('#n1 [data-action="previous"] svg')).width, 18);
    assert.equal((await icon('#n1 [data-action="previous"] svg')).d, 'm15 18-6-6 6-6');
    await ev(() => { const host = window.fresh('n2'); window.opfParts.nav.createSlideNavigator(host, { editor: window.session(), icons: { previous: 'M15 6l-6 6 6 6', next: () => window.own('next') } }); });
    assert.equal((await icon('#n2 [data-action="previous"] svg')).d, 'M15 6l-6 6 6 6');
    assert.equal((await icon('#n2 [data-action="next"] svg')).marker, 'next');
    assert.equal((await icon('#n2 [data-action="next"] svg')).name, 'next');
    mark('slide navigator: previous and next');

    // -- thumbnail strip: add ---------------------------------------------------------------------------------------------------------------
    await ev(() => { const host = window.fresh('t1'); host.style.width = '600px'; window.opfParts.strip.createThumbnailStrip(host, { editor: window.session(), fonts: window.fonts, actions: true }); });
    assert.deepEqual({ ...(await icon('#t1 .opf-thumbs-add svg')), d: undefined }, { cls: 'opf-icon opf-thumbs-add-icon', name: 'add', aria: 'true', focusable: 'false', d: undefined, marker: null, width: 20, height: 20 });
    assert.equal((await icon('#t1 .opf-thumbs-add svg')).d, 'M12 5v14M5 12h14');
    await ev(() => { const host = window.fresh('t2'); host.style.width = '600px'; window.opfParts.strip.createThumbnailStrip(host, { editor: window.session(), fonts: window.fonts, actions: true, icons: { add: () => window.own('add') } }); });
    assert.equal((await icon('#t2 .opf-thumbs-add svg')).marker, 'add');
    assert.equal((await icon('#t2 .opf-thumbs-add svg')).width, 20, 'the strip\'s CSS sizes it');
    mark('thumbnail strip: add');

    // -- toolbar: more -----------------------------------------------------------------------------------------------------------------------
    await ev(() => {
      for (const [id, icons] of [['b1', undefined], ['b2', { more: 'M5 12h.01M12 12h.01M19 12h.01' }], ['b3', { more: () => window.own('more') }]]) {
        const host = window.fresh(id);
        const bar = window.opfParts.toolbar.createToolbar(host, { items: ['spacer', 'more'], icons });
        bar.element.querySelector('.opf-tb-more').hidden = false;
      }
    });
    const dots = await ev(() => { const svg = document.querySelector('#b1 .opf-tb-more-button svg'); const rect = svg.getBoundingClientRect(); return { circles: svg.querySelectorAll('circle').length, vb: svg.getAttribute('viewBox'), width: Math.round(rect.width), cls: svg.getAttribute('class'), name: svg.getAttribute('data-opf-icon'), filled: svg.querySelector('circle').getAttribute('fill') }; });
    assert.deepEqual(dots, { circles: 3, vb: '0 0 24 24', width: 16, cls: 'opf-icon opf-tb-more-icon', name: 'more', filled: 'currentColor' }, 'the default ⋯ is still three dots at 16px');
    assert.equal((await icon('#b2 .opf-tb-more-button svg')).d, 'M5 12h.01M12 12h.01M19 12h.01');
    assert.equal((await icon('#b3 .opf-tb-more-button svg')).marker, 'more');
    mark('toolbar: the ⋯ icon (default three dots at 16px)');

    // -- toolbar actions: per-action icon through the same helper -------------------------------------------------------------------------
    await ev(() => { const host = window.fresh('a1'); window.opfParts.actions.createToolbarActions(host, { actions: [{ id: 'share', label: 'Share', icon: () => window.own('share'), run() {} }, { id: 'save', label: 'Save', icon: 'M5 12h14', run() {} }, { id: 'plain', label: 'Plain', run() {} }] }); });
    assert.equal((await icon('#a1 [data-action="share"] svg')).marker, 'share');
    assert.deepEqual({ ...(await icon('#a1 [data-action="save"] svg')) }, { cls: 'opf-icon opf-actions-icon', name: 'save', aria: 'true', focusable: 'false', d: 'M5 12h14', marker: null, width: 16, height: 16 });
    assert.equal(await icon('#a1 [data-action="plain"] svg'), null, 'no icon, no svg');
    mark('toolbar actions: per-action icon (path data and function)');

    // -- present button -----------------------------------------------------------------------------------------------------------------------
    await ev(() => { window.opfParts.presenter.createPresentButton(window.fresh('r1')); window.opfParts.presenter.createPresentButton(window.fresh('r2'), { icons: { present: 'M4 4h16v10H4z' } }); });
    assert.deepEqual({ ...(await icon('#r1 svg')), d: undefined }, { cls: 'opf-icon', name: 'present', aria: 'true', focusable: 'false', d: undefined, marker: null, width: 16, height: 16 });
    assert.equal((await icon('#r2 svg')).d, 'M4 4h16v10H4z');
    mark('present button: the icon');

    // -- a typo throws, in every part ---------------------------------------------------------------------------------------------------------
    const thrown = await ev(() => {
      const { expand, pill, help, design, nav, strip, toolbar, presenter } = window.opfParts;
      const host = window.fresh('e1');
      const attempt = (fn) => { try { fn(); return 'ok'; } catch (error) { return `${error.name}: ${error.message}`; } };
      const ctl = expand.createExpandController(document.querySelector('#editor'));
      const out = [
        attempt(() => expand.createExpandButton(host, { controller: ctl, icons: { expnad: 'M1 1' } })),
        attempt(() => pill.createReviewPill(host, { icons: { warn: 'M1 1' } })),
        attempt(() => help.createHelpButton(host, { icons: { question: 'M1 1' } })),
        attempt(() => design.createDesignMenu(host, { editor: window.session(), icons: { palette: 'M1 1' } })),
        attempt(() => nav.createSlideNavigator(host, { editor: window.session(), icons: { prev: 'M1 1' } })),
        attempt(() => strip.createThumbnailStrip(host, { editor: window.session(), icons: { plus: 'M1 1' } })),
        attempt(() => toolbar.createToolbar(host, { items: ['more'], icons: { dots: 'M1 1' } })),
        attempt(() => presenter.createPresentButton(host, { icons: { play: 'M1 1' } })),
        attempt(() => pill.createReviewPill(host, { icons: { valid: '<svg onload=alert(1)>' } })),
      ];
      ctl.destroy();
      return out;
    });
    thrown.forEach((message, index) => assert.match(message, index === 8 ? /^TypeError: .*valid must be an SVG element/ : /^RangeError: .*is not an icon of this part\. Use one of /, message));
    mark('an unknown icon name throws a RangeError and a bad value a TypeError');

    assert.deepEqual(errors, [], 'no page errors');
  } finally {
    await app.close();
  }
}

// ---- 3. tokens -------------------------------------------------------------------------------------------------------------------------------
{
  const app = await startWorkspacePage({ body: BODY });
  const { page, errors } = app;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  try {
    await ev(() => {
      window.mount = async (options) => { window.ed?.destroy(); window.ed = window.opfWs.createOpfEditor(document.querySelector('#editor'), { fonts: window.fonts, catalogs: [window.opfWs.gallery], ...options }); await window.ed.ready; await window.ed.whenIdle(); };
      window.styleOf = () => {
        const bar = document.querySelector('.opf-ws-bar');
        const tb = document.querySelector('.opf-tb');
        const input = document.querySelector('.opf-title-input');
        const probe = document.createElement('div'); probe.style.color = 'var(--opf-ui-surface)'; bar.append(probe); const surface = getComputedStyle(probe).color; probe.style.color = 'var(--opf-ui-fg)'; const fg = getComputedStyle(probe).color; probe.style.color = 'var(--opf-ui-border)'; const border = getComputedStyle(probe).color; probe.remove();
        const b = getComputedStyle(bar); const t = getComputedStyle(tb); const i = getComputedStyle(input);
        return { surface, fg, border, bg: b.backgroundColor, color: b.color, padding: b.padding, minHeight: b.minHeight, borderBottom: b.borderBottomColor, gap: t.columnGap, tbColor: t.color, font: i.fontFamily, size: i.fontSize, weight: i.fontWeight, titleColor: i.color, height: Math.round(bar.getBoundingClientRect().height) };
      };
    });

    // defaults equal the old look
    await ev((d) => window.mount({ document: d }), deck());
    const base = await ev(() => window.styleOf());
    assert.equal(base.bg, base.surface, 'the bar background is the surface');
    assert.equal(base.color, base.fg);
    assert.equal(base.borderBottom, base.border);
    assert.equal(base.padding, '6px 12px');
    assert.equal(base.minHeight, '0px');
    assert.equal(base.gap, '8px');
    assert.equal(base.tbColor, base.fg);
    assert.match(base.font, /^Inter\b/);
    assert.equal(base.size, '15px');
    assert.equal(base.weight, '600');
    assert.equal(base.titleColor, base.fg);
    assert.equal(await ev(() => getComputedStyle(document.querySelector('#editor')).getPropertyValue('--opf-ui-z-overlay').trim()), '1000');
    await ev((d) => window.mount({ document: d, layout: 'embed' }), deck());
    assert.equal((await ev(() => window.styleOf())).padding, '4px 8px', 'the embed layout keeps its compact bar');
    mark('defaults: the bar and the title look as before (surface, 6px 12px, 8px gap, 15px 600), embed 4px 8px');

    // token overrides through the theme option change the computed styles
    const tokens = { barBackground: 'rgb(10, 20, 30)', barText: 'rgb(240, 241, 242)', barBorder: 'rgb(1, 2, 3)', barGap: '20px', barPadding: '3px 5px', barHeight: '72px', titleFont: 'Georgia, serif', titleSize: '22px', titleWeight: '700', titleText: 'rgb(200, 0, 0)' };
    await ev((d) => window.mount({ document: d }), deck());
    await ev((t) => window.ed.setTheme({ tokens: t }), tokens);
    const themed = await ev(() => window.styleOf());
    assert.equal(themed.bg, 'rgb(10, 20, 30)');
    assert.equal(themed.color, 'rgb(240, 241, 242)');
    assert.equal(themed.tbColor, 'rgb(240, 241, 242)');
    assert.equal(themed.borderBottom, 'rgb(1, 2, 3)');
    assert.equal(themed.gap, '20px');
    assert.equal(themed.padding, '3px 5px');
    assert.equal(themed.minHeight, '72px');
    assert.ok(themed.height >= 72, 'the bar is at least as high as its minimum height');
    assert.match(themed.font, /^Georgia/);
    assert.equal(themed.size, '22px');
    assert.equal(themed.weight, '700');
    assert.equal(themed.titleColor, 'rgb(200, 0, 0)');
    // the full names work too, and the theme can be taken back
    await ev(() => window.ed.setTheme({ tokens: { '--opf-ui-bar-gap': '2px' } }));
    assert.equal((await ev(() => window.styleOf())).gap, '2px');
    assert.equal((await ev(() => window.styleOf())).padding, '6px 12px', 'a token that is no longer set is back to its default');
    // the embed padding default is a default: the theme wins over it
    await ev((d) => window.mount({ document: d, layout: 'embed', theme: { tokens: { barPadding: '10px 14px' } } }), deck());
    assert.equal((await ev(() => window.styleOf())).padding, '10px 14px');
    // dark: the defaults derive from the scheme's surface
    await ev((d) => window.mount({ document: d, theme: { colorScheme: 'dark' } }), deck());
    const dark = await ev(() => window.styleOf());
    assert.equal(dark.bg, dark.surface);
    assert.notEqual(dark.bg, base.bg, 'the dark bar is not the light one');
    mark('theme tokens barBackground, barText, barBorder, barGap, barPadding, barHeight and titleFont/Size/Weight/Text change the computed styles; defaults follow the scheme');

    // the overlay layer: the token, and the older --opf-expand-z first
    await ev((d) => window.mount({ document: d }), deck());
    await ev(() => window.ed.expand(true));
    assert.equal(await ev(() => getComputedStyle(document.querySelector('#editor')).zIndex), '1000', 'expanded: the default layer');
    await ev(() => window.ed.setTheme({ tokens: { overlayZ: '4321' } }));
    assert.equal(await ev(() => getComputedStyle(document.querySelector('#editor')).zIndex), '4321', 'the token sets the layer');
    await ev(() => document.querySelector('#editor').style.setProperty('--opf-expand-z', '77'));
    assert.equal(await ev(() => getComputedStyle(document.querySelector('#editor')).zIndex), '77', '--opf-expand-z still wins');
    await ev(() => { document.querySelector('#editor').style.removeProperty('--opf-expand-z'); window.ed.expand(false); });
    mark('--opf-ui-z-overlay sets the expanded editor\'s z-index; --opf-expand-z still wins');

    await ev(() => window.ed.destroy());
    assert.deepEqual(errors, [], 'no page errors');
  } finally {
    await app.close();
  }
}

// ---- 4. the examples of docs/styling.md ---------------------------------------------------------------------------------------------------
{
  const doc = readFileSync(new URL('../docs/styling.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const examples = {};
  for (const chunk of doc.split(/^## /m).slice(1)) examples[chunk.slice(0, chunk.indexOf('\n')).trim()] = [...chunk.matchAll(/```css\n([\s\S]*?)```/g)].map((match) => match[1]).join('\n');
  for (const name of ['Toolbar', 'Deck title', 'Expand', 'Design menu', 'Review pill', 'Help', 'Toolbar actions', 'Slide navigator', 'Thumbnail strip', 'The element']) assert.ok(examples[name], `the doc has a CSS example for ${name}`);

  const app = await startWorkspacePage({ bundle: { extraEntry: parts }, body: BODY, layered: true });
  const { page, errors } = app;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  try {
    // The page is the layered stylesheet; the examples are the host's own unlayered CSS, added last (and, for the layered cases, before nothing).
    await page.addStyleTag({ content: Object.values(examples).join('\n') });
    await ev(async (d) => {
      const SVG = 'http://www.w3.org/2000/svg';
      const stage = document.querySelector('#stage');
      const add = (id) => { const host = document.createElement('div'); host.id = id; stage.append(host); return host; };
      const session = () => window.opfWs.createEditorSession(d, { catalogs: [window.opfWs.gallery] });
      window.ed = window.opfWs.createOpfEditor(document.querySelector('#editor'), { document: d, fonts: window.fonts, catalogs: [window.opfWs.gallery] });
      await window.ed.ready; await window.ed.whenIdle();
      window.pill = window.opfParts.pill.createReviewPill(add('pill'));
      window.pill.update({ error: 1, warning: 0, info: 0, total: 1, all: 1, sources: [], unavailable: false });
      window.opfParts.help.createHelpButton(add('help'), { bindKey: false, getShortcuts: () => [{ label: 'Undo', keys: ['Mod-z'] }] });
      window.opfParts.actions.createToolbarActions(add('actions'), { actions: [{ id: 'a', label: 'Plain', run() {} }, { id: 'b', label: 'Main', primary: true, run() {} }] });
      window.opfParts.nav.createSlideNavigator(add('nav'), { editor: session() });
      const strip = add('strip'); strip.style.width = '600px';
      window.opfParts.strip.createThumbnailStrip(strip, { editor: session(), fonts: window.fonts, actions: true });
      window.opfParts.design.createDesignMenu(add('design'), { editor: session(), catalogs: [window.opfWs.gallery] });
      document.body.insertAdjacentHTML('beforeend', '<opf-editor id="el" layout="embed"></opf-editor>');
      window.opfParts.element.defineOpfEditorElement();
      window.svgNs = SVG;
    }, deck());
    const css = (selector, property) => ev(([s, p]) => getComputedStyle(document.querySelector(s))[p], [selector, property]);
    const resolved = (variable) => ev((v) => { const probe = document.createElement('div'); probe.style.color = `var(${v})`; document.querySelector('#stage').append(probe); const color = getComputedStyle(probe).color; probe.remove(); return color; }, variable);

    // Toolbar: a dark bar, buttons included
    assert.equal(await css('.opf-ws-bar', 'backgroundColor'), 'rgb(17, 24, 39)');
    assert.equal(await css('.opf-tb', 'color'), 'rgb(249, 250, 251)');
    assert.equal(await css('.opf-ws-bar', 'borderBottomColor'), 'rgb(55, 65, 81)');
    assert.equal(await css('.opf-ws-bar .opf-ws-button', 'backgroundColor'), 'rgb(31, 41, 55)', 'the buttons in the bar take the dark surface');
    mark('example Toolbar: a dark bar with dark buttons');
    // Deck title
    assert.match(await css('.opf-title-input', 'fontFamily'), /Source Serif 4/);
    assert.equal(await css('.opf-title-input', 'fontSize'), '18px');
    assert.equal(await css('.opf-title-input', 'fontWeight'), '700');
    mark('example Deck title: a serif heading face');
    // Expand
    await ev(() => window.ed.expand(true));
    assert.equal(await css('#editor', 'zIndex'), '6000');
    assert.equal(await css('#editor', 'backgroundColor'), 'rgb(243, 244, 246)');
    await ev(() => window.ed.expand(false));
    mark('example Expand: the layer and the backdrop');
    // Review pill
    assert.equal(await css('.opf-review-pill', 'borderRadius'), '999px');
    assert.equal(await css('.opf-review-pill', 'backgroundColor'), await resolved('--opf-ui-danger'), 'the error pill is filled');
    assert.equal(await css('.opf-review-pill-icon', 'color'), await css('.opf-review-pill', 'color'));
    mark('example Review pill: pill-shaped, filled for errors');
    // Help
    await page.click('#help button');
    assert.ok(Number.parseFloat(await css('.opf-shortcuts-dialog', 'width')) <= 480, 'the sheet is at most 480px wide');
    assert.ok(Number.parseFloat(await css('.opf-shortcuts-dialog', 'width')) > 300);
    assert.equal(await css('.opf-shortcuts-title', 'color'), await resolved('--opf-ui-accent-strong'));
    await page.keyboard.press('Escape');
    mark('example Help: a narrower sheet with a colored heading');
    // Toolbar actions
    assert.equal(await css('.opf-actions-button', 'borderTopLeftRadius'), '0px');
    assert.equal(await css('.opf-actions-button.is-primary', 'backgroundColor'), await resolved('--opf-ui-accent'));
    mark('example Toolbar actions: square buttons, an accent primary');
    // Slide navigator
    assert.equal(await css('.opf-nav-counter', 'fontFamily'), await css('#nav', 'fontFamily'), 'the counter follows the body font');
    assert.equal(await css('.opf-nav-counter', 'fontWeight'), '600');
    mark('example Slide navigator: the counter in the body font');
    // Thumbnail strip
    assert.equal(await css('.opf-thumbs-add', 'borderTopLeftRadius'), '50%');
    await page.waitForSelector('.opf-thumbs-item[aria-current="true"] .opf-thumbs-frame');
    assert.equal(await css('.opf-thumbs-item[aria-current="true"] .opf-thumbs-frame', 'outlineWidth'), '3px');
    mark('example Thumbnail strip: a thicker ring and a round add button');
    // Design menu
    await page.click('#design .opf-design-menu-trigger');
    assert.equal(await css('.opf-design-menu-popover', 'width'), '360px');
    assert.equal(await css('.opf-design-menu-popover', 'borderTopLeftRadius'), '0px');
    await page.keyboard.press('Escape');
    mark('example Design menu: a wider popover with square corners');
    // The element
    await ev(() => new Promise((resolve) => setTimeout(resolve, 0)));
    const element = await ev(() => { const el = document.querySelector('#el'); const style = getComputedStyle(el); return { height: style.height, border: style.borderTopWidth, radius: style.borderTopLeftRadius, state: el.getAttribute('data-opf-state'), opacity: style.opacity, display: style.display }; });
    assert.equal(element.height, '420px', 'the example height beats the zero-specificity default of 600px');
    assert.equal(element.border, '1px');
    assert.equal(element.radius, '12px');
    assert.equal(element.display, 'block');
    assert.ok(['loading', 'ready', 'error'].includes(element.state), `the element sets data-opf-state (${element.state})`);
    if (element.state === 'loading') assert.equal(element.opacity, '0.5', 'the loading state is styled');
    mark('example The element: a framed box, state attribute styled');

    assert.deepEqual(errors.filter((message) => !/opf-editor|deck/i.test(message)), [], 'no page errors');
  } finally {
    await app.close();
  }
}

console.log(`styling hooks browser checks passed (${checks.length}):\n- ${checks.join('\n- ')}`);
