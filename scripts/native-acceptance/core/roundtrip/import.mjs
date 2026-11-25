// NT-04b: does the application's PowerPoint copy come back into OPF? Runs OPF's own importer the way
// scripts/native-acceptance/qualification/build.mjs runs the CLI (`node packages/cli/dist/index.js convert`), and answers in
// the shape of result.json's verbs.resave.import: { status: imported | failed | not-run, error?, slideCount? }.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export const CLI = path.join(root, 'packages/cli/dist/index.js');
const ERROR_LIMIT = 2000;

/** The importer's own words from a failed convert: the report's error, else its error findings, else stderr. */
// The CLI writes its failure report as JSON ({ ok: false, code, reason, error, findings }) to stderr or stdout.
export function errorOf(stdout, stderr) {
  for (const text of [stderr, stdout]) {
    let report;
    try {
      report = JSON.parse(String(text ?? ''));
    } catch {
      continue;
    }
    const message = typeof report.error === 'string' ? report.error : report.error?.message;
    const reason = report.reason ?? report.code ?? (typeof report.error === 'object' ? report.error?.code : undefined);
    const located = (report.findings ?? []).filter((finding) => finding.severity === 'error' && finding.path).map((finding) => finding.path);
    const parts = [[reason, message].filter(Boolean).join(': '), ...(located.length > 0 ? [`at ${located.join(', ')}`] : [])].filter(Boolean);
    if (parts.length > 0) return parts.join(' ').slice(0, ERROR_LIMIT);
  }
  return String(stderr || stdout || 'the importer failed without a message').trim().slice(0, ERROR_LIMIT);
}

/**
 * importResaved(path, { cli? }) -> { status: "imported", slideCount } | { status: "failed", error } | { status: "not-run", error }
 * "not-run" when the copy is missing or the workspace is not built (no packages/cli/dist): `error` then says why, and
 * `pnpm build:packages` is what builds it.
 */
export function importResaved(file, { cli = CLI } = {}) {
  if (!file || !existsSync(file)) return { status: 'not-run', error: `no copy to import: ${file ? path.basename(file) : 'none'} is missing` };
  if (!existsSync(cli)) return { status: 'not-run', error: 'the OPF command line is not built (packages/cli/dist/index.js is missing); run pnpm build:packages' };
  const scratch = mkdtempSync(path.join(tmpdir(), 'opf-roundtrip-'));
  const out = path.join(scratch, 'back.opf.json');
  try {
    execFileSync(process.execPath, [cli, 'convert', file, out, '--force'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
    const deck = JSON.parse(readFileSync(out, 'utf8'));
    return { status: 'imported', slideCount: Array.isArray(deck.slides) ? deck.slides.length : 0 };
  } catch (error) {
    if (error.code === 'ENOENT' && !error.stdout) return { status: 'not-run', error: String(error.message).slice(0, ERROR_LIMIT) };
    return { status: 'failed', error: errorOf(error.stdout, error.stderr) };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
