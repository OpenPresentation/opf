// CE-20: a page with the Studio (`createOpfEditor(el, { layout: "studio" })`) on the workspace test page (the package stylesheet, the renderer's
// fonts handle with Roboto, the gallery catalog), and the decks the Studio suites use.
import { startWorkspacePage } from './workspace-page.mjs';

/** A deck with a row of three blocks, a group, a layout slide whose region accepts only text, a column of short text, and a chart slide. */
export function studioDeck() {
  return {
    name: 'Studio fixture',
    language: 'en-US',
    design: { theme: 'classic', fontScheme: 'roboto' },
    catalogs: { custom: { layouts: { 'text-and-media': { name: 'Text and media', direction: 'row', regions: [{ name: 'words', accepts: ['text'] }, { name: 'media', accepts: ['image', 'chart'] }] } } } },
    slides: [
      { id: 'row', title: 'Three blocks in a row', composition: { mode: 'row' }, blocks: [
        { id: 'first', text: 'First block of text' },
        { id: 'second', text: 'Second block of text' },
        { id: 'third', text: 'Third block of text' },
      ] },
      { id: 'grouped', title: 'A group', blocks: [
        { id: 'lead', text: 'Lead text before the group' },
        { id: 'pair', composition: { mode: 'row' }, blocks: [{ id: 'left', text: 'Left in the group' }, { id: 'right', text: 'Right in the group' }] },
      ] },
      { id: 'layout', title: 'Layout slide', layout: 'text-and-media', blocks: [{ id: 'words-1', text: 'Words in their region', region: 'words' }] },
      { id: 'stack', title: 'Stacked column', composition: { mode: 'column' }, blocks: [{ id: 'a', text: 'Short' }, { id: 'b', text: 'Also short' }] },
      { id: 'chart', title: 'Chart and table', composition: { mode: 'row' }, blocks: [
        { id: 'revenue', chart: { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 10], ['Q2', 14]] } } },
        { id: 'figures', table: { columns: ['Quarter', 'Revenue'], rows: [['Q1', '10'], ['Q2', '14']] } },
      ] },
    ],
  };
}

export async function startStudioPage(options = {}) {
  const app = await startWorkspacePage({ viewport: { width: 1440, height: 900 }, body: '<div id="host" style="width:1400px;height:860px"></div>', ...options });
  await app.page.evaluate(() => {
    window.base = () => ({ fonts: window.fonts, catalogs: [window.opfWs.gallery] });
    window.makeHost = (id = 'host', width = 1400, height = 860) => { document.querySelector(`#${id}`)?.remove(); const host = document.createElement('div'); host.id = id; host.style.cssText = `width:${width}px;height:${height}px;position:relative`; document.body.append(host); return host; };
  });
  return app;
}
