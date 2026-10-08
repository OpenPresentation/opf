// FF-32: native notes/core text is authoritative, including its whitespace.
// Public import/export only; no Office, source-text tags or hidden recovery.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync, zipSync, strFromU8, strToU8} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';

const output = path.resolve(process.env.OPF_NATIVE_TEXT_ARTIFACTS ?? 'artifacts/native-text-whitespace/source');
const baseline = process.env.OPF_NATIVE_TEXT_BASELINE && path.resolve(process.env.OPF_NATIVE_TEXT_BASELINE);
const options = {seed: 832, timestamp: '2026-09-29T12:00:00Z', zipDate: '2026-09-29T12:00:00Z', strictAssets: true};
const sha = value => createHash('sha256').update(value).digest('hex');
const report = {node: process.version, options, cases: [], exports: [], limits: 'Portable native XML conversion only, not Office acceptance. Empty/absent notes both import absent; empty/missing core title uses the existing fallback, and empty description/author import absent. Author arrays still serialize as a joined scalar.'};
await mkdir(output, {recursive: true});
async function check(id, callback) {
  try { await callback(); report.cases.push({id, passed: true}); }
  catch (error) { report.cases.push({id, passed: false, message: error.message, stack: error.stack}); }
}
async function save(name, bytes) {
  await writeFile(path.join(output, name), bytes);
  return {file: name, bytes: bytes.length, sha256: sha(bytes)};
}
async function exported(name, source, provenance) {
  const before = JSON.stringify(source), bytes = new Uint8Array(await toPptx(source, {...options, provenance}));
  report.exports.push(await save(name + '.pptx', bytes));
  assert.equal(JSON.stringify(source), before, 'Export must not mutate authored input');
  const entries = unzipSync(bytes);
  for (const [part, value] of Object.entries(entries)) if (/\.(xml|rels)$/.test(part)) {
    assert.equal(XMLValidator.validate(strFromU8(value)), true, `Well-formed ${part}`);
  }
  return bytes;
}
async function imported(bytes, id) {
  const before = sha(bytes), value = await fromPptx(bytes);
  assert.equal(sha(bytes), before, 'Import must not mutate input ZIP bytes');
  await writeFile(path.join(output, id + '.imported.json'), JSON.stringify(value, null, 2) + '\n');
  return value;
}
const deck = slides => ({name: 'Ordinary title', description: 'Ordinary description', author: 'Ordinary author', design: {fontScheme: 'roboto'}, slides});
const xml = (entries, name) => strFromU8(entries[name]);
const replacePart = (entries, name, callback) => {
  const before = xml(entries, name), after = callback(before);
  assert.notEqual(after, before, `${name}: mutation applied`); entries[name] = strToU8(after);
};
function bodyShape(shape) { return /<p:ph\b[^>]*\btype="body"/.test(shape); }
function changeNotes(entries, part, body, remove = false) {
  let count = 0;
  replacePart(entries, part, value => value.replace(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g, shape => {
    if (!bodyShape(shape)) return shape;
    count++;
    return remove ? '' : shape.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/, `<p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody>`);
  }));
  assert.equal(count, 1, 'Exactly one native notes body modified');
}
async function mutated(bytes, id, edit) {
  const entries = unzipSync(bytes); edit(entries);
  const changed = zipSync(entries, {level: 0, mtime: new Date('2000-01-01T00:00:00Z')});
  await save(id + '.pptx', changed);
  return imported(changed, id);
}
const p = text => `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`;
const field = (id, value) => `<a:fld id="{00000000-0000-0000-0000-${id}}" type="slidenum"><a:t>${value}</a:t></a:fld>`;
const values = [
  ['spaces', '  preserve edges  '], ['tab', '\tinside\tand edges\t'], ['nbsp', '\u00a0keep\u00a0'],
  ['cr', 'before\rafter'], ['lf', 'before\nafter'], ['crlf', 'before\r\nafter'],
  ['blank-lines', '\n\nfirst\n\nlast\n\n'], ['cr-blank-lines', '\r\rfirst\r\rlast\r\r'],
  ['only-spaces', '  '], ['only-tab', '\t'], ['only-breaks', '\r\n\n\r'],
  ['xml-literal', ' & < > " \' literal &#13; &#xD; actual \r\n end '],
];
const modes = [['full', undefined], ['references-only', 'references-only'], ['off', false]];

try {
  for (const [mode, provenance] of modes) {
    const ordinary = await exported(`ordinary-${mode}`, deck([{title: 'First', text: 'Editable body', notes: 'One line\nAnother line'}, {title: 'Second', text: 'Unchanged'}]), provenance);
    await check(`${mode}/ordinary-byte-baseline`, async () => {
      if (baseline) assert.deepEqual(ordinary, new Uint8Array(await readFile(path.join(baseline, `ordinary-${mode}.pptx`))), 'Ordinary whole ZIP bytes remain identical');
      else assert.deepEqual(ordinary, new Uint8Array(await toPptx(deck([{title: 'First', text: 'Editable body', notes: 'One line\nAnother line'}, {title: 'Second', text: 'Unchanged'}]), {...options, provenance})), 'Ordinary export deterministic');
    });

    const source = deck(values.map(([id, notes]) => ({title: id, text: 'Visible body', notes})));
    const bytes = await exported(`notes-${mode}`, source, provenance), value = await imported(bytes, `notes-${mode}`);
    for (const [index, [id, notes]] of values.entries()) await check(`${mode}/authored-notes/${id}`, () => assert.equal(value.slides[index].notes, notes));
    await check(`${mode}/notes-CR-encoded-as-text`, () => {
      const raw = xml(unzipSync(bytes), 'ppt/notesSlides/notesSlide4.xml');
      assert.ok(raw.includes('before&#13;after'), 'Own notes encode raw CR rather than relying on parser normalization');
      assert.ok(!/<a:t\b[^>]*>[^<]*\r[^<]*<\/a:t>/.test(raw), 'No literal CR remains in notes text');
    });

    for (const [id, text] of values) {
      const properties = {...deck([{title: 'Visible title', text: 'Body'}]), name: text, description: text, author: text};
      const data = await exported(`properties-${mode}-${id}`, properties, provenance), restored = await imported(data, `properties-${mode}-${id}`);
      await check(`${mode}/core-properties/${id}`, () => {
        assert.equal(restored.name, text); assert.equal(restored.description, text); assert.equal(restored.author, text);
      });
    }

    const native = await exported(`native-${mode}`, deck([{title: 'One', text: 'First', notes: 'ORIGINAL_NOTES_SENTINEL'}, {title: 'Two', text: 'Second', notes: 'second note'}]), provenance);
    await check(`${mode}/no-hidden-notes-source`, () => {
      for (const [name, data] of Object.entries(unzipSync(native))) if (name.startsWith('ppt/tags/')) {
        for (const match of strFromU8(data).matchAll(/val="([0-9A-Fa-f]+)"/g)) {
          assert.ok(!Buffer.from(match[1], 'hex').toString('utf8').includes('ORIGINAL_NOTES_SENTINEL'), name);
        }
      }
    });
    const part = 'ppt/notesSlides/notesSlide1.xml';
    await check(`${mode}/native-run-field-break-order`, async () => {
      const paragraphs = '<a:p/>' + '<a:p><a:r><a:t> A </a:t></a:r>' + field('000000000001', 'F') + '<a:r><a:t>B</a:t></a:r><a:br/>' + field('000000000002', 'G') + '<a:r><a:t> C </a:t></a:r></a:p><a:p/>';
      const edited = await mutated(native, `ordered-${mode}`, entries => changeNotes(entries, part, paragraphs));
      assert.equal(edited.slides[0].notes, '\n A FB\nG C \n');
    });
    await check(`${mode}/native-edit-authority`, async () => {
      const edited = await mutated(native, `edited-${mode}`, entries => changeNotes(entries, part, p('  CURRENT&#13;\n\tNOTE&#160;&#xD; &amp;#13; &amp;#xD; &lt;&amp;&gt;  ')));
      assert.equal(edited.slides[0].notes, '  CURRENT\r\n\tNOTE\u00a0\r &#13; &#xD; <&>  ');
    });
    await check(`${mode}/blank-paragraphs-retained`, async () => {
      const edited = await mutated(native, `blank-paragraphs-${mode}`, entries => changeNotes(entries, part, '<a:p/><a:p/><a:p/>'));
      assert.equal(edited.slides[0].notes, '\n\n');
    });
    for (const [id, edit] of [
      ['cleared', entries => changeNotes(entries, part, '<a:p/>')],
      ['deleted-body', entries => changeNotes(entries, part, '', true)],
      ['deleted-part', entries => { delete entries[part]; }],
      ['deleted-relationship', entries => replacePart(entries, 'ppt/slides/_rels/slide1.xml.rels', value => value.replace(/<Relationship\b[^>]*\bType="[^"]*\/notesSlide"[^>]*\/>/, ''))],
    ]) await check(`${mode}/${id}-no-resurrection`, async () => {
      const edited = await mutated(native, `${id}-${mode}`, edit);
      assert.equal(Object.hasOwn(edited.slides[0], 'notes'), false);
      assert.equal(edited.slides[1].notes, 'second note');
    });
    await check(`${mode}/notes-follow-relationships-and-slide-order`, async () => {
      const edited = await mutated(native, `reordered-${mode}`, entries => {
        entries['ppt/notesSlides/renamed-note.xml'] = entries[part]; delete entries[part];
        replacePart(entries, 'ppt/slides/_rels/slide1.xml.rels', value => value.replace('../notesSlides/notesSlide1.xml', '../notesSlides/renamed-note.xml'));
        replacePart(entries, 'ppt/presentation.xml', value => value.replace(/<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/, (_, list) => `<p:sldIdLst>${[...list.matchAll(/<p:sldId\b[^>]*\/>/g)].map(match => match[0]).reverse().join('')}</p:sldIdLst>`));
      });
      assert.deepEqual(edited.slides.map(slide => slide.title), ['Two', 'One']);
      assert.deepEqual(edited.slides.map(slide => slide.notes), ['second note', 'ORIGINAL_NOTES_SENTINEL']);
    });
    await check(`${mode}/native-core-edit-authority`, async () => {
      const edited = await mutated(native, `core-edited-${mode}`, entries => replacePart(entries, 'docProps/core.xml', value => value
        .replace(/<dc:title>[^<]*<\/dc:title>/, '<dc:title>  CURRENT&#13;TITLE  </dc:title>')
        .replace(/<dc:subject>[^<]*<\/dc:subject>/, '<dc:subject>\tCURRENT DESCRIPTION\t</dc:subject>')
        .replace(/<dc:creator>[^<]*<\/dc:creator>/, '<dc:creator>&#160;CURRENT AUTHOR&#160;</dc:creator>')));
      assert.equal(edited.name, '  CURRENT\rTITLE  '); assert.equal(edited.description, '\tCURRENT DESCRIPTION\t'); assert.equal(edited.author, '\u00a0CURRENT AUTHOR\u00a0');
    });
    await check(`${mode}/native-description-takes-precedence`, async () => {
      const edited = await mutated(native, `description-${mode}`, entries => replacePart(entries, 'docProps/core.xml', value => value.replace('</cp:coreProperties>', '<dc:description>  CURRENT&#xD;\n &amp;#13; &amp;#xD; &lt;&amp;&gt;  </dc:description></cp:coreProperties>')));
      assert.equal(edited.description, '  CURRENT\r\n &#13; &#xD; <&>  ');
    });
    for (const id of ['cleared', 'deleted', 'deleted-part']) await check(`${mode}/native-core-${id}-no-resurrection`, async () => {
      const edited = await mutated(native, `core-${id}-${mode}`, entries => {
        if (id === 'deleted-part') delete entries['docProps/core.xml'];
        else replacePart(entries, 'docProps/core.xml', value => value.replace(/<(dc:title|dc:subject|dc:creator)>[^<]*<\/\1>/g, (_, tag) => id === 'cleared' ? `<${tag}/>` : ''));
      });
      assert.equal(edited.name, 'Imported PPTX'); assert.equal(edited.description, undefined); assert.equal(edited.author, undefined);
      assert.equal(edited.slides[0].notes, 'ORIGINAL_NOTES_SENTINEL');
    });
    await check(`${mode}/empty-is-not-absent-preservation-claim`, async () => {
      const empty = await exported(`empty-${mode}`, {name: '', description: '', author: '', slides: [{text: 'One', notes: ''}, {text: 'Two'}]}, provenance);
      const restored = await imported(empty, `empty-${mode}`);
      assert.equal(restored.name, 'Imported PPTX'); assert.equal(restored.description, undefined); assert.equal(restored.author, undefined);
      assert.equal(restored.slides.some(slide => Object.hasOwn(slide, 'notes')), false);
    });
  }
} finally {
  report.passed = report.cases.length > 0 && report.cases.every(item => item.passed);
  report.counts = {passed: report.cases.filter(item => item.passed).length, failed: report.cases.filter(item => !item.passed).length};
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Native text whitespace: ${report.counts.passed} passed, ${report.counts.failed} failed.`);
}
assert.equal(report.passed, true, 'Native text whitespace controls failed; retained report and inputs identify each result.');
