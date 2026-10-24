// The keyboard cases of the source editor (artifacts/source-editor/TEST-PLAN.md), phase 0: Tab and Enter accept, Ctrl+Space opens the list, lines
// move, paste, indentation, multiple cursors, the field menu and Format, in JSON, YAML and Markdown. Real keyboard events in a real browser on the
// source pane harness (artifacts/playground/source-pane.html, built by `pnpm run build:playground`). OPF_BROWSER_ENGINE=webkit runs it on WebKit.
import assert from 'node:assert/strict';
import { engineName, platform, runCases, startKeyboardSuite } from './support/source-keyboard.mjs';
import { jsonCases } from './support/source-cases/json.mjs';
import { yamlCases } from './support/source-cases/yaml.mjs';
import { markdownCases } from './support/source-cases/markdown.mjs';

const suite = await startKeyboardSuite();
const only = process.env.OPF_KEYBOARD_ONLY ? new RegExp(process.env.OPF_KEYBOARD_ONLY) : null;
const select = (cases) => (only ? cases.filter((row) => only.test(row[0])) : cases);
try {
  const results = [];
  for (const [name, cases] of [['JSON', jsonCases], ['YAML', yamlCases], ['Markdown', markdownCases]]) {
    const result = await runCases(suite, select(cases), { onFailure: (detail) => console.error(`  FAIL ${detail}`) });
    console.log(`${name}: ${result.passed} cases pass${result.failed.length ? `, ${result.failed.length} fail` : ''} (${engineName} ${suite.browserVersion}, keymap ${platform}).`);
    results.push(result);
  }
  // The accept race again with the CPU slowed down four times (Chromium): Tab and Enter right after a keystroke must still accept.
  if (engineName === 'chromium') {
    const race = await runCases(suite, select(jsonCases.filter((row) => /^J-ACC-00[3-8]/.test(row[0]))), { cpuThrottle: 4, onFailure: (detail) => console.error(`  FAIL (4x slower CPU) ${detail}`) });
    console.log(`Accept race on a 4x slower CPU: ${race.passed} cases pass${race.failed.length ? `, ${race.failed.length} fail` : ''}.`);
    results.push(race);
  }
  assert.deepEqual(results.flatMap((result) => result.failed), [], 'every keyboard case passes');
  console.log('Source editor keyboard: phase 0 cases pass.');
} finally { await suite.close(); }
