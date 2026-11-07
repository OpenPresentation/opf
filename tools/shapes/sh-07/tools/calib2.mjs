// node calib2.mjs: where PowerPoint puts the first baseline of exactly spaced text in a text box and in shapes with insets (rect, roundRect,
// a custom geometry), with the text area larger than, equal to and smaller than the line pitch. Writes ../calib2/calib.pptx and expect.json;
// every case is built so that its baseline should be at y = 200 (+ 160 per row) by the rule baseline = text top + 0.75 pitch.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/opf-work/sh-07-native-diagrams/packages/pptx/package.json');
const { zipSync, unzipSync, strFromU8, strToU8 } = require('fflate');
const PptxGenJS = (await import('file:///C:/opf-work/sh-07-native-diagrams/packages/pptx/vendor/pptxgenjs/pptxgen.es.js')).default;
const out = 'C:/opf-work/shapes/sh-07/calib2';
mkdirSync(out, { recursive: true });
const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
const E = 9525;
const cases = [];
const slide = pptx.addSlide();
const size = 28, pitch = 1.4 * size;
const kinds = [
  { kind: 'txbox', geom: 'rect', tIns: 0, bIns: 0, h: pitch },
  { kind: 'rect-ins', geom: 'rect', tIns: 20, bIns: 20, h: pitch + 40 },
  { kind: 'rect-tight', geom: 'rect', tIns: 20, bIns: 0, h: pitch + 20 },
  { kind: 'rect-short', geom: 'rect', tIns: 20, bIns: 10, h: pitch + 20 },
  { kind: 'rect-tall', geom: 'rect', tIns: 20, bIns: 0, h: pitch + 80 },
  { kind: 'round-ins', geom: 'roundRect', tIns: 20, bIns: 20, h: pitch + 40 },
  { kind: 'cust-ins', geom: 'cust', tIns: 20, bIns: 20, h: pitch + 40 },
  { kind: 'txbox-big', geom: 'rect', tIns: 0, bIns: 0, h: pitch * 3 },
];
kinds.forEach((k, index) => {
  const col = index % 4, row = Math.floor(index / 4);
  const x = 40 + col * 300, baseline = 200 + row * 260;
  // rect text rectangle = frame; roundRect (adj 16667) insets its text rect by 0.29289 * radius.
  const radius = k.geom === 'roundRect' ? 0.16667 * Math.min(240, k.h) : 0, inset = radius * 0.29289;
  const top = baseline - 0.75 * pitch;
  const frameY = top - k.tIns - inset;
  const name = `cal ${index}`;
  cases.push({ ...k, x, baseline, name, size, pitch });
  slide.addText('HHH', { x: x / 96, y: frameY / 96, w: 240 / 96, h: k.h / 96 + (inset * 2) / 96, objectName: name, fontFace: 'Aptos', fontSize: size * 0.75, margin: 0, fill: { color: 'EEEEEE' } });
});
const bytes = await pptx.write({ outputType: 'uint8array' });
const parts = unzipSync(bytes);
let xml = strFromU8(parts['ppt/slides/slide1.xml']);
xml = xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (sp) => {
  const name = /name="(cal [^"]+)"/.exec(sp)?.[1];
  const c = cases.find((k) => k.name === name);
  if (!c) return sp;
  sp = sp.replace(/<a:bodyPr[^>]*\/>|<a:bodyPr[\s\S]*?<\/a:bodyPr>/, `<a:bodyPr wrap="none" lIns="0" tIns="${Math.round(c.tIns * E)}" rIns="0" bIns="${Math.round(c.bIns * E)}" anchor="t" rtlCol="0"><a:noAutofit/></a:bodyPr>`);
  sp = sp.replace(/<a:pPr[^>]*\/>|<a:pPr[^>]*>[\s\S]*?<\/a:pPr>/, `<a:pPr><a:lnSpc><a:spcPts val="${Math.round(c.pitch * 75)}"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft></a:pPr>`);
  if (!/<a:pPr/.test(sp)) sp = sp.replace('<a:p>', `<a:p><a:pPr><a:lnSpc><a:spcPts val="${Math.round(c.pitch * 75)}"/></a:lnSpc></a:pPr>`);
  if (c.geom === 'roundRect') sp = sp.replace(/<a:prstGeom prst="rect">/, '<a:prstGeom prst="roundRect">');
  if (c.geom === 'cust') sp = sp.replace(/<a:prstGeom prst="rect"><a:avLst\/><\/a:prstGeom>/, '<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="100" h="100"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="100" y="0"/></a:lnTo><a:lnTo><a:pt x="100" y="100"/></a:lnTo><a:lnTo><a:pt x="0" y="100"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>');
  return sp;
});
parts['ppt/slides/slide1.xml'] = strToU8(xml);
writeFileSync(`${out}/calib.pptx`, zipSync(parts));
writeFileSync(`${out}/expect.json`, JSON.stringify(cases, null, 1));
writeFileSync(`${out}/list.txt`, 'calib|C:\\opf-work\\shapes\\sh-07\\calib2\\calib.pptx|0');
console.log(cases.length);
