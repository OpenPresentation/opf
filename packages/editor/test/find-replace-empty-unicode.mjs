import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createEditorSession } from "../dist/index.js";
import { findMatches, replaceAll } from "../dist/find-replace.js";

if (process.argv[2] === "child") {
  for (const text of ["😀", "A😀B", "AB", "", "\uD800", "\uDC00"]) {
    const doc = { slides: [{ text }] };
    for (const query of ["(?=.)", "(?:)", "^|$", "(?=😀)|B"]) {
      const result = findMatches(doc, query, { regex: true });
      assert.ok(result.matches.every(match => match.text.length > 0));
      const expected = query === "(?=😀)|B" && text.includes("B") ? ["B"] : [];
      assert.deepEqual(result.matches.map(match => match.text), expected);
    }
  }
  const editor = createEditorSession({ slides: [{ text: "A😀B" }] });
  const before = editor.snapshot();
  const result = replaceAll(editor, "(?:)", "X", { regex: true });
  assert.equal(result.count, 0);
  assert.equal(editor.snapshot(), before, "empty matches never insert replacement text or history");
  assert.deepEqual(findMatches(editor.presentation, "😀|B", { regex: true }).matches.map(({ start, end, text }) => ({ start, end, text })),
    [{ start: 1, end: 3, text: "😀" }, { start: 3, end: 4, text: "B" }]);
  console.log("Empty Unicode regex progression and no-empty replacement controls passed.");
} else {
  // Bound the regression so a future accidental infinite loop fails the suite.
  const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "child"], { encoding: "utf8", timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  process.stdout.write(result.stdout);
}
