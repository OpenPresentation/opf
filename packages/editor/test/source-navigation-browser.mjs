// Phase 4 of the source editor keyboard plan (artifacts/source-editor/SPEC.md, section 8.3): go to definition, peek, find references and rename for the ids of
// a deck, in JSON, YAML and Markdown, with real keyboard and mouse events in a real browser on the source pane harness. OPF_BROWSER_ENGINE=webkit runs it on
// WebKit; OPF_KEYBOARD_PLATFORM=darwin|win32|linux picks the keymap; OPF_KEYBOARD_ONLY=<regexp> runs the cases whose id matches.
import assert from 'node:assert/strict';
import { engineName, platform, runCases, startKeyboardSuite } from './support/source-keyboard.mjs';
import { navigationCases } from './support/source-cases/navigation.mjs';
import { runNavigationBudgets } from './support/source-nav-perf.mjs';

const suite = await startKeyboardSuite();
const only = process.env.OPF_KEYBOARD_ONLY ? new RegExp(process.env.OPF_KEYBOARD_ONLY) : null;
try {
  const failed = [];
  for (const [name, cases] of Object.entries(navigationCases)) {
    const result = await runCases(suite, only ? cases.filter((row) => only.test(row[0])) : cases, { onFailure: (detail) => console.error(`  FAIL ${detail}`) });
    console.log(`Go to, peek, references and rename (${name}): ${result.passed} cases pass${result.failed.length ? `, ${result.failed.length} fail` : ''} (${engineName} ${suite.browserVersion}, keymap ${platform}).`);
    failed.push(...result.failed);
  }
  // The speed of the commands on a deck of 1000 slides in each format.
  if (!only || only.test('P-NAV')) for (const format of ['json', 'yaml', 'md']) await runNavigationBudgets(suite, { format });
  assert.deepEqual(failed, [], 'every navigation case passes');
  console.log('Source editor keyboard: phase 4 go to definition, peek, references and rename pass.');
} finally { await suite.close(); }
