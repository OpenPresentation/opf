import assert from 'node:assert/strict';
import { startWorkspacePage } from './support/workspace-page.mjs';

// FR-03 follow-up: links work in a slide that is read, not edited (the viewer layout, a read-only editor, the MCP viewer's superseded view).
// A `slide:<id>` link shows its slide (a hidden one too) and the focus lands on the slide; a web, mail or phone link goes to the host's
// `onOpenLink`, else a new tab with noopener and noreferrer; any other address is ignored; the frame never navigates. An editable slide keeps a
// plain click for editing and follows a link on Ctrl or Cmd with the click. Nothing is drawn differently (the SVG is the renderer's own).
const checks = [];
const mark = (name) => checks.push(name);
const app = await startWorkspacePage({ viewport: { width: 1280, height: 900 } });
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);

const fixture = () => ({
  name: 'Links fixture',
  language: 'en-US',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    {
      id: 'agenda',
      title: 'Agenda',
      blocks: [
        { text: ['Go to ', { text: 'pricing', link: 'slide:pricing' }, ', the ', { text: 'appendix', link: 'slide:appendix' }, ', or the ', { text: 'site', link: 'https://example.test/site' }, '.'] },
        { text: ['Write ', { text: 'us', link: 'mailto:hello@example.test' }, ' or ', { text: 'call', link: 'tel:+15555550100' }, '.'] },
      ],
    },
    { id: 'middle', title: 'Middle', text: 'Nothing here' },
    { id: 'pricing', title: 'Pricing', text: 'Plans' },
    { id: 'appendix', title: 'Appendix', text: 'Hidden', hidden: true },
  ],
});

try {
  await ev(() => {
    window.calls = [];
    window.opened = [];
    window.mountEditor = async (options) => {
      window.ed?.destroy();
      document.querySelector('#host')?.remove();
      const host = document.createElement('div');
      host.id = 'host';
      host.style.cssText = 'width:1000px;height:700px';
      document.body.append(host);
      window.ed = window.opfWs.createOpfEditor(host, { fonts: window.fonts, catalogs: [window.opfWs.gallery], ...options });
      window.events = [];
      window.ed.on('link', (detail) => window.events.push(detail));
      await window.ed.ready;
      await window.ed.whenIdle();
    };
    // Nothing leaves the page: window.open is recorded, and a click that reaches the window unprevented would be a navigation.
    window.open = (...args) => { window.opened.push(args); return null; };
    window.navigations = 0;
    window.addEventListener('click', (event) => { if (event.target.closest?.('a[href]') && !event.defaultPrevented) window.navigations += 1; });
  });
  const counter = () => ev(() => document.querySelector('#host .opf-ws-counter .opf-nav-counter')?.textContent);
  const link = (href) => page.locator(`#host .opf-canvas a[href="${href}"]`).first();
  const slideLink = (id) => page.locator(`#host .opf-canvas a[data-opf-slide-link="${id}"]`).first();
  const mountViewer = async (extra = {}) => {
    await ev((options) => window.mountEditor({ document: options.document, layout: 'viewer', onOpenLink: (href) => window.calls.push(href), ...options.extra }), { document: fixture(), extra });
    await page.waitForSelector('#host .opf-canvas a[href]');
    await ev(() => { window.calls.length = 0; window.opened.length = 0; window.navigations = 0; });
  };

  // ---- the viewer layout: links are reachable, the slide is not inert and has no editing targets ------------------------------------------
  await mountViewer();
  const shape = await ev(() => {
    const frame = document.querySelector('#host .opf-canvas').closest('[inert]');
    return { inert: !!frame, targets: document.querySelectorAll('#host .opf-canvas [data-canvas-target]').length, links: document.querySelectorAll('#host .opf-canvas a[href]').length, readonly: document.querySelector('#host .opf-canvas').hasAttribute('data-readonly') };
  });
  assert.deepEqual(shape, { inert: false, targets: 0, links: 5, readonly: true }, 'a read-only slide is not inert, has no editing targets and keeps its five links');
  assert.equal(await page.locator('#host .opf-canvas a[href]').first().evaluate((node) => getComputedStyle(node).cursor), 'pointer', 'a link has the pointer cursor');
  mark('the viewer layout draws the slide unlocked: its links are there, no editing target, pointer cursor');

  // ---- a slide link: a click shows the slide and the focus lands on it ---------------------------------------------------------------------
  assert.equal(await counter(), '01 / 04');
  await slideLink('pricing').click();
  assert.equal(await counter(), '03 / 04', 'a click on a slide link shows that slide');
  assert.equal(await ev(() => document.activeElement?.classList.contains('opf-canvas')), true, 'the focus lands on the slide');
  assert.deepEqual(await ev(() => window.events), [{ slide: 'pricing', index: 2 }], 'the link event names the slide');
  assert.deepEqual(await ev(() => [window.calls.length, window.opened.length, window.navigations]), [0, 0, 0], 'a slide link opens nothing outside the deck and the frame does not navigate');
  await ev(() => window.ed.setSlide(0));
  await page.waitForSelector('#host .opf-canvas a[data-opf-slide-link]');
  // A link to a hidden slide goes to it (the viewer lists hidden slides, the way the presenter and PowerPoint jump).
  await slideLink('appendix').click();
  assert.equal(await counter(), '04 / 04', 'a slide link to a hidden slide shows it');
  mark('a click on a slide:<id> link shows that slide, a hidden one too, and the focus lands on the slide; nothing opens outside the deck');

  // ---- Enter on a focused link ----------------------------------------------------------------------------------------------------------------
  await ev(() => window.ed.setSlide(0));
  await page.waitForSelector('#host .opf-canvas a[data-opf-slide-link]');
  await page.keyboard.press('Tab');
  const reach = [];
  for (let step = 0; step < 14; step += 1) {
    reach.push(await ev(() => document.activeElement?.getAttribute?.('href') ?? null));
    if (reach.includes('slide:pricing') || reach.filter(Boolean).length >= 5) break;
    await page.keyboard.press('Tab');
  }
  const focusable = reach.filter(Boolean);
  assert.ok(focusable.length >= 1, `a link takes the Tab focus (reached ${JSON.stringify(reach)})`);
  await slideLink('pricing').focus();
  assert.equal(await ev(() => document.activeElement?.getAttribute('data-opf-slide-link')), 'pricing', 'a slide link can be focused');
  assert.equal(await ev(() => getComputedStyle(document.activeElement).outlineStyle !== 'none' || document.activeElement.matches(':focus-visible')), true, 'a focused link shows a focus ring');
  await page.keyboard.press('Enter');
  assert.equal(await counter(), '03 / 04', 'Enter on a focused slide link shows the slide');
  assert.equal(await ev(() => document.activeElement?.classList.contains('opf-canvas')), true, 'the focus moves to the slide');
  mark('a link is reachable with Tab, shows a focus ring, and Enter follows it');

  // ---- an unknown slide id goes nowhere ----------------------------------------------------------------------------------------------------
  await ev(() => window.ed.setSlide(0));
  await page.waitForSelector('#host .opf-canvas a[data-opf-slide-link]');
  await ev(() => { window.events.length = 0; document.querySelector('#host .opf-canvas a[data-opf-slide-link=pricing]').setAttribute('data-opf-slide-link', 'nowhere'); });
  await slideLink('nowhere').click();
  assert.equal(await counter(), '01 / 04', 'a slide link to no slide does nothing');
  assert.deepEqual(await ev(() => window.events), []);
  mark('a slide link to an id no slide has does nothing');

  // ---- web, mail and phone links go to the host ----------------------------------------------------------------------------------------------
  await ev(() => window.ed.setSlide(0));
  await page.waitForSelector('#host .opf-canvas a[href^="https:"]');
  await link('https://example.test/site').click();
  await link('mailto:hello@example.test').click();
  await link('tel:+15555550100').click();
  assert.deepEqual(await ev(() => window.calls), ['https://example.test/site', 'mailto:hello@example.test', 'tel:+15555550100'], 'the host opens web, mail and phone links');
  assert.deepEqual(await ev(() => [window.opened.length, window.navigations, location.href === 'about:blank' || location.protocol !== 'https:']), [0, 0, true], 'nothing else opens and the frame stays');
  assert.equal(await counter(), '01 / 04', 'a web link does not move the slide');
  await ev(() => { window.calls.length = 0; });
  await link('https://example.test/site').focus();
  await page.keyboard.press('Enter');
  assert.deepEqual(await ev(() => window.calls), ['https://example.test/site'], 'Enter on a focused web link goes to the host too');
  mark('a click or Enter on a web, mail or phone link goes to onOpenLink and the frame does not navigate');

  // ---- an address that is not http, https, mailto or tel is ignored ------------------------------------------------------------------------
  await ev(() => {
    window.calls.length = 0;
    for (const href of ['javascript:window.hacked=1', 'data:text/html,hi', 'file:///etc/hosts', 'ftp://example.test/x']) {
      const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'a');
      anchor.setAttribute('href', href);
      anchor.setAttribute('data-injected', '');
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.textContent = href;
      anchor.append(text);
      document.querySelector('#host .opf-canvas svg').append(anchor);
    }
  });
  for (const node of await page.locator('#host .opf-canvas a[data-injected]').all()) await node.dispatchEvent('click');
  assert.deepEqual(await ev(() => [window.calls.length, window.opened.length, window.hacked ?? null]), [0, 0, null], 'javascript:, data:, file: and ftp: links are ignored');
  mark('a javascript:, data:, file: or ftp: link is ignored');

  // ---- no onOpenLink: a new tab with noopener and noreferrer -----------------------------------------------------------------------------
  await ev((document) => window.mountEditor({ document, layout: 'viewer' }), fixture());
  await page.waitForSelector('#host .opf-canvas a[href^="https:"]');
  await ev(() => { window.opened.length = 0; });
  await link('https://example.test/site').click();
  assert.deepEqual(await ev(() => window.opened), [['https://example.test/site', '_blank', 'noopener,noreferrer']], 'without a host callback a new tab opens with noopener and noreferrer');
  await ev(() => { window.opened.length = 0; });
  await link('mailto:hello@example.test').click();
  assert.equal(await ev(() => window.opened.length), 1, 'a mail link opens the same way');
  mark('without onOpenLink a web link opens a new tab with noopener and noreferrer');

  // ---- an editable slide: a plain click edits, Ctrl or Cmd with the click follows ---------------------------------------------------------------
  await ev((document) => window.mountEditor({ document, layout: 'canvas', onOpenLink: (href) => window.calls.push(href) }), fixture());
  await page.waitForSelector('#host .opf-canvas [data-canvas-target]');
  await ev(() => { window.calls.length = 0; window.events.length = 0; window.opened.length = 0; });
  await slideLink('pricing').click();
  assert.equal(await ev(() => document.querySelector('#host .opf-ws-counter .opf-nav-counter')?.textContent ?? '01 / 04'), '01 / 04', 'a plain click on a slide link in an editable slide does not change the slide');
  assert.deepEqual(await ev(() => [window.events.length, window.calls.length, window.opened.length]), [0, 0, 0], 'a plain click on a link in an editable slide follows nothing');
  assert.equal(await ev(() => !!document.querySelector('#host .opf-canvas textarea, #host .opf-canvas [contenteditable], #host .opf-inline-input, #host .opf-canvas input')), true, 'it edits the text instead');
  await page.keyboard.press('Escape');
  await link('https://example.test/site').click({ modifiers: ['Control'] });
  assert.deepEqual(await ev(() => window.calls), ['https://example.test/site'], 'Ctrl with a click follows the link in an editable slide');
  assert.equal(await ev(() => window.ed.slideIndex), 0);
  await slideLink('pricing').click({ modifiers: ['Control'] });
  assert.equal(await ev(() => window.ed.slideIndex), 2, 'Ctrl with a click on a slide link shows the slide');
  mark('in an editable slide a plain click edits and follows nothing; Ctrl or Cmd with the click follows the link');

  // ---- a read-only switch at run time ----------------------------------------------------------------------------------------------------------
  await ev((document) => window.mountEditor({ document, layout: 'canvas', onOpenLink: (href) => window.calls.push(href) }), fixture());
  await page.waitForSelector('#host .opf-canvas [data-canvas-target]');
  await ev(() => { window.ed.setReadOnly(true); window.calls.length = 0; });
  await page.waitForFunction(() => !document.querySelector('#host .opf-canvas [data-canvas-target]') && document.querySelector('#host .opf-canvas a[href]'));
  await link('https://example.test/site').click();
  assert.deepEqual(await ev(() => window.calls), ['https://example.test/site'], 'setReadOnly(true) makes the links work');
  await ev(() => window.ed.setReadOnly(false));
  await page.waitForSelector('#host .opf-canvas [data-canvas-target]');
  mark('setReadOnly switches a mounted editor between editing and working links');

  assert.deepEqual(errors, [], 'no page error');
  console.log(`viewer links in a browser: ${checks.length} checks`);
  for (const name of checks) console.log(`  ok  ${name}`);
}
catch (error) {
  console.error(error);
  process.exitCode = 1;
}
finally {
  await app.close();
}
