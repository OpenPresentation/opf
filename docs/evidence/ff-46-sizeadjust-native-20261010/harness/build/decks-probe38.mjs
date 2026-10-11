// opf#361 lineAscent probe (RR-38 method): one deck per family, one slide per size (18, 24 and 32 pt). Each row is a one-line text box
// with the export's own line-shape conventions (wrap none, zero insets, anchor top, 100 percent line spacing, box height 1.22 x size as
// core composes it), black text on white. Rows: the family regular, bold, and a mixed line (the family's script around an Aptos Latin run).
// The controls deck re-measures families already in the policy or measured natively (Angsana New 0.85, Sakkal Majalla 0.78, Arabic
// Typesetting 0.70) to check the method. The base package is a toPptx export of a 3-slide deck; only the slides' shape trees are replaced.
import {unzipSync, zipSync, strFromU8, strToU8} from 'fflate';
import {exportDeck} from './lib.mjs';

export const SIZES = [18, 24, 32];
const S = 'https://openpresentation.org/schema/opf/v1';
const SCRIPT = {
  thai: {lang: 'th-TH', slot: 'cs', rtl: false, text: 'ภาษาไทยสวยมาก ราตรีสวัสดิ์นะ ๒๕๖๙', mixed: ['รายงานไตรมาส ', 'PowerPoint 365', ' ปี ๒๕๖๙']},
  korean: {lang: 'ko-KR', slot: 'ea', rtl: false, text: '분기별 검토: 매출이 전년 대비 증가했습니다', mixed: ['분기별 검토 ', 'PowerPoint 365', ' 매출 증가']},
  hindi: {lang: 'hi-IN', slot: 'cs', rtl: false, text: 'यह निर्मला यूआई फ़ॉन्ट में लिखा गया है', mixed: ['तिमाही समीक्षा ', 'PowerPoint 365', ' राजस्व बढ़ा']},
  arabic: {lang: 'ar-SA', slot: 'cs', rtl: true, text: 'نظام تصميم موحد وإعدادات خطوط متسقة لعام 2026', mixed: ['أضاف المنتج ', 'PowerPoint 365', ' أكثر من 50 لغة']},
};
export const PROBES = [
  {id: 'probe38-dilleniaupc', family: 'DilleniaUPC', script: 'thai', rows: [['regular', false, false], ['bold', true, false], ['mixed', false, true]]},
  {id: 'probe38-malgun-gothic', family: 'Malgun Gothic', script: 'korean', rows: [['regular', false, false], ['bold', true, false], ['mixed', false, true]]},
  {id: 'probe38-nirmala-ui', family: 'Nirmala UI', script: 'hindi', rows: [['regular', false, false], ['bold', true, false], ['mixed', false, true]]},
  {id: 'probe38-controls', family: null, controls: [['Angsana New', 'thai', 0.85], ['Sakkal Majalla', 'arabic', 0.78], ['Arabic Typesetting', 'arabic', 0.70]]},
];
// Attempt 3 (set probe38b): the families whose mixed line was never probed, measured single (regular, bold) AND mixed, in the attempt-2 setup.
export const PROBES_B = [
  {id: 'probe38b-angsana-new', family: 'Angsana New', script: 'thai', rows: [['regular', false, false], ['bold', true, false], ['mixed', false, true]]},
  {id: 'probe38b-sakkal-majalla', family: 'Sakkal Majalla', script: 'arabic', rows: [['regular', false, false], ['bold', true, false], ['mixed', false, true]]},
  {id: 'probe38b-arabic-typesetting', family: 'Arabic Typesetting', script: 'arabic', rows: [['regular', false, false], ['bold', true, false], ['mixed', false, true]]},
];

const EMU = 12700, X = 43.2, W = 873.6;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rPr = (lang, size, bold, latin, scriptSlot, scriptFace) =>
  `<a:rPr lang="${lang}" sz="${Math.round(size * 100)}" b="${bold ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="000000"/></a:solidFill>` +
  `<a:latin typeface="${esc(latin)}"/><a:ea typeface="${esc(scriptSlot === 'ea' ? scriptFace : latin)}"/><a:cs typeface="${esc(scriptSlot === 'cs' ? scriptFace : latin)}"/></a:rPr>`;
let nextId = 100;
function box({name, y, size, runs, rtl}) {
  const h = Math.round(size * 1.22 * 100) / 100;
  const body = runs.map(([text, props]) => `<a:r>${props}<a:t>${esc(text)}</a:t></a:r>`).join('');
  return {h, xml: `<p:sp><p:nvSpPr><p:cNvPr id="${nextId++}" name="${esc(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${Math.round(X * EMU)}" y="${Math.round(y * EMU)}"/><a:ext cx="${Math.round(W * EMU)}" cy="${Math.round(h * EMU)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>` +
    `<a:p><a:pPr algn="${rtl ? 'r' : 'l'}" rtl="${rtl ? 1 : 0}"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buNone/></a:pPr>${body}</a:p></p:txBody></p:sp>`};
}
const tree = shapes => `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree>`;

function rowsFor(probe) {
  if (probe.controls) return probe.controls.map(([family, script, known]) => ({family, script, weight: 'regular', bold: false, mixed: false, known}));
  return probe.rows.map(([weight, bold, mixed]) => ({family: probe.family, script: probe.script, weight, bold, mixed}));
}

/** Builds one probe deck; returns {bytes, diagnostics, layout: [{slide, size, rows: [{name, family, weight, kind, box}]}]}. */
export async function buildProbe(probe) {
  const base = {$schema: S, name: probe.id, language: 'en-US', slides: SIZES.map(size => ({title: `${size} pt`}))};
  const {bytes, diagnostics} = await exportDeck(base, {provenance: false});
  const files = unzipSync(bytes);
  const layout = [];
  SIZES.forEach((size, i) => {
    const part = `ppt/slides/slide${i + 1}.xml`;
    let y = 40;
    const shapes = [], rows = [];
    for (const row of rowsFor(probe)) {
      const sc = SCRIPT[row.script];
      const faceProps = (bold, latin) => rPr(sc.lang, size, bold, latin, sc.slot, row.family);
      const runs = row.mixed ? [[sc.mixed[0], faceProps(row.bold, row.family)], [sc.mixed[1], rPr('en-US', size, row.bold, 'Aptos', sc.slot, row.family)], [sc.mixed[2], faceProps(row.bold, row.family)]] : [[sc.text, faceProps(row.bold, row.family)]];
      const name = `probe38|${row.family}|${row.weight}|${row.mixed ? 'mixed' : 'single'}|${size}`;
      const b = box({name, y, size, runs, rtl: sc.rtl});
      shapes.push(b.xml);
      rows.push({name, family: row.family, weight: row.weight, kind: row.mixed ? 'mixed' : 'single', known: row.known ?? null, box: {x: X, y, w: W, h: b.h}});
      y += b.h + 34;
    }
    let xml = strFromU8(files[part]);
    xml = xml.replace(/<p:spTree>[\s\S]*<\/p:spTree>/, tree(shapes.join('')));
    // White background on the slide itself, so ink detection is plain dark-on-white.
    xml = xml.replace(/<p:bg>[\s\S]*?<\/p:bg>/, '').replace('<p:cSld>', '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>').replace(/<p:cSld name="([^"]*)">/, '<p:cSld name="$1"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>');
    files[part] = strToU8(xml);
    layout.push({slide: i + 1, size, rows});
  });
  return {bytes: zipSync(files, {level: 6, mtime: new Date('2026-10-10T00:00:00Z')}), diagnostics, layout};
}
