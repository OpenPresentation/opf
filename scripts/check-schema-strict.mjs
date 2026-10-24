/**
 * The published schemas (spec/schemas, served at openpresentation.org/schema/...) must compile under Ajv in strict mode with
 * no `addKeyword`: anyone validating OPF with Ajv or ajv-cli, whose default is strict, gets no "unknown keyword" error.
 * Metadata that is not JSON Schema (the catalog kind of a reference field) lives in core (packages/javascript/src/
 * schema-catalog-kinds.ts), never in a schema file.
 *
 * Every *.schema.json is added to one Ajv (draft 2020-12, ajv-formats) and compiled with `strictSchema` and `strictNumbers` on, the
 * part of strict mode that rejects an unknown keyword (and any other unknown or ignored schema construct); any compile error, and
 * any warning Ajv logs, fails. The three lint options on top of that stay at what Ajv's own default does with them, because
 * they flag standard JSON Schema rather than unknown keywords: `strictTypes` only logs on a `required` or a union `type`
 * without a `type: object`, `strictTuples` only logs, and `strictRequired` is off (it rejects the usual
 * `anyOf: [{required: ["id"]}, {required: ["name"]}]` idiom). What the default would log is not this check's business.
 */
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../packages/javascript/package.json", import.meta.url));
const Ajv = require("ajv/dist/2020.js").default;
const addFormats = require("ajv-formats").default;

export async function checkSchemaStrict({ schemaRoot = path.join(root, "spec/schemas") } = {}) {
  const failures = [];
  const log = (...message) => failures.push(`Ajv warned: ${message.join(" ")}`);
  const ajv = new Ajv({ strictSchema: true, strictNumbers: true, strictTypes: false, strictTuples: false, strictRequired: false, allErrors: true, logger: { log, warn: log, error: log } });
  addFormats(ajv);
  const files = (await readdir(schemaRoot)).filter((file) => file.endsWith(".schema.json")).sort();
  const schemas = [];
  for (const file of files) {
    const schema = JSON.parse(await readFile(path.join(schemaRoot, file), "utf8"));
    schemas.push([file, schema]);
    try {
      ajv.addSchema(schema);
    } catch (error) {
      failures.push(`${file}: ${error.message}`);
    }
  }
  for (const [file, schema] of schemas) {
    try {
      ajv.getSchema(schema.$id) ?? failures.push(`${file}: no schema was added under ${schema.$id}`);
    } catch (error) {
      failures.push(`${file}: ${error.message}`);
    }
  }
  return { valid: failures.length === 0, schemas: schemas.length, failures };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await checkSchemaStrict();
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) {
    console.error("A published schema does not compile under strict Ajv. Keep non-JSON-Schema metadata out of spec/schemas (see packages/javascript/src/schema-catalog-kinds.ts).");
    process.exitCode = 1;
  }
}
