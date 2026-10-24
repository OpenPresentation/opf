// Phase 3 cases of the source editor keyboard plan (artifacts/source-editor/TEST-PLAN.md sections 4.11 and 5 to 6): problem text in plain words, squiggles,
// the Details of a rule and the quick fixes for YAML and Markdown syntax problems and the new text fixes, with real keyboard events in a real browser on the
// source pane harness. OPF_BROWSER_ENGINE=webkit runs it on WebKit; OPF_KEYBOARD_ONLY=<regexp> runs the cases whose id matches.
import assert from 'node:assert/strict';
import { engineName, platform, runCases, startKeyboardSuite } from './support/source-keyboard.mjs';
import { diagnosticsPhase3 } from './support/source-cases/diagnostics-phase3.mjs';

const suite = await startKeyboardSuite();
const only = process.env.OPF_KEYBOARD_ONLY ? new RegExp(process.env.OPF_KEYBOARD_ONLY) : null;
try {
  const failed = [];
  for (const [name, cases] of Object.entries(diagnosticsPhase3)) {
    const result = await runCases(suite, only ? cases.filter((row) => only.test(row[0])) : cases, { onFailure: (detail) => console.error(`  FAIL ${detail}`) });
    console.log(`Problems and fixes (${name}): ${result.passed} cases pass${result.failed.length ? `, ${result.failed.length} fail` : ''} (${engineName} ${suite.browserVersion}, keymap ${platform}).`);
    failed.push(...result.failed);
  }
  assert.deepEqual(failed, [], 'every phase 3 problem and quick fix case passes');
  console.log('Source editor keyboard: phase 3 problems and quick fixes pass.');
} finally { await suite.close(); }
