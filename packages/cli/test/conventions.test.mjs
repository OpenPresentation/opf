// RR-75: the conventions every command shares. One output convention (an optional positional output, stdout by default, -i,
// --check), fixed flag meanings (--format for reports, --from/--to for decks, --data-format for data), one report envelope,
// errors that carry a code and state the fix ("did you mean"), help for every command, and every removed command and flag exiting 2.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
const temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-conventions-")));
after(() => rm(temp, { recursive: true, force: true }));

function run(args, { status = 0, input, cwd = temp } = {}) {
  const result = spawnSync(process.execPath, [executable, ...args], { cwd, input, encoding: "utf8", timeout: 60000, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 1500), stderr: result.stderr.slice(0, 1500) }));
  const parse = (text) => {
    try {
      return JSON.parse(text.slice(Math.max(0, text.indexOf("{"))));
    } catch {
      return undefined;
    }
  };
  return { ...result, report: parse(result.stdout), error: parse(result.stderr) };
}
const write = async (name, value) => {
  await mkdir(path.dirname(path.join(temp, name)), { recursive: true });
  await writeFile(path.join(temp, name), typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
  return name;
};
const read = (name) => readFile(path.join(temp, name), "utf8");
const deck = { name: "Conventions", slides: [{ id: "a", title: "A", layout: "title-subtitle" }, { id: "b", title: "B", text: "body" }] };
const ENVELOPE = ["command", "ok", "input", "outputs", "findings", "counts"];
const assertEnvelope = (report, command) => {
  assert.deepEqual(Object.keys(report).slice(0, 6), ENVELOPE, command);
  assert.equal(report.command, command);
  assert.equal(typeof report.ok, "boolean");
  assert.ok(Array.isArray(report.outputs) && Array.isArray(report.findings), command);
  assert.deepEqual(Object.keys(report.counts), ["error", "warning", "info"], command);
  for (const output of report.outputs) for (const key of ["file", "sha256", "bytes", "mediaType"]) assert.ok(key in output, `${command}: outputs[].${key}`);
};

describe("one output convention", () => {
  test("an optional positional output, stdout without one, -i to rewrite the input", async () => {
    await write("deck.opf.json", deck);
    const stdout = run(["embed", "deck.opf.json"]);
    assert.equal(JSON.parse(stdout.stdout).catalogs.default.source, "https://www.pptx.gallery");
    assert.equal(stdout.error.outputs[0].file, "-");
    const file = run(["embed", "deck.opf.json", "embedded.opf.json"]);
    assert.equal(file.report.outputs[0].file, path.join(temp, "embedded.opf.json"));
    assert.ok(existsSync(path.join(temp, "embedded.opf.json")));
    run(["embed", "deck.opf.json", "embedded.opf.json"], { status: 1 });
    run(["embed", "deck.opf.json", "embedded.opf.json", "--force"]);
    await write("in-place.opf.json", deck);
    const inPlace = run(["embed", "in-place.opf.json", "-i"]);
    assert.equal(inPlace.report.outputs[0].file, path.join(temp, "in-place.opf.json"));
    assert.ok(JSON.parse(await read("in-place.opf.json")).catalogs);
    // -i and --in-place are one flag, on every command that rewrites its input.
    await write("patch.json", [{ op: "replace", path: "/name", value: "Patched" }]);
    run(["edit", "in-place.opf.json", "--patch", "patch.json", "--in-place"]);
    assert.equal(JSON.parse(await read("in-place.opf.json")).name, "Patched");
    await write("p.opf.json", deck);
    run(["paginate", "p.opf.json", "-i"]);
    run(["format", "p.opf.json", "-i"]);
  });

  test("-i, --check and an output exclude each other, and stdin cannot be rewritten", async () => {
    await write("deck.opf.json", deck);
    for (const args of [
      ["embed", "deck.opf.json", "out.opf.json", "-i"],
      ["embed", "deck.opf.json", "-i", "--check"],
      ["embed", "deck.opf.json", "out.opf.json", "--check"],
      ["embed", "-", "-i"],
      ["paginate", "deck.opf.json", "-i", "--force"],
      ["edit", "deck.opf.json", "x.opf.json", "-i", "--patch", "patch.json"],
      ["ingest", "data.csv", "--as", "table", "-i"],
      ["create", "-i"],
      ["diff", "deck.opf.json", "deck.opf.json", "-i"],
    ]) {
      const result = run(args, { status: 2, input: args.includes("-") ? JSON.stringify(deck) : undefined });
      assert.ok(result.error.code, args.join(" "));
    }
    assert.equal(existsSync(path.join(temp, "out.opf.json")), false);
  });

  test("--check answers a CI question: format, embed and paginate exit 1 when they would change something, and write nothing", async () => {
    await write("self-contained.opf.json", deck);
    run(["embed", "self-contained.opf.json", "-i"]);
    const before = await read("self-contained.opf.json");
    const embedded = run(["embed", "self-contained.opf.json", "--check"]);
    assertEnvelope(embedded.report, "embed");
    assert.equal(embedded.report.ok, true);
    await write("referencing.opf.json", deck);
    const needs = run(["embed", "referencing.opf.json", "--check"], { status: 1 });
    assert.equal(needs.report.ok, false);
    assert.ok(needs.report.embed.added.length > 0);
    assert.equal(await read("self-contained.opf.json"), before);
    await write("long.opf.json", { name: "Long", slides: [{ id: "long", title: "Many items", items: Array.from({ length: 60 }, (_, index) => `Item ${index + 1} with enough words to take a line`) }] });
    const overflow = run(["paginate", "long.opf.json", "--check"], { status: 1 });
    assertEnvelope(overflow.report, "paginate");
    assert.equal(overflow.report.ok, false);
    assert.equal(overflow.report.overflow[0].slide, 1);
    assert.ok(overflow.report.overflow[0].pages > 1);
    assert.equal(overflow.report.outputs.length, 0);
    assert.equal(run(["paginate", "self-contained.opf.json", "--check"]).report.ok, true);
    await write("messy.opf.json", '{"slides":[{"title":"T"}]}');
    assert.equal(run(["format", "messy.opf.json", "--check"], { status: 1 }).report.ok, false);
  });

  test("paginate says its layout is estimated without the renderer, and how to measure", async () => {
    await write("p2.opf.json", deck);
    const result = run(["paginate", "p2.opf.json"]);
    if (result.error.layout === "measured") return; // a 0.18 renderer is installed
    assert.equal(result.error.layout, "estimated");
    assert.match(result.error.hint, /opf convert --paginate/);
    assert.match(result.error.hint, /install/);
  });

  test("an existing output is refused before any warning is printed", async () => {
    await write("fenced.opf.json", { name: "F", slides: [{ title: "A", design: { colorScheme: "forest-green" } }] });
    await write("exists.opf.md", "keep\n");
    const refused = run(["paginate", "fenced.opf.json", "exists.opf.md"], { status: 1 });
    assert.equal(refused.error.code, "output-exists");
    assert.doesNotMatch(refused.stderr, /fence/);
  });
});

describe("flag meanings", () => {
  test("--format is a report format only; --to names the form of a deck; --data-format the data", async () => {
    await write("deck.opf.json", deck);
    for (const args of [["create", "-", "--format", "yaml"], ["edit", "deck.opf.json", "--patch", "patch.json", "--format", "yaml"], ["paginate", "deck.opf.json", "--format", "md"], ["fill", "deck.opf.json", "--format", "csv"], ["ingest", "data.csv", "--as", "table", "--format", "csv"]]) {
      const failed = run(args, { status: 2 });
      assert.match(failed.error.error, /--format names a report format only/, args.join(" "));
      assert.match(failed.error.error, /--to json\|yaml\|md/, args.join(" "));
    }
    assert.match(run(["fill", "deck.opf.json", "--format", "csv"], { status: 2 }).error.error, /--data-format csv\|tsv\|json/);
    assert.match(run(["create", "-", "--to", "md"]).stdout, /^---\n/);
    assert.equal(JSON.parse(run(["validate", "deck.opf.json", "--format", "json"]).stdout).command, "validate");
    assert.match(run(["validate", "deck.opf.json", "--format", "text"]).stdout, /deck\.opf\.json: /);
    assert.match(run(["diff", "deck.opf.json", "deck.opf.json", "--format", "text"]).stdout, /No differences/);
    assert.match(run(["stats", "deck.opf.json", "--format", "text"]).stdout, /^Conventions\n/);
    assert.match(run(["doctor", "--format", "text"]).stdout, /pptx-import/);
    await write("data.tsv.txt", "Quarter\tRevenue\nQ1\t12\n");
    const ingested = run(["ingest", "data.tsv.txt", "--as", "table", "--data-format", "tsv"]);
    assert.deepEqual(JSON.parse(ingested.stdout).slides[0].table.columns, ["Quarter", "Revenue"]);
  });

  test("--from names the form of every deck input; stdin is sniffed: { or [ is JSON, else --from is required", async () => {
    const yaml = "name: Piped\nslides:\n  - title: A\n";
    for (const args of [["validate", "-"], ["stats", "-"], ["paginate", "-"], ["embed", "-"], ["edit", "-", "--patch", "patch.json"], ["format", "-"], ["doctor", "-"]]) {
      const unknown = run(args, { status: 2, input: yaml });
      assert.equal(unknown.error.code, "unknown-input-format", args.join(" "));
      assert.match(unknown.error.error, /Pass --from yaml\|md/, args.join(" "));
      run([...args, "--from", "yaml"], { input: yaml });
      run(args, { input: JSON.stringify(deck) });
    }
  });
});

describe("one report envelope", () => {
  test("every command that reports uses { command, ok, input, outputs, findings, counts }", async () => {
    await write("env.opf.json", deck);
    await write("env-patch.json", [{ op: "replace", path: "/name", value: "Env" }]);
    await write("env.csv", "Quarter,Revenue\nQ1,12\n");
    await write("env-template.opf.json", { name: "T", variables: { who: { type: "text" } }, slides: [{ id: "s", title: "Hi {{who}}" }] });
    await write("env-data.csv", "who\nAda\nBob\n");
    const reports = {
      create: run(["create", "env-created.opf.json"]).report,
      validate: run(["validate", "env.opf.json"]).report,
      convert: run(["convert", "env.opf.json", "env.opf.yaml"]).report,
      edit: run(["edit", "env.opf.json", "env-edited.opf.json", "--patch", "env-patch.json"]).report,
      format: run(["format", "env.opf.json", "env-formatted.opf.json"]).report,
      diff: run(["diff", "env.opf.json", "env-edited.opf.json", "--format", "json"]).report,
      merge: run(["merge", "env.opf.json", "env-edited.opf.json", "env.opf.json", "env-merged.opf.json"]).report,
      stats: run(["stats", "env.opf.json"]).report,
      paginate: run(["paginate", "env.opf.json", "env-paged.opf.json"]).report,
      embed: run(["embed", "env.opf.json", "env-embedded.opf.json"]).report,
      fill: run(["fill", "env-template.opf.json", "env-data.csv", "env-out/{who}.opf.json"]).report,
      ingest: run(["ingest", "env.csv", "env-ingested.opf.json", "--as", "table"]).report,
      doctor: run(["doctor", "env.opf.json"]).report,
    };
    for (const [command, report] of Object.entries(reports)) assertEnvelope(report, command);
    assert.equal(reports.create.input, null);
    assert.equal(reports.edit.input.file, path.join(temp, "env.opf.json"));
    assert.equal(reports.diff.input.length, 2);
    assert.equal(reports.merge.input.length, 3);
    assert.equal(reports.fill.input.length, 2);
    assert.deepEqual(reports.fill.outputs.map((item) => path.basename(item.file)), ["ada.opf.json", "bob.opf.json"]);
    assert.equal(reports.ingest.outputs[0].mediaType, "application/json");
    assert.equal(reports.convert.outputs[0].mediaType, "application/yaml");
    for (const report of Object.values(reports)) {
      assert.equal("dryRun" in report, false);
      assert.equal("agentSkills" in report, false);
    }
  });

  test("errors always carry code, ok: false and the command", async () => {
    await write("err.opf.json", { slides: 42 });
    for (const [args, code, status] of [
      [["validate", "missing.opf.json"], "input-not-found", 2],
      [["convert", "err.opf.json", "x.opf.md"], "invalid-document", 1],
      [["edit", "err.opf.json"], "missing-value", 2],
      [["embed", "err.opf.json"], "invalid-document", 1],
      [["catalog", "layouts", "no-such-layout"], "unknown-id", 2],
      [["schema", "nope"], "unknown-schema", 2],
      [["create", "--example", "no-such-example"], "unknown-example", 2],
    ]) {
      const failed = run(args, { status });
      assert.equal(failed.error.code, code, args.join(" "));
      assert.equal(failed.error.ok, false, args.join(" "));
      assert.equal(failed.error.command, args[0], args.join(" "));
      assert.equal(typeof failed.error.error, "string");
    }
  });
});

describe("errors that state the fix, and help for every command", () => {
  test("did you mean: commands, options, values, catalogs and examples", async () => {
    assert.match(run(["convrt"], { status: 2 }).error.error, /Did you mean opf convert\?/);
    assert.equal(run(["validte"], { status: 2 }).error.suggestion, "validate");
    const option = run(["paginate", "x.opf.json", "--chek"], { status: 2 }).error;
    assert.equal(option.code, "unknown-option");
    assert.equal(option.suggestion, "--check");
    assert.match(run(["validate", "x.json", "--format", "txt"], { status: 2 }).error.error, /Did you mean text\?/);
    assert.match(run(["catalog", "layout"], { status: 2 }).error.error, /Did you mean layouts\?/);
    assert.match(run(["catalog", "layouts", "two-colum"], { status: 2 }).error.error, /Did you mean two-column\?/);
  });

  test("a missing or extra argument names what is missing and prints the usage", () => {
    const missing = run(["convert", "deck.opf.json"], { status: 2 }).error;
    assert.equal(missing.code, "missing-argument");
    assert.match(missing.error, /needs <output>/);
    assert.match(missing.error, /opf convert <input\|-> <output\|->/);
    const extra = run(["stats", "a.json", "b.json"], { status: 2 }).error;
    assert.equal(extra.code, "extra-argument");
    assert.match(extra.error, /b\.json is extra/);
    assert.doesNotMatch(missing.error + extra.error, /Incorrect arguments/);
  });

  test("every command has --help and -h, and opf help <command>", () => {
    const commands = ["create", "validate", "convert", "edit", "format", "diff", "merge", "stats", "paginate", "embed", "fill", "ingest", "doctor", "schemas", "schema", "catalogs", "catalog", "skills"];
    const top = run(["--help"]).stdout;
    for (const command of commands) {
      assert.match(top, new RegExp(`^ {2}${command} `, "m"), command);
      const long = run([command, "--help"]).stdout;
      assert.match(long, new RegExp(`^Usage:\\n {2}opf ${command}\\b`), command);
      assert.equal(run([command, "-h"]).stdout, long, command);
      assert.equal(run(["help", command]).stdout, long, command);
    }
    assert.equal(run(["-h"]).stdout, top);
    assert.equal(run(["help", "nope"], { status: 2 }).error.code, "unknown-command");
  });
});

describe("removed in 0.18", () => {
  test("every removed command exits 2 and names its replacement", () => {
    for (const [command, replacement] of [["render", "opf convert"], ["export", "opf convert"], ["import", "opf convert"], ["from-md", "opf convert"], ["to-md", "opf convert"], ["from-yaml", "opf convert"], ["to-yaml", "opf convert"], ["import-data", "opf ingest"]]) {
      const failed = run([command, "deck.opf.json"], { status: 2 });
      assert.equal(failed.error.code, "removed-command", command);
      assert.ok(failed.error.error.includes(replacement), command);
    }
  });

  test("every removed flag exits 2 and names its replacement", async () => {
    await write("deck.opf.json", deck);
    for (const [args, replacement] of [
      [["edit", "deck.opf.json", "--patch", "patch.json", "--output", "x.json"], "last argument"],
      [["convert", "deck.opf.json", "x.pdf", "--out", "y.pdf"], "last argument"],
      [["fill", "deck.opf.json", "--out-dir", "decks"], "pattern"],
      [["fill", "deck.opf.json", "--name", "deck-{n}"], "pattern"],
      [["fill", "deck.opf.json", "--data", "data.csv"], "second argument"],
      [["validate", "-", "--input-format", "yaml"], "--from"],
      [["convert", "deck.opf.json", "x.opf.md", "--json"], "JSON already"],
      [["edit", "deck.opf.json", "--patch", "patch.json", "--dry-run"], "stdout"],
      [["create", "x.opf.json", "--from", "deck.opf.json"], "opf convert"],
      [["validate", "deck.opf.json", "--strict"], "--fail-on"],
    ]) {
      const failed = run(args, { status: 2, input: "{}" });
      assert.equal(failed.error.code, "removed-option", args.join(" "));
      assert.ok(failed.error.error.includes(replacement), `${args.join(" ")}: ${failed.error.error}`);
    }
  });
});

describe("opf create --example and opf catalog examples", () => {
  test("lists core's bundled examples and copies one", async () => {
    const examples = JSON.parse(run(["catalog", "examples"]).stdout);
    assert.ok(examples.length > 10);
    for (const key of ["slug", "name", "category", "gallery", "file"]) assert.ok(key in examples[0], key);
    const slug = examples[0].slug;
    assert.deepEqual(JSON.parse(run(["catalog", "examples", slug]).stdout).slides.length > 0, true);
    const created = run(["create", "example.opf.md", "--example", slug]);
    assert.equal(created.report.example, slug);
    assert.equal(run(["validate", "example.opf.md"]).status, 0);
    assert.equal(run(["create", "-", "--example", slug, "--title", "x"], { status: 2 }).error.code, "usage");
    const catalogs = JSON.parse(run(["catalogs"]).stdout);
    assert.equal(catalogs.find((entry) => entry.kind === "examples").count, examples.length);
  });
});

describe("small fixes", () => {
  test("an empty text report has no leading blank line", async () => {
    await write("clean.opf.json", { name: "Clean", language: "en-US", slides: [{ title: "Hello", text: "A readable slide." }] });
    const text = run(["validate", "clean.opf.json", "--format", "text"]).stdout;
    assert.match(text, /^clean\.opf\.json: 0 findings/);
  });

  test("the version is JSON with the CLI and core versions", () => {
    const version = JSON.parse(run(["--version"]).stdout);
    assert.match(version.cli, /^\d+\.\d+\.\d+/);
    assert.match(version.opf, /^\d+\.\d+\.\d+/);
  });

  test("the dead --config option is gone everywhere but validate", async () => {
    await write("deck.opf.json", deck);
    assert.equal(run(["stats", "deck.opf.json", "--config", "x.json"], { status: 2 }).error.code, "unknown-option");
    assert.ok((await readdir(temp)).length > 0);
  });
});
