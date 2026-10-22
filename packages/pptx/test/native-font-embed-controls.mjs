import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {
  auditCanonicalFixtureManifest,
  auditDiagnosticObservations,
  auditEmbedVerifierSource,
  expectedFontSlotStageNames,
  expectedFontsInventoryStageNames,
  expectedRangeSnapshotStageNames,
  auditBlockedEmbedEvidence,
  auditBlockedEvidenceDirectory,
  auditEvidenceDirectory,
  auditSavedEmbedPresentation,
  EMBED_COM_SETTERS,
  EMBED_SOURCE_POLICY,
  EMBED_LOCAL_ASSIGNMENT_ROOTS,
  hasOfficeQuitInvocation,
  inspectFontEmbeddingPackage,
  PERMITTED_CARLITO_FIXTURE,
  PERMITTED_CARLITO_FIXTURE_FILES,
  PERMITTED_CARLITO_LICENSE_SHA256,
  PERMITTED_NATIVE_FONT_NAMES,
  scanPowerShellSource,
  stripPowerShellLiteralsForScan,
} from './native-font-embed-audit.mjs';
import {assertSourcePolicyProbes, SOURCE_POLICY_PROBE_POSITIVES} from './powershell-scan-probes.mjs';
import {readPowerShellPolicyLists} from './powershell-scan.mjs';
import {applyMasterBulletFontTransform, carlitoOnlySource, carlitoOnlyTypefaceFailures, declaredFontsUsed, MASTER_BULLET_FONT_TRANSFORM, themeFontSlots, typefaceInventory} from './native-font-embed-fixture-source.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(root, '..');
const embedVerifier = path.join(root, 'native-font-embed.ps1');
const auditCli = path.join(root, 'native-font-embed-audit.mjs');
const editVerifier = path.join(root, 'native-font-edit.ps1');
const node = process.execPath;
const spawnOptions = {cwd: packageRoot, encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 15_000, windowsHide: true};
// Windows PowerShell 5.1 cold start on hosted runners can exceed 15 s; this bounds the test process only, not any gate.
const psSpawnOptions = {...spawnOptions, timeout: 180_000};
const psOutcome = child => child.error ? `spawn error: ${child.error.message}` : `status ${child.status} signal ${child.signal}\n${child.stderr || child.stdout}`;
assert.equal(process.versions.node.split('.')[0], '24', 'Native font embed controls require Node 24.');
const outcomes = [];
const record = name => outcomes.push({name, passed: true});

const embedSource = await readFile(embedVerifier, 'utf8');
assert.deepEqual(auditEmbedVerifierSource(embedSource), []);
record('embed-verifier-requests-gated-embed');

// Dynamic code outside the pure regression's exact re-evaluation of its two extracted helpers, checked by both the
// PowerShell AST policy (Windows) and the Node source policy.
const workerAnchor = 'function Get-FontEmbedSha256(';
const pureAnchor = '        Invoke-Expression $comDefinition[0].Extent.Text';
const withWorker = line => embedSource.replace(workerAnchor, `function Invoke-FontEmbedForbiddenDynamic($Text) { ${line} }\r\n${workerAnchor}`);
const withPure = line => embedSource.replace(pureAnchor, `${pureAnchor}\r\n        ${line}`);
const IEX_MESSAGE = /must not run Invoke-Expression, iex or Add-Type/, DYNAMIC_MESSAGE = /harness must not (use dynamic code|use|run|invoke|reference|pass)/;
const dynamicCodeNegatives = [
  ['worker-invoke-expression', withWorker('Invoke-Expression $Text'), IEX_MESSAGE],
  ['worker-iex', withWorker('iex $Text'), IEX_MESSAGE],
  ['worker-qualified-invoke-expression', withWorker('Microsoft.PowerShell.Utility\\Invoke-Expression $Text'), IEX_MESSAGE],
  ['worker-string-named-iex', withWorker("& 'iex' $Text"), IEX_MESSAGE],
  ['worker-add-type', withWorker('Add-Type -TypeDefinition $Text'), IEX_MESSAGE],
  ['pure-other-argument', withPure('Invoke-Expression $script:payload'), IEX_MESSAGE],
  ['pure-iex-alias', withPure('iex $stageDefinition[0].Extent.Text'), IEX_MESSAGE],
  ['pure-add-type', withPure('Add-Type -TypeDefinition $script:payload'), IEX_MESSAGE],
  // Other dynamic code, and non-literal & / . targets outside the exact COM-wrapper and helper dot-source sites.
  ['worker-scriptblock-create', withWorker('$null=[scriptblock]::Create($Text)'), DYNAMIC_MESSAGE],
  ['worker-qualified-scriptblock-create', withWorker('$null=[System.Management.Automation.ScriptBlock]::Create($Text)'), DYNAMIC_MESSAGE],
  ['worker-invoke-script', withWorker('$null=$Host.Runspace.InvokeScript($Text)'), DYNAMIC_MESSAGE],
  ['worker-execution-context', withWorker('$null=$ExecutionContext.SessionState'), DYNAMIC_MESSAGE],
  ['worker-invoke-command', withWorker('Invoke-Command -ScriptBlock $Text'), DYNAMIC_MESSAGE],
  ['worker-icm', withWorker('icm -ScriptBlock $Text'), DYNAMIC_MESSAGE],
  ['worker-call-variable', withWorker('& $Text'), DYNAMIC_MESSAGE],
  ['worker-dot-variable', withWorker('. $Text'), DYNAMIC_MESSAGE],
  ['worker-call-expression', withWorker('& (Get-Command $Text)'), DYNAMIC_MESSAGE],
  ['operation-outside-com-wrapper', withWorker('& $Operation'), DYNAMIC_MESSAGE],
  ['helper-dot-source-inside-function', withWorker('. $processSnapshot'), DYNAMIC_MESSAGE],
  ['helper-called-not-dot-sourced', withWorker('& $fontHelperSnapshot'), DYNAMIC_MESSAGE],
  ['worker-dynamic-member', withWorker('$null=$Text.$Name()'), DYNAMIC_MESSAGE],
];
assert.ok(embedSource.includes(workerAnchor) && embedSource.includes(pureAnchor));

const editSource = await readFile(editVerifier, 'utf8');
assert.match(editSource, /SaveAs\(\$savedPath,\s*24\s*,\s*0\s*\)/, 'Gate E native-font-edit must keep EmbedFonts 0.');
assert.doesNotMatch(editSource, /SaveAs\(\$savedPath,\s*24\s*,\s*-1\s*\)/, 'Gate E must not request font embedding.');
assert.match(editSource, /tolerancePoints=0\.02/, 'Gate E native-font-edit must keep the 0.02pt geometry gate.');
record('gate-e-remains-no-embed');

const ps = path.join(process.env.WINDIR ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
let pureRegression = null;
if (process.platform === 'win32') {
  const child = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', embedVerifier, '-PureRegression'], psSpawnOptions);
  assert.equal(child.status, 0, psOutcome(child));
  const pure = JSON.parse(child.stdout.replace(/^\uFEFF/, ''));
  assert.equal(pure.officeOrComCalls, 0);
  assert.equal(pure.canonicalHashRejected, true); assert.equal(pure.wrongLicenseRejected, true);
  assert.equal(pure.carlitoAptosGateRejected, true); assert.equal(pure.stopLatchPassed, true);
  assert.equal(pure.observationHelpersPassed, true); assert.ok(Array.isArray(pure.observationStageNames) && pure.observationStageNames.length > 0);
  pureRegression = pure;
  record('embed-pure-regression');
  // The pure regression's AST policy rejects a copy whose only gate reads the pre-edit observation, or that kills a process.
  const astRoot = await mkdtemp(path.join(path.resolve(os.tmpdir()), 'opf-font-embed-ast-'));
  try {
    const astNegatives = [
      ['gate-on-pre-edit', embedSource.replace('$report.nativeFontsGate=Get-FontEmbedNativeFontsGate $report.nativeFontsObservation', '$report.nativeFontsGate=Get-FontEmbedNativeFontsGate $report.preEditFontsObservation'), /post-edit \$report\.nativeFontsObservation/],
      ['kill', embedSource.replace('function Get-FontEmbedSha256(', 'function Invoke-FontEmbedForbiddenKill($Target) { $Target.Kill() }\r\nfunction Get-FontEmbedSha256('), /must not invoke \.Kill/],
      ['stop-process', embedSource.replace('function Get-FontEmbedSha256(', 'function Invoke-FontEmbedForbiddenStop($Target) { Stop-Process -Id $Target }\r\nfunction Get-FontEmbedSha256('), /must not stop processes/],
      ...dynamicCodeNegatives.map(([name, text, message]) => [`dynamic-${name}`, text, message]),
    ];
    for (const [name, text, message] of astNegatives) {
      assert.notEqual(text, embedSource, name);
      const copy = path.join(astRoot, `${name}.ps1`); await writeFile(copy, text);
      const negative = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', copy, '-PureRegression'], psSpawnOptions);
      assert.ok(!negative.error && negative.status !== null && negative.status !== 0, `${name}: ${psOutcome(negative)}`);
      // PowerShell wraps error records at the console width, so compare with all whitespace removed.
      assert.match((negative.stderr + negative.stdout).replace(/\s+/g, ''), new RegExp(message.source.replace(/ /g, '')), name);
    }
  } finally { await rm(astRoot, {recursive: true, force: true}); }
  record('embed-ast-policy-negatives');
} else outcomes.push({name: 'embed-pure-regression', passed: true, skipped: 'non-Windows runner'});

assert.ok(auditEmbedVerifierSource('$script:presentation.SaveAs($savedPath,24,0)', {label: 'negative'}).some(item => item.code === 'embed-forced-off'));
assert.equal(auditEmbedVerifierSource("throw 'Embed harness must not call Application.Quit'").filter(item => item.code === 'application-quit').length, 0);
assert.ok(hasOfficeQuitInvocation('$app.Quit()'));
record('source-policy-negatives');

// Node dynamic-code and member-assignment policy: the pure-regression exemption is exact, and the worker may assign only
// local report roots and the documented COM setters (EMBED_COM_SETTERS).
{
  const codes = text => new Set(auditEmbedVerifierSource(text).map(item => item.code));
  for (const [name, text] of dynamicCodeNegatives) assert.ok(codes(text).has('dynamic-code'), `node ${name}`);
  assert.ok(codes(embedSource.replace(pureAnchor, `${pureAnchor}\r\n        $script:o=$app.'Quit'()`)).has('dynamic-code'), 'string-named member');
  assert.ok(EMBED_COM_SETTERS.includes('wholeFont.Name') && EMBED_COM_SETTERS.includes('presentation.Saved') && !EMBED_LOCAL_ASSIGNMENT_ROOTS.includes('presentation'));
  for (const [name, line] of [
    ['application-visible', '$app.Visible=0'],
    ['other-font-object', "$font.Name='Aptos'"],
    ['nested-setter', '$wholeFont.Color.RGB=0'],
    ['chained-com-property', "$script:presentation.Slides.Item(1).Shapes.Item(1).Name='x'"],
    ['compound-assignment', '$shape.Top += 1'],
    ['postfix-increment', '$shape.Top++'],
    ['prefix-increment', '++$shape.Top'],
    ['index-on-com', "$script:presentation.Tags['k']='v'"],
    ['setter-method', '$script:presentation.set_Saved(0)'],
    ['pipeline-variable', "$shapes | ForEach-Object { $_.Name='x' }"],
  ]) assert.ok(codes(`${embedSource}\r\n${line}\r\n`).has('com-property-assignment'), `assignment ${name}`);
  for (const [name, line] of [
    ['comment', "# $app.Visible=0 and $font.Name='Aptos'"],
    ['string', "$note='$app.Visible=0'"],
    ['here-string', "$note=@'\r\n$font.Name='Aptos'\r\n'@"],
    ['local-report', '$report.extra=1'],
    ['documented-setter', '$runFont.Bold=0'],
    ['comparison', 'if($font.Name -eq $x) { }'],
  ]) assert.deepEqual(auditEmbedVerifierSource(`${embedSource}\r\n${line}\r\n`), [], `allowed ${name}`);
}
record('source-policy-dynamic-code-and-com-assignments');

// The Node allowlist policy and the harness's $script:FontEmbedPolicy* lists (enforced by its PowerShell AST check) are
// one reviewed allowlist; every independent-review probe is rejected by both layers.
{
  const lists = readPowerShellPolicyLists(embedSource, 'FontEmbed');
  for (const [key, value] of Object.entries(lists)) assert.deepEqual(value, [...EMBED_SOURCE_POLICY[key]], `FontEmbedPolicy ${key} parity`);
  const probes = await assertSourcePolicyProbes({source: embedSource, audit: auditEmbedVerifierSource, harnessPath: embedVerifier, assertFunction: 'Assert-FontEmbedVerifierAst', positives: SOURCE_POLICY_PROBE_POSITIVES, names: {com: 'Invoke-FontEmbedCom', pure: 'Invoke-FontEmbedPureRegression'}});
  outcomes.push({name: 'source-policy-allowlist-parity-and-review-probes', passed: true, probes});
}

// Source-policy lexer: comments, every string form, and here-strings are blanked in one left-to-right pass, so an
// apostrophe in a comment can neither hide a following Quit call (fail open) nor invent a gate-input mismatch (fail closed).
{
  const codes = text => new Set(auditEmbedVerifierSource(text).map(item => item.code));
  const quitCases = [
    ['apostrophe-in-line-comment', "# it's the presentation's owner\r\n$app.Quit()\r\n$x = 'y'", true],
    ['apostrophe-in-double-quoted-string', '$msg = "it\'s done"\n$app.Quit()\n$y = \'z\'', true],
    ['block-comment-with-quotes', '<# it\'s "quoted" and \'single\' #>\n$app.Quit()', true],
    ['quit-inside-block-comment', "<#\n$app.Quit()\nit's #>\n$x = 1", false],
    ['single-here-string-with-quit', "$t = @'\n$app.Quit()\nit's\n'@\n$x = 1", false],
    ['double-here-string-with-quit', '$t = @"\n$app.Quit() "quoted" it\'s\n"@\n$x = 1', false],
    ['quit-after-here-string', "$t = @'\nit's\n'@\n$app.Quit()", true],
    ['here-string-terminator-must-start-line', "$t = @'\n x '@ $app.Quit()\n'@\n$x = 1", false],
    ['backtick-escaped-double-quote', '$m = "say `"hi`" it\'s"; $app.Quit()', true],
    ['backtick-escaped-quote-stays-literal', '$m = "`"; $app.Quit(); `""', false],
    ['doubled-double-quote', '$m = "a""b"; $app.Quit()', true],
    ['doubled-single-quote', "$m = 'it''s'; $app.Quit()", true],
    ['braced-variable-with-quote-in-string', '$probe = "${x"}"; $app.Quit() # "', true],
    ['braced-variable-with-quote-in-here-string', '$probe = @"\n${x"}\n"@\n$app.Quit()', true],
    ['typographic-quotes', '$m = \u2018 # \u2019; $app.Quit()', true],
    ['subexpression-in-expandable-string', '$m = "$($app.Quit())"', true],
    ['expandable-string-member-text', '$m = "$app.Quit()"', false],
    ['braced-variable', "${app's}.Quit()", true],
    ['application-quit-member', '$ppt.Application.Quit()', true],
  ];
  for (const [name, text, expected] of quitCases) {
    assert.equal(hasOfficeQuitInvocation(text), expected, name);
    const code = stripPowerShellLiteralsForScan(text);
    assert.equal(code.length, text.length, `${name}: offsets preserved`);
    assert.deepEqual([...code.matchAll(/\r?\n/g)].map(match => match.index), [...text.matchAll(/\r?\n/g)].map(match => match.index), `${name}: line breaks preserved`);
    assert.deepEqual(scanPowerShellSource(text).issues, [], `${name}: fully modeled`);
  }
  // The reviewed verifier with an apostrophe comment near the gate still audits clean, and a hidden Quit is caught.
  const gateLine = '$report.nativeFontsGate=Get-FontEmbedNativeFontsGate $report.nativeFontsObservation';
  assert.ok(embedSource.includes(gateLine));
  assert.deepEqual(auditEmbedVerifierSource(embedSource.replace(gateLine, `# gate the presentation's post-edit inventory\r\n    ${gateLine}`)), []);
  assert.deepEqual(auditEmbedVerifierSource(embedSource.replace(gateLine, `${gateLine} # it's final`)), []);
  const hiddenQuit = embedSource.replace(gateLine, `${gateLine}\r\n    # it's done\r\n    $app.Quit()`);
  assert.notEqual(hiddenQuit, embedSource);
  assert.ok(codes(hiddenQuit).has('application-quit'), 'An apostrophe comment must not hide a following $app.Quit()');
  const hereStringGate = embedSource.replace(gateLine, `${gateLine}\r\n    $note=@'\r\nGet-FontEmbedNativeFontsGate $report.preEditFontsObservation\r\n'@`);
  assert.deepEqual(auditEmbedVerifierSource(hereStringGate), []);
  // Syntax the lexer does not model fails closed instead of being guessed.
  for (const [name, text, kind] of [
    ['glued-comment', "$x=1#it's\n$app.Quit()", 'ambiguous-comment-start'],
    ['unterminated-single', "$x = 'open\n$app.Quit()", 'unterminated-string'],
    ['unterminated-double', '$x = "open\n$app.Quit()', 'unterminated-string'],
    ['unterminated-block-comment', '<# open\n$app.Quit()', 'unterminated-block-comment'],
    ['unterminated-here-string', "$x = @'\n$app.Quit()\n '@", 'unterminated-here-string'],
    ['here-string-header-with-text', "$x = @'text'\n", 'here-string-header'],
    ['backtick-escaped-quote-in-code', "Write-Output `'; $app.Quit()", 'backtick-escape-in-code'],
    ['backtick-escaped-command-name', 'i`ex $y', 'backtick-escape-in-code'],
    ['lone-cr-moves-here-string-terminator', "$x = @'\r\nfoo\r'@\r$app.Quit()\r\n'@\r\n", 'lone-carriage-return'],
    ['glued-block-comment', 'Write-Output a<#; $app.Quit(); #>', 'ambiguous-comment-start'],
  ]) {
    assert.ok(scanPowerShellSource(text).issues.some(item => item.kind === kind), name);
    assert.ok(codes(text).has('source-scan-unsupported'), `${name}: audit fails closed`);
  }
  assert.deepEqual(scanPowerShellSource(embedSource).issues, []);
}
record('source-policy-lexer');

const generation = {
  kind: 'native-font-edit-fixture', source: {file: 'source.pptx', sha256: '0'.repeat(64)}, registration: {flags: 0},
  license: {file: 'LICENSE_FONT', spdx: 'OFL-1.1', sha256: PERMITTED_CARLITO_LICENSE_SHA256},
  fonts: PERMITTED_CARLITO_FIXTURE_FILES.map(file => ({file, sha256: PERMITTED_CARLITO_FIXTURE[file]})),
};
assert.deepEqual(auditCanonicalFixtureManifest(generation), []);
const wrongGeneration = structuredClone(generation); wrongGeneration.fonts[0].sha256 = 'f'.repeat(64);
assert.ok(auditCanonicalFixtureManifest(wrongGeneration).some(item => item.code === 'generation-font-hash'));
const stringFlags = structuredClone(generation); stringFlags.registration.flags = '0';
assert.ok(auditCanonicalFixtureManifest(stringFlags).some(item => item.code === 'generation-registration-flags'));
record('canonical-manifest-negatives');

{
  const {toPptx} = await import('../src/index.js');
  const inspect = bytes => requireCarlitoBullets => carlitoOnlyTypefaceFailures(typefaceInventory(bytes), themeFontSlots(bytes), {requireCarlitoBullets});
  const carlitoBytes = await toPptx(carlitoOnlySource(), {strictAssets: true});
  // Current exporter source: master bullets follow the theme minor font (+mn-lt),
  // so the Carlito-only fixture passes strictly with no harness transform.
  const current = inspect(carlitoBytes)(true);
  assert.deepEqual(current.failures, [], JSON.stringify(current.failures));
  assert.ok(current.residual.every(item => item.code === 'theme-script-supplement'));
  assert.ok(typefaceInventory(carlitoBytes).some(row => row.element === 'a:buFont' && row.typeface === '+mn-lt' && row.occurrences === 9));
  assert.throws(() => applyMasterBulletFontTransform(carlitoBytes), /Expected 9 Arial master bullet fonts, found 0/);
  // Published exporters up to 0.9.1 (the registry consumer used by the fixture generator)
  // still write the vendored Arial master bullets. Rebuild those bytes to keep the harness
  // transform covered until the pinned consumer includes the exporter fix.
  const legacyEntries = unzipSync(new Uint8Array(carlitoBytes)), masterPart = MASTER_BULLET_FONT_TRANSFORM.part;
  legacyEntries[masterPart] = strToU8(strFromU8(legacyEntries[masterPart]).split('<a:buFont typeface="+mn-lt"/>').join(MASTER_BULLET_FONT_TRANSFORM.from));
  const legacyBytes = zipSync(legacyEntries);
  const pure = inspect(legacyBytes)(false);
  assert.deepEqual(pure.failures, [], JSON.stringify(pure.failures));
  assert.ok(pure.residual.some(item => item.code === 'non-carlito-bullet-font' && item.row.typeface === 'Arial'), 'Expected the documented Arial master bullet residual');
  assert.ok(pure.residual.every(item => ['non-carlito-bullet-font', 'theme-script-supplement'].includes(item.code)));
  assert.ok(inspect(legacyBytes)(true).failures.some(item => item.code === 'non-carlito-bullet-font'));
  const transformed = applyMasterBulletFontTransform(legacyBytes);
  assert.equal(transformed.replacements, MASTER_BULLET_FONT_TRANSFORM.expectedCount);
  const strict = inspect(transformed.bytes)(true);
  assert.deepEqual(strict.failures, [], JSON.stringify(strict.failures));
  assert.ok(strict.residual.every(item => item.code === 'theme-script-supplement'));
  assert.ok(typefaceInventory(transformed.bytes).every(row => row.element === 'a:font' || ['Carlito', ''].includes(row.typeface) || /^\+m[jn]-/.test(row.typeface)));
  const aptos = inspect(await toPptx({slides: [{title: 'Plain control', text: 'Current content'}]}, {strictAssets: true}))(false);
  assert.ok(aptos.failures.some(item => item.code === 'non-carlito-text-typeface' && /Aptos/.test(item.row.typeface)));
  assert.ok(aptos.failures.some(item => item.code === 'theme-latin-not-carlito'));
  assert.throws(() => applyMasterBulletFontTransform(transformed.bytes), /Expected 9 Arial master bullet fonts/);
  // FF-08: the exporter regenerates docProps "Fonts Used" from the package's own fonts, so the
  // former static Arial/Calibri residual is gone from current source output.
  assert.deepEqual(declaredFontsUsed(carlitoBytes), ['Carlito'], 'docProps Fonts Used lists only the package fonts');
  assert.deepEqual(declaredFontsUsed(transformed.bytes), ['Carlito'], 'docProps Fonts Used lists only the package fonts');
  record('carlito-only-fixture-typefaces');
}

const relXml = ({extra = '', target = null, duplicateId = false, external = false} = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${[1, 2, 3, 4].map(index => `<Relationship Id="rId${duplicateId && index === 2 ? 1 : index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${target && index === 1 ? target : `fonts/font${index}.fntdata`}"${external && index === 1 ? ' TargetMode="External"' : ''}/>`).join('')}${extra}
</Relationships>`;
const presentationXml = ({family = 'Carlito', missingStyle = null} = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:embeddedFontLst><p:embeddedFont><p:font typeface="${family}"/>${[
  ['p:regular', 1], ['p:bold', 2], ['p:italic', 3], ['p:boldItalic', 4],
].filter(([style]) => style !== missingStyle).map(([style, id]) => `<${style} r:id="rId${id}"/>`).join('')}</p:embeddedFont></p:embeddedFontLst></p:presentation>`;
const contentTypesXml = ({duplicate = false} = {}) => `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="fntdata" ContentType="application/x-fontdata"/>${duplicate ? '<Override PartName="/ppt/fonts/font1.fntdata" ContentType="application/x-fontdata"/><Override PartName="/ppt/fonts/font1.fntdata" ContentType="application/x-fontdata"/>' : ''}</Types>`;

function makeOpc({rels = relXml(), presentation = presentationXml(), contentTypes = contentTypesXml(), extraParts = {}} = {}) {
  const entries = {
    '[Content_Types].xml': strToU8(contentTypes),
    'ppt/presentation.xml': strToU8(presentation),
    'ppt/_rels/presentation.xml.rels': strToU8(rels),
    ...Object.fromEntries([1, 2, 3, 4].map(index => [`ppt/fonts/font${index}.fntdata`, new Uint8Array([index, 42, 99])])),
    ...extraParts,
  };
  return Buffer.from(zipSync(entries, {level: 0}));
}

const positivePptx = makeOpc();
assert.deepEqual(inspectFontEmbeddingPackage(positivePptx).failures, []);
record('font-opc-positive-structure');

// The four Gate E body spans, as in the worker's request expectations.
const SYNTHETIC_RUNS = [
  {start: 1, length: 10, text: 'Regular 18', size: 18, bold: false, italic: false},
  {start: 14, length: 7, text: 'Bold 20', size: 20, bold: true, italic: false},
  {start: 24, length: 9, text: 'Italic 22', size: 22, bold: false, italic: true},
  {start: 36, length: 13, text: 'BoldItalic 24', size: 24, bold: true, italic: true},
];
const SLOT_STAGE_SUFFIXES = ['font.get', 'font.name.get', 'font.nameAscii.get', 'font.nameOther.get', 'font.nameFarEast.get', 'font.nameComplexScript.get'];
const slotValues = ({farEast = '', complex = ''} = {}) => ({name: 'Carlito', nameAscii: 'Carlito', nameOther: 'Carlito', nameFarEast: farEast, nameComplexScript: complex});
// Mirrors what the worker records: pre-edit fixture text is "Plain control"/"Current content" (13/15), post-edit text is 16/48 characters.
function slotRecords(titleLength, bodyLength, slotOptions) {
  const records = [
    {range: 'title', start: 1, length: titleLength, textLength: titleLength, observed: true, slots: slotValues(slotOptions)},
    {range: 'body', start: 1, length: bodyLength, textLength: bodyLength, observed: true, slots: slotValues(slotOptions)},
  ];
  for (const run of SYNTHETIC_RUNS) {
    const observed = run.start + run.length - 1 <= bodyLength;
    records.push({range: `body.run-${run.start}-${run.length}`, start: run.start, length: run.length, textLength: bodyLength, observed, slots: observed ? slotValues(slotOptions) : null});
  }
  return records;
}
// Hand-written stage expectation, kept independent of the auditor's expectedFontSlotStageNames.
function slotStageNames(phase, records) {
  return records.flatMap(record => {
    if (record.range === 'title' || record.range === 'body') return [`${phase}.${record.range}.textRange2.get`, `${phase}.${record.range}.length.get`, ...SLOT_STAGE_SUFFIXES.map(suffix => `${phase}.${record.range}.${suffix}`)];
    if (!record.observed) return [];
    return [`${phase}.${record.range}.get`, ...SLOT_STAGE_SUFFIXES.map(suffix => `${phase}.${record.range}.${suffix}`)];
  });
}
function inventoryStageNames(phase, count) {
  const names = [`${phase}.presentation.fonts.get`, `${phase}.presentation.fonts.count.get`];
  for (let index = 1; index <= count; index++) for (const suffix of ['get', 'name.get', 'embedded.get', 'embeddable.get']) names.push(`${phase}.presentation.fonts.item-${index}.${suffix}`);
  return names;
}

function snapshotStageNames(phase, range, count) {
  return [...inventoryStageNames(`${phase}.${range}`, count), `${phase}.${range}.textRange2.get`, `${phase}.${range}.length.get`, ...SLOT_STAGE_SUFFIXES.map(suffix => `${phase}.${range}.${suffix}`)];
}
const inventory = names => ({count: names.length, entries: names.map((name, index) => ({index: index + 1, name, embedded: 0, embeddable: -1}))});
const BLOCKED_ERROR = 'Native Presentation.Fonts allowlist/embeddability gate failed before SaveAs; the owned presentation was closed without saving and no retry was started.';

// completed: gate passes and one embed SaveAs completes. blocked: the post-edit inventory is editedFonts (for example Carlito+Aptos),
// the gate blocks, and the worker discards and closes the owned presentation exactly as native-font-embed.ps1 does.
function makeLifecycle(pptxBytes, sourcePath, savedPath, sourceHash = '0'.repeat(64), {preEditFonts = ['Carlito'], postTextFonts = ['Carlito'], postFormatFonts = ['Carlito'], postTextSlots = {}, postEditSlots = {}, blocked = false, editedFonts = blocked ? ['Carlito', 'Aptos'] : ['Carlito']} = {}) {
  const stages = []; const base = Date.parse('2026-09-22T12:00:00.000Z');
  const add = (stage, status, ownedPresentationPath, cleanupConfirmed, error = null) => stages.push({sequence: stages.length + 1, timestamp: new Date(base + stages.length * 1000).toISOString(), stage, status, error, cleanupConfirmed, officeOperationsStopped: false, ownedPresentationPath});
  const pair = (stage, ownedPresentationPath, cleanupConfirmed = false) => { add(stage, 'begin', ownedPresentationPath, cleanupConfirmed); add(stage, 'success', ownedPresentationPath, cleanupConfirmed); };
  const preEditFontsObservation = inventory(preEditFonts);
  const postTextFontsObservations = {title: inventory(postTextFonts), body: inventory(postTextFonts)};
  const postFormatFontsObservations = {title: inventory(postFormatFonts)};
  const postTextWhole = slotRecords(16, 48, postTextSlots).slice(0, 2);
  const fontSlotObservations = {properties: ['Name', 'NameAscii', 'NameOther', 'NameFarEast', 'NameComplexScript'], preEdit: slotRecords(13, 15), postText: postTextWhole, postFormat: slotRecords(16, 48).slice(0, 1), postEdit: slotRecords(16, 48, postEditSlots)};
  const nativeFontsObservation = inventory(editedFonts);
  const entries = nativeFontsObservation.entries;
  const unexpectedNames = editedFonts.filter(name => !PERMITTED_NATIVE_FONT_NAMES.includes(name));
  const gate = {passed: !blocked, reportedCount: entries.length, entryCount: entries.length, countValid: true, baseFamilyPresent: editedFonts.includes('Carlito'), allowedReportedNames: [...PERMITTED_NATIVE_FONT_NAMES], unexpectedNames, unembeddableNames: [], entries, scope: 'synthetic'};
  add('worker.initialize', 'success', null, true);
  pair('input.presentation.open', sourcePath);
  for (const stage of inventoryStageNames('pre-edit', preEditFonts.length)) pair(stage, sourcePath);
  pair('edit.slides.get', sourcePath); pair('edit.title.textRange2.get', sourcePath); pair('edit.body.textRange2.get', sourcePath);
  for (const stage of slotStageNames('pre-edit', fontSlotObservations.preEdit)) pair(stage, sourcePath);
  pair('edit.title.text.set', sourcePath);
  for (const stage of snapshotStageNames('post-text', 'title', postTextFonts.length)) pair(stage, sourcePath);
  pair('edit.title.font.get', sourcePath); pair('edit.title.font.name.set', sourcePath); pair('edit.title.font.italic.set', sourcePath);
  for (const stage of snapshotStageNames('post-format', 'title', postFormatFonts.length)) pair(stage, sourcePath);
  pair('edit.body.text.set', sourcePath);
  for (const stage of snapshotStageNames('post-text', 'body', postTextFonts.length)) pair(stage, sourcePath);
  pair('edit.body.font.name.set', sourcePath); pair('edit.body.run-36-13.font.italic.set', sourcePath);
  pair('edited.presentation.fonts.get', sourcePath); pair('edited.presentation.fonts.count.get', sourcePath);
  for (let index = 1; index <= entries.length; index++) for (const suffix of ['get', 'name.get', 'embedded.get', 'embeddable.get']) pair(`edited.presentation.fonts.item-${index}.${suffix}`, sourcePath);
  for (const stage of slotStageNames('post-edit', fontSlotObservations.postEdit)) pair(stage, sourcePath);
  if (blocked) {
    add('edited.presentation.native-fonts-gate', 'blocked', sourcePath, false, `${unexpectedNames.join(',')}|`);
    pair('blocked.presentation.fullName.get', sourcePath); pair('blocked.presentation.saved.set', sourcePath); pair('blocked.presentation.close', sourcePath);
    add('blocked.presentation.cleanup', 'success', null, true);
    add('worker.failure', 'error', null, true, BLOCKED_ERROR);
  } else {
    add('edited.presentation.native-fonts-gate', 'success', sourcePath, false);
    pair('edited.presentation.saveAs-owned-copy-embed-fonts', sourcePath);
    pair('edited.presentation.fullName.get', savedPath);
    pair('edited.presentation.close', savedPath);
    add('edited.presentation.cleanup', 'success', null, true);
    add('worker.complete', 'success', null, true);
  }
  const report = {
    kind: 'native-font-embed', error: blocked ? BLOCKED_ERROR : null, cleanupConfirmed: true, officeOperationsStopped: false, ownedCloseCount: 1, lastStage: blocked ? 'worker.failure' : 'worker.complete', lastStatus: blocked ? 'error' : 'success',
    source: {path: sourcePath, sha256: sourceHash, snapshotPath: sourcePath, snapshotSha256: sourceHash}, saved: {path: savedPath, sha256: blocked ? null : sha(pptxBytes)},
    embedFonts: {saveFormat: 24, saveArgument: -1, stage: 'edited.presentation.saveAs-owned-copy-embed-fonts', attempted: !blocked, completed: !blocked, blockedByNativeFontsGate: blocked},
    requested: {body: {runs: structuredClone(SYNTHETIC_RUNS)}},
    preEditFontsObservation, postTextFontsObservations, postFormatFontsObservations, fontSlotObservations,
    nativeFontsObservation, nativeFontsGate: gate,
  };
  const final = stages.at(-1);
  const exitCode = blocked ? 1 : 0;
  const supervisor = {timestamp: new Date(Date.parse(final.timestamp) + 1000).toISOString(), timedOut: false, exitCode, officeLifecycleComplete: !blocked, nativeFontsGatePassed: !blocked, embedSaveRecorded: !blocked, fontCleanupConfirmed: true, inputsUnchanged: true, ownedCloseCount: 1, lastDurableStage: final.stage, lastDurableStatus: final.status, parentError: null};
  const worker = {timedOut: false, exitCode, timeoutSeconds: 45, processId: 4242, startedAt: '2026-09-22T11:59:59.000Z', finishedAt: supervisor.timestamp};
  const registrations = PERMITTED_CARLITO_FIXTURE_FILES.map(file => ({file, sha256: PERMITTED_CARLITO_FIXTURE[file], added: 1, removed: true}));
  return {report, supervisor, worker, progress: structuredClone(final), stages, registrations, generation, pptxBytes: blocked ? null : pptxBytes};
}
const syntheticSourcePath = path.resolve(packageRoot, 'artifacts/synthetic-font-embed/source.pptx');
const syntheticSavedPath = path.resolve(packageRoot, 'artifacts/synthetic-font-embed/native-font-embed.pptx');
const positiveEvidence = makeLifecycle(positivePptx, syntheticSourcePath, syntheticSavedPath);
assert.equal(auditSavedEmbedPresentation(positiveEvidence).passed, true);
record('lifecycle-bound-positive');

function failureCodes(evidence) { return new Set(auditSavedEmbedPresentation(evidence).failures.map(item => item.code)); }
const failedCleanup = structuredClone(positiveEvidence); failedCleanup.report.cleanupConfirmed = false;
assert.ok(failureCodes(failedCleanup).has('report-lifecycle'));
const badSavedHash = structuredClone(positiveEvidence); badSavedHash.report.saved.sha256 = '0'.repeat(64);
assert.ok(failureCodes(badSavedHash).has('saved-hash'));
const forgedAptosGate = structuredClone(positiveEvidence); forgedAptosGate.report.nativeFontsObservation = {count: 2, entries: [{index: 1, name: 'Carlito', embedded: 0, embeddable: -1}, {index: 2, name: 'Aptos', embedded: 0, embeddable: -1}]};
assert.ok(failureCodes(forgedAptosGate).has('native-font-inventory'));
const missingInventory = structuredClone(positiveEvidence); delete missingInventory.report.nativeFontsObservation;
assert.ok(failureCodes(missingInventory).has('native-font-inventory'));
const duplicateLedger = structuredClone(positiveEvidence); duplicateLedger.registrations[3] = structuredClone(duplicateLedger.registrations[0]);
assert.ok(failureCodes(duplicateLedger).has('font-cleanup'));
const stageAfterComplete = structuredClone(positiveEvidence); stageAfterComplete.stages.push({...stageAfterComplete.stages.at(-1), sequence: stageAfterComplete.stages.length + 1, timestamp: '2026-09-22T12:01:00.000Z', stage: 'unexpected.after-complete'});
assert.ok([...failureCodes(stageAfterComplete)].some(code => ['stage-pair', 'stage-duplicate', 'stage-terminal'].includes(code)));
const orphanSuccess = structuredClone(positiveEvidence); orphanSuccess.stages.splice(orphanSuccess.stages.findIndex(row => row.stage === 'edited.presentation.fonts.get' && row.status === 'begin'), 1); orphanSuccess.stages.forEach((row, index) => { row.sequence = index + 1; }); orphanSuccess.progress = structuredClone(orphanSuccess.stages.at(-1));
assert.ok(failureCodes(orphanSuccess).has('stage-pair'));
const extraClose = structuredClone(positiveEvidence); const cleanupIndex = extraClose.stages.findIndex(row => row.stage === 'edited.presentation.cleanup'); const duplicateClose = extraClose.stages.filter(row => row.stage === 'edited.presentation.close').map(row => ({...row})); extraClose.stages.splice(cleanupIndex, 0, ...duplicateClose); extraClose.stages.forEach((row, index) => { row.sequence = index + 1; row.timestamp = new Date(Date.parse('2026-09-22T12:00:00.000Z') + index * 1000).toISOString(); }); extraClose.progress = structuredClone(extraClose.stages.at(-1));
assert.ok([...failureCodes(extraClose)].some(code => ['stage-duplicate', 'stage-close'].includes(code)));
record('lifecycle-inventory-ledger-stage-hash-negatives');

// Diagnostic observations: bound for presence, type and stage pairing, but never allowlisted.
function resequence(evidence) {
  evidence.stages.forEach((row, index) => { row.sequence = index + 1; row.timestamp = new Date(Date.parse('2026-09-22T12:00:00.000Z') + index * 1000).toISOString(); });
  evidence.progress = structuredClone(evidence.stages.at(-1));
  evidence.supervisor.timestamp = new Date(Date.parse(evidence.progress.timestamp) + 1000).toISOString();
  return evidence;
}
const stageIndex = (evidence, stage, status = 'begin') => evidence.stages.findIndex(row => row.stage === stage && row.status === status);
function movePair(evidence, stage, beforeStage) {
  const from = stageIndex(evidence, stage); const moved = evidence.stages.splice(from, 2);
  evidence.stages.splice(stageIndex(evidence, beforeStage), 0, ...moved);
  return resequence(evidence);
}
{
  assert.deepEqual(auditDiagnosticObservations(positiveEvidence.report), []);
  const auditStageNames = [
    ...expectedFontsInventoryStageNames('pre-edit', positiveEvidence.report.preEditFontsObservation.count),
    ...expectedFontSlotStageNames('pre-edit', positiveEvidence.report.fontSlotObservations.preEdit),
    ...expectedRangeSnapshotStageNames('post-text', 'title', positiveEvidence.report.postTextFontsObservations.title.count),
    ...expectedRangeSnapshotStageNames('post-format', 'title', positiveEvidence.report.postFormatFontsObservations.title.count),
    ...expectedRangeSnapshotStageNames('post-text', 'body', positiveEvidence.report.postTextFontsObservations.body.count),
    ...expectedFontSlotStageNames('post-edit', positiveEvidence.report.fontSlotObservations.postEdit),
  ];
  assert.deepEqual(auditStageNames, [...inventoryStageNames('pre-edit', 1), ...slotStageNames('pre-edit', slotRecords(13, 15)), ...snapshotStageNames('post-text', 'title', 1), ...snapshotStageNames('post-format', 'title', 1), ...snapshotStageNames('post-text', 'body', 1), ...slotStageNames('post-edit', slotRecords(16, 48))]);
  assert.deepEqual(positiveEvidence.report.fontSlotObservations.preEdit.map(item => item.observed), [true, true, true, false, false, false]);
  // Stage names emitted by the PowerShell helpers (pure regression with plain stand-in objects: pre-edit and post-text.title
  // inventories of 2, post-format.title of 1, post-text.body of 0) match the auditor's expectation exactly.
  if (pureRegression) {
    assert.deepEqual(pureRegression.observationStageNames, [
      ...expectedFontsInventoryStageNames('pre-edit', 2),
      ...expectedFontSlotStageNames('pre-edit', slotRecords(13, 15)),
      ...expectedRangeSnapshotStageNames('post-text', 'title', 2),
      ...expectedRangeSnapshotStageNames('post-format', 'title', 1),
      ...expectedRangeSnapshotStageNames('post-text', 'body', 0),
      ...expectedFontSlotStageNames('post-edit', slotRecords(16, 48)),
    ]);
  }
  record('diagnostic-observations-positive-and-stage-names');

  // Aptos in the pre-edit inventory or in an East Asian/complex-script slot is an observation, not a failure.
  const aptosObserved = makeLifecycle(positivePptx, syntheticSourcePath, syntheticSavedPath, '0'.repeat(64), {preEditFonts: ['Carlito', 'Aptos'], postTextFonts: ['Aptos', 'Carlito'], postTextSlots: {farEast: 'Aptos', complex: ''}, postEditSlots: {farEast: 'Aptos', complex: null}});
  const aptosObservedResult = auditSavedEmbedPresentation(aptosObserved);
  assert.equal(aptosObservedResult.passed, true, JSON.stringify(aptosObservedResult.failures));
  // ...while Aptos in the post-edit gated inventory still fails closed, with or without the observations.
  const aptosGated = structuredClone(aptosObserved);
  aptosGated.report.nativeFontsObservation = {count: 2, entries: [{index: 1, name: 'Carlito', embedded: 0, embeddable: -1}, {index: 2, name: 'Aptos', embedded: 0, embeddable: -1}]};
  aptosGated.report.nativeFontsGate = {...aptosGated.report.nativeFontsGate, passed: false, reportedCount: 2, entryCount: 2, unexpectedNames: ['Aptos'], entries: aptosGated.report.nativeFontsObservation.entries};
  assert.ok(failureCodes(aptosGated).has('native-font-inventory'));
  assert.ok(failureCodes(aptosGated).has('report-native-font-gate'));
  const aptosGateOnly = structuredClone(positiveEvidence); aptosGateOnly.report.nativeFontsGate = {...aptosGateOnly.report.nativeFontsGate, passed: false, unexpectedNames: ['Aptos']};
  assert.ok(failureCodes(aptosGateOnly).has('report-native-font-gate'));
  record('diagnostic-observations-are-not-gates-post-edit-aptos-fails-closed');

  // Evidence without the new fields (as from the attempt-01 harness) is rejected.
  const withoutPre = structuredClone(positiveEvidence); delete withoutPre.report.preEditFontsObservation;
  assert.ok(failureCodes(withoutPre).has('report-pre-edit-fonts'));
  const withoutSlots = structuredClone(positiveEvidence); delete withoutSlots.report.fontSlotObservations;
  assert.ok(failureCodes(withoutSlots).has('report-font-slots'));
  const withoutPostEdit = structuredClone(positiveEvidence); withoutPostEdit.report.fontSlotObservations.postEdit = [];
  assert.ok(failureCodes(withoutPostEdit).has('report-font-slots'));
  const withoutPostText = structuredClone(positiveEvidence); delete withoutPostText.report.postTextFontsObservations;
  assert.ok(failureCodes(withoutPostText).has('report-post-text-fonts'));
  const withoutPostTextBody = structuredClone(positiveEvidence); withoutPostTextBody.report.postTextFontsObservations.body = null;
  assert.ok(failureCodes(withoutPostTextBody).has('report-post-text-fonts'));
  const withoutPostTextSlots = structuredClone(positiveEvidence); withoutPostTextSlots.report.fontSlotObservations.postText = withoutPostTextSlots.report.fontSlotObservations.postText.slice(0, 1);
  assert.ok(failureCodes(withoutPostTextSlots).has('report-font-slots'));
  const withoutPostFormat = structuredClone(positiveEvidence); delete withoutPostFormat.report.postFormatFontsObservations;
  assert.ok(failureCodes(withoutPostFormat).has('report-post-format-fonts'));
  const withoutPostFormatSlots = structuredClone(positiveEvidence); withoutPostFormatSlots.report.fontSlotObservations.postFormat = [];
  assert.ok(failureCodes(withoutPostFormatSlots).has('report-font-slots'));
  const legacy = structuredClone(positiveEvidence); for (const key of ['preEditFontsObservation', 'postTextFontsObservations', 'postFormatFontsObservations', 'fontSlotObservations']) delete legacy.report[key];
  legacy.stages = legacy.stages.filter(row => !/^(?:pre-edit|post-text|post-format|post-edit)\./.test(row.stage)); resequence(legacy);
  const legacyCodes = failureCodes(legacy);
  assert.ok(['report-pre-edit-fonts', 'report-post-text-fonts', 'report-post-format-fonts', 'report-font-slots', 'stage-required'].every(code => legacyCodes.has(code)), [...legacyCodes].join(','));
  record('diagnostic-observations-required');

  // Present, finite and well-typed.
  const typeNegatives = [
    ['string-count', evidence => { evidence.report.preEditFontsObservation.count = '1'; }, 'report-pre-edit-fonts'],
    ['nan-count', evidence => { evidence.report.preEditFontsObservation.count = Number.NaN; }, 'report-pre-edit-fonts'],
    ['infinite-count', evidence => { evidence.report.preEditFontsObservation.count = Number.POSITIVE_INFINITY; }, 'report-pre-edit-fonts'],
    ['entry-count-mismatch', evidence => { evidence.report.preEditFontsObservation.entries = []; }, 'report-pre-edit-fonts'],
    ['string-embeddable', evidence => { evidence.report.preEditFontsObservation.entries[0].embeddable = '-1'; }, 'report-pre-edit-fonts'],
    ['numeric-name', evidence => { evidence.report.preEditFontsObservation.entries[0].name = 7; }, 'report-pre-edit-fonts'],
    ['numeric-slot', evidence => { evidence.report.fontSlotObservations.postEdit[0].slots.nameFarEast = 42; }, 'report-font-slots'],
    ['missing-slot-key', evidence => { delete evidence.report.fontSlotObservations.preEdit[1].slots.nameComplexScript; }, 'report-font-slots'],
    ['string-observed', evidence => { evidence.report.fontSlotObservations.preEdit[2].observed = 'true'; }, 'report-font-slots'],
    ['infinite-text-length', evidence => { evidence.report.fontSlotObservations.postEdit[1].textLength = Number.POSITIVE_INFINITY; }, 'report-font-slots'],
    ['negative-text-length', evidence => { evidence.report.fontSlotObservations.preEdit[0].textLength = -1; }, 'report-font-slots'],
    ['outside-span-claimed-observed', evidence => { const item = evidence.report.fontSlotObservations.preEdit[3]; item.observed = true; item.slots = slotValues(); }, 'report-font-slots'],
    ['post-edit-span-unobserved', evidence => { const item = evidence.report.fontSlotObservations.postEdit[5]; item.observed = false; item.slots = null; }, 'report-font-slots'],
    ['span-label-mismatch', evidence => { evidence.report.fontSlotObservations.postEdit[2].range = 'body.run-2-10'; }, 'report-font-slots'],
    ['wrong-properties', evidence => { evidence.report.fontSlotObservations.properties = ['Name']; }, 'report-font-slots'],
    ['post-text-string-count', evidence => { evidence.report.postTextFontsObservations.title.count = '1'; }, 'report-post-text-fonts'],
    ['post-text-nan-embedded', evidence => { evidence.report.postTextFontsObservations.body.entries[0].embedded = Number.NaN; }, 'report-post-text-fonts'],
    ['post-text-slots-order', evidence => { evidence.report.fontSlotObservations.postText.reverse(); }, 'report-font-slots'],
    ['post-text-numeric-slot', evidence => { evidence.report.fontSlotObservations.postText[0].slots.nameComplexScript = 0; }, 'report-font-slots'],
    ['post-format-string-count', evidence => { evidence.report.postFormatFontsObservations.title.count = '1'; }, 'report-post-format-fonts'],
    ['post-format-body-record', evidence => { evidence.report.fontSlotObservations.postFormat[0].range = 'body'; }, 'report-font-slots'],
    ['post-format-numeric-slot', evidence => { evidence.report.fontSlotObservations.postFormat[0].slots.nameFarEast = 1; }, 'report-font-slots'],
  ];
  for (const [name, mutate, code] of typeNegatives) {
    const evidence = structuredClone(positiveEvidence); mutate(evidence);
    assert.ok(failureCodes(evidence).has(code), `${name}: ${[...failureCodes(evidence)].join(',')}`);
  }
  record('diagnostic-observations-typed-and-finite');

  // Stage pairing, bounds and ordering.
  const unpaired = structuredClone(positiveEvidence); unpaired.stages.splice(stageIndex(unpaired, 'pre-edit.title.font.nameFarEast.get'), 1); resequence(unpaired);
  assert.ok(failureCodes(unpaired).has('stage-pair'));
  const missingPost = structuredClone(positiveEvidence); missingPost.stages.splice(stageIndex(missingPost, 'post-edit.body.run-36-13.font.nameComplexScript.get'), 2); resequence(missingPost);
  assert.ok(failureCodes(missingPost).has('stage-required'));
  const duplicated = structuredClone(positiveEvidence); const duplicateAt = stageIndex(duplicated, 'pre-edit.body.font.name.get');
  duplicated.stages.splice(duplicateAt + 2, 0, ...duplicated.stages.slice(duplicateAt, duplicateAt + 2).map(row => ({...row}))); resequence(duplicated);
  assert.ok(failureCodes(duplicated).has('stage-duplicate'));
  const unobservedRead = structuredClone(positiveEvidence); const injectAt = stageIndex(unobservedRead, 'edit.title.text.set');
  unobservedRead.stages.splice(injectAt, 0, {...unobservedRead.stages[injectAt], stage: 'pre-edit.body.run-14-7.get', status: 'begin'}, {...unobservedRead.stages[injectAt], stage: 'pre-edit.body.run-14-7.get', status: 'success'}); resequence(unobservedRead);
  assert.ok(failureCodes(unobservedRead).has('stage-diagnostic-bound'));
  const preAfterEdit = movePair(structuredClone(positiveEvidence), 'pre-edit.title.font.nameFarEast.get', 'edit.body.text.set');
  assert.ok([...failureCodes(preAfterEdit)].some(code => ['stage-order', 'stage-diagnostic-order'].includes(code)));
  const inventoryAfterEdit = movePair(structuredClone(positiveEvidence), 'pre-edit.presentation.fonts.get', 'edited.presentation.fonts.get');
  assert.ok([...failureCodes(inventoryAfterEdit)].some(code => ['stage-order', 'stage-diagnostic-order'].includes(code)));
  const editAfterInventory = movePair(structuredClone(positiveEvidence), 'edit.body.run-36-13.font.italic.set', 'post-edit.title.textRange2.get');
  assert.ok(failureCodes(editAfterInventory).has('stage-diagnostic-order'));
  const postBeforeInventory = movePair(structuredClone(positiveEvidence), 'post-edit.title.font.nameFarEast.get', 'edited.presentation.fonts.get');
  assert.ok(failureCodes(postBeforeInventory).has('stage-order'));
  const postAfterGate = movePair(structuredClone(positiveEvidence), 'post-edit.body.font.nameFarEast.get', 'edited.presentation.saveAs-owned-copy-embed-fonts');
  assert.ok(failureCodes(postAfterGate).has('stage-order'));
  const postTextBeforeText = movePair(structuredClone(positiveEvidence), 'post-text.title.presentation.fonts.get', 'edit.title.text.set');
  assert.ok(failureCodes(postTextBeforeText).has('stage-order'));
  const fontSetBeforePostText = movePair(structuredClone(positiveEvidence), 'edit.title.font.italic.set', 'post-text.title.presentation.fonts.get');
  assert.ok(failureCodes(fontSetBeforePostText).has('stage-diagnostic-order'));
  const bodySnapshotInTitle = movePair(structuredClone(positiveEvidence), 'post-text.body.font.nameFarEast.get', 'edit.title.font.name.set');
  assert.ok(failureCodes(bodySnapshotInTitle).has('stage-order'));
  const unpairedPostText = structuredClone(positiveEvidence); unpairedPostText.stages.splice(stageIndex(unpairedPostText, 'post-text.body.presentation.fonts.item-1.name.get', 'success'), 1); resequence(unpairedPostText);
  assert.ok(failureCodes(unpairedPostText).has('stage-pair'));
  const postFormatBeforeTitleSets = movePair(structuredClone(positiveEvidence), 'post-format.title.presentation.fonts.get', 'edit.title.font.italic.set');
  assert.ok(failureCodes(postFormatBeforeTitleSets).has('stage-diagnostic-order'));
  const postFormatAfterBodyText = movePair(structuredClone(positiveEvidence), 'post-format.title.font.nameFarEast.get', 'edit.body.font.name.set');
  assert.ok(failureCodes(postFormatAfterBodyText).has('stage-order'));
  const postFormatForBody = structuredClone(positiveEvidence); const bodyFormatAt = stageIndex(postFormatForBody, 'edit.body.font.name.set');
  postFormatForBody.stages.splice(bodyFormatAt, 0, {...postFormatForBody.stages[bodyFormatAt], stage: 'post-format.body.presentation.fonts.get', status: 'begin'}, {...postFormatForBody.stages[bodyFormatAt], stage: 'post-format.body.presentation.fonts.get', status: 'success'}); resequence(postFormatForBody);
  assert.ok(failureCodes(postFormatForBody).has('stage-diagnostic-bound'));
  record('diagnostic-stage-pairing-bounds-and-order');

  // Source policy: the one worker gate must still read the post-edit inventory.
  const gateOnPreEdit = embedSource.replace('$report.nativeFontsGate=Get-FontEmbedNativeFontsGate $report.nativeFontsObservation', '$report.nativeFontsGate=Get-FontEmbedNativeFontsGate $report.preEditFontsObservation');
  assert.notEqual(gateOnPreEdit, embedSource);
  assert.ok(auditEmbedVerifierSource(gateOnPreEdit).some(item => item.code === 'native-font-gate-input'));
  const secondGate = embedSource.replace('$report.nativeFontsGate=Get-FontEmbedNativeFontsGate $report.nativeFontsObservation', '$report.nativeFontsGate=Get-FontEmbedNativeFontsGate $report.nativeFontsObservation; $null=Get-FontEmbedNativeFontsGate $report.preEditFontsObservation');
  assert.notEqual(secondGate, embedSource);
  assert.ok(auditEmbedVerifierSource(secondGate).some(item => item.code === 'native-font-gate-input'));
  assert.ok(auditEmbedVerifierSource(embedSource.replaceAll('preEditFontsObservation', 'preEditFontsRemoved')).some(item => item.code === 'missing-diagnostic-observation'));
  record('source-policy-gate-input-and-observations');
}

// Blocked-evidence mode: a gate-blocked attempt gets its lifecycle and diagnostics machine-checked, but never an embed pass.
const blockedOptions = {blocked: true, postTextFonts: ['Carlito', 'Aptos'], postFormatFonts: ['Carlito', 'Aptos'], postTextSlots: {farEast: 'Aptos'}, postEditSlots: {farEast: 'Aptos', complex: null}};
const blockedEvidence = makeLifecycle(positivePptx, syntheticSourcePath, syntheticSavedPath, '0'.repeat(64), blockedOptions);
{
  const result = auditBlockedEmbedEvidence(blockedEvidence);
  assert.deepEqual(result.failures, [], JSON.stringify(result.failures));
  assert.equal(result.embedGatePassed, false); assert.equal(result.diagnosticEvidenceValid, true); assert.equal(Object.hasOwn(result, 'passed'), false);
  assert.equal(blockedEvidence.report.nativeFontsGate.passed, false); assert.deepEqual(blockedEvidence.report.nativeFontsGate.unexpectedNames, ['Aptos']);
  record('blocked-mode-positive-never-passes-embed-gate');

  const blockedCodes = evidence => new Set(auditBlockedEmbedEvidence(evidence).failures.map(item => item.code));
  const blockedNegatives = [
    ['malformed-slot', evidence => { evidence.report.fontSlotObservations.postFormat[0].slots.nameFarEast = 5; }, 'report-font-slots'],
    ['missing-pre-edit', evidence => { delete evidence.report.preEditFontsObservation; }, 'report-pre-edit-fonts'],
    ['nan-post-text-count', evidence => { evidence.report.postTextFontsObservations.body.count = Number.NaN; }, 'report-post-text-fonts'],
    ['missing-post-format', evidence => { evidence.report.postFormatFontsObservations = null; }, 'report-post-format-fonts'],
    ['forged-unexpected-names', evidence => { evidence.report.nativeFontsGate.unexpectedNames = []; }, 'report-native-font-gate'],
    ['forged-gate-pass', evidence => { evidence.report.nativeFontsGate.passed = true; }, 'report-native-font-gate'],
    ['gate-entries-differ', evidence => { evidence.report.nativeFontsGate.entries = evidence.report.nativeFontsGate.entries.slice(0, 1); }, 'report-native-font-gate'],
    ['gate-stage-error-differs', evidence => { evidence.stages.find(row => row.status === 'blocked').error = '|'; }, 'stage-sequence'],
    ['save-attempted', evidence => { evidence.report.embedFonts.attempted = true; }, 'report-embed'],
    ['not-blocked-flag', evidence => { evidence.report.embedFonts.blockedByNativeFontsGate = false; }, 'report-embed'],
    ['saved-hash-present', evidence => { evidence.report.saved.sha256 = '0'.repeat(64); }, 'report-file-binding'],
    ['font-ledger-3-of-4', evidence => { evidence.registrations.pop(); }, 'font-cleanup'],
    ['font-not-removed', evidence => { evidence.registrations[0].removed = false; }, 'font-cleanup'],
    ['inputs-changed', evidence => { evidence.supervisor.inputsUnchanged = false; }, 'supervisor-outcome'],
    ['supervisor-claims-save', evidence => { evidence.supervisor.embedSaveRecorded = true; }, 'supervisor-outcome'],
    ['worker-exit-zero', evidence => { evidence.worker.exitCode = 0; evidence.supervisor.exitCode = 0; }, 'worker-outcome'],
    ['cleanup-unconfirmed', evidence => { evidence.report.cleanupConfirmed = false; }, 'report-lifecycle'],
    ['package-present', evidence => { evidence.pptxBytes = positivePptx; }, 'blocked-saved-package-present'],
  ];
  for (const [name, mutate, code] of blockedNegatives) {
    const evidence = structuredClone(blockedEvidence); mutate(evidence);
    const out = auditBlockedEmbedEvidence(evidence);
    assert.equal(out.diagnosticEvidenceValid, false, name); assert.equal(out.embedGatePassed, false, name);
    assert.ok(blockedCodes(evidence).has(code), `${name}: ${[...blockedCodes(evidence)].join(',')}`);
  }
  // A Carlito-only post-edit inventory would pass the gate, so a "blocked" record over it is inconsistent.
  const carlitoOnlyBlocked = makeLifecycle(positivePptx, syntheticSourcePath, syntheticSavedPath, '0'.repeat(64), {...blockedOptions, editedFonts: ['Carlito']});
  assert.ok(blockedCodes(carlitoOnlyBlocked).has('report-native-font-gate'));
  // Stages: a SaveAs stage, a missing or duplicated close, an unpaired diagnostic, or a misordered snapshot all fail.
  const withSave = structuredClone(blockedEvidence); const gateAt = withSave.stages.findIndex(row => row.status === 'blocked');
  withSave.stages.splice(gateAt + 1, 0, {...withSave.stages[gateAt], stage: 'edited.presentation.saveAs-owned-copy-embed-fonts', status: 'begin', error: null}, {...withSave.stages[gateAt], stage: 'edited.presentation.saveAs-owned-copy-embed-fonts', status: 'success', error: null}); resequence(withSave);
  assert.ok(blockedCodes(withSave).has('stage-no-save'));
  const noClose = structuredClone(blockedEvidence); noClose.stages.splice(stageIndex(noClose, 'blocked.presentation.close'), 2); resequence(noClose);
  assert.ok(blockedCodes(noClose).has('stage-required') && blockedCodes(noClose).has('stage-close'));
  const unpairedBlocked = structuredClone(blockedEvidence); unpairedBlocked.stages.splice(stageIndex(unpairedBlocked, 'post-format.title.font.nameFarEast.get'), 1); resequence(unpairedBlocked);
  assert.ok(blockedCodes(unpairedBlocked).has('stage-pair'));
  const misorderedBlocked = movePair(structuredClone(blockedEvidence), 'post-text.body.presentation.fonts.get', 'edit.body.text.set');
  assert.ok(blockedCodes(misorderedBlocked).has('stage-order'));
  const extraStageAfterFailure = structuredClone(blockedEvidence); extraStageAfterFailure.stages.push({...extraStageAfterFailure.stages.at(-1), stage: 'unexpected.after-failure', status: 'success', error: null}); resequence(extraStageAfterFailure);
  assert.ok([...blockedCodes(extraStageAfterFailure)].some(code => ['stage-pair', 'stage-terminal', 'stage-order'].includes(code)));
  record('blocked-mode-malformed-lifecycle-gate-and-diagnostic-negatives');

  // Completed-save evidence is rejected by blocked mode; blocked evidence is still rejected by the default embed audit.
  const completedAsBlocked = auditBlockedEmbedEvidence(positiveEvidence);
  assert.equal(completedAsBlocked.diagnosticEvidenceValid, false); assert.equal(completedAsBlocked.embedGatePassed, false);
  const completedAsBlockedCodes = new Set(completedAsBlocked.failures.map(item => item.code));
  assert.ok(['report-embed', 'report-native-font-gate', 'blocked-saved-package-present', 'stage-no-save'].every(code => completedAsBlockedCodes.has(code)), [...completedAsBlockedCodes].join(','));
  const blockedAsCompleted = auditSavedEmbedPresentation({...structuredClone(blockedEvidence), pptxBytes: positivePptx});
  assert.equal(blockedAsCompleted.passed, false);
  const blockedAsCompletedCodes = new Set(blockedAsCompleted.failures.map(item => item.code));
  assert.ok(['report-embed', 'native-font-inventory', 'report-native-font-gate', 'stage-terminal'].every(code => blockedAsCompletedCodes.has(code)), [...blockedAsCompletedCodes].join(','));
  record('blocked-and-completed-modes-are-mutually-exclusive');
}

const opcNegatives = [
  ['extra-font-part', makeOpc({extraParts: {'ppt/fonts/extra.fntdata': new Uint8Array([9])}}), ['opc-font-part-count', 'opc-font-part-extra']],
  ['dangling-font-relationship', makeOpc({rels: relXml({extra: '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/extra.fntdata"/>'})}), ['opc-font-relationship-dangling']],
  ['unused-font-relationship-same-target', makeOpc({rels: relXml({extra: '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font1.fntdata"/>'})}), ['opc-font-relationship-unused']],
  ['missing-font-reference', makeOpc({presentation: presentationXml({missingStyle: 'p:boldItalic'})}), ['opc-embedded-reference', 'opc-font-part-extra']],
  ['unknown-family', makeOpc({presentation: presentationXml({family: 'Aptos'})}), ['opc-embedded-family', 'opc-unknown-family']],
  ['duplicate-relationship-id', makeOpc({rels: relXml({duplicateId: true})}), ['opc-relationship-id']],
  ['duplicate-content-type', makeOpc({contentTypes: contentTypesXml({duplicate: true})}), ['opc-content-type-duplicate']],
  ['traversing-target', makeOpc({rels: relXml({target: '../fonts/font1.fntdata'})}), ['opc-font-relationship-target', 'opc-embedded-target']],
  ['external-target', makeOpc({rels: relXml({target: 'https://example.invalid/font', external: true})}), ['opc-font-relationship-external', 'opc-embedded-relationship']],
  ['presentation-namespace-rebinding', makeOpc({presentation: presentationXml().replace('<p:embeddedFontLst>', '<p:embeddedFontLst xmlns:p="urn:unexpected">')}), ['opc-namespace-rebinding']],
  ['relationship-namespace-rebinding', makeOpc({rels: relXml().replace('<Relationship Id="rId1"', '<Relationship xmlns="urn:unexpected" Id="rId1"')}), ['opc-namespace-rebinding']],
  ['content-type-namespace-rebinding', makeOpc({contentTypes: contentTypesXml().replace('<Default ', '<Default xmlns="urn:unexpected" ')}), ['opc-namespace-rebinding']],
];
for (const [name, pptx, expectedCodes] of opcNegatives) {
  const codes = new Set(inspectFontEmbeddingPackage(pptx).failures.map(item => item.code));
  assert.ok(expectedCodes.some(code => codes.has(code)), `${name}: ${[...codes].join(',')}`);
}
record('font-opc-negative-fixtures');

function duplicateCentralNameZip() {
  const zip = makeOpc({extraParts: {'ppt/fonts/fond1.fntdata': new Uint8Array([7])}});
  const from = Buffer.from('ppt/fonts/fond1.fntdata'); const to = Buffer.from('ppt/fonts/font1.fntdata');
  let changed = false;
  for (let index = 0; index <= zip.length - from.length; index++) if (zip.subarray(index, index + from.length).equals(from) && index >= 4 && zip.readUInt32LE(index - 46) === 0x02014b50) { to.copy(zip, index); changed = true; }
  assert.equal(changed, true);
  return zip;
}
assert.ok(inspectFontEmbeddingPackage(duplicateCentralNameZip()).failures.some(item => item.code === 'opc-zip-structure'));
record('duplicate-central-directory-name-rejected');

const missingArg = spawnSync(node, [auditCli], spawnOptions);
assert.notEqual(missingArg.status, 0); assert.match(missingArg.stderr, /Usage/);
const missingDir = spawnSync(node, [auditCli, path.join(os.tmpdir(), `opf-font-embed-missing-${process.pid}`)], spawnOptions);
assert.notEqual(missingDir.status, 0); assert.match(missingDir.stderr, /does not exist/);
record('cli-missing-inputs-fail-without-output');

const require = createRequire(path.join(packageRoot, 'package.json'));
const carlitoRoot = path.dirname(require.resolve('@expo-google-fonts/carlito/package.json'));
const installedFaces = {
  'fonts/Carlito-400-normal.ttf': '400Regular/Carlito_400Regular.ttf',
  'fonts/Carlito-400-italic.ttf': '400Regular_Italic/Carlito_400Regular_Italic.ttf',
  'fonts/Carlito-700-normal.ttf': '700Bold/Carlito_700Bold.ttf',
  'fonts/Carlito-700-italic.ttf': '700Bold_Italic/Carlito_700Bold_Italic.ttf',
};
const tempBase = path.resolve(os.tmpdir());
const evidenceRoot = await mkdtemp(path.join(tempBase, 'opf-font-embed-control-'));
assert.ok(path.resolve(evidenceRoot).startsWith(tempBase + path.sep));
try {
  const inputs = path.join(evidenceRoot, 'inputs'); const originals = path.join(evidenceRoot, 'synthetic-originals');
  await mkdir(path.join(inputs, 'fonts'), {recursive: true}); await mkdir(path.join(originals, 'fonts'), {recursive: true});
  const sourceBytes = Buffer.from('synthetic source binding; not a native PPTX'); const sourceHash = sha(sourceBytes);
  await writeFile(path.join(originals, 'source.pptx'), sourceBytes); await copyFile(path.join(originals, 'source.pptx'), path.join(inputs, 'source.pptx'));
  const directoryGeneration = {...structuredClone(generation), source: {file: 'source.pptx', sha256: sourceHash}, license: {file: 'LICENSE_FONT', spdx: 'OFL-1.1', sha256: PERMITTED_CARLITO_LICENSE_SHA256}};
  await writeFile(path.join(originals, 'generation.json'), JSON.stringify(directoryGeneration, null, 2) + '\n'); await copyFile(path.join(originals, 'generation.json'), path.join(inputs, 'generation.json'));
  await copyFile(path.join(carlitoRoot, 'LICENSE_FONT'), path.join(originals, 'LICENSE_FONT')); await copyFile(path.join(originals, 'LICENSE_FONT'), path.join(inputs, 'LICENSE_FONT'));
  await copyFile(embedVerifier, path.join(inputs, 'native-font-embed.ps1'));
  await copyFile(path.join(root, 'native-process.ps1'), path.join(inputs, 'native-process.ps1'));
  await copyFile(path.join(root, 'native-text-fonts.ps1'), path.join(inputs, 'native-text-fonts.ps1'));
  for (const [file, installed] of Object.entries(installedFaces)) { await copyFile(path.join(carlitoRoot, installed), path.join(originals, file)); await copyFile(path.join(originals, file), path.join(inputs, file)); }
  const generationBytes = await readFile(path.join(inputs, 'generation.json'));
  const expectations = {
    title: {text: 'Gate E - Carlito', family: 'Carlito', size: 30, bold: true, italic: false},
    body: {text: 'Regular 18 | Bold 20 | Italic 22 | BoldItalic 24', family: 'Carlito', defaultSize: 18, runs: structuredClone(SYNTHETIC_RUNS)},
    embedFonts: {saveFormat: 24, saveArgument: -1, meaning: 'synthetic structural control'},
    nativeFonts: {allowedNames: [...PERMITTED_NATIVE_FONT_NAMES], maxEntries: 64, unexpectedNamesBlockSave: true, requireEmbeddable: true},
  };
  const item = (original, snapshot, hash) => ({path: original, sha256: hash, snapshotPath: snapshot, snapshotSha256: hash});
  const request = {
    source: item(path.join(originals, 'source.pptx'), path.join(inputs, 'source.pptx'), sourceHash),
    fixture: {
      generation: item(path.join(originals, 'generation.json'), path.join(inputs, 'generation.json'), sha(generationBytes)),
      license: {...item(path.join(originals, 'LICENSE_FONT'), path.join(inputs, 'LICENSE_FONT'), PERMITTED_CARLITO_LICENSE_SHA256), spdx: 'OFL-1.1'},
      fonts: PERMITTED_CARLITO_FIXTURE_FILES.map(file => ({file, ...item(path.join(originals, file), path.join(inputs, file), PERMITTED_CARLITO_FIXTURE[file])})),
    },
    verifier: item(embedVerifier, path.join(inputs, 'native-font-embed.ps1'), sha(Buffer.from(embedSource))),
    processHelper: item(path.join(root, 'native-process.ps1'), path.join(inputs, 'native-process.ps1'), sha(await readFile(path.join(inputs, 'native-process.ps1')))),
    fontHelper: {...item(path.join(root, 'native-text-fonts.ps1'), path.join(inputs, 'native-text-fonts.ps1'), sha(await readFile(path.join(inputs, 'native-text-fonts.ps1')))), registrationFlags: 0},
    expectations,
  };
  const savedPath = path.join(evidenceRoot, 'native-font-embed.pptx');
  const directoryEvidence = makeLifecycle(positivePptx, path.join(inputs, 'source.pptx'), savedPath, sourceHash);
  directoryEvidence.generation = directoryGeneration;
  directoryEvidence.report.source = {path: request.source.path, sha256: sourceHash, snapshotPath: request.source.snapshotPath, snapshotSha256: sourceHash};
  directoryEvidence.report.requested = expectations;
  const bindings = [
    ['source', request.source], ['generation', request.fixture.generation], ['license', request.fixture.license], ['verifier', request.verifier], ['process-helper', request.processHelper], ['font-helper', request.fontHelper],
    ...request.fixture.fonts.map(font => [`font:${font.file}`, font]),
  ];
  directoryEvidence.supervisor.inputChecks = bindings.flatMap(([role, binding]) => [
    {role, copy: 'snapshot', path: binding.snapshotPath, expected: binding.sha256, actual: binding.sha256, matched: true},
    {role, copy: 'original', path: binding.path, expected: binding.sha256, actual: binding.sha256, matched: true},
  ]);
  await Promise.all([
    writeFile(path.join(evidenceRoot, 'request.json'), JSON.stringify(request)),
    writeFile(path.join(evidenceRoot, 'report.json'), JSON.stringify(directoryEvidence.report)),
    writeFile(path.join(evidenceRoot, 'supervisor.json'), JSON.stringify(directoryEvidence.supervisor)),
    writeFile(path.join(evidenceRoot, 'worker.json'), JSON.stringify(directoryEvidence.worker)),
    writeFile(path.join(evidenceRoot, 'progress.json'), JSON.stringify(directoryEvidence.progress)),
    writeFile(path.join(evidenceRoot, 'font-registration.json'), JSON.stringify(directoryEvidence.registrations)),
    writeFile(path.join(evidenceRoot, 'stages.jsonl'), directoryEvidence.stages.map(row => JSON.stringify(row)).join('\n') + '\n'),
    writeFile(savedPath, positivePptx),
  ]);
  assert.equal((await auditEvidenceDirectory(evidenceRoot)).passed, true);
  const firstCli = spawnSync(node, [auditCli, evidenceRoot], spawnOptions);
  assert.equal(firstCli.status, 0, firstCli.stderr || firstCli.stdout);
  const auditBytes = await readFile(path.join(evidenceRoot, 'embed-opc-audit.json'));
  const secondCli = spawnSync(node, [auditCli, evidenceRoot], spawnOptions);
  assert.notEqual(secondCli.status, 0); assert.match(secondCli.stderr, /Refusing to overwrite/);
  assert.equal(sha(await readFile(path.join(evidenceRoot, 'embed-opc-audit.json'))), sha(auditBytes));
  const mutatedFontPath = path.join(inputs, PERMITTED_CARLITO_FIXTURE_FILES[0]); const canonicalFontBytes = await readFile(mutatedFontPath);
  await writeFile(mutatedFontPath, Buffer.concat([canonicalFontBytes, Buffer.from([0])]));
  assert.ok((await auditEvidenceDirectory(evidenceRoot)).failures.some(item => item.code === 'input-hash'));
  await writeFile(mutatedFontPath, canonicalFontBytes);
  const supervisorPath = path.join(evidenceRoot, 'supervisor.json'); const supervisorBytes = await readFile(supervisorPath); const corruptedSupervisor = JSON.parse(supervisorBytes);
  corruptedSupervisor.inputChecks[0].actual = '0'.repeat(64); corruptedSupervisor.inputChecks[0].matched = false;
  await writeFile(supervisorPath, JSON.stringify(corruptedSupervisor));
  assert.ok((await auditEvidenceDirectory(evidenceRoot)).failures.some(item => item.code === 'supervisor-input-binding'));
  await writeFile(supervisorPath, supervisorBytes);
  const workerPath = path.join(evidenceRoot, 'worker.json'); const workerBytes = await readFile(workerPath);
  await writeFile(workerPath, 'false\n');
  assert.ok((await auditEvidenceDirectory(evidenceRoot)).failures.some(item => item.code === 'evidence-object'));
  await writeFile(workerPath, workerBytes);
  const generationPath = path.join(inputs, 'generation.json'); const savedGenerationBytes = await readFile(generationPath);
  await writeFile(generationPath, 'null\n');
  assert.ok((await auditEvidenceDirectory(evidenceRoot)).failures.some(item => item.code === 'evidence-object'));
  await writeFile(generationPath, savedGenerationBytes);
  record('full-directory-audit-canonical-installed-fixture');
  record('cli-preserves-existing-audit');
  record('directory-rejects-snapshot-and-supervisor-mutation');
  record('directory-rejects-false-null-json');

  // The same bound inputs, now as a gate-blocked attempt: no saved package, blocked gate, discarding close.
  const blockedDirectory = makeLifecycle(positivePptx, path.join(inputs, 'source.pptx'), savedPath, sourceHash, blockedOptions);
  blockedDirectory.report.source = directoryEvidence.report.source; blockedDirectory.report.requested = expectations;
  blockedDirectory.supervisor.inputChecks = directoryEvidence.supervisor.inputChecks;
  await rm(savedPath); await rm(path.join(evidenceRoot, 'embed-opc-audit.json'));
  await Promise.all([
    writeFile(path.join(evidenceRoot, 'report.json'), JSON.stringify(blockedDirectory.report)),
    writeFile(supervisorPath, JSON.stringify(blockedDirectory.supervisor)),
    writeFile(workerPath, JSON.stringify(blockedDirectory.worker)),
    writeFile(path.join(evidenceRoot, 'progress.json'), JSON.stringify(blockedDirectory.progress)),
    writeFile(path.join(evidenceRoot, 'stages.jsonl'), blockedDirectory.stages.map(row => JSON.stringify(row)).join('\n') + '\n'),
  ]);
  const blockedAudit = await auditBlockedEvidenceDirectory(evidenceRoot);
  assert.equal(blockedAudit.diagnosticEvidenceValid, true, JSON.stringify(blockedAudit.failures)); assert.equal(blockedAudit.embedGatePassed, false); assert.equal(Object.hasOwn(blockedAudit, 'passed'), false);
  assert.deepEqual(blockedAudit.fontsTimeline.map(item => item.names), [['Carlito'], ['Carlito', 'Aptos'], ['Carlito', 'Aptos'], ['Carlito', 'Aptos'], ['Carlito', 'Aptos']]);
  const defaultOnBlocked = await auditEvidenceDirectory(evidenceRoot);
  assert.equal(defaultOnBlocked.passed, false); assert.ok(defaultOnBlocked.failures.some(item => item.code === 'missing-evidence'));
  const blockedCli = spawnSync(node, [auditCli, evidenceRoot, '--blocked'], spawnOptions);
  assert.equal(blockedCli.status, 0, blockedCli.stderr || blockedCli.stdout);
  assert.deepEqual(JSON.parse(blockedCli.stdout).embedGatePassed, false);
  const blockedAuditBytes = await readFile(path.join(evidenceRoot, 'blocked-diagnostic-audit.json'));
  const blockedAuditJson = JSON.parse(blockedAuditBytes);
  assert.equal(blockedAuditJson.kind, 'native-font-embed-blocked-diagnostic-audit'); assert.equal(blockedAuditJson.embedGatePassed, false); assert.equal(blockedAuditJson.diagnosticEvidenceValid, true);
  const secondBlockedCli = spawnSync(node, [auditCli, evidenceRoot, '--blocked'], spawnOptions);
  assert.notEqual(secondBlockedCli.status, 0); assert.match(secondBlockedCli.stderr, /Refusing to overwrite/);
  assert.equal(sha(await readFile(path.join(evidenceRoot, 'blocked-diagnostic-audit.json'))), sha(blockedAuditBytes));
  const defaultCliOnBlocked = spawnSync(node, [auditCli, evidenceRoot], spawnOptions);
  assert.notEqual(defaultCliOnBlocked.status, 0, 'Default embed audit must reject blocked evidence');
  const unknownFlag = spawnSync(node, [auditCli, evidenceRoot, '--pass'], spawnOptions);
  assert.notEqual(unknownFlag.status, 0); assert.match(unknownFlag.stderr, /Usage/);
  await writeFile(savedPath, positivePptx);
  assert.ok((await auditBlockedEvidenceDirectory(evidenceRoot)).failures.some(item => item.code === 'blocked-saved-package-present'));
  await rm(savedPath);
  const reportPath = path.join(evidenceRoot, 'report.json'); const blockedReport = structuredClone(blockedDirectory.report);
  blockedReport.fontSlotObservations.postText[1].slots.nameComplexScript = 3;
  await writeFile(reportPath, JSON.stringify(blockedReport));
  const malformedBlocked = await auditBlockedEvidenceDirectory(evidenceRoot);
  assert.equal(malformedBlocked.diagnosticEvidenceValid, false); assert.ok(malformedBlocked.failures.some(item => item.code === 'report-font-slots'));
  record('directory-blocked-mode-cli-exclusive-create-and-rejections');
} finally {
  const resolved = path.resolve(evidenceRoot);
  if (resolved.startsWith(tempBase + path.sep)) await rm(resolved, {recursive: true, force: true});
}

const suite = {
  passed: outcomes.every(item => item.passed),
  scope: 'Offline controls for canonical pre-registration provenance, fail-closed native Fonts gating, bounded pre-edit/post-text/post-format/post-edit diagnostic observations (never gates), blocked-evidence diagnostic audit (never an embed pass), lifecycle-bound font OPC structure, and immutable CLI output. No Office or font API was called.',
  node: process.version,
  embedVerifier,
  embedVerifierSha256: sha(Buffer.from(embedSource)),
  checks: outcomes,
};
const reportPath = path.join(packageRoot, 'artifacts/native-font-embed-controls.json');
await mkdir(path.dirname(reportPath), {recursive: true});
await writeFile(reportPath, JSON.stringify(suite, null, 2) + '\n');
console.log(JSON.stringify({passed: suite.passed, checks: outcomes.length, reportPath}));
process.exitCode = suite.passed ? 0 : 1;
