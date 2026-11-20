import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
const bin = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL('../dist/index.js', import.meta.url));

// RR-105: a drawing conversion merges the located findings of the input check with the engine's own. The engine checks the same
// deck with the same validator, so its unlocated copy of a format or references finding must not print beside the located one.
const decks = {
  yaml: [['/design/theme', '/design/fontScheme', '/slides/0/layout'], 'deck.opf.yaml', `name: Findings once
design:
  theme: no-such-theme
  fontScheme: no-such-fonts
slides:
  - layout: no-such-layout
    title: One
    blocks:
      - text: hello
`],
  markdown: [['/design/theme', '/design/fontScheme'], 'deck.opf.md', `---
name: Findings once
design:
  theme: no-such-theme
  fontScheme: no-such-fonts
---
# One

hello
`],
};
for (const [format, [paths, file, text]] of Object.entries(decks)) {
  test(`convert prints each located ${format} finding once`, async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'opf-findings-once-'));
    try {
      const input = path.join(dir, file);
      await writeFile(input, text);
      const result = spawnSync(process.execPath, [bin, 'convert', input, path.join(dir, 'slide-{n}.svg'), '--keep-slides', '--date', '2026-11-12'], { encoding: 'utf8', timeout: 120000 });
      assert.equal(result.status, 0, result.stderr);
      const found = JSON.parse(result.stdout).findings;
      const references = found.filter((item) => item.ruleId === 'opf/unresolved-reference');
      assert.deepEqual(references.map((item) => item.path), paths);
      assert.ok(references.every((item) => item.location?.line > 0), 'the copy that prints is the located one');
      const keys = found.filter((item) => /^(opf|yaml|markdown)\//.test(item.ruleId)).map((item) => `${item.ruleId} ${item.path} ${item.message}`);
      assert.equal(new Set(keys).size, keys.length, 'no finding prints twice');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}
