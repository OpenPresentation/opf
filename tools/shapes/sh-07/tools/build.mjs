// node build.mjs <mode: picture|shapes> [ids...]: one deck per corpus source (one slide, the diagram alone), its preview PNG
// (core convert, the CLI's pipeline) and its PPTX with diagrams: <mode>. Writes ../decks, ../preview/<id>.png, ../<mode>/pptx/<id>.pptx
// and ../<mode>/findings.json.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const repo = 'C:/opf-work/sh-07-native-diagrams';
const root = process.env.SH07_ROOT ?? 'C:/opf-work/shapes/sh-07';
const [mode = 'shapes', ...only] = process.argv.slice(2);
const { convert } = await import(pathToFileURL(`${repo}/packages/javascript/dist/index.js`).href);
const corpus = readFileSync(`${root}/sources/corpus.txt`, 'utf8').split(/^=== /m).filter(Boolean).map((part) => {
  const nl = part.indexOf('\n');
  return { id: part.slice(0, nl).trim(), source: part.slice(nl + 1).replace(/\s+$/, '') };
});
for (const dir of ['decks', 'preview', `${mode}/pptx`]) mkdirSync(`${root}/${dir}`, { recursive: true });
const findings = existsSync(`${root}/${mode}/findings.json`) ? JSON.parse(readFileSync(`${root}/${mode}/findings.json`, 'utf8')) : {};
for (const { id, source } of corpus) {
  if (only.length && !only.some((o) => id === o || id.startsWith(`${o}-`))) continue;
  const deck = { $schema: 'https://openpresentation.org/schema/opf/v1', name: id, language: process.env.SH07_LANG ?? 'en-US', ...(process.env.SH07_DESIGN ? { design: JSON.parse(process.env.SH07_DESIGN) } : {}), slides: [{ diagram: source }] };
  writeFileSync(`${root}/decks/${id}.opf.json`, JSON.stringify(deck, null, 1));
  try {
    if (!existsSync(`${root}/preview/${id}.png`) || process.env.PREVIEW) {
      await convert(deck, `${root}/preview/${id}-{n}.png`, { force: true });
    }
    const result = await convert(deck, `${root}/${mode}/pptx/${id}.pptx`, { force: true, ...(mode === 'picture' ? {} : { diagrams: mode }) });
    findings[id] = (result.findings ?? []).map((f) => `${f.severity} ${f.ruleId}: ${f.message}`.slice(0, 300));
    console.log('ok', id, findings[id].filter((f) => !f.startsWith('info')).join(' | '));
  } catch (error) {
    findings[id] = [`FAIL ${error.code ?? ''} ${error.message}`];
    console.log('FAIL', id, error.message);
  }
}
writeFileSync(`${root}/${mode}/findings.json`, JSON.stringify(findings, null, 1));
