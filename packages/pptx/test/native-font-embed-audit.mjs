import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
import {unzipSync} from 'fflate';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parse = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));

export const PERMITTED_CARLITO_FIXTURE_FILES = [
  'fonts/Carlito-400-normal.ttf',
  'fonts/Carlito-400-italic.ttf',
  'fonts/Carlito-700-normal.ttf',
  'fonts/Carlito-700-italic.ttf',
];

export const PERMITTED_CARLITO_FIXTURE_SHA256 = new Set([
  'ca019755404c45627a8566915df99068949dc32ee2bce48d6aeee7542d2a0a89',
  '074cd1b89d53765d90d0ed3b4bfe49523efaaf4f3f430c006bc3233778b0ebb5',
  '51edbfa32d8af939913ae1f4ad0a5173e32083499218c133384638090295f0b0',
  '25f5672c1985d168d6bc2973864fc5a7e374bb95fe8d0f91cff47ae17fa67691',
]);

/** Remove PS string literals so ban documentation in throw messages is not scanned as code. */
export function stripPowerShellLiteralsForScan(sourceText) {
  return sourceText
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:`"|[^"])*"/g, '""')
    .replace(/#.*$/gm, '');
}

/** Detect real Office quit invocations ($app.Quit(), .Application.Quit(), …), not prose. */
export function hasOfficeQuitInvocation(sourceText) {
  const code = stripPowerShellLiteralsForScan(sourceText);
  return /(?:\$[\w]+\.Quit|\.Application\.Quit)\s*\(/i.test(code);
}

const OWNED_EMBED_SAVE_OFF = /\.SaveAs\(\$savedPath,\s*24\s*,\s*0\s*\)/;
const OWNED_EMBED_SAVE_ON = /\.SaveAs\(\$savedPath,\s*24\s*,\s*(?:\(-1\)|-1)\s*\)/;

export function auditEmbedVerifierSource(sourceText, {label = 'native-font-embed.ps1'} = {}) {
  const failures = [];
  if (OWNED_EMBED_SAVE_OFF.test(sourceText)) {
    failures.push({code: 'embed-forced-off', message: `${label} must not call SaveAs with EmbedFonts 0`});
  }
  if (!OWNED_EMBED_SAVE_ON.test(sourceText)) {
    failures.push({code: 'embed-not-requested', message: `${label} must call SaveAs with EmbedFonts -1 on the owned presentation`});
  }
  if (hasOfficeQuitInvocation(sourceText)) {
    failures.push({code: 'application-quit', message: `${label} must not call Application.Quit or .Quit()`});
  }
  return failures;
}

export function listPptxFontParts(pptxBytes) {
  const entries = unzipSync(pptxBytes);
  const parts = Object.keys(entries)
    .filter(name => name.startsWith('ppt/fonts/') && !name.endsWith('/'))
    .sort()
    .map(partName => {
      const bytes = entries[partName];
      return {partName, byteLength: bytes.length, sha256: sha(bytes)};
    });
  return {parts, packageSha256: sha(pptxBytes)};
}

export function auditSavedEmbedPresentation({report, generation, pptxBytes, requireFontParts = true}) {
  const failures = [];
  if (!report || report.kind !== 'native-font-embed') {
    failures.push({code: 'report-kind', message: 'report.json must be a native-font-embed worker report'});
  } else if (Number(report.embedFonts?.saveArgument) !== -1) {
    failures.push({code: 'report-embed-argument', message: 'report.embedFonts.saveArgument must be -1'});
  } else if (!report.embedFonts?.completed) {
    failures.push({code: 'report-embed-incomplete', message: 'report.embedFonts.completed must be true after a successful Windows run'});
  }
  const fixtureFonts = generation?.fonts ?? [];
  if (fixtureFonts.length !== 4) {
    failures.push({code: 'generation-fonts', message: 'generation.json must list exactly four Carlito fixture fonts'});
  } else {
    for (const font of fixtureFonts) {
      if (!PERMITTED_CARLITO_FIXTURE_FILES.includes(font.file)) {
        failures.push({code: 'generation-font-path', message: `Disallowed fixture font path: ${font.file}`});
      } else if (!PERMITTED_CARLITO_FIXTURE_SHA256.has(font.sha256)) {
        failures.push({code: 'generation-font-hash', message: `Disallowed fixture font hash for ${font.file}`});
      }
    }
  }
  const {parts, packageSha256} = listPptxFontParts(pptxBytes);
  if (requireFontParts && parts.length === 0) {
    failures.push({code: 'opc-no-font-parts', message: 'Saved PPTX contains no ppt/fonts parts after an embed save'});
  }
  return {failures, parts, packageSha256};
}

const evidenceRoot = process.argv[2];
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  assert.ok(evidenceRoot, 'Usage: node test/native-font-embed-audit.mjs EVIDENCE_DIRECTORY');
  const root = path.resolve(evidenceRoot);
  const verifierPath = path.join(root, 'inputs', 'native-font-embed.ps1');
  const reportPath = path.join(root, 'report.json');
  const generationPath = path.join(root, 'inputs', 'generation.json');
  const savedPath = path.join(root, 'native-font-embed.pptx');
  const verifierSource = await readFile(verifierPath, 'utf8');
  const failures = auditEmbedVerifierSource(verifierSource);
  let report = null;
  let generation = null;
  try {
    report = parse(await readFile(reportPath));
  } catch {
    failures.push({code: 'missing-report', message: 'report.json is required for OPC audit'});
  }
  try {
    generation = parse(await readFile(generationPath));
  } catch {
    failures.push({code: 'missing-generation', message: 'inputs/generation.json is required'});
  }
  let opc = null;
  if (failures.length === 0) {
    try {
      const pptxBytes = await readFile(savedPath);
      opc = auditSavedEmbedPresentation({report, generation, pptxBytes, requireFontParts: true});
      failures.push(...opc.failures);
    } catch {
      failures.push({code: 'missing-pptx', message: 'native-font-embed.pptx is required for OPC audit'});
    }
  }
  const out = {
    schemaVersion: 1,
    kind: 'native-font-embed-opc-audit',
    evidenceDirectory: root,
    passed: failures.length === 0,
    failures,
    verifierSha256: sha(Buffer.from(verifierSource, 'utf8')),
    opc,
    scope: 'Offline verifier-source and ppt/fonts OPC part audit. No Office process is started.',
  };
  const outPath = path.join(root, 'embed-opc-audit.json');
  await writeFile(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify({passed: out.passed, failures: failures.length, outPath}));
  process.exitCode = out.passed ? 0 : 1;
}
