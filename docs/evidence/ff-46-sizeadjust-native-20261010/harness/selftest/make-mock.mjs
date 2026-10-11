// Self-test of compare.mjs WITHOUT Office: fabricates "perfect" native read-outs from manifest.json (what PowerPoint would report if
// every criterion held) under native/selftest-pass, and a copy with known defects under native/selftest-defects, plus a fake FF-13
// attempt. Then: node compare.mjs --native native/selftest-pass ... must PASS everything, and the defects run must flag each defect.
// The mock PNGs are the preview PNGs themselves (ink ratio 1). Nothing here touches PowerPoint.
import {copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync, zipSync, strToU8, strFromU8} from 'fflate';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const write = (file, value) => { mkdirSync(path.dirname(file), {recursive: true}); writeFileSync(file, JSON.stringify(value, null, 1)); };
const themeOut = t => t && {major: {latin: t.major.latin, eastAsian: t.major.ea, complexScript: t.major.cs}, minor: {latin: t.minor.latin, eastAsian: t.minor.ea, complexScript: t.minor.cs}};
const resolveRef = (name, theme, heading) => {
  if (!name) return null;
  const m = /^\+(mj|mn)-(lt|ea|cs)$/.exec(name);
  if (!m) return name;
  const role = m[1] === 'mj' ? theme.major : theme.minor;
  return role[{lt: 'latin', ea: 'ea', cs: 'cs'}[m[2]]] || '';
};

function mockRead(set, id, d, dir) {
  const theme = d.theme;
  const slides = d.perSlide.map(ps => {
    const shapes = ps.shapes.map(sh => {
      const isHeading = /heading/.test(sh.name);
      const runs = sh.runs.map(r => ({text: r.text, languageId: 1033, font: {name: resolveRef(r.latin, theme, isHeading) ?? (isHeading ? theme.major.latin : theme.minor.latin), nameFarEast: resolveRef(r.ea, theme, isHeading) ?? (isHeading ? theme.major.ea : theme.minor.ea), nameComplexScript: resolveRef(r.cs, theme, isHeading) ?? (isHeading ? theme.major.cs : theme.minor.cs), size: r.size, bold: r.bold ? -1 : 0, italic: r.italic ? -1 : 0}}));
      return {name: sh.name, type: sh.placeholder ? 14 : 17, left: sh.box?.x, top: sh.box?.y, width: sh.box?.w, height: sh.box?.h, hasTextFrame: true, hasText: true, hasTable: false, hasChart: false,
        text: sh.text, paragraphs: [{index: 1, text: sh.text, runs}], lineCount: 1, lines: [{index: 1, text: sh.text, boundLeft: sh.box?.x ?? 0, boundTop: sh.box?.y ?? 0, boundWidth: (sh.box?.w ?? 100) * 0.5, boundHeight: sh.box?.h ?? 20}]};
    });
    for (let c = 0; c < ps.charts; c++) shapes.push({name: `Chart ${c}`, type: 3, hasChart: true, hasTable: false, hasTextFrame: false, chart: {chartType: 51, seriesCount: 2}});
    for (let t = 0; t < ps.tables; t++) shapes.push({name: `Table ${t}`, type: 19, hasChart: false, hasTable: true, hasTextFrame: false, table: {rows: 1, columns: 1, cells: []}});
    let png = null;
    if (d.previews?.[ps.index - 1]) { png = `${id}-slide-${ps.index}.native.png`; copyFileSync(path.join(ROOT, 'previews', set, d.previews[ps.index - 1]), path.join(dir, png)); }
    return {index: ps.index, slideId: 255 + ps.index, png, shapes, notes: ps.notesText || null, headersFooters: null};
  });
  return {schema: 'opf323-native-read/v2', deck: `<set>/decks/${set}/${id}.pptx`, id, stage: 'done', opened: true, readOnlyRequested: true, readOnly: -1, startedPowerPoint: false, error: null, truncated: false,
    app: {version: '16.0', build: 'mock'}, deckSha256: d.sha256, slideSize: {widthPt: d.slideSize.cx / 12700, heightPt: d.slideSize.cy / 12700, exportWidth: 1280, exportHeight: 720},
    presentationFonts: d.requiredFonts.map(name => ({name, embedded: 0, embeddable: -1})), theme: themeOut(d.theme), notesTheme: themeOut(d.notesTheme), slides, readErrors: [], elapsedMs: 1};
}

function mockFields(id, d) {
  const today = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const expected = {'MMMM d, yyyy': `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`, 'M/d/yyyy': `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`};
  const titles = d.perSlide.map(ps => ps.shapes.find(s => /heading/.test(s.name)).text);
  const orders = {initial: titles, 'after-duplicate': [titles[0], ...titles], 'after-move': [titles.at(-1), titles[0], ...titles.slice(0, -1)]};
  const fmt = d.fields.date.format;
  const slidesFor = order => order.map((title, i) => {
    const n = i + 1;
    const shapes = [{name: 'OPF heading slides.x.title line 0', placeholderType: null, text: title}];
    if (id === '01-footer-fields') shapes.push({name: `OPF furniture ${i} part 0 line 0`, placeholderType: 16, text: expected[fmt]}, {name: `OPF furniture ${i} part 1 line 0`, placeholderType: 15, text: 'FF-27 fields check'}, {name: `OPF furniture ${i} part 2 line 0`, placeholderType: 13, text: String(n)});
    else shapes.push({name: `OPF furniture ${i} part 0 line 0`, placeholderType: null, text: `Page ${n} of 5`}, {name: `OPF furniture ${i} part 1 line 0`, placeholderType: null, text: expected[fmt]}, {name: `OPF furniture ${i} part 2 line 0`, placeholderType: 13, text: `A-${n}`});
    return {index: n, slideId: 256 + n, phase: 'after-layout', shapes, headersFooters: {slideNumberVisible: -1, dateVisible: id === '01-footer-fields' ? -1 : 0, dateUseFormat: -1, dateFormat: d.fields.date.ppFormat, footerVisible: -1}};
  });
  return {schema: 'opf323-native-fields/v2', deck: `<set>/decks/ff27/${id}.pptx`, id, stage: 'done', deckSha256: d.sha256, powerpoint: {version: '16.0', build: 'mock'},
    clock: {localDate: today.toISOString().slice(0, 10), culture: 'en-US', expectedEnUS: expected},
    steps: Object.entries(orders).map(([step, order]) => ({step, operation: step, slideCount: order.length, before: slidesFor(order), after: slidesFor(order)})), readErrors: []};
}

function mockFf13(dir, defect) {
  mkdirSync(dir, {recursive: true});
  const src = path.join(ROOT, 'decks', 'ff13', 'ff13-carlito-embed-source.pptx');
  const files = unzipSync(readFileSync(src));
  const eot = family => { const name = Buffer.from(`${family}\u0000`, 'utf16le'); const b = Buffer.alloc(84 + name.length + 64); b.writeUInt32LE(b.length, 0); b.writeUInt32LE(64, 4); b.writeUInt32LE(0x20002, 8); b.writeUInt32LE(5, 12); b.writeUInt32LE(400, 28); b.writeUInt16LE(0x504c, 34); b.writeUInt16LE(name.length, 82); name.copy(b, 84); return new Uint8Array(b); };
  const styles = ['regular', 'bold', 'italic', 'boldItalic'];
  let rels = strFromU8(files['ppt/_rels/presentation.xml.rels']);
  let list = '<p:embeddedFontLst><p:embeddedFont><p:font typeface="Carlito"/>';
  styles.forEach((s, i) => { files[`ppt/fonts/font${i + 1}.fntdata`] = eot(defect && i === 1 ? 'Aptos' : 'Carlito'); rels = rels.replace('</Relationships>', `<Relationship Id="rIdF${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font${i + 1}.fntdata"/></Relationships>`); list += `<p:${s} r:id="rIdF${i}"/>`; });
  list += '</p:embeddedFont></p:embeddedFontLst>';
  files['ppt/_rels/presentation.xml.rels'] = strToU8(rels);
  files['ppt/presentation.xml'] = strToU8(strFromU8(files['ppt/presentation.xml']).replace('<p:presentation ', '<p:presentation embedTrueTypeFonts="1" saveSubsetFonts="1" ').replace('<p:defaultTextStyle>', `${list}<p:defaultTextStyle>`));
  writeFileSync(path.join(dir, 'copy.pptx'), zipSync(files));
  const sha = manifest.sets.ff13.decks['ff13-carlito-embed-source'].sha256;
  write(path.join(dir, 'report.json'), {saved: true, stage: 'done', sourceSha256Before: sha, sourceSha256After: sha, fontsBeforeSave: [{index: 1, name: 'Carlito', embedded: 0, embeddable: -1}], fontsAfterReopen: [{index: 1, name: 'Carlito', embedded: -1, embeddable: -1}], powerpoint: {version: '16.0', build: 'mock'}});
  write(path.join(dir, 'supervisor.json'), {child: {status: 'completed', exitCode: 0}, probes: []});
  write(path.join(dir, 'font-registration.json'), {faces: []});
}

for (const variant of ['selftest-pass', 'selftest-defects']) {
  const out = path.join(ROOT, 'native', variant);
  if (existsSync(out)) rmSync(out, {recursive: true});
  for (const [set, s] of Object.entries(manifest.sets)) {
    if (s.mode === 'embed' || set === 'probe38') continue;   // probe38 has its own synthetic test (selftest/probe-mock.mjs)
    for (const [id, d] of Object.entries(s.decks)) {
      const dir = path.join(out, set, id);
      mkdirSync(dir, {recursive: true});
      write(path.join(dir, `${id}.run.json`), {set, deck: id, mode: s.mode, status: 'completed', exitCode: 0, childPid: 1, timeoutSeconds: 90, sha256: d.sha256});
      if (s.mode === 'fields') {
        const f = mockFields(id, d);
        if (variant === 'selftest-defects' && id === '01-footer-fields') f.steps[2].after[0].shapes.find(x => x.placeholderType === 16).text = 'January 15, 2026';
        if (variant === 'selftest-defects' && id === '02-header-forms') f.steps[1].after[1].shapes.find(x => /Page/.test(x.text)).text = 'Page 1 of 5';
        write(path.join(dir, `${id}.fields.json`), f);
      } else {
        const r = mockRead(set, id, d, dir);
        if (variant === 'selftest-defects' && id === '01-carlito-code-chart-table-notes') r.presentationFonts.push({name: 'Aptos', embedded: 0, embeddable: -1});
        if (variant === 'selftest-defects' && id === '05-ar-rtl') r.theme.minor.complexScript = 'Arial';
        if (variant === 'selftest-defects' && id === 'scripts-18-ar-traditional-arabic') { r.slides[1].shapes[1].lineCount = 2; r.slides[1].shapes[2].lines[0].boundWidth = r.slides[1].shapes[2].width + 10; }
        if (variant === 'selftest-defects' && id === 'scripts-01-ja-meiryo') r.slides[0].shapes[1].paragraphs[0].runs[0].font.nameFarEast = 'Yu Gothic';
        write(path.join(dir, `${id}.json`), r);
      }
    }
  }
  if (manifest.sets.ff13) mockFf13(path.join(out, 'ff13-attempt'), variant === 'selftest-defects');
  console.log(`wrote native/${variant}`);
}
