// The reference adapter: @openpresentation/opf, the core package of this repository (docs/conformance.md).
//
// An adapter is a module whose default export has `name`, `version`, `check(text)` (the Reader level) and, optionally,
// `roundTrip(text)` (the Writer level). Copy this file to point the suite at a library of your own.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { parse, stringify, validate } from "@openpresentation/opf";

const require = createRequire(import.meta.url);
const { version } = JSON.parse(readFileSync(require.resolve("@openpresentation/opf/package.json"), "utf8"));

// The core document level: format and document-internal references, with no catalog registered.
const options = { only: ["format", "references"], catalogs: [] };

export default {
  name: "@openpresentation/opf",
  version,
  /** Reader: is the text a valid OPF document? `errors` (optional) are the JSON Pointer paths of the errors. */
  check(text) {
    const report = validate(text, options);
    return {
      valid: report.valid,
      errors: report.findings.filter((finding) => finding.severity === "error").map((finding) => ({ path: finding.path, rule: finding.ruleId, message: finding.message })),
    };
  },
  /** Writer: read the text and write the document back as text. */
  roundTrip(text) {
    return stringify(parse(text, { format: "json", catalogs: [] }), { format: "json" });
  },
};
