// Phase 4 keyboard cases that belong to the editor itself (artifacts/source-editor/TEST-PLAN.md sections 4.8 and 7): the fold gutter and chords, the line
// and selection keys, go to line and replace, and the shortcuts list, with real keyboard events on the source pane harness.
// OPF_BROWSER_ENGINE=webkit runs it on WebKit; OPF_KEYBOARD_PLATFORM=darwin|win32|linux picks the keymap; OPF_KEYBOARD_ONLY=<regexp> runs matching case ids.
import assert from 'node:assert/strict';
import { engineName, platform, runCases, startKeyboardSuite } from './support/source-keyboard.mjs';
import { keymapCases } from './support/source-cases/keymap.mjs';

const suite = await startKeyboardSuite();
const only = process.env.OPF_KEYBOARD_ONLY ? new RegExp(process.env.OPF_KEYBOARD_ONLY) : null;
try {
  const result = await runCases(suite, only ? keymapCases.filter((row) => only.test(row[0])) : keymapCases, { onFailure: (detail) => console.error(`  FAIL ${detail}`) });
  console.log(`Keymap: ${result.passed} cases pass${result.failed.length ? `, ${result.failed.length} fail` : ''} (${engineName} ${suite.browserVersion}, keymap ${platform}).`);
  assert.deepEqual(result.failed, [], 'every keymap case passes');
  console.log('Source editor keyboard: phase 4 keymap cases pass.');
} finally { await suite.close(); }
