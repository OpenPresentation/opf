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
const downstream = registry ? [] : plan.packages.filter(item => ['@openpresentation/opf-render', '@openpresentation/opf-editor', '@openpresentation/opf-pptx'].includes(item.name));
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
  const tarResult = await run("tar", ["-tzf", tgzPath]);
  const files = tarResult.stdout.trim().split(/\r?\n/).filter(Boolean).sort();

  for (const entry of [
    "package/LICENSE",
    "package/README.md",
    "package/package.json",
    "package/dist/index.js",
    "package/dist/schemas.js",
    "package/dist/catalogs.js",
    "package/dist/validator.js",
    "package/dist/types.js",
    "package/dist/spec-files.js",
    "package/dist/previews.js",
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
  if (downstream.length) {
    await writeFile(path.join(projectDir, 'downstream.mjs'), `
import assert from 'node:assert/strict';
import {createEditorSession} from '@openpresentation/opf-editor';
import {renderSvg} from '@openpresentation/opf-render';
import {toPptx} from '@openpresentation/opf-pptx';
import {validatePresentation} from '@openpresentation/opf';
const editor = createEditorSession({slides: [{title: 'Compiler compatibility'}]});
editor.set('slides.0.title', 'Packed downstream');
assert.equal(validatePresentation(editor.document).valid, true);
assert.match(renderSvg(editor.document), /Packed downstream/);
assert.ok((await toPptx(editor.document)).length > 1000);
editor.undo();
assert.equal(editor.document.slides[0].title, 'Compiler compatibility');
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
  catalogs,
  presentation,
  validate,
  validatePresentation,
} from "@openpresentation/opf";
import { presentation as focusedPresentation } from "@openpresentation/opf/schemas";
import { tones } from "@openpresentation/opf/catalogs";
import { assertValid, validate as focusedValidate } from "@openpresentation/opf/validator";
import * as typesRuntime from "@openpresentation/opf/types";
import { specFileEntries, specFilePaths } from "@openpresentation/opf/spec-files";
import { layoutPreviews, getLayoutPreview } from "@openpresentation/opf/previews";
import { examples, getExample } from "@openpresentation/opf/examples";
import { docs, getDoc } from "@openpresentation/opf/docs";
import { repoReadme } from "@openpresentation/opf/repo-readme";
import { paginatePresentation } from "@openpresentation/opf/pagination";
import rawPresentation from "@openpresentation/opf/spec/schemas/opf.schema.json" with { type: "json" };
import rawBoardAudience from "@openpresentation/opf/spec/catalogs/audiences/board.json" with { type: "json" };
import installedManifest from "@openpresentation/opf/package.json" with { type: "json" };
assert.equal(installedManifest.version,${JSON.stringify(manifest.version)});

assert.equal(presentation.$id, "https://openpresentation.org/schema/opf/v1");
assert.equal(focusedPresentation.$id, presentation.$id);
assert.equal(rawPresentation.$id, presentation.$id);
assert.equal(rawBoardAudience.id, "board");
assert.ok(catalogs.audiences.some((audience) => audience.id === "executives"));
assert.ok(tones.length > 0);
assert.deepEqual(Object.keys(typesRuntime), []);

assert.ok(specFileEntries.length > 0, "spec-files subpath should ship entries");
assert.ok(specFilePaths.includes("openapi.yaml"));
const firstPreviewSlug = Object.keys(layoutPreviews)[0];
assert.ok(firstPreviewSlug, "previews subpath should ship layout previews");
assert.ok(getLayoutPreview(firstPreviewSlug)?.length > 0);
assert.ok(examples.length > 0, "examples subpath should ship example decks");
assert.equal(getExample(examples[0].slug)?.slug, examples[0].slug);
assert.ok(docs.length > 0, "docs subpath should ship reference pages");
assert.equal(getDoc("schema-reference")?.slug, "schema-reference");
assert.ok(repoReadme.length > 100, "repo-readme subpath should ship the upstream README");

const validDeck = {
  name: "Packed Package Smoke",
  audience: ["executives"],
  slides: [{ title: "Smoke Test", items: ["Root import", "Focused import", "Raw JSON import"] }],
};

assert.equal(validatePresentation(validDeck).valid, true);
assert.equal(validate(validDeck, "presentation").valid, true);
assert.equal(focusedValidate(validDeck, "presentation").valid, true);
assert.doesNotThrow(() => assertValid(validDeck));

const richTable = {columns: [['Rich ', {text:'header',bold:true}]], rows: Array.from({length:45}, (_,i) => [[{text:'Row '+i,bold:true}]])};
const richDeck = {slides:[{table:richTable}]};
assert.equal(validatePresentation(richDeck).valid,true,'Installed schema accepts rich cells and headers');
const pages = paginatePresentation(richDeck);
assert.ok(pages.presentation.slides.length > 1,'Installed pagination splits rich tables');
assert.deepEqual(pages.presentation.slides.flatMap(slide=>slide.table.rows),richTable.rows,'Installed pagination preserves rich runs');

const invalidDeck = {
  name: "Invalid Packed Package Smoke",
  slides: [{ type: "placeholder" }],
};
const invalidResult = validatePresentation(invalidDeck);
assert.equal(invalidResult.valid, false, "invalid deck should fail validation");
assert.ok(invalidResult.errors.length > 0, "invalid deck should return validation errors");
`,
  );
  await run(process.execPath, ["smoke.mjs"], { cwd: projectDir });
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
