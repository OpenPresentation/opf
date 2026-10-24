// `analyzeJsonSyntax`: the root cause of each JSON syntax error, once, in plain words, with the fixes that repair it
// (SPEC 9.3, VALIDATOR-HINTS 5 and 6). Golden cases, one per cause the editor documents, and the invariants that hold for any text.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { validate } from "../dist/index.js";
import { analyzeJsonSyntax, applyTextEdits } from "../dist/source.js";

const BOM = String.fromCharCode(0xfeff);
const parses = (text) => {
  try {
    JSON.parse(text.replace(/^\uFEFF/, ""));
    return true;
  } catch {
    return false;
  }
};
const codes = (text, options) => analyzeJsonSyntax(text, options).map((problem) => problem.code);
const fixOf = (problem, title) => {
  const fix = problem.fixes.find((entry) => entry.title === title);
  assert.ok(fix, `${problem.code} has the fix "${title}" (has ${problem.fixes.map((entry) => entry.title).join(", ")})`);
  return fix;
};
const apply = (text, fix) => applyTextEdits(text, fix.edits);
const slice = (text, range) => text.slice(range.offset, range.offset + range.length);

/** Apply the first fix of the first problem and return the new text. */
function repairOnce(text) {
  const [problem] = analyzeJsonSyntax(text);
  assert.ok(problem, "has a problem");
  const fix = problem.fixes.find((entry) => !entry.action);
  assert.ok(fix, `${problem.code} has a text fix`);
  return apply(text, fix);
}

describe("the owner's case: a key with no value, followed by the next key", () => {
  const text = '{\n  "name": "x",\n  "design":\n  "organization": {"name": "Acme"}\n}';
  const problems = analyzeJsonSyntax(text);

  test("is exactly one problem, not the four a parser reports", () => {
    assert.equal(problems.length, 1);
    assert.equal(problems[0].code, "missing-value");
    assert.equal(problems[0].severity, "error");
  });
  test("the squiggle is the key through the colon on line 3", () => {
    const { range } = problems[0];
    assert.equal(slice(text, range), '"design":');
    assert.deepEqual({ offset: range.offset, length: range.length, line: range.line, column: range.column }, { offset: 19, length: 9, line: 3, column: 3 });
    assert.deepEqual(problems[0].path, ["design"]);
  });
  test("says what is missing and what could come, from the schema", () => {
    assert.equal(problems[0].message, "`design` needs a value.");
    assert.match(problems[0].next, /an object such as \{ "theme": "minimal" \}/);
    assert.match(problems[0].next, /Ctrl\+Space/);
    assert.doesNotMatch(problems[0].next, /^Next:/);
  });
  test('"Add { }" inserts a space and braces after the colon, so the result reads "design": {}', () => {
    const fix = fixOf(problems[0], "Add { }");
    assert.equal(fix.edits[0].offset, 28);
    assert.equal(fix.edits[0].length, 0);
    assert.equal(fix.edits[0].insert, " {}");
    const fixed = apply(text, fix);
    assert.ok(fixed.includes('"design": {}'));
    assert.equal(parses(fixed), true, "the comma the next property lacked is added too");
    assert.equal(fixed.slice(fix.caret - 1, fix.caret + 1), "{}", "the caret is between the braces");
    assert.deepEqual(analyzeJsonSyntax(fixed), []);
  });
  test('"Remove "design"" removes the key and colon (the whole line) so the rest parses', () => {
    const fix = fixOf(problems[0], 'Remove "design"');
    const fixed = apply(text, fix);
    assert.equal(fixed, '{\n  "name": "x",\n  "organization": {"name": "Acme"}\n}');
    assert.equal(parses(fixed), true);
  });
  test("a key with no value before } or at the end removes the comma that belonged to it", () => {
    const last = '{"name": "x", "design": }';
    const [problem] = analyzeJsonSyntax(last);
    assert.equal(problem.code, "missing-value");
    assert.equal(apply(last, fixOf(problem, 'Remove "design"')), '{"name": "x" }');
    const explicit = '{"a": , "b": 1}';
    assert.equal(apply(explicit, fixOf(analyzeJsonSyntax(explicit)[0], 'Remove "a"')), '{ "b": 1}');
  });
  test("works with CRLF line breaks", () => {
    const crlf = text.replaceAll("\n", "\r\n");
    const [problem] = analyzeJsonSyntax(crlf);
    assert.equal(problem.code, "missing-value");
    assert.equal(problem.range.line, 3);
    assert.equal(parses(apply(crlf, fixOf(problem, 'Remove "design"'))), true);
    assert.equal(parses(apply(crlf, fixOf(problem, "Add { }"))), true);
  });
});

describe("what a missing value could be depends on the field", () => {
  const cases = [
    ['{"design": {"titleAlignment":}}', /one of left, center, right/, "Add \"left\"", '"titleAlignment": "left"'],
    ['{"template":}', /true or false/, "Add false", '"template": false'],
    ['{"duration":}', /a number/, "Add 1", '"duration": 1'],
    ['{"slides":}', /a list such as/, "Add [ ]", '"slides": []'],
    ['{"slides": [{"title":}]}', /a string such as "Quarterly Review"/, 'Add ""', '"title": ""'],
    ['{"slides": [{"layout":}]}', /a layout id such as "cover"/, 'Add ""', '"layout": ""'],
    ['{"audience":}', /an audience id such as/, 'Add ""', '"audience": ""'],
    ['{"organization":}', /an object such as \{ "id": "acme" \}/, "Add { }", '"organization": {}'],
    ['{"zzz":}', /a value \(text in quotes/, 'Add ""', '"zzz": ""'],
  ];
  for (const [text, next, title, result] of cases)
    test(`${text}`, () => {
      const [problem] = analyzeJsonSyntax(text);
      assert.equal(problem.code, "missing-value");
      assert.match(problem.next, next);
      assert.match(problem.next, /remove the key/);
      const fixed = apply(text, fixOf(problem, title));
      assert.ok(fixed.includes(result), fixed);
      assert.equal(parses(fixed), true, fixed);
    });
  test("at the end of the text the unclosed brace is a second, separate problem", () => {
    assert.deepEqual(codes('{"design":'), ["unclosed-object", "missing-value"]);
    assert.deepEqual(codes('{"design": '), ["unclosed-object", "missing-value"]);
  });
});

describe("commas", () => {
  test("missing between properties: the end of the previous value, one character, on its line", () => {
    const text = '{\n  "name": "x"\n  "slides": []\n}';
    const problems = analyzeJsonSyntax(text);
    assert.equal(problems.length, 1);
    const [problem] = problems;
    assert.equal(problem.code, "missing-comma");
    assert.equal(slice(text, problem.range), '"');
    assert.equal(problem.range.offset, text.indexOf('"x"') + 2);
    assert.equal(problem.range.line, 2);
    assert.match(problem.message, /^Missing comma after `"name": "x"` \(line 2\)\.$/);
    const fix = fixOf(problem, "Insert comma");
    assert.equal(fix.safe, true);
    assert.deepEqual(fix.edits, [{ offset: text.indexOf('"x"') + 3, length: 0, insert: "," }]);
    assert.equal(apply(text, fix), '{\n  "name": "x",\n  "slides": []\n}');
  });
  test("missing between array items", () => {
    const text = '{"slides": [1 2]}';
    const [problem] = analyzeJsonSyntax(text);
    assert.equal(problem.code, "missing-comma");
    assert.match(problem.message, /^Missing comma after `1` \(line 1\)\./);
    assert.equal(slice(text, problem.range), "1");
    assert.equal(apply(text, fixOf(problem, "Insert comma")), '{"slides": [1, 2]}');
  });
  test("missing after an object value names the property, not its contents", () => {
    const text = '{"design": {"theme": "minimal"}\n "slides": []}';
    const [problem] = analyzeJsonSyntax(text);
    assert.equal(problem.code, "missing-comma");
    assert.match(problem.message, /after `"design": \{…\}` \(line 1\)/);
  });
  test("trailing before } and ]", () => {
    for (const [text, kind] of [['{"a": 1,}', "property"], ['{"a": [1, 2,]}', "item"], ['{"a": 1,\n}', "property"]]) {
      const problems = analyzeJsonSyntax(text);
      assert.equal(problems.length, 1, text);
      const [problem] = problems;
      assert.equal(problem.code, "trailing-comma");
      assert.equal(slice(text, problem.range), ",");
      assert.match(problem.message, new RegExp(`last ${kind}\\.$`));
      const fixed = apply(text, fixOf(problem, "Remove comma"));
      assert.equal(parses(fixed), true);
      assert.equal(fixOf(problem, "Remove comma").safe, true);
    }
  });
  test("two in a row, and one with nothing before it", () => {
    const [two] = analyzeJsonSyntax("[1,,2]".replace("[", '{"a":[') + "}");
    assert.equal(two.code, "double-comma");
    assert.equal(two.message, "Two commas in a row.");
    assert.equal(apply('{"a":[1,,2]}', fixOf(two, "Remove comma")), '{"a":[1,2]}');
    const [lead] = analyzeJsonSyntax('{,"a": 1}');
    assert.equal(lead.code, "double-comma");
    assert.match(lead.message, /nothing before it/);
    assert.equal(apply('{,"a": 1}', fixOf(lead, "Remove comma")), '{"a": 1}');
  });
});

describe("names and colons", () => {
  test('"design" {  is a missing colon, repaired by adding it', () => {
    const text = '{"design" {}}';
    const problems = analyzeJsonSyntax(text);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].code, "missing-colon");
    assert.equal(slice(text, problems[0].range), '"design"');
    assert.equal(problems[0].message, "`design` is missing a colon.");
    assert.equal(apply(text, fixOf(problems[0], "Add colon")), '{"design": {}}');
  });
  test('a half-typed key ("organ" and nothing else) has no colon and no value', () => {
    const text = '{\n  "name": "x",\n  "organ"\n}';
    const problems = analyzeJsonSyntax(text);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].code, "missing-colon");
    assert.equal(problems[0].message, "`organ` has no colon and value.");
    assert.equal(parses(apply(text, fixOf(problems[0], 'Remove "organ"'))), true);
    assert.equal(apply(text, fixOf(problems[0], 'Remove "organ"')), '{\n  "name": "x"\n}');
  });
  test("a half-typed key before another key is one problem, not also a missing comma", () => {
    assert.deepEqual(codes('{\n  "organ"\n  "design": {}\n}'), ["missing-colon"]);
  });
  test("an unquoted property name", () => {
    const text = '{slides: []}';
    const problems = analyzeJsonSyntax(text);
    assert.deepEqual(problems.map((problem) => problem.code), ["unquoted-key"]);
    assert.equal(problems[0].message, 'Property names need double quotes: "slides".');
    assert.equal(apply(text, fixOf(problems[0], "Quote the property name")), '{"slides": []}');
    assert.deepEqual(problems[0].path, ["slides"]);
  });
});

describe("quotes and bare words", () => {
  test("single quotes (name and value) are two problems with the safe fix", () => {
    const text = "{'a': 'it\\'s \"x\"'}";
    const problems = analyzeJsonSyntax(text);
    assert.deepEqual(problems.map((problem) => problem.code), ["single-quotes", "single-quotes"]);
    assert.equal(problems[0].message, "JSON strings use double quotes, not single quotes.");
    assert.equal(fixOf(problems[0], "Use double quotes").safe, true);
    assert.equal(parses(repairOnce(text)), false, "the value is still single-quoted");
    assert.deepEqual(JSON.parse(repairOnce(repairOnce(text))), { a: 'it\'s "x"' });
  });
  test("typographic quotes", () => {
    const text = "{\u201Ca\u201D: \u201Cb\u201D}";
    const problems = analyzeJsonSyntax(text);
    assert.deepEqual(problems.map((problem) => problem.code), ["typographic-quotes", "typographic-quotes"]);
    assert.match(problems[0].message, /typographic quotes/);
    assert.equal(slice(text, problems[0].range), "\u201Ca\u201D");
    assert.deepEqual(JSON.parse(repairOnce(repairOnce(text))), { a: "b" });
    assert.equal(fixOf(problems[0], "Replace with straight quotes").safe, true);
  });
  test("True, None, undefined and NaN are named and fixed to the JSON words", () => {
    const text = '{"a": True, "b": None, "c": undefined, "d": NaN, "e": hello}';
    const problems = analyzeJsonSyntax(text);
    assert.deepEqual(problems.map((problem) => problem.code), Array(5).fill("bare-word"));
    assert.equal(problems[0].message, "`True` is not JSON. Write true in lowercase.");
    assert.equal(apply(text, fixOf(problems[0], "Use true")), '{"a": true, "b": None, "c": undefined, "d": NaN, "e": hello}');
    assert.match(problems[1].message, /Use null/);
    assert.equal(apply(text, fixOf(problems[1], "Use null")).includes('"b": null'), true);
    assert.equal(problems[4].message, '`e` needs a quoted string: "hello".');
    assert.equal(apply(text, fixOf(problems[4], "Quote the value")).endsWith('"e": "hello"}'), true);
    assert.deepEqual(problems.map((problem) => problem.path), [["a"], ["b"], ["c"], ["d"], ["e"]]);
  });
  test("a bare word in a list has no key to name", () => {
    const [problem] = analyzeJsonSyntax('{"a": [hello]}');
    assert.equal(problem.code, "bare-word");
    assert.match(problem.message, /^`hello` needs quotes to be text/);
  });
});

describe("comments", () => {
  test("// and /* */ are reported one by one and removed whole", () => {
    const text = '{\n  // note\n  "a": 1 /* x */\n}';
    const problems = analyzeJsonSyntax(text);
    assert.deepEqual(problems.map((problem) => problem.code), ["comment", "comment"]);
    assert.equal(problems[0].message, "JSON does not allow comments.");
    assert.equal(slice(text, problems[0].range), "// note");
    assert.equal(apply(text, fixOf(problems[0], "Remove comment")), '{\n  "a": 1 /* x */\n}');
    assert.equal(apply(text, fixOf(problems[1], "Remove comment")), '{\n  // note\n  "a": 1\n}');
    const yaml = fixOf(problems[0], "Switch format to YAML");
    assert.deepEqual([yaml.action, yaml.format, yaml.edits], ["switch-format", "yaml", []]);
  });
  test("a comment before the root, with the root fine", () => {
    assert.deepEqual(codes('// comment\n{"slides":[]}'), ["comment"]);
  });
  test("an unterminated /* is one problem at the opener, with two repairs", () => {
    const text = '{"a": 1 /* open\n}';
    const problems = analyzeJsonSyntax(text);
    const comment = problems.find((problem) => problem.code === "unclosed-comment");
    assert.equal(slice(text, comment.range), "/*");
    assert.match(comment.message, /never closed/);
    assert.equal(apply(text, fixOf(comment, "Close comment")).endsWith("*/"), true);
    assert.equal(apply(text, fixOf(comment, "Remove comment")), '{"a": 1');
  });
});

describe("strings and numbers", () => {
  test("a string cut off by the end of the line", () => {
    const text = '{\n  "a": "abc,\n  "b": 2\n}';
    const problems = analyzeJsonSyntax(text);
    assert.equal(problems.length, 1, "the comma and the next key are the aftershock, not more problems");
    assert.equal(problems[0].code, "unclosed-string");
    assert.equal(slice(text, problems[0].range), '"abc,');
    assert.match(problems[0].message, /not closed before the end of the line/);
    assert.match(problems[0].next, /\\n/);
    assert.equal(apply(text, fixOf(problems[0], "Close the string")), '{\n  "a": "abc,"\n  "b": 2\n}');
  });
  test("numbers JSON does not accept: 01, .5, 5., +1, 12%", () => {
    const text = '{"a": 01, "b": .5, "c": 5., "d": +1, "e": 12%}';
    const problems = analyzeJsonSyntax(text);
    assert.deepEqual(problems.map((problem) => problem.code), Array(5).fill("invalid-number"));
    assert.deepEqual(problems.map((problem) => slice(text, problem.range)), ["01", ".5", "5.", "+1", "12%"]);
    assert.equal(apply(text, fixOf(problems[0], "Remove leading zeros")).startsWith('{"a": 1,'), true);
    assert.equal(apply(text, fixOf(problems[1], "Add leading zero")).includes('"b": 0.5'), true);
    assert.equal(apply(text, fixOf(problems[2], "Remove trailing dot")).includes('"c": 5,'), true);
    assert.equal(apply(text, fixOf(problems[3], "Remove plus sign")).includes('"d": 1,'), true);
    assert.equal(apply(text, fixOf(problems[4], "Quote the value")).endsWith('"e": "12%"}'), true);
    assert.match(problems[4].next, /12%/);
    for (const problem of problems) assert.ok(problem.fixes.some((fix) => fix.title === "Quote the value"));
  });
  test("valid numbers are never reported", () => {
    assert.deepEqual(codes('{"a": [0, -1, 1.5, 1e3, 1E-3, -0.5e+2]}'), []);
  });
  test("a bad escape such as a Windows path", () => {
    const text = '{"p": "C:\\Users\\me"}';
    const problems = analyzeJsonSyntax(text);
    assert.equal(problems.length, 1, "one problem per string");
    assert.equal(problems[0].code, "invalid-escape");
    assert.equal(slice(text, problems[0].range), "\\U");
    assert.match(problems[0].message, /`\\U` is not a JSON escape\./);
    const fixed = apply(text, fixOf(problems[0], "Double the backslashes"));
    assert.deepEqual(JSON.parse(fixed), { p: "C:\\Users\\me" });
  });
  test("a bad unicode escape has no fix, a good one is fine", () => {
    const [problem] = analyzeJsonSyntax('{"a": "\\u12"}');
    assert.equal(problem.code, "invalid-unicode");
    assert.deepEqual(problem.fixes, []);
    assert.deepEqual(codes('{"a": "\\u00e9 \\" \\\\ \\/ \\b\\f\\n\\r\\t"}'), []);
  });
  test("a tab inside a string", () => {
    const text = '{"a": "x\ty"}';
    const [problem] = analyzeJsonSyntax(text);
    assert.equal(problem.code, "control-character");
    assert.equal(problem.range.length, 1);
    assert.equal(fixOf(problem, "Replace with escape").safe, true);
    assert.deepEqual(JSON.parse(apply(text, fixOf(problem, "Replace with escape"))), { a: "x\ty" });
  });
});

describe("brackets that are never closed", () => {
  test("an object: the opener is the squiggle, the closer goes after the last property", () => {
    const text = '{\n  "slides": [\n    {"title": "a"\n  ]\n}';
    const problems = analyzeJsonSyntax(text);
    assert.equal(problems.length, 1, "the ] and } that follow are not more problems");
    const [problem] = problems;
    assert.equal(problem.code, "unclosed-object");
    assert.equal(slice(text, problem.range), "{");
    assert.equal(problem.range.line, 3);
    assert.match(problem.message, /^The `\{` on line 3 \(starting `"title": "a"`\) is never closed\.$/);
    assert.deepEqual(problem.path, ["slides", 0]);
    const fixed = apply(text, fixOf(problem, "Insert }"));
    assert.equal(fixed, '{\n  "slides": [\n    {"title": "a"}\n  ]\n}');
  });
  test("a list at the end of the text, with the object around it", () => {
    const text = '{"slides": [{"title": "a"}';
    const problems = analyzeJsonSyntax(text);
    assert.deepEqual(problems.map((problem) => problem.code), ["unclosed-object", "unclosed-array"]);
    assert.equal(slice(text, problems[1].range), "[");
    assert.match(problems[1].message, /^The list `"slides": \[` on line 1 is never closed\.$/);
    assert.equal(apply(text, fixOf(problems[1], "Insert ]")), '{"slides": [{"title": "a"}]');
    // The outer fix closes what is open inside it too, so one fix repairs the whole text.
    assert.equal(apply(text, fixOf(problems[0], "Insert ]}")), '{"slides": [{"title": "a"}]}');
  });
  test("a closer on its own line when the last property is not on the opener's line", () => {
    const text = '[\n  {\n    "title": "a",\n    "items": ["x"]\n  {\n    "title": "b"\n  }\n]';
    const problems = analyzeJsonSyntax(text);
    const unclosed = problems.find((problem) => problem.code === "unclosed-object");
    assert.equal(unclosed.range.line, 2);
    assert.equal(apply(text, fixOf(unclosed, "Insert }")), '[\n  {\n    "title": "a",\n    "items": ["x"]\n  }\n  {\n    "title": "b"\n  }\n]');
  });
  test("a dangling comma at the end is replaced by the closer", () => {
    assert.equal(apply('{"a": 1,', fixOf(analyzeJsonSyntax('{"a": 1,')[0], "Insert }")), '{"a": 1}');
  });
  test("the wrong closing bracket, with nothing to match it, is a typo for the right one", () => {
    const [problem] = analyzeJsonSyntax('{"a":1]');
    assert.equal(problem.code, "unclosed-object");
    assert.equal(apply('{"a":1]', fixOf(problem, "Replace ] with }")), '{"a":1}');
  });
  test("a closing brace where a list should end closes the list", () => {
    const text = '{"slides": [}';
    const problems = analyzeJsonSyntax(text);
    assert.deepEqual(problems.map((problem) => problem.code), ["unclosed-array"]);
    assert.equal(apply(text, fixOf(problems[0], "Insert ]")), '{"slides": []}');
  });
});

describe("the top level", () => {
  test("text after the root value", () => {
    const text = '{"a": 1}\n{"b": 2}\n';
    const problems = analyzeJsonSyntax(text);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].code, "content-after-root");
    assert.equal(problems[0].range.line, 2);
    assert.match(problems[0].message, /^Unexpected content after the closing `\}` on line 1\./);
    assert.equal(apply(text, fixOf(problems[0], "Remove the extra text")), '{"a": 1}\n');
  });
  test("an empty document, white space only, and a BOM alone", () => {
    for (const text of ["", "  \n\t ", BOM]) {
      const problems = analyzeJsonSyntax(text);
      assert.deepEqual(problems.map((problem) => problem.code), ["empty-document"], JSON.stringify(text));
      assert.equal(problems[0].message, "The document is empty.");
      const fixed = apply(text, fixOf(problems[0], "Insert minimal deck"));
      assert.deepEqual(JSON.parse(fixed), { slides: [{ title: "" }] });
      assert.equal(fixed.slice(problems[0].fixes[0].caret - 1, problems[0].fixes[0].caret + 1), '""', "the caret is in the empty title");
    }
  });
  test("an array at the top level is wrapped in slides", () => {
    const text = '[\n  {"title": "a"}\n]';
    const problems = analyzeJsonSyntax(text);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].code, "not-an-object");
    assert.equal(slice(text, problems[0].range), "[");
    assert.match(problems[0].message, /but this is an array\.$/);
    assert.deepEqual(JSON.parse(apply(text, fixOf(problems[0], 'Wrap in { "slides" ... }'))), { slides: [{ title: "a" }] });
  });
  test("a string, a number or true at the top level is not an object either", () => {
    assert.match(analyzeJsonSyntax('"hello"')[0].message, /but this is a string\.$/);
    assert.match(analyzeJsonSyntax("42")[0].message, /but this is a number\.$/);
    assert.match(analyzeJsonSyntax("true")[0].message, /but this is a boolean\.$/);
  });
  test("YAML pasted into the JSON pane is one problem, with the switch", () => {
    const text = "name: x\nslides:\n  - title: a\n";
    const problems = analyzeJsonSyntax(text);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].code, "looks-like-yaml");
    assert.match(problems[0].next, /fromYaml/);
    assert.deepEqual([problems[0].fixes[0].title, problems[0].fixes[0].action, problems[0].fixes[0].format, problems[0].fixes[0].edits], ["Switch format to YAML", "switch-format", "yaml", []]);
    assert.equal(codes("---\nname: x\n").join(), "looks-like-yaml");
  });
  test("Markdown pasted into the JSON pane is one problem, with the switch", () => {
    for (const text of ["# Title\n\nBody\n", "```json\n{}\n```", "> quote"]) {
      const problems = analyzeJsonSyntax(text);
      assert.equal(problems.length, 1, text);
      assert.equal(problems[0].code, "looks-like-markdown");
      assert.match(problems[0].next, /fromMarkdown/);
      assert.deepEqual([problems[0].fixes[0].title, problems[0].fixes[0].action, problems[0].fixes[0].format], ["Switch format to Markdown", "switch-format", "md"]);
    }
  });
  test("plain text that is neither is an unexpected start", () => {
    const [problem] = analyzeJsonSyntax("hello");
    assert.equal(problem.code, "invalid-symbol");
    assert.match(problem.message, /^Unexpected `hello` at the start/);
  });
  test("a stray symbol and an invisible space inside the document", () => {
    const [stray] = analyzeJsonSyntax('{"a": 1 @ }');
    assert.equal(stray.code, "invalid-symbol");
    const [space] = analyzeJsonSyntax('{"a":\u00A01}');
    assert.equal(space.code, "invalid-symbol");
    assert.match(space.message, /invisible or non-standard space/);
    assert.equal(apply('{"a":\u00A01}', fixOf(space, "Replace with a space")), '{"a": 1}');
  });
});

describe("text that is not what it seems", () => {
  test("a BOM is accepted and does not shift ranges", () => {
    const text = `${BOM}{"a": 1,}`;
    const [problem] = analyzeJsonSyntax(text);
    assert.equal(problem.code, "trailing-comma");
    assert.equal(slice(text, problem.range), ",");
    assert.deepEqual(analyzeJsonSyntax(`${BOM}{"a": 1}`), []);
  });
  test("CRLF and a lone CR count as one line break each", () => {
    const crlf = '{\r\n  "a": 1\r\n  "b": 2\r\n}';
    const [problem] = analyzeJsonSyntax(crlf);
    assert.deepEqual([problem.code, problem.range.line, problem.range.column], ["missing-comma", 2, 8]);
    assert.equal(apply(crlf, fixOf(problem, "Insert comma")), '{\r\n  "a": 1,\r\n  "b": 2\r\n}');
    const cr = '{\r  "a": 1\r  "b": 2\r}';
    assert.equal(analyzeJsonSyntax(cr)[0].range.line, 2);
  });
  test("any text at all is accepted", () => {
    for (const text of ["", " ", "\n", "{", "[", '"', "}", "]", ",", ":", "/*", "//", "\\", "\u0000", "\uD800", "{{{{", "[[[[[", "💥", '{"a": "💥}']) assert.doesNotThrow(() => analyzeJsonSyntax(text), JSON.stringify(text));
    assert.deepEqual(analyzeJsonSyntax(undefined), analyzeJsonSyntax(""));
  });
  test("deep nesting does not overflow", () => {
    assert.doesNotThrow(() => analyzeJsonSyntax("[".repeat(100000)));
    assert.deepEqual(analyzeJsonSyntax(`{"a":${"[".repeat(500)}${"]".repeat(500)}}`), []);
  });
  test("valid JSON has no problems; a valid top-level non-object is only not-an-object", () => {
    assert.deepEqual(analyzeJsonSyntax(JSON.stringify({ name: "x", slides: [{ title: "a", items: ["1", "2"] }] }, null, 2)), []);
    assert.deepEqual(codes("[1, 2]"), ["not-an-object"]);
  });
});

describe("many errors", () => {
  test("three independent errors in five lines are three problems, in position order", () => {
    const text = '{\n  "a": 1\n  "b": [1, 2,],\n  "c": \'x\'\n}';
    const problems = analyzeJsonSyntax(text);
    assert.deepEqual(problems.map((problem) => [problem.code, problem.range.line]), [["missing-comma", 2], ["trailing-comma", 3], ["single-quotes", 4]]);
    // Applying the first fix re-checks and reveals the rest; three fixes end it.
    const once = repairOnce(text);
    assert.deepEqual(codes(once), ["trailing-comma", "single-quotes"]);
    assert.equal(parses(repairOnce(repairOnce(once))), true);
  });
  test("at most five are returned, the first five by position; limit changes it", () => {
    const text = '{"a": [1,], "b": [2,], "c": [3,], "d": [4,], "e": [5,], "f": [6,], "g": [7,]}';
    assert.equal(analyzeJsonSyntax(text).length, 5);
    assert.deepEqual(analyzeJsonSyntax(text).map((problem) => problem.range.offset), [...analyzeJsonSyntax(text, { limit: 100 }).map((problem) => problem.range.offset)].slice(0, 5));
    assert.equal(analyzeJsonSyntax(text, { limit: 100 }).length, 7);
    assert.equal(analyzeJsonSyntax(text, { limit: 2 }).length, 2);
    assert.equal(analyzeJsonSyntax(text, { limit: 0 }).length, 0);
  });
  test("the aftershock of one mistake is not reported as more", () => {
    // A key with no value, an unclosed string, a stray colon after a comma: each is the only problem.
    assert.deepEqual(codes('{"a": 1,\n : "b": 2}'), ["invalid-symbol"]);
    assert.deepEqual(codes('{"a":\n"b": 1,\n"c": 2}'), ["missing-value"]);
    assert.deepEqual(codes('{"a": "x\n, "b": 2}'), ["unclosed-string"]);
  });
  test("problems carry the shape the editor relies on", () => {
    const text = '{\n  "a": 1\n  "b": [1, 2,],\n  "c": \'x\', "d":\n}';
    for (const problem of analyzeJsonSyntax(text, { limit: 20 })) {
      assert.equal(problem.severity, "error");
      assert.match(problem.code, /^[a-z]+(?:-[a-z]+)*$/);
      assert.ok(problem.message.length > 0 && !problem.message.includes("!"), problem.message);
      assert.ok(!/^Next:/i.test(problem.next) && problem.next.length > 0);
      assert.ok(problem.range.offset >= 0 && problem.range.offset + problem.range.length <= text.length);
      assert.ok(problem.range.line >= 1 && problem.range.column >= 1);
      for (const fix of problem.fixes) {
        assert.ok(fix.id && fix.title && typeof fix.safe === "boolean");
        assert.ok(Array.isArray(fix.edits));
        assert.doesNotThrow(() => applyTextEdits(text, fix.edits));
      }
    }
  });
});

describe("agreement with JSON.parse", () => {
  // A deterministic generator: mutate valid documents; the analyzer reports something exactly when JSON.parse throws.
  let seed = 20261022;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = (items) => items[Math.floor(random() * items.length)];
  const documents = [
    JSON.stringify({ name: "x", design: { theme: "minimal", titleAlignment: "left" }, slides: [{ title: "a", items: ["one", "two"] }, { title: "b", chart: { type: "column", data: [[1, 2], [3, 4]] } }] }, null, 2),
    '{"a":1,"b":[true,false,null],"c":{"d":"e\\n\\u00e9"}}',
    '{\r\n  "slides": [\r\n    {"title": "T", "text": "Line"}\r\n  ]\r\n}\r\n',
  ];
  const characters = ['"', "'", "{", "}", "[", "]", ",", ":", "\n", " ", "\\", "/", "*", "t", "1", ".", "-", "\t", "\u201C", "#", "\u00E9", "\u00A0"];
  test("2000 mutated documents: never throws, finds every syntax error, invents none, ranges stay in the text", () => {
    for (let round = 0; round < 2000; round++) {
      let text = pick(documents);
      for (let change = 0, count = 1 + Math.floor(random() * 3); change < count; change++) {
        const at = Math.floor(random() * (text.length + 1));
        const operation = random();
        text = operation < 0.4 ? text.slice(0, at) + text.slice(at + 1 + Math.floor(random() * 3)) : operation < 0.8 ? text.slice(0, at) + pick(characters) + text.slice(at) : text.slice(0, at) + pick(characters) + text.slice(at + 1);
      }
      const problems = analyzeJsonSyntax(text, { limit: 1000 });
      const real = problems.filter((problem) => problem.code !== "not-an-object");
      const valid = parses(text);
      assert.equal(valid, real.length === 0, `${JSON.stringify(text)}: ${problems.map((problem) => problem.code)}`);
      let previous = -1;
      for (const problem of problems) {
        assert.ok(problem.range.offset >= previous, "in position order");
        previous = problem.range.offset;
        assert.ok(problem.range.offset + problem.range.length <= text.length, JSON.stringify(text));
        for (const fix of problem.fixes) if (!fix.action) assert.doesNotThrow(() => applyTextEdits(text, fix.edits), JSON.stringify(text));
      }
    }
  });
  test("applying the first fix, again and again, repairs most broken documents", () => {
    let broken = 0;
    let repaired = 0;
    for (let round = 0; round < 1500; round++) {
      let text = documents[0];
      const at = Math.floor(random() * (text.length + 1));
      text = random() < 0.5 ? text.slice(0, at) + text.slice(at + 1) : text.slice(0, at) + pick(characters) + text.slice(at);
      if (parses(text)) continue;
      broken++;
      let current = text;
      for (let step = 0; step < 12; step++) {
        const [problem] = analyzeJsonSyntax(current, { limit: 1 });
        if (!problem) break;
        const fix = problem.fixes.find((entry) => !entry.action);
        if (!fix) break;
        current = apply(current, fix);
      }
      if (parses(current)) repaired++;
    }
    assert.ok(broken > 300, `${broken} broken documents`);
    assert.ok(repaired / broken > 0.9, `${repaired} of ${broken} repaired`);
  });
});

describe("validate(text) reports the same causes", () => {
  test("one opf/json-syntax finding per cause, with the friendly message, the hint as help and the range as location", () => {
    const text = '{\n  "name": "x",\n  "design":\n  "organization": {"name": "Acme"}\n}';
    const report = validate(text);
    assert.equal(report.valid, false);
    assert.equal(report.schemaValid, null);
    assert.equal(report.findings.length, 1);
    const [found] = report.findings;
    assert.equal(found.ruleId, "opf/json-syntax");
    assert.equal(found.severity, "error");
    assert.equal(found.message, "`design` needs a value.");
    assert.match(found.help, /an object such as \{ "theme": "minimal" \}/);
    assert.deepEqual(found.location, { offset: 19, length: 9, line: 3, column: 3 });
  });
  test("a text with syntax errors reports only syntax findings, whatever else is wrong", () => {
    const report = validate('{"slides": [{"title": 3,}], "nope": 1}');
    assert.deepEqual(report.findings.map((found) => found.ruleId), ["opf/json-syntax"]);
    assert.equal(report.findings[0].message.startsWith("Trailing comma"), true);
  });
  test("YAML and Markdown text keep the converter hint", () => {
    assert.match(validate("name: x\nslides:\n  - title: a\n").findings[0].help, /fromYaml/);
    assert.match(validate("# Title\n\nBody\n").findings[0].help, /fromMarkdown/);
    assert.doesNotMatch(validate('{"slides": [}').findings[0].help, /fromYaml|fromMarkdown/);
  });
  test("a valid text is unaffected, and an empty one is the empty-document problem", () => {
    assert.equal(validate('{"slides": [{"title": "a"}]}', { only: ["format"] }).valid, true);
    assert.equal(validate("").findings[0].message, "The document is empty.");
  });
  test("a text that is a valid array is still the schema's problem, not a syntax finding", () => {
    assert.deepEqual(validate("[1]").findings.map((found) => found.ruleId), ["opf/schema"]);
  });
});
