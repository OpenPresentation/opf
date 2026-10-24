// Phase 2 YAML cases of the source editor keyboard plan (artifacts/source-editor/TEST-PLAN.md section 5): completion in block and flow style, what
// accepting writes, Enter and indentation, pairs, comments, problems with their positions, Canonicalize with OPF and hover, with real keyboard events in a
// real browser on the source pane harness. OPF_BROWSER_ENGINE=webkit runs it on WebKit; OPF_KEYBOARD_ONLY=<regexp> runs the cases whose id matches.
import assert from 'node:assert/strict';
import { engineName, platform, runCases, startKeyboardSuite } from './support/source-keyboard.mjs';
import { yamlCases } from './support/source-cases/yaml-complete.mjs';
import { runBudgets } from './support/source-perf.mjs';

const suite = await startKeyboardSuite();
const only = process.env.OPF_KEYBOARD_ONLY ? new RegExp(process.env.OPF_KEYBOARD_ONLY) : null;
const cases = only ? yamlCases.filter((row) => only.test(row[0])) : yamlCases;
try {
  const result = await runCases(suite, cases, { onFailure: (detail) => console.error(`  FAIL ${detail}`) });
  console.log(`YAML: ${result.passed} cases pass${result.failed.length ? `, ${result.failed.length} fail` : ''} (${engineName} ${suite.browserVersion}, keymap ${platform}).`);
  // The SPEC's budgets (R-PERF-01..03) on a 300-slide deck written as YAML: a new key line in slide 150 opens the key list, a value is typed over.
  if (!only || only.test('P-')) {
    await runBudgets(suite, {
      format: 'yaml', label: 'YAML', trigger: 'it', typeAt: 'title: Slide 150 headline',
      place: () => { const { api } = demo.pane.editor, source = api.getValue(), at = source.indexOf('title: Slide 150 headline') + 'title: Slide 150 headline'.length; api.focus(); api.replace(at, at, '\n    '); api.setSelection(at + 5); },
    });
  }
  assert.deepEqual(result.failed, [], 'every YAML keyboard case passes');
  console.log('Source editor keyboard: phase 2 YAML cases pass.');
} finally { await suite.close(); }
