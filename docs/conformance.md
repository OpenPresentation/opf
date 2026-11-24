# OPF conformance suite

The conformance suite is a set of OPF documents with the result a conforming tool must give for each, and a runner that
checks a tool against them and writes a report. A tool that passes a level can say so, with the report as evidence. The
suite lives in [`conformance/`](../conformance/): `manifest.json` (the levels and the cases), `core/valid/` and
`core/invalid/` (the fixtures), `run.mjs` (the runner) and `adapters/opf-core.mjs` (the reference adapter).

Status: first version (manifest format 1). The Core Reader and Core Writer levels can be run and claimed; Renderer and
Converter are planned. How claims are listed is part of the [governance](governance.md) proposal.

## Levels

| Level | Status | A tool at this level |
| --- | --- | --- |
| **Core Reader** | available | Accepts every valid core document and rejects every invalid one. |
| **Core Writer** | available | Is a Core Reader, and writes each valid document back as a valid document that keeps every `extensions` object and every id where it was. |
| **Renderer** | planned | Is a Core Reader, and draws each slide as expected: slide count, hidden slides, slide size, then reference images with a stated tolerance. |
| **Converter** | planned | Is a Core Writer, and exports to PPTX and imports it back with slide count, titles, text, notes, hidden slides and `extensions` intact. |

A level counts only together with the levels it requires: a tool that passes the Writer cases but fails the Reader
cases has passed neither.

### What the core level checks

The Reader cases cover what a tool can decide from the document alone, with no catalog registered:

- **JSON syntax:** strict JSON (RFC 8259): no comments, trailing commas, single quotes or repeated keys.
- **Schema validity:** the document is an object, field types and enumerations hold, and an unknown field is an error
  at every level (the root, a slide, a payload).
- **Required fields:** `slides` exists and holds at least one slide; each slide is an object.
- **Ids and references:** slide and payload ids are strings, unique together in the document; reference ids are unique;
  a citation, a dataset, an `asset:` reference and a `name:id` catalog prefix each resolve inside the document; groups
  nest at most 32 levels and do not mix child blocks with leaf content.
- **Extensions:** `extensions` is an object wherever it appears; tool data written next to OPF fields instead of under
  `extensions` is an error; what is inside `extensions` is opaque, so field names and ids in it are never validated or
  counted.
- **Unknown catalog records:** a layout, theme or other record the tool does not know is not an error (the reference
  validator reports it as the warning `opf/unresolved-reference`), so a reader without the default catalog still
  accepts the document.

Accessibility, layout, content and policy rules (the other categories of [`opf validate`](validate.md)) are not part of
conformance: they are advice, and a valid document can have warnings.

The Writer cases round-trip every valid document. The output must be JSON, valid by the reference validator, and keep
each `extensions` value and each id at the same JSON Pointer. A writer may normalize the rest (key order, shorthands,
added defaults); the report counts the documents that came back unchanged, for information only.

### Cases

Each case in `manifest.json` has an `id`, a `file`, the `levels` it counts for, `expect` and a `basis`: the schema
keyword or the documented rule the expectation rests on, so an implementer can check the suite against the spec.

```json
{
  "id": "core.invalid.duplicate-slide-id",
  "file": "core/invalid/duplicate-slide-id.opf.json",
  "levels": ["reader"],
  "expect": { "valid": false, "errorAt": "/slides/1/id" },
  "description": "Two slides share an id.",
  "basis": "opf.schema.json#/$defs/ContentPayload/properties/id (unique among slide and payload ids)"
}
```

`errorAt` is the JSON Pointer of the expected error. A tool that reports error paths should report one at or inside it;
the report counts how many do, but a different path never fails a case, because tools may point at a different node
for the same mistake. A group in the manifest adds every technical example deck (`examples/technical/*.opf.json`) as a
valid case, so the decks CI already validates are part of the suite. In November 2026 the suite has 76 cases: 13 valid
core documents, 31 technical examples and 32 invalid documents.

## Run it

Clone the repository at the release you target (the suite ships in releases after 0.31.0) and build it (Node 24, pnpm):

```sh
git clone https://github.com/OpenPresentation/opf && cd opf
git checkout vX.Y.Z    # a release tag, or the commit of main you test against
pnpm install
pnpm build
node conformance/run.mjs   # the reference implementation, @openpresentation/opf
```

The runner needs the built core package for the reference adapter and for checking a writer's output; your tool needs
nothing from this repository.

### A command-line tool

Give the command that checks one file, with `{file}` where the path goes. Exit code 0 means the tool accepts the
document, 1 that it rejects it, anything else is a tool error (the case fails). If the command prints JSON with
`findings` (or `errors`) carrying a JSON Pointer `path`, the report also says whether the errors were located as
expected.

```sh
node conformance/run.mjs --check-command "mytool check {file}" --name mytool --tool-version 1.4.0
node conformance/run.mjs --check-command "mytool check {file}" --write-command "mytool save {in} {out}" --name mytool --tool-version 1.4.0
```

For the Writer level, `--write-command` reads `{in}` and writes the document to `{out}`. The `opf` CLI itself passes
both levels this way:

```sh
node conformance/run.mjs --name @openpresentation/cli \
  --check-command "node packages/cli/dist/index.js validate {file} --only format,references" \
  --write-command "node packages/cli/dist/index.js convert {in} {out}"
```

### A library

Write an adapter module and pass it with `--adapter`. `check` is required; `roundTrip` adds the Writer level. Both may
be async. [`conformance/adapters/opf-core.mjs`](../conformance/adapters/opf-core.mjs) is the reference adapter.

```js
// my-adapter.mjs
import { parseDeck, serializeDeck, checkDeck } from "my-library";

export default {
  name: "my-library",
  version: "2.1.0",
  check(text) {
    const result = checkDeck(text);
    return { valid: result.ok, errors: result.errors.map((error) => ({ path: error.pointer })) };
  },
  roundTrip(text) {
    return serializeDeck(parseDeck(text));
  },
};
```

```sh
node conformance/run.mjs --adapter ./my-adapter.mjs
```

### Options and output

| Option | Meaning |
| --- | --- |
| `--level reader,writer` | The levels to run; by default every available level the tool supports |
| `--case <prefix>` | Only the cases whose id starts with the prefix, such as `core.invalid.` (a filtered run cannot support a claim) |
| `--format markdown` or `json` | What is printed: a Markdown summary (the default) or the whole report |
| `--report <file>` | Also write the JSON report to a file |
| `--name`, `--tool-version` | The tool named in the report |

The exit code is 0 when every level that ran passed, 1 when one failed and 2 for a usage error. The JSON report holds the
suite (`opfVersion`, `commit`, and `digest`, a sha256 of the manifest and every fixture), the tool, the date, the result
of each level and the result of each case (`pass`, `fail` or `error`, with a message).

## Claim a level

1. Run the unmodified suite, with no `--case` filter, from a tagged release of this repository (or a commit of `main`).
2. Every case of the level and of the levels it requires passes.
3. Publish the JSON report where your users can read it, and name the level, the OPF version and the digest, for
   example: "Passes the OPF conformance suite at Core Reader and Core Writer (OPF X.Y.Z, suite sha256 1f2e3d...)."
4. Re-run it when you release a new version of the tool or move to a new OPF release; a claim is for the versions it
   names.

A claim is self-assessed: the project does not certify tools. Say "passes the OPF conformance suite at Core Reader",
not "certified" or "official". To have the claim shown in the list of implementations, follow
[Implementations](governance.md#implementations). Anyone who finds a case a listed tool fails can report it in an issue
with the case id.

## Change the suite

- A new case is a pull request that adds the fixture and its manifest entry, with a `basis`. `pnpm check:conformance`
  (part of `pnpm test`) runs the suite against the reference implementation and fails unless every case passes and every
  fixture is listed.
- An expectation follows the spec. Changing one is a spec change and goes through the
  [change process](governance.md#how-the-spec-changes); a spec change that adds a rule adds a case for it.
- Fixtures are never edited to make a tool pass. If the reference implementation and the spec disagree, the spec wins
  and the implementation is fixed.

## Planned levels

- **Renderer.** Expected slide counts, hidden-slide handling and slide sizes for the core and example documents, then
  reference images with a stated tolerance. It will reuse the renderer's golden corpus
  (`packages/render/test/golden/`), which today holds exact hashes for one renderer rather than tolerances for any.
- **Converter.** PPTX export and import expectations: slide count, titles, text, notes, hidden slides and `extensions`
  after a round trip. It will reuse the PPTX package's conformance and round-trip tests (`packages/pptx/test/`).
- **Full validator (under discussion).** The reference rules of the `references` category that need a catalog, with the
  default catalog registered.
