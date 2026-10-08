import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile, readFile, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {createHash} from 'node:crypto';
import {packageManagerInvocation} from '../../../scripts/package-manager.mjs';
import {checkPackedTypes} from '../../../scripts/check-packed-types.mjs';
import {createRequire} from 'node:module';

const execFile = promisify(execFileCallback);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(packageRoot,'package.json'),'utf8'));
const registry = process.argv.includes('--registry');
const require = createRequire(import.meta.url);
const nodeTypesVersion = require('@types/node/package.json').version;
const plan = JSON.parse(await readFile(new URL('../../../release-plan.json', import.meta.url), 'utf8'));
// The release plan's renderer, editor and PPTX were built for the plan's core. A candidate core of a later minor line (a
// breaking pre-1.0 release, such as 0.14 over a 0.13 plan) cannot run them; test:packed-ecosystem checks it with the
// candidate siblings instead, and the release-prep PR moves the plan to the new line, which turns this check back on.
const line = (version) => String(version).split('.').slice(0, 2).join('.');
const planCore = plan.packages.find(item => item.name === manifest.name)?.version;
const sameLine = planCore !== undefined && line(planCore) === line(manifest.version);
const downstream = registry || !sameLine ? [] : plan.packages.filter(item => ['@openpresentation/opf-render', '@openpresentation/opf-editor', '@openpresentation/opf-pptx'].includes(item.name));
if (!registry && !sameLine) process.stdout.write(`core ${manifest.version} is on a newer minor than the release plan's published siblings (${line(planCore)}.x): skipping their install until the ${line(manifest.version)} siblings publish (test:packed-ecosystem covers the candidate siblings).\n`);
assert.ok(!process.env.NODE_OPTIONS&&!process.execArgv.some(arg=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(arg)),'Standalone package verification must not use source loaders or module aliases');
const packageSource = registry ? `${manifest.name}@${manifest.version}` : packageRoot;
const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "opf-packed-smoke-"));
const packDir = path.join(tmpRoot, "pack");
const projectDir = path.join(tmpRoot, "project");

async function run(command, args, options = {}) {
  try {
    if (command === 'npm') ({command,args}=packageManagerInvocation(command,args));
    return await execFile(command, args, {
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    });
  } catch (error) {
    const stdout = error.stdout ? `\nstdout:\n${error.stdout}` : "";
    const stderr = error.stderr ? `\nstderr:\n${error.stderr}` : "";
    error.message = `${error.message}${stdout}${stderr}`;
    throw error;
  }
}

function assertTarIncludes(files, entry) {
  assert.ok(files.includes(entry), `packed tarball should include ${entry}`);
}

try {
  await mkdir(packDir, { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    path.join(projectDir, "package.json"),
    `${JSON.stringify({ private: true, type: "module", overrides: {'@openpresentation/opf': '$@openpresentation/opf'} }, null, 2)}\n`,
  );

  const packResult = await run("npm", ["pack", packageSource, "--pack-destination", packDir, '--offline=false', '--prefer-online']);
  const tgzName = packResult.stdout.trim().split(/\r?\n/).at(-1);
  assert.ok(tgzName?.endsWith(".tgz"), `npm pack did not return a tarball name: ${packResult.stdout}`);

  const tgzPath = path.join(packDir, tgzName);
  const tarResult = await run("tar", ["-tzf", path.basename(tgzPath)], { cwd: path.dirname(tgzPath) }); // GNU tar reads C:... after -f as host:path
  const files = tarResult.stdout.trim().split(/\r?\n/).filter(Boolean).sort();

  for (const entry of [
    "package/LICENSE",
    "package/README.md",
    "package/package.json",
    "package/dist/index.js",
    "package/dist/schemas.js",
    "package/dist/catalog.js",
    "package/dist/validator.js",
    "package/dist/types.js",
    "package/dist/spec-files.js",
    "package/dist/examples.js",
    "package/dist/docs.js",
    "package/dist/repo-readme.js",
    "package/dist/spec/openapi.yaml",
    "package/dist/spec/schemas/opf.schema.json",
    "package/dist/spec/catalogs/audiences/board.json",
    "package/dist/spec/catalogs/layouts/index.json",
  ]) {
    assertTarIncludes(files, entry);
  }

  assert.equal(files.some((file) => file.endsWith(".map")), false, "npm package should not ship source maps");

  await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", registry ? packageSource : tgzPath, `@types/node@${nodeTypesVersion}`, ...downstream.map(item => `${item.name}@${item.version}`)], { cwd: projectDir });
  await checkPackedTypes(projectDir, {downstream: downstream.length > 0});
  // Resolve and load every runtime export, including newly added subpaths.
  await writeFile(path.join(projectDir, 'exports.mjs'), `
import manifest from '@openpresentation/opf/package.json' with {type: 'json'};
for (const [entry, target] of Object.entries(manifest.exports)) {
  if (typeof target === 'object') await import(manifest.name + (entry === '.' ? '' : entry.slice(1)));
}
`);
  await run(process.execPath, ['exports.mjs'], {cwd: projectDir});
  // FA wave C: the package declares "sideEffects": false, and its code-split entries import some chunks only for
  // evaluation order (`import './chunk-X.js'`), which a consumer's bundler drops. Bundle a consumer of the packed
  // package the way a host does (esbuild, sideEffects honoured, tree shaking on) and require the bundle to compute
  // exactly what the installed package computes, so a chunk whose code is needed but only bare-imported fails here.
  await writeFile(path.join(projectDir, 'bundle-probe.mjs'), `
import {embed, paginate, resolveSlideContext, stats, toMarkdown, fromMarkdown, validate, validationRules, CHART_TYPES} from '@openpresentation/opf';
import {defaultCatalog, catalogDisplay} from '@openpresentation/opf/catalog';
import {composeSlide} from '@openpresentation/opf/composition';
import {fromYaml, toYaml} from '@openpresentation/opf/yaml';
import {applyPatch} from '@openpresentation/opf/patch';
const catalogs = [defaultCatalog];
const deck = {$schema: 'https://openpresentation.org/schema/opf/v1', name: 'Bundle probe', language: 'en-US',
  design: {theme: 'classic', colorScheme: 'cool-horizon', fontScheme: 'roboto'},
  slides: [
    {title: 'Cover', subtitle: 'Probe'},
    {layout: 'two-column', title: 'Two columns', left: {text: 'Left'}, right: {items: ['One', 'Two']}},
    {title: 'Chart', chart: {type: 'bar', data: {columns: ['Q', 'A'], rows: [['Q1', 1], ['Q2', 3]]}}},
    {title: 'Picture', design: {background: {type: 'image', src: './a.png', recolor: 'grayscale'}}},
    {title: 'Missing', layout: 'not-a-layout', text: 'Body'},
  ]};
const embedded = embed(deck, {catalogs}).document;
const composed = deck.slides.map((_, index) => { const context = resolveSlideContext(embedded, index, {catalogs: []}); return composeSlide(embedded.slides[index], context.options); });
const markdown = toMarkdown(embedded).markdown;
process.stdout.write(JSON.stringify({
  rules: validationRules.length, chartTypes: CHART_TYPES.length, display: Object.keys(catalogDisplay).sort(),
  findings: validate(deck, {catalogs}).findings.map(finding => finding.ruleId + ' ' + finding.path),
  embedded, composed, pages: paginate(embedded).pages.length, stats: stats(embedded, {catalogs}),
  markdown, back: fromMarkdown(markdown, {catalogs}).presentation, yaml: fromYaml(toYaml(embedded).yaml).presentation,
  patched: applyPatch(embedded, [{op: 'replace', path: '/name', value: 'Patched'}]).name,
}));
`);
  {
    const esbuild = createRequire(createRequire(path.join(packageRoot, 'package.json')).resolve('tsup'))('esbuild');
    const direct = (await run(process.execPath, ['bundle-probe.mjs'], {cwd: projectDir})).stdout;
    const bundled = await esbuild.build({entryPoints: [path.join(projectDir, 'bundle-probe.mjs')], absWorkingDir: projectDir, bundle: true, write: false, format: 'esm', platform: 'node', mainFields: ['module', 'main'], treeShaking: true, minify: true, logLevel: 'silent', banner: {js: "import {createRequire as __cr} from 'node:module'; const require = __cr(import.meta.url);"}, outfile: path.join(projectDir, 'bundle-probe.bundle.mjs')});
    assert.deepEqual(bundled.errors, []);
    // The only expected warning is esbuild's note that it ignores those ordering imports (ignored-bare-import).
    assert.deepEqual([...new Set(bundled.warnings.map(warning => warning.id))].filter(id => id !== 'ignored-bare-import'), [], JSON.stringify(bundled.warnings.map(warning => warning.text)));
    await writeFile(path.join(projectDir, 'bundle-probe.bundle.mjs'), bundled.outputFiles[0].contents);
    const fromBundle = (await run(process.execPath, ['bundle-probe.bundle.mjs'], {cwd: projectDir})).stdout;
    assert.ok(direct.length > 1000, 'the probe computes something');
    assert.equal(fromBundle, direct, 'a sideEffects-honouring bundle of the packed package computes what the package computes');
  }
  if (downstream.length) {
    await writeFile(path.join(projectDir, 'downstream.mjs'), `
import assert from 'node:assert/strict';
import {createEditorSession} from '@openpresentation/opf-editor';
import {renderSvg} from '@openpresentation/opf-render';
import {toPptx} from '@openpresentation/opf-pptx';
import {validate} from '@openpresentation/opf';
const editor = createEditorSession({slides: [{title: 'Compiler compatibility'}]});
editor.set('slides.0.title', 'Packed downstream');
assert.equal(validate(editor.presentation, {only: ['format']}).valid, true);
assert.match(renderSvg(editor.presentation).join(""), /Packed downstream/);
assert.ok((await toPptx(editor.presentation)).length > 1000);
editor.undo();
assert.equal(editor.presentation.slides[0].title, 'Compiler compatibility');
`);
    await run(process.execPath, ['downstream.mjs'], {cwd: projectDir});
  }
  if (registry) {
    const lock=JSON.parse(await readFile(path.join(projectDir,'package-lock.json'),'utf8'));
    const entry=lock.packages[`node_modules/${manifest.name}`];
    assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/')&&!entry.link);
    assert.equal(entry.integrity,`sha512-${createHash('sha512').update(await readFile(tgzPath)).digest('base64')}`,'Inspected tarball and installed registry dependency must match');
  }
  await writeFile(
    path.join(projectDir, "smoke.mjs"),
    `import assert from "node:assert/strict";
import {
  presentation,
  validate,
} from "@openpresentation/opf";
import { presentation as focusedPresentation } from "@openpresentation/opf/schemas";
import { defaultCatalog, layoutPreviews, getLayoutPreview } from "@openpresentation/opf/catalog";
import { assertValid, validate as focusedValidate } from "@openpresentation/opf/validator";
import * as typesRuntime from "@openpresentation/opf/types";
import { specFileEntries, specFilePaths } from "@openpresentation/opf/spec-files";
import { examples, getExample } from "@openpresentation/opf/examples";
import { docs, getDoc } from "@openpresentation/opf/docs";
import { repoReadme } from "@openpresentation/opf/repo-readme";
import { paginate } from "@openpresentation/opf/pagination";
import rawPresentation from "@openpresentation/opf/spec/schemas/opf.schema.json" with { type: "json" };
import rawBoardAudience from "@openpresentation/opf/spec/catalogs/audiences/board.json" with { type: "json" };
import installedManifest from "@openpresentation/opf/package.json" with { type: "json" };
assert.equal(installedManifest.version,${JSON.stringify(manifest.version)});

assert.equal(presentation.$id, "https://openpresentation.org/schema/opf/v1");
assert.equal(focusedPresentation.$id, presentation.$id);
assert.equal(rawPresentation.$id, presentation.$id);
assert.equal(rawBoardAudience.id, "board");
assert.ok(defaultCatalog.audiences.executive);
assert.ok(Object.keys(defaultCatalog.tones).length > 0);
assert.deepEqual(Object.keys(typesRuntime), []);

assert.ok(specFileEntries.length > 0, "spec-files subpath should ship entries");
assert.ok(specFilePaths.includes("openapi.yaml"));
const firstPreviewSlug = Object.keys(layoutPreviews)[0];
assert.ok(firstPreviewSlug, "the catalog subpath should ship layout previews");
assert.ok(getLayoutPreview(firstPreviewSlug)?.length > 0);
assert.ok(examples.length > 0, "examples subpath should ship example decks");
assert.equal(getExample(examples[0].slug)?.slug, examples[0].slug);
assert.ok(docs.length > 0, "docs subpath should ship reference pages");
assert.equal(getDoc("schema-reference")?.slug, "schema-reference");
assert.ok(repoReadme.length > 100, "repo-readme subpath should ship the upstream README");

const validDeck = {
  name: "Packed Package Smoke",
  audience: ["executive"],
  slides: [{ title: "Smoke Test", items: ["Root import", "Focused import", "Raw JSON import"] }],
};

assert.equal(validate(validDeck).valid, true);
assert.equal(focusedValidate(validDeck, { only: ["format"] }).valid, true);
assert.equal(validate(validDeck).schemaValid, true);
assert.doesNotThrow(() => assertValid(validDeck));

const richTable = {columns: [['Rich ', {text:'header',bold:true}]], rows: Array.from({length:45}, (_,i) => [[{text:'Row '+i,bold:true}]])};
const richDeck = {slides:[{table:richTable}]};
assert.equal(validate(richDeck,{only:['format']}).valid,true,'Installed schema accepts rich cells and headers');
const pages = paginate(richDeck);
assert.ok(pages.presentation.slides.length > 1,'Installed pagination splits rich tables');
assert.deepEqual(pages.presentation.slides.flatMap(slide=>slide.table.rows),richTable.rows,'Installed pagination preserves rich runs');

const invalidDeck = {
  name: "Invalid Packed Package Smoke",
  slides: [{ type: "placeholder" }],
};
const invalidResult = validate(invalidDeck);
assert.equal(invalidResult.valid, false, "invalid deck should fail validation");
assert.ok(invalidResult.findings.some(finding => finding.severity === "error"), "invalid deck should return validation errors");
`,
  );
  await run(process.execPath, ["smoke.mjs"], { cwd: projectDir });
  if(!registry){
    assertTarIncludes(files,'package/dist/validator.js');assertTarIncludes(files,'package/dist/validator.d.ts');
    assert.ok(!files.some(file=>/package\/dist\/(lint|audit)\.(js|d\.ts)$/.test(file)),'The lint and audit subpaths are gone');
    await writeFile(path.join(projectDir,'validate.mjs'),`
import assert from 'node:assert/strict';
import {validate as rootValidate,validationRules as rootRules} from '@openpresentation/opf';
import {validate,validationRules} from '@openpresentation/opf/validator';
globalThis.fetch=()=>{throw new Error('Offline validate must not fetch');};
assert.equal(rootValidate,validate);assert.equal(rootRules,validationRules);
for(const gone of ['@openpresentation/opf/lint','@openpresentation/opf/audit'])await assert.rejects(import(gone));
const source='{\\r\\n"slides":[{"layout":"partner","title":"Keep  spaces"}]\\n}';
const options={catalogs:[{source:'pkg:@host/layouts',layouts:{partner:{name:'Partner',placeholders:[{type:'title'}]}}}]};
assert.equal(validate(source,options).valid,true);
assert.equal(validate(source,{only:['format','references']}).findings.find(issue=>issue.ruleId==='opf/unresolved-reference').location.offset,source.indexOf('"partner"'));
assert.equal(validate('{"slides":[{"title":"First","title":"Second"}]}').valid,false);
const policy=validate(JSON.parse(source),{...options,contracts:[{path:'/slides/*/layout',allowedValues:['text-1x']}]});
assert.equal(policy.valid,false);assert.equal(policy.schemaValid,true);assert.ok(policy.findings.some(issue=>issue.ruleId==='opf/contract'&&issue.category==='policy'));
const deck={name:'Packed validate',language:'en-US',design:{background:{type:'solid',color:'#FFFFFF'}},slides:[{title:'Quarterly results',text:[{text:'faint',color:'#CCCCCC'}]},{text:'No title',image:'https://example.com/a.png'}]};
const report=validate(deck);
assert.equal(report.valid,true);
assert.deepEqual(report.findings.map(issue=>issue.ruleId),['opf/text-contrast','opf/missing-alt-text','opf/missing-slide-title']);
assert.equal(report.checks.backgroundPixels,'not-read');assert.equal(report.checks.layout,'estimated');
assert.equal(validate(deck,{only:['format']}).checks.layout,'not-run');
const text=JSON.stringify(deck,null,1);
const located=validate(text,{only:['opf/missing-alt-text']}).findings[0];
assert.equal(text.slice(located.location.offset,located.location.offset+located.location.length),'"https://example.com/a.png"');
assert.equal(validate('{"slides":[}').schemaValid,null);
console.log('Installed validate: root and subpath entrypoints, rule ids, categories, source ranges, loaded records, duplicate keys and contracts pass offline.');
`);
    const validation=await run(process.execPath,['validate.mjs'],{cwd:projectDir});process.stdout.write(validation.stdout);
    for(const entry of ['patch','diff','format'])assertTarIncludes(files,`package/dist/${entry}.js`);
    await writeFile(path.join(projectDir,'patch-diff-format.mjs'),`
import assert from 'node:assert/strict';
import {applyPatch,invertPatch} from '@openpresentation/opf/patch';
import {diff,merge} from '@openpresentation/opf/diff';
import {format} from '@openpresentation/opf/format';
const a={name:'A',slides:[{id:'x',title:'X'},{id:'y',title:'Y'}]};
const b={name:'B',slides:[{id:'y',title:'Y'},{id:'x',title:'X2'}]};
const changes=diff(a,b);
assert.deepEqual(applyPatch(a,changes.patch),b);
assert.deepEqual(applyPatch(b,invertPatch(a,changes.patch)),a);
assert.equal(merge(a,b,a).clean,true);
assert.equal(merge(a,{...a,name:'1'},{...a,name:'2'}).conflicts.length,1);
assert.equal(format('{"slides":[],"name":"N"}'),'{\\n  "name": "N",\\n  "slides": []\\n}\\n');
console.log('Installed patch, diff, merge and format entrypoints pass offline.');
`);
    const pdf=await run(process.execPath,['patch-diff-format.mjs'],{cwd:projectDir});process.stdout.write(pdf.stdout);
    assertTarIncludes(files,'package/dist/convert.js');assertTarIncludes(files,'package/dist/convert.d.ts');
    await writeFile(path.join(projectDir,'convert.mjs'),`
import assert from 'node:assert/strict';
import {convertContent,contentConversionTargets,mergeSlides,OPFConversionError} from '@openpresentation/opf/convert';
globalThis.fetch=()=>{throw new Error('Offline conversions must not fetch');};
const converted=convertContent({items:['a',{text:'b',description:'bd'}]},'table');
assert.deepEqual(converted.payload,{table:{rows:[['a',null],['b','bd']]}});assert.equal(converted.lossless,true);
assert.deepEqual(contentConversionTargets({text:'a'}).map(target=>target.kind),['list','quote','metric','code','timeline','table']);
assert.throws(()=>convertContent({image:'a.png'},'text'),OPFConversionError);
assert.equal(mergeSlides({slides:[{text:'a'},{text:'b'}]},0).slides[0].blocks.length,2);
console.log('Installed conversions: pure converters, loss reports and refusals work offline.');
`);
    const conversions=await run(process.execPath,['convert.mjs'],{cwd:projectDir});process.stdout.write(conversions.stdout);
    assertTarIncludes(files,'package/dist/markdown.js');assertTarIncludes(files,'package/dist/markdown.d.ts');
    await writeFile(path.join(projectDir,'markdown.mjs'),`
import assert from 'node:assert/strict';
import {fromMarkdown,toMarkdown,OPFMarkdownError} from '@openpresentation/opf/markdown';
globalThis.fetch=()=>{throw new Error('Offline Markdown conversion must not fetch');};
const source='---\\nname: Installed\\n---\\n\\n<!-- slide: id=a -->\\n# One\\n\\n- x\\n- y\\n\\n---\\n\\n# Two\\n\\nNote: speaking\\n';
const converted=fromMarkdown(source);
assert.equal(converted.valid,true);
assert.deepEqual(converted.presentation,{name:'Installed',slides:[{id:'a',title:'One',items:['x','y']},{title:'Two',notes:'speaking'}]});
const written=toMarkdown(converted.presentation);
assert.equal(written.markdown,source);assert.equal(written.report.native,true);
const broken=fromMarkdown('# A\\n\\n<!-- slide: nope=1 -->');
assert.equal(broken.valid,false);assert.deepEqual([broken.findings[0].location.line,broken.findings[0].location.column],[3,1]);
assert.throws(()=>toMarkdown({slides:'x'}),OPFMarkdownError);
console.log('Installed Markdown: dialect conversion, round trip and located errors work offline.');
`);
    const markdown=await run(process.execPath,['markdown.mjs'],{cwd:projectDir});process.stdout.write(markdown.stdout);
    assertTarIncludes(files,'package/dist/yaml.js');assertTarIncludes(files,'package/dist/yaml.d.ts');
    await writeFile(path.join(projectDir,'yaml.mjs'),`
import assert from 'node:assert/strict';
import {fromYaml,toYaml,OPFYamlError} from '@openpresentation/opf/yaml';
globalThis.fetch=()=>{throw new Error('Offline YAML conversion must not fetch');};
const source='name: Installed\\nslides:\\n  - id: a\\n    title: "2026-10-01"\\n    items:\\n      - x\\n      - "yes"\\n';
const converted=fromYaml(source);
assert.equal(converted.valid,true);
assert.deepEqual(converted.presentation,{name:'Installed',slides:[{id:'a',title:'2026-10-01',items:['x','yes']}]});
assert.equal(toYaml(converted.presentation).yaml,source);
const broken=fromYaml('name: x\\nslides:\\n  - title: 5\\n');
assert.equal(broken.valid,false);assert.deepEqual([broken.findings[0].location.line,broken.findings[0].location.column],[3,12]);
assert.equal(fromYaml('a: &x 1\\nb: *x\\n').findings[0].ruleId,'yaml/alias');
assert.throws(()=>toYaml({slides:'x'}),OPFYamlError);
console.log('Installed YAML: strict dialect, canonical writer and located errors work offline.');
`);
    const yamlRun=await run(process.execPath,['yaml.mjs'],{cwd:projectDir});process.stdout.write(yamlRun.stdout);
    assertTarIncludes(files,'package/dist/deck.js');assertTarIncludes(files,'package/dist/deck.d.ts');
    await writeFile(path.join(projectDir,'deck.mjs'),`
import assert from 'node:assert/strict';
import {readDeck as rootReadDeck} from '@openpresentation/opf';
import {readDeck,writeDeck,deckFormatOf} from '@openpresentation/opf/deck';
globalThis.fetch=()=>{throw new Error('Offline deck reading must not fetch');};
assert.equal(rootReadDeck,readDeck);
const deck={name:'Installed',slides:[{id:'a',title:'One'}]};
for(const format of ['json','yaml','markdown']){const back=readDeck(writeDeck(deck,{format}),{format});assert.equal(back.valid,true);assert.deepEqual(back.presentation,deck);}
assert.equal(deckFormatOf('deck.opf.md'),'markdown');assert.equal(deckFormatOf('deck.md'),'json');
assert.equal(readDeck('---',{filename:'x.opf.md'}).findings[0].ruleId.startsWith('markdown/'),true);
console.log('Installed readDeck/writeDeck: JSON, YAML and Markdown decks read and write offline.');
`);
    const deckRun=await run(process.execPath,['deck.mjs'],{cwd:projectDir});process.stdout.write(deckRun.stdout);
  }
  for (const file of ['quote-layout.test.mjs','quote-composition.test.mjs','code-layout.test.mjs','code-composition.test.mjs']) {
    const source=(await readFile(path.join(packageRoot,'test',file),'utf8'))
      .replaceAll("'../dist/index.js'","'@openpresentation/opf'")
      .replaceAll("'../dist/composition.js'","'@openpresentation/opf/composition'")
      .replaceAll("'../dist/pagination.js'","'@openpresentation/opf/pagination'");
    await writeFile(path.join(projectDir,file),source);
    const result=await run(process.execPath,['--test',file],{cwd:projectDir});
    process.stdout.write(result.stdout);
  }
  if (registry) {
    const signatures=await run('npm',['audit','signatures'],{cwd:projectDir});
    process.stdout.write(signatures.stdout);
  }

  const { size } = await stat(tgzPath);
  process.stdout.write(`${registry?'Registry':'Packed'} install smoke passed for ${tgzName} (${size} bytes).\n`);
  process.stdout.write(`Packed tarball entries checked: ${files.length}.\n`);
} finally {
  if (process.env.OPF_KEEP_PACKED_SMOKE_TMP) {
    process.stdout.write(`Preserved packed smoke temp directory: ${tmpRoot}\n`);
  } else {
    const actual=await realpath(tmpRoot),parent=await realpath(os.tmpdir());
    assert.ok(actual.startsWith(parent+path.sep)&&path.basename(actual).startsWith('opf-packed-smoke-'),'Cleanup must stay inside the created temporary directory');
    await rm(actual, { recursive: true, force: true });
  }
}
