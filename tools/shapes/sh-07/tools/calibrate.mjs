// node calibrate.mjs: a PPTX of Aptos text boxes (insets 0, top anchor, no wrap) with known tops, sizes and line spacings, to measure
// where PowerPoint puts the first baseline. Writes ../calib/calib.pptx and ../calib/expect.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/opf-work/sh-07-native-diagrams/packages/pptx/package.json');
const { zipSync, unzipSync, strFromU8, strToU8 } = require('fflate');
const PptxGenJS = (await import('file:///C:/opf-work/sh-07-native-diagrams/packages/pptx/vendor/pptxgenjs/pptxgen.es.js')).default;
const out = 'C:/opf-work/shapes/sh-07/calib';
mkdirSync(out, { recursive: true });
const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
// 13.333 x 7.5 in = 1280 x 720 px at 96 dpi.
const cases = [];
const fonts = ['Aptos', 'Arial', 'Georgia', 'Segoe UI', 'Cambria'];
for (const [fi, font] of fonts.entries()) {
  const slide = pptx.addSlide();
  [40].forEach((size, si) => {
    for (const [mi, mode] of ['pts120', 'pts125', 'pts130', 'pts135', 'pts150', 'pts200', 'pct100', 'pct130'].entries()) {
      const x = 20 + (mi % 4) * 300, y = 40 + Math.floor(mi / 4) * 330;
      const name = `cal ${fi} ${si} ${mi}`;
      cases.push({ slide: fi + 1, font, size, mode, x, y, name });
      slide.addText('HH', { x: x / 96, y: y / 96, w: 1, h: 1, objectName: name, fontFace: font, fontSize: size * 0.75, margin: 0 });
    }
  });
}
const bytes = await pptx.write({ outputType: 'uint8array' });
const parts = unzipSync(bytes);
for (const key of Object.keys(parts).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))) {
  let xml = strFromU8(parts[key]);
  xml = xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (sp) => {
    const name = /name="(cal [^"]+)"/.exec(sp)?.[1];
    const c = cases.find((k) => k.name === name);
    if (!c) return sp;
    const spacing = c.mode.startsWith('pct') ? '<a:spcPct val="' + Number(c.mode.slice(3)) * 1000 + '"/>' : '<a:spcPts val="' + Math.round(c.size * Number(c.mode.slice(3)) / 100 * 0.75 * 100) + '"/>';
    sp = sp.replace(/<a:bodyPr[^>]*\/>|<a:bodyPr[\s\S]*?<\/a:bodyPr>/, '<a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t" rtlCol="0"><a:noAutofit/></a:bodyPr>');
    sp = sp.replace(/<a:pPr[^>]*\/>|<a:pPr[^>]*>[\s\S]*?<\/a:pPr>/, `<a:pPr><a:lnSpc>${spacing}</a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft></a:pPr>`);
    if (!/<a:pPr/.test(sp)) sp = sp.replace('<a:p>', `<a:p><a:pPr><a:lnSpc>${spacing}</a:lnSpc></a:pPr>`);
    return sp;
  });
  parts[key] = strToU8(xml);
}
writeFileSync(`${out}/calib.pptx`, zipSync(parts));
writeFileSync(`${out}/expect.json`, JSON.stringify(cases, null, 1));
console.log(cases.length);
