// Re-seal tooling for the reference Name snapshot route (RR-105). It never starts Office, PowerShell or a worker.
//
//   export --output <new dir>                  deterministic export of the reference deck (the test's options) + export.json
//   seal-input --export <pptx> [--write] [--sealed-out <new dir>]
//                                              moves every unsealed input/helper-name pin to that export; prints (and with
//                                              --sealed-out writes) the sealed worker edit it needs, never applying it
//   record-run --run <completed run dir> [--envelope <file> --sha256 <hex>] [--write] [--no-archives]
//                                              validates a completed PowerPoint run of that input and records it under
//                                              test-fixtures/reference-name/measurement/ (read by reference-name-measurement.test.mjs)
//
// Without --write nothing in the repository changes; the command prints what it would do.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {digest} from './identity.mjs';

export const ROOT = fs.realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const NA = 'scripts/native-acceptance/';
export const RESEAL_FILES = Object.freeze({
  contract: `${NA}reference-name-contract.mjs`,
  snapshotTest: `${NA}reference-name-snapshot.test.mjs`,
  profileTest: `${NA}reference-name-profile.test.mjs`,
  postflight: `${NA}furniture-postflight.ps1`,
  snapshotCheck: `${NA}reference-name-snapshot-check.ps1`,
  startupCheck: 'packages/pptx/test/native-reference-startup-check.ps1',
  seriesControls: 'packages/pptx/test/native-series-name-controls.ps1',
  fixture: `${NA}test-fixtures/reference-name/reference-native-lines.pptx`,
  measurement: `${NA}test-fixtures/reference-name/measurement`,
  worker: 'packages/pptx/test/native-furniture-control.ps1',
});
// Files whose bytes other tests compare to a commit or to a whole-file hash. This tool never writes them.
export const SEALED = Object.freeze([
  'packages/pptx/test/native-furniture-control.ps1',
  'packages/pptx/test/native-process.ps1',
  'scripts/native-acceptance/run-reference-chart-profile.ps1',
  'scripts/native-acceptance/reference-chart-worker.ps1',
]);
// Every other file that pins the worker's bytes (stage derivations) changes together with the worker.
export const WORKER_SEALS = Object.freeze([
  'scripts/native-acceptance/b07-postflight.test.mjs',
  'packages/pptx/test/native-reference-startup.mjs',
  'packages/pptx/test/native-reference-startup-check.ps1',
]);

const read = (relative, root = ROOT) => fs.readFileSync(path.join(root, relative), 'utf8');
const identity = (bytes) => ({bytes: bytes.length, sha256: digest(bytes)});
const jsString = (text) => `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const psString = (text) => `'${text.replaceAll("'", "''")}'`;
const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
function once(text, old, next, label) {
  const count = text.split(old).length - 1;
  assert.equal(count, 1, `${label}: expected exactly one ${JSON.stringify(old.slice(0, 120))}, found ${count}`);
  return text.replace(old, () => next);
}

async function deps() {
  const {archiveDependencies} = await import('./reference-chart-archive.mjs');
  return archiveDependencies();
}

// The exact export the snapshot test pins (CURRENT_EXPORT): gallery catalog, seed 1, fixed timestamp/date, full provenance,
// Office font pack with visual substitution and automatic scripts, fonts ensured on the deck.
export async function exportReference() {
  const [{toPptx}, {gallery}, {loadFonts}, {readReferenceSources}] = await Promise.all([
    import('@openpresentation/opf-pptx'),
    import('@openpresentation/gallery'),
    import('@openpresentation/opf-render/fonts-node'),
    import('./reference-chart-fixtures.mjs'),
  ]);
  const source = readReferenceSources().find((row) => row.id === 'reference-native-lines').document;
  const deck = structuredClone(source),
    renderOptions = {catalogs: [gallery]};
  const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: deck, renderOptions});
  await fonts.ensure(deck, {renderOptions});
  const bytes = Buffer.from(
    await toPptx(deck, {catalogs: [gallery], seed: 1, timestamp: '2026-01-01T00:00:00Z', date: '2026-10-10', provenance: 'full', fonts}),
  );
  assert.deepEqual(deck, source, 'Export must not change the source deck');
  return bytes;
}

// Series names of slide 1's chart in document order: the ordinary series first, then the reference helpers.
export async function seriesNames(bytes) {
  const d = await deps(),
    parts = d.unzipSync(bytes),
    xml = d.strFromU8(parts['ppt/charts/chart1.xml']);
  return [...xml.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/gu)].map((match) => {
    const tx = /<c:tx>([\s\S]*?)<\/c:tx>/u.exec(match[0]);
    assert.ok(tx, 'Every series has a name');
    const value = /<c:v>([^<]*)<\/c:v>/u.exec(tx[1]);
    assert.ok(value, 'Every series name has a value');
    return value[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'");
  });
}

export async function describeExport(bytes, root = ROOT) {
  const d = await deps(),
    names = await seriesNames(bytes),
    measured = fs.readFileSync(path.join(root, RESEAL_FILES.fixture)),
    a = d.unzipSync(measured),
    b = d.unzipSync(bytes);
  const changed = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .sort()
    .filter((name) => !a[name] || !b[name] || Buffer.compare(Buffer.from(a[name]), Buffer.from(b[name])) !== 0);
  assert.equal(names[0], 'Actual', 'The renamed ordinary series is still "Actual"');
  return {
    ...identity(bytes),
    seriesNames: names,
    helperNames: names.slice(1),
    retainedArchive: identity(measured),
    partsDifferingFromRetainedArchive: changed,
  };
}

// Current pins, read from the unsealed contract.
export function currentPins(root = ROOT) {
  const contract = read(RESEAL_FILES.contract, root);
  const input = /export const REFERENCE_NAME_INPUT=Object\.freeze\(\{bytes:(\d+),sha256:'([a-f0-9]{64})'\}\);/u.exec(contract);
  assert.ok(input, 'REFERENCE_NAME_INPUT literal');
  const other = /assert\.deepEqual\(edit\.otherNames,(\[[^\]]*\])\)/u.exec(contract);
  assert.ok(other, 'otherNames literal');
  const helperNames = [...other[1].matchAll(/name:'((?:[^'\\]|\\.)*)'/gu)].map((m) => m[1].replaceAll("\\'", "'").replaceAll('\\\\', '\\'));
  return {input: {bytes: Number(input[1]), sha256: input[2]}, helperNames, otherNamesLiteral: other[1]};
}

const otherNamesLiteral = (names) => `[${names.map((name, i) => `{index:${i + 2},name:${jsString(name)}}`).join(',')}]`;

// The comparison the snapshot test runs before a re-seal (the export differs from the retained archive in listed parts),
// replaced once by byte identity. Later re-seals keep the identity form and only move CURRENT_EXPORT.
const IDENTITY_COMMENT = [
  '// The current export of the reference deck IS the archive PowerPoint was measured with (REFERENCE_NAME_INPUT, retained as',
  '// test-fixtures/reference-name/reference-native-lines.pptx; its PowerPoint run is recorded under test-fixtures/reference-name/measurement',
  '// and checked by reference-name-measurement.test.mjs). Any export change fails here: re-measure in PowerPoint and re-seal with',
  '// scripts/native-acceptance/reference-name-reseal.mjs (see its header) instead of widening this assertion.',
].join('\n');
const IDENTITY_CHECK =
  " assert.deepEqual(CURRENT_EXPORT,REFERENCE_NAME_INPUT,'The pinned export is the measured archive');assert.deepEqual(exported,input,'The current export is byte-identical to the measured archive');";

function snapshotTestEdit(text, next, oldNames, newNames) {
  const label = RESEAL_FILES.snapshotTest;
  const literal = /const CURRENT_EXPORT=Object\.freeze\(\{bytes:\d+,sha256:'[a-f0-9]{64}'\}\);/u;
  assert.ok(literal.test(text), `${label}: CURRENT_EXPORT literal`);
  text = text.replace(literal, `const CURRENT_EXPORT=Object.freeze({bytes:${next.bytes},sha256:'${next.sha256}'});`);
  const commentStart = text.indexOf('// The current export of the reference deck.'),
    commentEnd = text.indexOf('const CURRENT_EXPORT=');
  if (commentStart >= 0) {
    assert.ok(commentStart < commentEnd, `${label}: comment precedes CURRENT_EXPORT`);
    text = `${text.slice(0, commentStart) + IDENTITY_COMMENT}\n${text.slice(commentEnd)}`;
  } else assert.ok(text.includes(IDENTITY_COMMENT), `${label}: neither the differs-only nor the identity comment`);
  const differsStart = text.indexOf(' const sealedParts=deps.unzipSync(input),exportedParts=deps.unzipSync(exported);');
  if (differsStart >= 0) {
    const tail = ' const before=tx(input,',
      differsEnd = text.indexOf(tail, differsStart);
    assert.ok(differsEnd > differsStart, `${label}: differs-only block end`);
    const block = text.slice(differsStart, differsEnd);
    assert.ok(block.includes('only in the two chart parts'), `${label}: the expected differs-only block`);
    text = `${text.slice(0, differsStart) + IDENTITY_CHECK}\n${text.slice(differsEnd)}`;
  } else once(text, IDENTITY_CHECK, IDENTITY_CHECK, label);
  return once(text, `otherNames:${otherNamesLiteral(oldNames)}`, `otherNames:${otherNamesLiteral(newNames)}`, label);
}

// Each unsealed pin: file, what it pins, and the edit from the current pins to the export's.
export function unsealedEdits(old, next) {
  const sameNames = old.helperNames.length === next.helperNames.length;
  assert.ok(sameNames && next.helperNames.length === 2, 'The reference deck keeps exactly two helper series on slide 1');
  const otherOld = `otherNames:${otherNamesLiteral(old.helperNames)}`,
    otherNew = `otherNames:${otherNamesLiteral(next.helperNames)}`;
  return [
    {
      file: RESEAL_FILES.contract,
      pins: 'REFERENCE_NAME_INPUT (admitted input) and the helper names observed before the setter',
      apply: (text) =>
        once(
          once(
            text,
            `REFERENCE_NAME_INPUT=Object.freeze({bytes:${old.input.bytes},sha256:'${old.input.sha256}'})`,
            `REFERENCE_NAME_INPUT=Object.freeze({bytes:${next.input.bytes},sha256:'${next.input.sha256}'})`,
            RESEAL_FILES.contract,
          ),
          `assert.deepEqual(edit.otherNames,${otherNamesLiteral(old.helperNames)})`,
          `assert.deepEqual(edit.otherNames,${otherNamesLiteral(next.helperNames)})`,
          RESEAL_FILES.contract,
        ),
    },
    {
      file: RESEAL_FILES.snapshotTest,
      pins: 'CURRENT_EXPORT, the export-versus-measured comparison (made byte identity), synthetic helper names',
      apply: (text) => snapshotTestEdit(text, next.input, old.helperNames, next.helperNames),
    },
    {
      file: RESEAL_FILES.profileTest,
      pins: 'synthetic helper names of the single-copy route fixture',
      apply: (text) => once(text, otherOld, otherNew, RESEAL_FILES.profileTest),
    },
    {
      file: RESEAL_FILES.postflight,
      pins: 'admitted input bytes/hash in Test-ReferenceNameActionReady',
      apply: (text) =>
        once(
          text,
          `$Request.input.bytes -ne ${old.input.bytes} -or $Request.input.sha256 -cne '${old.input.sha256}'`,
          `$Request.input.bytes -ne ${next.input.bytes} -or $Request.input.sha256 -cne '${next.input.sha256}'`,
          RESEAL_FILES.postflight,
        ),
    },
    {
      file: RESEAL_FILES.snapshotCheck,
      pins: 'synthetic startup fixture length and declared source hash',
      apply: (text) =>
        once(
          once(text, `CreateInstance([byte],${old.input.bytes})`, `CreateInstance([byte],${next.input.bytes})`, RESEAL_FILES.snapshotCheck),
          `declaredSourceHash='${old.input.sha256}'`,
          `declaredSourceHash='${next.input.sha256}'`,
          RESEAL_FILES.snapshotCheck,
        ),
    },
    {
      file: RESEAL_FILES.startupCheck,
      pins: 'synthetic startup fixture length and declared source hash (this file also pins the worker hash: see the sealed edit)',
      apply: (text) =>
        once(
          once(text, `CreateInstance([byte],${old.input.bytes})`, `CreateInstance([byte],${next.input.bytes})`, RESEAL_FILES.startupCheck),
          `$sourceHash='${old.input.sha256}'`,
          `$sourceHash='${next.input.sha256}'`,
          RESEAL_FILES.startupCheck,
        ),
    },
    {
      file: RESEAL_FILES.seriesControls,
      pins: 'managed worker controls: admitted source hash/bytes and mocked helper names',
      apply: (text) => {
        let out = once(text, `$referenceSourceHash='${old.input.sha256}'`, `$referenceSourceHash='${next.input.sha256}'`, RESEAL_FILES.seriesControls);
        out = once(out, `$bytes=${old.input.bytes};`, `$bytes=${next.input.bytes};`, RESEAL_FILES.seriesControls);
        out = once(out, `.Name=${psString(old.helperNames[0])};`, `.Name=${psString(next.helperNames[0])};`, RESEAL_FILES.seriesControls);
        return once(out, `@{Name=${psString(old.helperNames[1])};`, `@{Name=${psString(next.helperNames[1])};`, RESEAL_FILES.seriesControls);
      },
    },
  ];
}

// The sealed worker edit the new input needs (proposal only). Two literal regions: the admitted source identity and the
// helper names it requires before the setter. Every test that pins the worker's bytes needs a matching eighth stage.
// The worker's own current literals are the "before" side, so the proposal is right whatever state the unsealed pins are in.
export function workerEdits(next, workerText) {
  const source = [...workerText.matchAll(/if\(\$SourceBytes -ne \d+ -or \$SourceHash -cne '[a-f0-9]{64}'/gu)];
  assert.equal(source.length, 1, 'One sealed source identity guard in the worker');
  const helper = [...workerText.matchAll(/\$name -cne (?:\('OPF reference '\+\(\$index-1\)\)|\(@\((?:'(?:[^']|'')*'(?:,|(?=\))))+\)\[\$index-2\]\))/gu)];
  assert.equal(helper.length, 1, 'One sealed helper-name guard in the worker');
  return [
    [source[0][0], `if($SourceBytes -ne ${next.input.bytes} -or $SourceHash -cne '${next.input.sha256}'`],
    [helper[0][0], `$name -cne (@(${next.helperNames.map(psString).join(',')})[$index-2])`],
  ];
}

export async function sealInput({exportFile, write = false, sealedOut = null, root = ROOT}) {
  const bytes = fs.readFileSync(exportFile),
    described = await describeExport(bytes, root),
    old = currentPins(root),
    next = {input: identity(bytes), helperNames: described.helperNames};
  const fresh = await exportReference();
  assert.deepEqual(identity(fresh), next.input, 'The file to seal must be the current export of the reference deck');
  const plan = unsealedEdits(old, next).map((edit) => {
    const before = read(edit.file, root),
      after = edit.apply(before);
    return {...edit, before, after, changed: before !== after};
  });
  const worker = read(RESEAL_FILES.worker, root),
    pairs = workerEdits(next, worker),
    applied = pairs.every(([prior, replacement]) => prior === replacement);
  let proposed = worker;
  for (const [prior, replacement] of pairs) proposed = once(proposed, prior, replacement, RESEAL_FILES.worker);
  const proposal = {
    file: RESEAL_FILES.worker,
    edits: pairs,
    current: identity(Buffer.from(worker)),
    proposed: identity(Buffer.from(proposed)),
    alsoPinWorkerBytes: WORKER_SEALS,
  };
  if (write) {
    for (const edit of plan) if (edit.changed) fs.writeFileSync(path.join(root, edit.file), edit.after);
    fs.writeFileSync(path.join(root, RESEAL_FILES.fixture), bytes);
  }
  if (sealedOut) {
    fs.mkdirSync(sealedOut, {recursive: false});
    fs.writeFileSync(path.join(sealedOut, 'native-furniture-control.ps1'), proposed);
    fs.writeFileSync(path.join(sealedOut, 'worker-stage8.json'), json(proposal));
  }
  return {
    old: old.input,
    oldHelperNames: old.helperNames,
    next: next.input,
    helperNames: next.helperNames,
    partsDifferingFromRetainedArchive: described.partsDifferingFromRetainedArchive,
    unsealed: plan.map(({file, pins, changed}) => ({file, pins, changed})),
    fixture: {file: RESEAL_FILES.fixture, changed: described.retainedArchive.sha256 !== next.input.sha256},
    sealedWorker: proposal,
    sealedWorkerApplied: applied,
    written: write,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// record-run: a completed run directory as the typed runner leaves it (OutputDirectory of run-reference-name-snapshots.ps1).
const RUN_FILES = [
  'execution-request.json',
  'inputs/case.pptx',
  'inputs/execution-envelope.json',
  'runner.json',
  'postflight-admission.json',
  'postflight-result.json',
  'postflight.jsonl',
  'reference-name-snapshot-comparison.json',
  'native/request.json',
  'native/report.json',
  'native/supervisor.json',
  'native/worker.json',
  'native/stages.jsonl',
  'native/inputs/input.pptx',
  'native/native-furniture-control.pptx',
  'native/reference-name-before.pptx',
  'native/reference-name-reopened.pptx',
];
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/u, ''));

export async function summarizeRun(run, {root = ROOT} = {}) {
  for (const name of RUN_FILES) assert.ok(fs.statSync(path.join(run, name)).isFile(), `Completed run file missing: ${name}`);
  const file = (name) => fs.readFileSync(path.join(run, name)),
    runner = readJson(path.join(run, 'runner.json')),
    request = readJson(path.join(run, 'execution-request.json')),
    report = readJson(path.join(run, 'native/report.json')),
    terminal = readJson(path.join(run, 'native/supervisor.json')),
    postflight = readJson(path.join(run, 'postflight-result.json')),
    stages = file('native/stages.jsonl');
  assert.equal(runner.status, 'lifecycle-observed; semantic-and-visual-review-required', 'The typed runner completed (runner.json status)');
  assert.equal(runner.runOfficeRequested, true);
  assert.equal(request.profile, 'reference-line-one-name-three-native-archives-v1');
  assert.equal(postflight.error, null);
  assert.equal(postflight.result?.observedZero, true, 'The observer saw zero PowerPoint processes after the owned Quit');
  assert.deepEqual([terminal.timedOut, terminal.exitCode, terminal.cleanupConfirmed], [false, 0, true]);
  const {REFERENCE_NAME_INPUT} = await import(pathToFileURL(path.join(root, RESEAL_FILES.contract)).href);
  const {assertReferenceNameSnapshotNative} = await import(pathToFileURL(path.join(root, `${NA}reference-name-snapshot-contract.mjs`)).href);
  const input = file('native/inputs/input.pptx');
  assert.deepEqual(identity(input), REFERENCE_NAME_INPUT, 'The run measured the sealed input');
  assert.deepEqual(file('inputs/case.pptx'), input);
  assert.deepEqual(identity(fs.readFileSync(path.join(root, RESEAL_FILES.fixture))), REFERENCE_NAME_INPUT, 'The retained archive is the sealed input');
  const native = assertReferenceNameSnapshotNative(report, stages);
  const archives = {
    before: file('native/reference-name-before.pptx'),
    edited: file('native/native-furniture-control.pptx'),
    reopened: file('native/reference-name-reopened.pptx'),
  };
  for (const row of report.referenceNameSnapshots) assert.equal(row.sha256, digest(archives[row.phase]));
  assert.equal(report.saved.sha256, digest(archives.edited));
  const edit = report.actionPlan.chartSeriesEdits[0],
    rows = stages
      .toString('utf8')
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
  const proof = readJson(path.join(run, 'reference-name-snapshot-comparison.json'));
  return {
    schemaVersion: 1,
    profile: request.profile,
    input: REFERENCE_NAME_INPUT,
    requestSha256: digest(file('execution-request.json')),
    envelopeSha256: request.envelopeSha256,
    admission: identity(file('postflight-admission.json')),
    routeComparison: identity(file('reference-name-snapshot-comparison.json')),
    worker: {sha256: request.worker.sha256, bytes: request.worker.bytes},
    controllerRevision: request.controller.revision,
    started: rows[0].timestamp,
    finished: rows.at(-1).timestamp,
    stages: rows.length,
    native,
    names: Object.fromEntries(['original', 'edited', 'reopened'].map((phase) => [phase, report.phases[phase].chartSeriesNames[0].observedName])),
    otherNames: edit.otherNames,
    typeEvidence: {chart: edit.chartTypeObservation, count: edit.referenceSeriesCount, series: edit.referenceSeriesTypes},
    archives: Object.fromEntries(Object.entries(archives).map(([phase, bytes]) => [phase, identity(bytes)])),
    rasters: ['original', 'edited', 'reopened'].flatMap((phase) => report.phases[phase].rasters.map((r) => ({phase, slideIndex: r.slideIndex, sha256: r.sha256}))),
    firstSaveOpenParts: proof.sourceBefore.rawFindings.map((row) => row.part),
    coreRevisions: proof.raw.metadata.find((row) => row.part === 'docProps/core.xml')?.phases.map((row) => row.revision?.value ?? null),
    postflight: {observedZero: postflight.result.observedZero},
    archivesFor: {report, stages, ...archives},
  };
}

export async function recordRun({run, envelope = null, sha256 = null, write = false, archives = true, root = ROOT}) {
  run = fs.realpathSync(run);
  if (envelope) {
    // The route's own final check, before anything in the controller changes (it binds the clean controller revision).
    const out = execFileSync(
      process.execPath,
      [path.join(root, `${NA}reference-name-snapshot-profile.mjs`), 'verify-admission', '--envelope', envelope, '--sha256', sha256, '--output', run, '--require-office', 'true'],
      {cwd: root, encoding: 'utf8'},
    );
    assert.match(out, /"verified":true/u, 'verify-admission');
  }
  const summary = await summarizeRun(run, {root}),
    {archivesFor, ...measurement} = summary;
  const target = path.join(root, RESEAL_FILES.measurement),
    retained = {
      'report.json': fs.readFileSync(path.join(run, 'native/report.json')),
      'stages.jsonl': archivesFor.stages,
      ...(archives ? {'reference-name-before.pptx': archivesFor.before, 'native-furniture-control.pptx': archivesFor.edited, 'reference-name-reopened.pptx': archivesFor.reopened} : {}),
    };
  measurement.retained = Object.fromEntries(Object.entries(retained).map(([name, bytes]) => [name, identity(bytes)]));
  if (write) {
    fs.rmSync(target, {recursive: true, force: true});
    fs.mkdirSync(target, {recursive: true});
    for (const [name, bytes] of Object.entries(retained)) fs.writeFileSync(path.join(target, name), bytes);
    fs.writeFileSync(path.join(target, 'measurement.json'), json(measurement));
  }
  return {target: RESEAL_FILES.measurement, written: write, measurement};
}

// ---------------------------------------------------------------------------------------------------------------------
function options(argv, allowed, flags) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (flags.includes(key)) {
      out[key] = true;
      continue;
    }
    assert.ok(allowed.includes(key) && argv[i + 1] && !argv[i + 1].startsWith('--') && !Object.hasOwn(out, key), `Unknown or incomplete option ${key}`);
    out[key] = argv[++i];
  }
  return out;
}
async function main([command, ...argv]) {
  if (command === 'export') {
    const o = options(argv, ['--output'], []);
    assert.ok(o['--output'], '--output <new directory>');
    const bytes = await exportReference(),
      out = path.resolve(o['--output']);
    fs.mkdirSync(out, {recursive: false});
    const file = path.join(out, 'reference-native-lines.pptx');
    fs.writeFileSync(file, bytes, {flag: 'wx'});
    const described = {file, ...(await describeExport(bytes)), pinned: currentPins()};
    fs.writeFileSync(path.join(out, 'export.json'), json(described), {flag: 'wx'});
    console.log(JSON.stringify(described, null, 2));
    return;
  }
  if (command === 'seal-input') {
    const o = options(argv, ['--export', '--sealed-out'], ['--write']);
    assert.ok(o['--export'], '--export <pptx>');
    const result = await sealInput({exportFile: path.resolve(o['--export']), write: Boolean(o['--write']), sealedOut: o['--sealed-out'] ? path.resolve(o['--sealed-out']) : null});
    console.log(JSON.stringify(result, null, 2));
    if (!result.sealedWorkerApplied)
      console.log(
        `\nSEALED (not applied): ${RESEAL_FILES.worker} still admits only ${result.old.bytes}/${result.old.sha256.slice(0, 12)}... and helper names ${JSON.stringify(result.oldHelperNames)}; the route cannot measure the new input until the supervisor-approved eighth worker stage lands (see RUNBOOK).`,
      );
    return;
  }
  if (command === 'record-run') {
    const o = options(argv, ['--run', '--envelope', '--sha256'], ['--write', '--no-archives']);
    assert.ok(o['--run'], '--run <completed run directory>');
    assert.equal(Boolean(o['--envelope']), Boolean(o['--sha256']), '--envelope and --sha256 go together');
    const result = await recordRun({run: o['--run'], envelope: o['--envelope'] ?? null, sha256: o['--sha256'] ?? null, write: Boolean(o['--write']), archives: !o['--no-archives']});
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error('Usage: node scripts/native-acceptance/reference-name-reseal.mjs export|seal-input|record-run ... (see header)');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  });
