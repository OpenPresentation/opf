import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import { CliError } from "../client.js";
import { info, printJson } from "../output.js";

/**
 * `pptx fmt` normalizes OPF JSON locally — sorts top-level keys into a
 * canonical order and pretty-prints at 2-space indent. It never mutates
 * semantics, just formatting, so it can run offline without an API key.
 */
export function fmtCommand(): Command {
  return new Command("fmt")
    .description("Format/normalize an OPF JSON document (local, no API call)")
    .argument("<file>", "Path to an OPF JSON file")
    .option("-w, --write", "Write the formatted output back to the file")
    .option("--check", "Exit 1 if the file is not already formatted")
    .action((file: string, opts: { write?: boolean; check?: boolean }) => {
      const path = resolve(file);
      let raw: string;
      try {
        raw = readFileSync(path, "utf8");
      } catch (err) {
        throw new CliError(
          `Could not read ${file}: ${err instanceof Error ? err.message : String(err)}`,
          2,
        );
      }
      let doc: Record<string, unknown>;
      try {
        doc = JSON.parse(raw) as Record<string, unknown>;
      } catch (err) {
        throw new CliError(
          `${file} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
          2,
        );
      }

      const formatted = `${JSON.stringify(canonicalize(doc), null, 2)}\n`;

      if (opts.check) {
        if (raw !== formatted) {
          throw new CliError(`${file} is not formatted. Run \`pptx fmt -w ${file}\`.`, 1);
        }
        info(`ok — ${file}`);
        return;
      }

      if (opts.write) {
        writeFileSync(path, formatted);
        info(`formatted ${file}`);
        return;
      }

      printJson(canonicalize(doc));
    });
}

const TOP_LEVEL_ORDER = [
  "$schema",
  "meta",
  "design",
  "slides",
  "presenterGuide",
  "extensions",
];

function canonicalize(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of TOP_LEVEL_ORDER) {
    if (key in doc) out[key] = doc[key];
  }
  for (const [key, value] of Object.entries(doc)) {
    if (!(key in out)) out[key] = value;
  }
  return out;
}
