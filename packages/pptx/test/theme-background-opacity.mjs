import assert from 'node:assert/strict';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { validate } from '@openpresentation/opf';
import { gallery } from '@openpresentation/gallery';
import { toSvg } from '@openpresentation/opf-render';
import { toPptx, fromPptx } from '../dist/index.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false });
const catalogs = [gallery], options = { catalogs };
const slots = { light1: '#F0E0D0', light2: '#C0D0E0', dark1: '#204060', dark2: '#405060' };
const deck = background => ({
  design: { colorScheme: { id: 'cool-horizon', ...slots } },
  slides: [{ design: { background } }],
});
let cases = 0;
for (const [slot, color] of Object.entries(slots)) {
  for (const opacity of [undefined, 0, .25, .5, 1]) {
    const background = { type: 'theme', slot, ...(opacity === undefined ? {} : { opacity }) };
    const source = deck(background), before = structuredClone(source);
    assert.equal(validate(source, { catalogs, only: ['format'] }).schemaValid, true);
    const svg = parser.parse(toSvg(source, 1, options)).svg;
    const backgrounds = (Array.isArray(svg.rect) ? svg.rect : [svg.rect]).filter(rect => rect?.fill === color);
    assert.equal(backgrounds.length, 1, 'the public SVG paints the selected theme-slot color');
    assert.equal(Number(backgrounds[0].opacity), opacity ?? 1, 'the public SVG retains actual background opacity');

    const bytes = await toPptx(source, options), parts = unzipSync(bytes);
    const xml = strFromU8(parts['ppt/slides/slide1.xml']);
    const native = parser.parse(xml)['p:sld']['p:cSld']['p:bg']['p:bgPr']['a:solidFill'];
    const scheme = native['a:schemeClr'];
    assert.ok(scheme, 'opacity does not rasterize the background or replace its native theme reference');
    assert.equal(Number(scheme['a:alpha']?.val ?? 100000), Math.round((opacity ?? 1) * 100000));
    assert.deepEqual((await fromPptx(bytes, options)).slides[0].design.background, background, 'unchanged authored theme-slot/opacity round-trip');
    assert.deepEqual(source, before, 'validation, SVG and PPTX do not mutate authored opacity');

    if (opacity === .25) {
      // Read actual native alpha, without root source provenance replay. A native alpha edit must win too.
      const nativeParts = { ...parts };
      nativeParts['ppt/presentation.xml'] = strToU8(strFromU8(parts['ppt/presentation.xml']).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/, ''));
      const imported = await fromPptx(zipSync(nativeParts), options);
      assert.equal(imported.slides[0].design.background.color, color);
      assert.equal(imported.slides[0].design.background.opacity, .25, 'native-only import reads actual theme alpha');
      assert.ok(xml.includes('<a:alpha val="25000"/>'));
      nativeParts['ppt/slides/slide1.xml'] = strToU8(xml.replace('<a:alpha val="25000"/>', '<a:alpha val="60000"/>'));
      const edited = await fromPptx(zipSync(nativeParts), options);
      assert.equal(edited.slides[0].design.background.color, color);
      assert.equal(edited.slides[0].design.background.opacity, .6, 'current native alpha edit replaces the old authored value');
    }
    cases++;
  }
}
for (const opacity of [-.01, 1.01, '0.25', null, false, {}, []]) {
  await assert.rejects(toPptx(deck({ type: 'theme', slot: 'dark1', opacity }), options), error => error.code === 'invalid-opf');
}
await assert.rejects(toPptx(deck({ type: 'theme', slot: 'dark1', opacity: .25, opactiy: .25 }), options), error => error.code === 'invalid-opf');
console.log(`Theme background opacity: ${cases} public SVG/native-fill/authored controls, four native-only imports/alpha edits, and eight strict export refusals passed; no Office execution.`);
