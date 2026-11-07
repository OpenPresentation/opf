import {examples} from '@openpresentation/opf/examples';
import {toSvg} from 'file:///C:/opf-work/sh-04-overlays-connectors/packages/render/test/catalog-harness.mjs';
import {loadFonts} from 'file:///C:/opf-work/sh-04-overlays-connectors/packages/render/dist/fonts-node.js';
const handle = await loadFonts({pack: 'office', substitutionPolicy: 'metric'});
for (const {file, deck} of examples.filter(e => /arabic|rtl|language-and/.test(e.file))) {
  try { toSvg(deck, 1, {fonts: handle}); console.log('ok', file); } catch (e) { console.log(e.code, file, e.message.slice(0, 120)); }
}
