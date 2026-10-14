// Bounded offline replay of the four retained native edits. Never invokes Office.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {digest, installedIdentity, packageNames} from './identity.mjs';
import {installedEngines} from './generate.mjs';
import {installOfflineGuard} from './replay-offline.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const caseIds = ['change-layout', 'new-custom', 'new-text', 'change-picture'];
const peerKeys = {opf: 'opf', 'opf-render': 'opf-render', 'opf-pptx': 'opf-pptx', 'opf-editor': 'opf-editor', cli: 'cli', gallery: 'gallery'};
const readJson = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const inside = (file, root) => file === root || file.startsWith(root + path.sep);

export function parseArguments(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    assert.ok(['--consumer', '--evidence', '--output', '--release-plan', '--registry-receipt'].includes(key), `Unknown option: ${key}`);
    assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value: ${key}`);
    assert.ok(!Object.hasOwn(options, key), `Duplicate option: ${key}`);
    options[key] = path.resolve(args[i + 1]);
  }
  for (const key of ['--consumer', '--evidence', '--output', '--registry-receipt']) assert.ok(options[key], `Required: ${key}`);
  return {consumer: options['--consumer'], evidence: options['--evidence'], output: options['--output'], releasePlan: options['--release-plan'] ?? path.join(repository, 'release-plan.json'), registryReceipt: options['--registry-receipt']};
}

// Check every existing component, not just the leaf: junctions must not disguise source aliases.
export function canonicalPath(file) {
  const resolved = path.resolve(file);
  let current = path.parse(resolved).root;
  for (const part of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    assert.ok(!lstatSync(current).isSymbolicLink(), `Symlink/junction alias: ${current}`);
  }
  assert.equal(realpathSync(resolved), resolved, `Noncanonical path: ${resolved}`);
  return resolved;
}

export function assertOutputIsolation(output, protectedPaths) {
  output = path.resolve(output);
  canonicalPath(path.dirname(output));
  for (const root of protectedPaths) {
    assert.ok(!inside(output, root) && !inside(root, output), `Output overlaps protected input: ${root}`);
  }
  assert.ok(!existsSync(output), 'Output must be a fresh directory; preserve previous attempts');
  return output;
}

export function plannedPackages(plan) {
  const records = [...(plan.packages ?? []), ...(plan.independentPackages ?? [])].filter(item => packageNames.includes(item.name));
  assert.equal(records.length, packageNames.length, 'Release plan must contain the complete six-package graph');
  assert.equal(new Set(records.map(item => item.name)).size, packageNames.length, 'Duplicate release-plan package');
  for (const name of packageNames) {
    const record = records.find(item => item.name === name);
    assert.ok(record, `Missing planned package: ${name}`);
    assert.match(record.version ?? '', /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, `Exact stable published version required: ${name}`);
    const key = name.slice('@openpresentation/'.length);
    if (peerKeys[key]) assert.match(plan.verificationRefs?.[peerKeys[key]] ?? '', /^[a-f0-9]{40}$/, `Immutable verification ref required: ${name}`);
  }
  const core = records.find(item => item.name === '@openpresentation/opf').version.split('.').map(Number);
  const gallery = records.find(item => item.name === '@openpresentation/gallery').version.split('.').map(Number);
  assert.ok(core[0] > 0 || core[1] >= 20, 'Retained array-layout saves require the published 0.20-or-newer core');
  assert.ok(gallery[0] >= 3, 'Retained array-layout saves require Gallery 3 or newer');
  return records;
}

export function registryIdentity(consumer, plan) {
  consumer = canonicalPath(consumer);
  const modules = canonicalPath(path.join(consumer, 'node_modules'));
  const declarations = readJson(path.join(consumer, 'package.json'));
  const lockFile = canonicalPath(path.join(consumer, 'package-lock.json'));
  const lock = readJson(lockFile);
  const records = plannedPackages(plan);
  for (const [location, entry] of Object.entries(lock.packages ?? {})) {
    if (!location) continue;
    assert.ok(!entry.link, 'Source alias in consumer lock: ' + location);
    if (entry.resolved !== undefined) assert.equal(new URL(entry.resolved).origin, 'https://registry.npmjs.org', 'Non-registry transitive source: ' + location);
  }
  // Resolve no engines until versions, declared sources and lock integrity have passed.
  for (const record of records) {
    const name = record.name;
    assert.equal(declarations.dependencies?.[name], record.version, `Consumer must declare exact registry version: ${name}`);
    const directory = canonicalPath(path.join(modules, name));
    assert.ok(inside(directory, modules), `Package escapes consumer: ${name}`);
    const installed = readJson(canonicalPath(path.join(directory, 'package.json')));
    assert.equal(installed.name, name);
    assert.equal(installed.version, record.version, `Installed package differs from release plan: ${name}`);
    assert.ok(!installed.requiresUnreleasedCore, `Unpublished source marker: ${name}`);
    const entry = lock.packages?.[`node_modules/${name}`];
    assert.equal(entry?.version, record.version, `Lock version differs from release plan: ${name}`);
    assert.ok(!entry.link, `Source alias in registry lock: ${name}`);
    const url = new URL(entry.resolved);
    assert.equal(url.origin, 'https://registry.npmjs.org', `Non-registry source: ${name}`);
    assert.ok(!url.username && !url.password && !url.search && !url.hash, `Unexpected registry URL: ${name}`);
    const short = name.split('/')[1];
    assert.equal(decodeURIComponent(url.pathname), `/${name}/-/${short}-${record.version}.tgz`, `Wrong registry tarball: ${name}`);
    assert.match(entry.integrity ?? '', /^sha512-[A-Za-z0-9+/]{86}==$/, `Valid SHA-512 integrity required: ${name}`);
    assert.equal(Buffer.from(entry.integrity.slice(7), 'base64').length, 64, `Invalid integrity: ${name}`);
  }
  const identity = installedIdentity(consumer);
  for (const item of identity.packages) assert.equal(item.directory, path.join(modules, item.name), `Ancestor/nested package alias: ${item.name}`);
  return {...identity, lock: {sha256: digest(readFileSync(lockFile)), packages: records.map(({name, version}) => ({name, version, ...lock.packages[`node_modules/${name}`]}))}, authority: 'Installed identity and lock metadata; verifiedRegistryAuthority separately binds canonical provenance authority'};
}


export function verifiedRegistryAuthority(file, plan, identity) {
  file = canonicalPath(file);
  const receipt = readJson(file);
  assert.equal(receipt.schemaVersion, 1, 'Unknown registry receipt schema');
  assert.ok(Number.isFinite(Date.parse(receipt.verifiedAt)), 'Registry receipt needs verifiedAt');
  const records = plannedPackages(plan);
  assert.equal(receipt.packages?.length, packageNames.length, 'Verified registry receipt must cover all six packages');
  assert.equal(new Set(receipt.packages.map(item => item.name)).size, packageNames.length, 'Duplicate registry authority package');
  for (const record of records) {
    const authority = receipt.packages.find(item => item.name === record.name);
    assert.ok(authority, 'Missing verified registry package: ' + record.name);
    assert.equal(authority.version, record.version, 'Registry authority version differs: ' + record.name);
    assert.match(authority.gitHead ?? '', /^[a-f0-9]{40}$/, 'Registry authority needs immutable gitHead');
    const key = record.name.slice('@openpresentation/'.length);
    if (peerKeys[key]) assert.equal(authority.gitHead, plan.verificationRefs[peerKeys[key]], 'Verified gitHead differs from plan: ' + record.name);
    const locked = identity.lock.packages.find(item => item.name === record.name);
    assert.equal(authority.dist?.integrity, locked.integrity, 'Verified registry integrity differs from consumer: ' + record.name);
    for (const field of ['repository', 'tag', 'workflow', 'provenanceInvocation']) assert.ok(typeof authority[field] === 'string' && authority[field].length > 0, 'Missing canonical authority field: ' + field);
    const verification = authority.canonicalVerification;
    assert.equal(verification?.ok, true, 'Canonical registry verification has not passed: ' + record.name);
    assert.match(verification.logSha256 ?? '', /^[a-f0-9]{64}$/, 'Canonical verification log digest missing');
    assert.ok(Array.isArray(verification.checks) && verification.checks.length > 0 && verification.checks.every(check => check.ok === true), 'Failed/incomplete canonical registry checks: ' + record.name);
    for (const required of ['npm version', 'tag', 'gitHead', 'tag on main', 'version at tag', 'dist.attestations', 'SLSA provenance', 'npm audit signatures']) assert.ok(verification.checks.some(check => check.name === required && check.ok === true), 'Missing canonical check: ' + required);
  }
  assert.equal(receipt.nativeScope?.globalAcceptance, false, 'Registry authority must not assert global native acceptance');
  assert.equal(receipt.siteDeployment, false, 'Registry authority does not authorize site deployment');
  return {path: file, sha256: digest(readFileSync(file)), receipt};
}

export function retainedInputs(evidence) {
  evidence = canonicalPath(evidence);
  const indexFile = canonicalPath(path.join(evidence, 'index.json'));
  const index = readJson(indexFile);
  const artifacts = new Map();
  for (const record of index.artifacts ?? []) {
    assert.ok(typeof record.path === 'string' && !path.isAbsolute(record.path) && record.path.split('/').every(part => part && part !== '.' && part !== '..' && !part.includes('\\')), 'Unsafe evidence path');
    assert.ok(!artifacts.has(record.path), `Duplicate evidence artifact: ${record.path}`);
    artifacts.set(record.path, record);
  }
  const load = relative => {
    const record = artifacts.get(relative);
    assert.ok(record, `Missing sealed evidence artifact: ${relative}`);
    const file = canonicalPath(path.join(evidence, relative));
    assert.ok(inside(file, evidence));
    assert.ok(lstatSync(file).isFile(), `Evidence must be a regular file: ${relative}`);
    const bytes = readFileSync(file);
    assert.equal(bytes.length, record.bytes, `Corrupt evidence length: ${relative}`);
    assert.equal(digest(bytes), record.sha256, `Corrupt evidence hash: ${relative}`);
    return {relative, sha256: record.sha256, bytes};
  };
  const acceptedReportPath = index.fixedSourceReplay?.report;
  assert.ok(typeof acceptedReportPath === 'string', 'Missing accepted fixed-source replay report');
  const acceptedReport = load(acceptedReportPath);
  const accepted = JSON.parse(acceptedReport.bytes);
  assert.equal(accepted.passed, true, 'Fixed-source replay was not accepted as passing');
  assert.deepEqual(accepted.results?.map(item => item.id), caseIds, 'Accepted replay does not cover the exact four retained cases');
  const baselineDirectory = path.posix.dirname(acceptedReportPath);
  const cases = caseIds.map(id => ({id, archive: load(`manual/${id}.pptx`), baseline: load(`${baselineDirectory}/${id}-direct.opf.json`), historical: load(`${baselineDirectory}/${id}-historical-direct.opf.json`)}));
  for (const item of cases) assert.equal(accepted.results.find(result => result.id === item.id).savedSha256, item.archive.sha256, 'Accepted archive identity differs: ' + item.id);
  const binding = load('manual/new-custom-region-binding.json');
  assert.ok(typeof index.fixedSourceReplay.identities === 'string', 'Missing accepted preview runtime identities');
  const fixedRuntime = load(index.fixedSourceReplay.identities);
  return {evidence, indexSha256: digest(readFileSync(indexFile)), historicalPackageGraph: index.packageGraph, nativeSelectedCases: index.results?.length, manualOperations: index.manualOperations?.length, coverage: index.coverage, cases, binding, acceptedReport, fixedRuntime};
}

export function coverageCounts(coverage) {
  assert.ok(Array.isArray(coverage), 'Retained case coverage must be explicit');
  const selectedCases = coverage.filter(item => /^native-observed\b/.test(item.disposition ?? '')).length;
  const unexecutedCases = coverage.filter(item => /^(unexecuted\b|prepared-offline only; not executed natively\b)/.test(item.disposition ?? '')).length;
  assert.equal(selectedCases + unexecutedCases, coverage.length, 'Unknown retained native disposition; do not infer acceptance');
  return {selectedCases, unexecutedCases, totalCases: coverage.length};
}

export function preflight(options) {
  const consumer = canonicalPath(options.consumer), evidence = canonicalPath(options.evidence);
  const planFile = canonicalPath(options.releasePlan);
  assert.ok(options.registryReceipt, 'Verified registry receipt is required before final replay');
  const receiptFile = canonicalPath(options.registryReceipt);
  const output = assertOutputIsolation(options.output, [consumer, evidence, repository, planFile, receiptFile]);
  const plan = readJson(planFile);
  const identity = registryIdentity(consumer, plan);
  const authority = verifiedRegistryAuthority(receiptFile, plan, identity);
  const inputs = retainedInputs(evidence);
  const scope = authority.receipt.nativeScope;
  assert.equal(inputs.coverage?.length, scope.totalCases, 'Authority/evidence coverage count differs');
  assert.equal(inputs.nativeSelectedCases, scope.selectedCases, 'Authority/evidence selected native count differs');
  assert.equal(inputs.manualOperations, scope.uiOperations, 'Authority/evidence UI operation count differs');
  const counts = coverageCounts(inputs.coverage);
  assert.equal(counts.selectedCases, scope.selectedCases, 'Authority/evidence observed count differs');
  assert.equal(counts.unexecutedCases, scope.unexecutedCases, 'Authority/evidence unexecuted count differs');
  return {consumer, evidence, output, plan, authority, planIdentity: {path: planFile, sha256: digest(readFileSync(planFile)), verificationRefs: plan.verificationRefs}, identity, inputs};
}

function pictureInspection(bytes, fflate) {
  const archive = fflate.unzipSync(bytes);
  const xml = fflate.strFromU8(archive['ppt/slides/slide1.xml']);
  const picture = xml.match(/<p:pic>[\s\S]*?<\/p:pic>/)?.[0];
  assert.ok(picture, 'Expected retained native picture');
  const rid = picture.match(/r:embed="([^"]+)"/)?.[1];
  const rels = fflate.strFromU8(archive['ppt/slides/_rels/slide1.xml.rels']);
  const relation = [...rels.matchAll(/<Relationship\b[^>]*\/>/g)].map(match => match[0]).find(value => value.match(/\bId="([^"]+)"/)?.[1] === rid);
  assert.ok(relation, 'Picture media relationship missing');
  const target = relation.match(/Target="([^"]+)"/)?.[1];
  assert.ok(target && !/TargetMode="External"/.test(relation), 'Retained picture must embed local bytes');
  const media = path.posix.normalize(path.posix.join('ppt/slides', target));
  assert.ok(media.startsWith('ppt/media/') && archive[media], 'Picture media must remain inside archive');
  const srcRect = picture.match(/<a:srcRect\b[^>]*>/)?.[0] ?? null;
  assert.ok(!srcRect || ![...srcRect.matchAll(/[lrtb]="([^"]+)"/g)].some(match => Number(match[1]) !== 0), 'Reexport crops the full-source replacement');
  const fillRect = picture.match(/<a:fillRect\b[^>]*>/)?.[0] ?? null;
  assert.ok(!fillRect || ![...fillRect.matchAll(/[lrtb]="([^"]+)"/g)].some(match => Number(match[1]) !== 0), 'Reexport offsets the full-source replacement');
  assert.ok(!/<a:tile\b/.test(picture), 'Reexport tiles the replacement');
  assert.match(picture, /<a:stretch\b/, 'Expected full-source native stretch fill');
  assert.match(picture, /<p:ph\b[^>]*type="pic"[^>]*idx="500"/, 'Picture placeholder 500 lost');
  return {frame: picture.match(/<a:xfrm\b[^>]*>[\s\S]*?<\/a:xfrm>/)?.[0] ?? null, srcRect, fillRect, placeholder: picture.match(/<p:ph\b[^>]*\/>/)?.[0], mediaSha256: digest(archive[media]), fullSource: true};
}

export async function replay(options) {
  const prepared = preflight(options);
  const {consumer, output, inputs} = prepared;
  mkdirSync(output); // Exclusive; never overwrite failed attempts.
  const artifacts = [];
  const put = (relative, value) => {
    const bytes = typeof value === 'string' || value instanceof Uint8Array ? value : JSON.stringify(value, null, 2) + '\n';
    writeFileSync(path.join(output, relative), bytes, {flag: 'wx'});
    const content = readFileSync(path.join(output, relative));
    artifacts.push({path: relative, bytes: content.length, sha256: digest(content)});
  };
  const networkLog = path.join(output, 'network-attempts.jsonl');
  put('network-attempts.jsonl', '');
  const restore = installOfflineGuard(networkLog);
  const results = [];
  try {
    put('runtime-identities.json', {current: prepared.identity, historical: inputs.historicalPackageGraph, acceptedFixedPreview: JSON.parse(inputs.fixedRuntime.bytes), historicalNativeIdentityUnchanged: true, nativeAcceptance: false, registryAcceptance: false});
    put('plan-identity.json', prepared.planIdentity);
    put('inputs-identity.json', {indexSha256: inputs.indexSha256, cases: inputs.cases.map(item => ({id: item.id, archive: {path: item.archive.relative, sha256: item.archive.sha256}, baseline: {path: item.baseline.relative, sha256: item.baseline.sha256}, historical: {path: item.historical.relative, sha256: item.historical.sha256}})), binding: {path: inputs.binding.relative, sha256: inputs.binding.sha256}});
    put('registry-authority.json', prepared.authority);
    put('tooling-identity.json', {node: process.version, platform: process.platform, files: ['replay-retained-saves.mjs', 'replay-offline.mjs', 'identity.mjs', 'generate.mjs'].map(name => {const file = fileURLToPath(new URL(name, import.meta.url)); return {name, sha256: digest(readFileSync(file))};})});
    const engines = await installedEngines(consumer);
    const require = createRequire(path.join(consumer, 'package.json'));
    const coreDirectory = path.dirname(require.resolve('@openpresentation/opf/package.json'));
    const composition = await import(pathToFileURL(path.join(coreDirectory, 'dist/composition.js')).href);
    const cliManifest = require.resolve('@openpresentation/cli/package.json');
    const cli = canonicalPath(path.join(path.dirname(cliManifest), 'dist/index.js'));
    // fileURLToPath handles Windows drive letters and spaces; never shell-expand arguments.
    const guardUrl = pathToFileURL(fileURLToPath(new URL('./replay-offline.mjs', import.meta.url))).href;
    const env = {...process.env, NODE_OPTIONS: '', OPF_REPLAY_NETWORK_LOG: networkLog};
    for (const item of inputs.cases) {
      const {id} = item, diagnostics = [];
      const direct = await engines.pptx.fromPptx(item.archive.bytes, {catalogs: [engines.gallery], onDiagnostic: finding => diagnostics.push(finding)});
      put(`${id}-direct.opf.json`, direct); put(`${id}-diagnostics.json`, diagnostics);
      assert.deepEqual(direct, JSON.parse(item.baseline.bytes), `${id}: accepted fixed-source document changed`);
      const historical = JSON.parse(item.historical.bytes);
      const normalized = structuredClone(direct);
      if (id === 'change-picture') {
        const block = normalized.slides[0].blocks.find(block => block.image);
        assert.equal(block.fit, 'stretch', 'Native replacement stretch fit lost');
        assert.equal(block.image.alt, undefined, 'PowerPoint-cleared alt resurrected');
        delete block.fit;
      }
      assert.deepEqual(normalized, historical, `${id}: unexpected historical semantic delta`);
      const apiResults = [];
      for (const catalogMode of ['default', 'registered']) {
        const catalogs = catalogMode === 'default' ? {} : {catalogs: [engines.gallery]};
        const opened = await engines.core.open(item.archive.bytes, catalogs);
        const converted = await engines.core.convert(item.archive.bytes, {...catalogs, format: 'json'});
        const convertedDocument = JSON.parse(Buffer.from(converted.files[0].bytes));
        put(`${id}-${catalogMode}-open.opf.json`, opened);
        put(`${id}-${catalogMode}-convert.opf.json`, convertedDocument);
        put(`${id}-${catalogMode}-findings.json`, converted.findings);
        assert.deepEqual(opened, direct); assert.deepEqual(convertedDocument, direct);
        assert.ok(!converted.findings.some(finding => String(finding.ruleId ?? finding.code).includes('unresolved-reference')), 'Catalog import warning returned');
        apiResults.push({catalogMode,openMatchesDirect: true,convertMatchesDirect: true,unresolvedReferences: 0});
      }
      put(`${id}-input.pptx`, item.archive.bytes);
      const stdout = execFileSync(process.execPath, ['--import', guardUrl, cli, 'convert', path.join(output, `${id}-input.pptx`), path.join(output, `${id}-cli.opf.json`)], {cwd: consumer, env, encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024});
      put(`${id}-cli-report.json`, stdout);
      const cliOutput = readFileSync(path.join(output, `${id}-cli.opf.json`));
      artifacts.push({path: `${id}-cli.opf.json`, bytes: cliOutput.length, sha256: digest(cliOutput)});
      assert.deepEqual(JSON.parse(cliOutput), direct);
      assert.ok(!stdout.includes('unresolved-reference'), 'CLI catalog warning returned');
      if (id === 'new-custom') {
        const context = engines.core.resolveSlideContext(direct, 3, {catalogs: [engines.gallery]});
        assert.deepEqual(context.diagnostics, [], 'Named custom context diagnostics changed');
        assert.equal(context.resolved.provenance.layout.origin, 'document');
        assert.equal(context.resolved.provenance.layout.group, 'custom');
        assert.equal(context.resolved.provenance.layout.id, 'named');
        const binding = composition.bindRegions(direct.slides[3], context.options.layout, {slideIndex: 3});
        assert.deepEqual(binding, JSON.parse(inputs.binding.bytes).binding, 'Named first-region binding changed');
        const composed = composition.composeSlide(context.slide, context.options);
        assert.deepEqual(composed.diagnostics, [], 'Named custom portable composition diagnostics changed');
        put(`${id}-resolved-context.json`, {context, binding, composed,scope: 'Portable allocation only; no font, geometry or native pixel parity assertion'});
      }
      if (id === 'change-picture') {
        const exported = await engines.pptx.toPptx(direct, {catalogs: [engines.gallery], seed: 1,timestamp: '2026-01-01T00:00:00Z'});
        put(`${id}-reexport.pptx`, exported);
        const saved = pictureInspection(item.archive.bytes, engines.fflate), reexport = pictureInspection(exported, engines.fflate);
        const image = direct.slides[0].blocks.find(block => block.image).image;
        assert.match(image.src, /^data:image\/png;base64,/);
        assert.equal(digest(Buffer.from(image.src.split(',')[1], 'base64')), saved.mediaSha256, 'Replacement bytes changed on import');
        assert.equal(reexport.mediaSha256, saved.mediaSha256, 'Replacement bytes changed on reexport');
        put(`${id}-picture-inspection.json`, {saved, reexport, absoluteGeometryParityAsserted: false,pixelParityAsserted: false});
      }
      results.push({id, savedSha256: item.archive.sha256, apiResults,cliMatchesDirect: true,historicalDelta: id === 'change-picture' ? 'image block fit:stretch only' : 'none', passed: true});
      put(`${id}-result.json`, results.at(-1));
    }
    assert.equal(readFileSync(networkLog, 'utf8'), '', 'Network attempted, even if an engine swallowed the refusal');
    assert.deepEqual(registryIdentity(consumer, prepared.plan), prepared.identity, 'Installed runtime or lock changed during replay');
    assert.equal(digest(readFileSync(prepared.planIdentity.path)), prepared.planIdentity.sha256, 'Release plan changed during replay');
    assert.equal(digest(readFileSync(prepared.authority.path)), prepared.authority.sha256, 'Registry authority changed during replay');
    assert.equal(retainedInputs(inputs.evidence).indexSha256, inputs.indexSha256, 'Retained evidence changed during replay');
    put('report.json', {passed: true,scope: 'Four retained saves through the supplied complete installed registry graph; offline semantic replay only',plan: prepared.planIdentity, registryAuthority: {path: prepared.authority.path, sha256: prepared.authority.sha256}, results,coverage: inputs.coverage,sourceEvidenceIndexSha256: inputs.indexSha256,nativeAcceptance: false,registryAcceptance: false,limitations: ['No new Office observation; original 17 selected native cases and four UI operations retain their identities; 41 cases unexecuted.', 'No absolute frame, glyph, baseline, raster or full-catalog parity.', 'Canonical registry authority is supplied separately; this offline replay does not repeat attestation or release verification.'],networkAttempts: 0,artifacts});
    return {output,passed: true};
  } catch (error) {
    put('failure.json', {error: String(error),stack: error.stack, stdout: error.stdout?.toString(), stderr: error.stderr?.toString(), status: error.status, results,nativeAcceptance: false,registryAcceptance: false});
    throw error;
  } finally { restore(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  replay(parseArguments(process.argv.slice(2))).then(result => console.log(JSON.stringify(result)), error => {console.error(error.stack);process.exitCode = 1;});
}
