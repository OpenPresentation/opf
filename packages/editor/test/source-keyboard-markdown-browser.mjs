// Phase 2 Markdown cases of the source editor keyboard plan (artifacts/source-editor/TEST-PLAN.md section 6): completion in the front matter, in options
// comments, in fence info lines and fences, `Note:` and snippets; lists, quotes, Enter and Tab; pairs and comments; problems with their positions;
// Canonicalize with OPF and hover, with real keyboard events in a real browser on the source pane harness. OPF_BROWSER_ENGINE=webkit runs it on WebKit;
// OPF_KEYBOARD_ONLY=<regexp> runs the cases whose id matches.
import assert from 'node:assert/strict';
import { engineName, platform, runCases, startKeyboardSuite } from './support/source-keyboard.mjs';
import { markdownCases } from './support/source-cases/markdown-complete.mjs';
import { runBudgets } from './support/source-perf.mjs';

const suite = await startKeyboardSuite();
const only = process.env.OPF_KEYBOARD_ONLY ? new RegExp(process.env.OPF_KEYBOARD_ONLY) : null;
const cases = only ? markdownCases.filter((row) => only.test(row[0])) : markdownCases;
try {
  const result = await runCases(suite, cases, { onFailure: (detail) => console.error(`  FAIL ${detail}`) });
  console.log(`Markdown: ${result.passed} cases pass${result.failed.length ? `, ${result.failed.length} fail` : ''} (${engineName} ${suite.browserVersion}, keymap ${platform}).`);
  // The SPEC's budgets (R-PERF-01..03) on a 300-slide deck written as Markdown: an empty line after slide 150 opens the snippets, a title is typed over.
  if (!only || only.test('P-')) {
    await runBudgets(suite, {
      format: 'md', label: 'Markdown', trigger: 'sli', typeAt: '# Slide 150 headline',
      place: () => { const { api } = demo.pane.editor, source = api.getValue(), at = source.indexOf('# Slide 150 headline') + '# Slide 150 headline'.length; api.focus(); api.replace(at, at, '\n\n'); api.setSelection(at + 2); },
    });
  }
  assert.deepEqual(result.failed, [], 'every Markdown keyboard case passes');
  console.log('Source editor keyboard: phase 2 Markdown cases pass.');
} finally { await suite.close(); }
