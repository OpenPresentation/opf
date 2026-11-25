// FR-11: an unknown key with no close known key says which OPF release the validator is; a typo keeps its "Did you mean".
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

import { validate } from "../dist/index.js";

const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const additional = (document) => validate(document, { only: ["format"] }).findings.filter((found) => found.validation?.keyword === "additionalProperties");

describe("unknown key and the validator's version", () => {
  test("no close key: the help names the package's own version, and the version is data", () => {
    const [found] = additional({ slides: [{ title: "a", locked: true }] });
    assert.equal(found.path, "/slides/0/locked");
    assert.equal(found.suggestions, undefined);
    assert.ok(found.help.startsWith(`"locked" is not a field of this object. This validator is OPF ${version}; a later OPF release may define it.`), found.help);
    assert.equal(found.validation.params.validatorVersion, version);
    assert.equal(found.validation.params.additionalProperty, "locked");
  });
  test("a typo with a suggestion keeps today's help and carries no version", () => {
    const [found] = additional({ slids: [] });
    assert.equal(found.suggestions[0].value, "slides");
    assert.match(found.help, /^Did you mean "slides"\?/);
    assert.doesNotMatch(found.help, /This validator is OPF/);
    assert.equal(found.validation.params.validatorVersion, undefined);
  });
  test("other findings are unchanged", () => {
    const found = validate({ slides: "x" }, { only: ["format"] }).findings.find((entry) => entry.ruleId === "opf/schema" && entry.validation?.keyword !== "additionalProperties");
    assert.ok(found);
    assert.doesNotMatch(found.help ?? "", /This validator is OPF/);
  });
});
