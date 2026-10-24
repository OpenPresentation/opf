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
  // The accept race again with the CPU slowed down four times (Chromium): Tab and Enter right after a keystroke must still accept.
  if (engineName === 'chromium') {
    const race = await runCases(suite, cases.filter((row) => /^Y-ACC-00[2-8]/.test(row[0])), { cpuThrottle: 4, onFailure: (detail) => console.error(`  FAIL (4x slower CPU) ${detail}`) });
    console.log(`Accept race on a 4x slower CPU: ${race.passed} cases pass${race.failed.length ? `, ${race.failed.length} fail` : ''}.`);
    result.failed.push(...race.failed);
  }
  // The SPEC's budgets (R-PERF-01..03) on a 300-slide deck written as YAML: a new key line in slide 150 opens the key list, a value is typed over.
  if (!only || only.test('P-')) {
    await runBudgets(suite, {
      format: 'yaml', label: 'YAML', trigger: 'it', typeAt: 'title: Slide 150 headline',
      prepare: (text) => text.replace('title: Slide 150 headline\n', 'title: Slide 150 headline\n    \n'),
      place: () => { const { api } = demo.pane.editor, source = api.getValue(), at = source.indexOf('title: Slide 150 headline\n    ') + 'title: Slide 150 headline\n    '.length; api.focus(); api.setSelection(at); },
    });
  }
  assert.deepEqual(result.failed, [], 'every YAML keyboard case passes');
  console.log('Source editor keyboard: phase 2 YAML cases pass.');
} finally { await suite.close(); }
