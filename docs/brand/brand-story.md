# openpresentation.org brand story

Status: **Proposed, for Michael's approval** (2026-11-04). Nothing here is approved positioning
yet. Built on Donald Miller's StoryBrand framework (SB7): the implementer is the hero, the Open
Presentation Format project is the guide. Every page of openpresentation.org, the README, release
notes and talks about the format should be traceable to this file. The people we write for are in
[`icp.md`](icp.md). Visual identity: [`README.md`](README.md) (the mark) and the site's design
system.

This is the brand of an open standard. It belongs to no vendor and sells nothing. Products built
on OPF appear on the site only as implementations (see [Implementations](#implementations)).

## Start from people

People who work with presentation files fall into three groups, and each needs the format for a
different reason:

- **Tool builders** write software that opens, edits, renders or converts decks: editors,
  converters, CMS and LMS plugins, report generators, viewers. They want a file they can parse
  without reverse-engineering a vendor's XML.
- **AI agent developers** build agents and pipelines that write and revise decks. They want a
  format a model can read and write correctly the first time, with a schema to constrain it and a
  validator to tell it what went wrong.
- **Enterprises** keep thousands of decks as records: board packs, sales material, training,
  regulated disclosures. They want those decks to outlive any vendor, tool or contract.

They work the same way: they read the spec, pin a schema, run a validator in CI, use an SDK when
one exists, and trust the project only when its governance is written down and followed. The
brand is built for that way of working: documents first, marketing never.

## The one-liner

> A slide deck is locked inside a zipped bundle of vendor XML that people can't diff, models can't
> write reliably and tools can't agree on. The Open Presentation Format is an open JSON standard
> for decks, with schemas, validators and MIT-licensed tools, so anyone can read, write, check and
> convert a presentation without asking a vendor.

Short form: **Slide decks, in plain JSON.** (The current site's hero line; keep it.)

## SB7

### 1. A character (the hero)

An engineer, architect or technical lead whose software, agent or archive has to handle slide
decks. Careful, skeptical of new formats, judged on whether the thing they ship still works next
year. They read specs before they read landing pages.

What they want, in their words: *"I need a deck format I can build on and still trust in five
years."*

### 2. Has a problem

- **External:** the only common deck format is PPTX, an opaque zip of Office Open XML. Parsing it
  is a project; writing it correctly is harder; every converter loses something; every vendor's
  editor stores its own extras. Generating decks with a model means fighting `<p:sp>` tags.
- **Internal:** they don't trust what they ship. A deck that opens in one tool breaks in another.
  An agent's output looks right until someone edits it. They can't diff a deck in review or tell
  what changed between two versions.
- **Philosophical:** a presentation is a document people write and keep, like a web page or a
  spreadsheet. It should not need one company's software to read, and its future should not
  depend on one company's roadmap.

The villain: **the opaque deck.** Binary bundles, private extensions, lossy round trips,
undocumented behavior and formats that change when a vendor decides.

### 3. And meets a guide

The Open Presentation Format project, with:

- **Empathy:** "You should be able to open a deck in a text editor, check it in CI and know what
  every field means."
- **Authority (facts only, keep them current):**
  - A published JSON Schema at a stable `$id`
    (`https://openpresentation.org/schema/opf/v1`) and 15 companion schemas for catalog records,
    validation findings and catalog indexes.
  - A local validator with stable rule ids, JSON Pointer paths and suggested fixes
    (`opf validate`, `validate()`), no network and no account.
  - Seven MIT-licensed npm packages released together at one version (0.31.0 on 2026-11-02),
    published only from CI with npm provenance.
  - A default catalog of reusable records: 30 layouts, 3 themes, 14 color schemes, 89 font
    schemes, 50 narratives, 27 chart types, 93 languages and more.
  - Rendering to SVG, PNG and PDF, export to and import from PPTX, an embeddable editor and a
    read-only MCP server, all from the same open packages.
  - A public change process: schema changes start as an issue, are labelled breaking or additive,
    and ship with a changelog entry and, when breaking, a migration note.

### 4. Who gives them a plan

**Process plan (three steps):**

1. **Read the spec.** The schema, the format card and the object reference say what a valid
   deck is.
2. **Validate locally.** Run `opf validate` or `validate()` on your files and in CI; every finding
   names a rule, a path and a fix.
3. **Build on the packages.** Render, convert, edit or serve OPF with the open libraries, or
   implement the format yourself from the schema.

**Agreement plan (what the project promises):**

- The format and the reference tools stay MIT-licensed. Always.
- No account, key, model or hosted service is needed to read, write, validate, render or convert
  a deck.
- Schema changes are proposed in public, labelled breaking or additive, and listed in the
  changelog. After 1.0, `v1` changes only in ways that keep every valid `v1` document valid.
- Your document is data: tools must preserve fields they don't understand in `extensions`.
- The spec is vendor-neutral: no implementation, the stewards' included, gets fields or
  behavior the spec does not give everyone.

### 5. And calls them to action

- **Direct:** "Read the spec" (`/spec`).
- **Transitional:** "Open the playground" (edit a real deck and watch it validate and render),
  "Validate a file" (CLI one-liner), "Connect the MCP server" for agents.
- **For enterprises and implementers:** "Propose a change" (the schema change issue template) and
  "List your implementation".

### 6. That helps them avoid failure (stakes)

- Decks that only one tool can open, and an archive that becomes unreadable when a contract ends.
- An agent that writes broken files nobody notices until a customer does.
- A converter that drops charts, notes or speaker data on every round trip.
- A format that changes under you because one vendor shipped a feature.

Use the stakes once on the homepage, plainly, never as fear.

### 7. And ends in success (transformation)

- **Success:** decks live in git, diff in review, validate in CI, render the same in every
  conforming tool, and can be generated by any model with a schema.
- **Transformation:** from *working around a vendor's file* to *building on a standard you can
  read*; from *hoping the output is valid* to *knowing, with a validator's report*.

Identity line: **"Own your decks."** (Proposed; alternative: "A deck format anyone can build on.")

## Brand script for the homepage

| Section | Copy direction |
| --- | --- |
| Hero | "Slide decks, in plain JSON." Sub: "Open Presentation Format is an open, MIT-licensed JSON standard for presentations, with schemas, a validator and tools to render, edit and convert." CTA: Read the spec · Open the playground. Beside it: a real `deck.opf.json` excerpt and the slide it renders (exists today) |
| Stakes | One line: "A .pptx file is a zip of vendor XML. You can't diff it, models can't write it reliably, and every converter loses something." |
| Value | Three outcomes: *Read it* (plain JSON, a schema at a stable URL), *Check it* (a local validator with rule ids and fixes), *Move it* (render, export to PPTX, import from PPTX, with open packages) |
| Guide | Empathy line + authority facts above, as a compact proof strip (schemas, packages, license, release) |
| Plan | The three steps, each with its one command or link |
| Before / after | The existing table: .pptx workflow vs. OPF workflow |
| For agents | "Give your agent a schema, not a screenshot": the format card, `llms.txt`, the MCP server, structured outputs guides |
| Governance | How the spec changes, who decides, the versioning promise, the changelog |
| Implementations | A neutral list of tools that read or write OPF, each with what it supports |
| Explanatory paragraph | For search: "The Open Presentation Format (OPF) is an open JSON document format for slide decks…" |
| Final CTA | Read the spec |

## Voice

- A standards body that writes like an engineer: precise, plain, calm. Say what the format does,
  what it doesn't do yet and which version a fact is true for.
- Normative words (MUST, SHOULD, MAY) only in the spec, and then exactly as RFC 2119 means them.
- Short sentences. No hype (revolutionary, seamless, AI-powered, next-generation), no superlatives
  about adoption, no logo walls.
- Every number is real, current and versioned, or absent. Every limit is stated next to the
  feature (for example, PPTX text that does not reflow unless native body text is chosen).
- Vendor-neutral: "a tool", "an implementation", "your agent"; never "our customers".

## Words we use and avoid

| Use | Avoid |
| --- | --- |
| format, specification, schema, document, deck | platform, solution, product (for OPF itself) |
| implementation, tool, reader, writer | partner, customer |
| validate, finding, rule, conform | "AI-ready", "smart" |
| open, MIT-licensed, vendor-neutral | "free forever" without the license name |
| pre-1.0, 0.31.0, `v1` line | "stable" before 1.0 |
| render, export, import, convert | "pixel-perfect", "lossless" without evidence |
| catalog record, layout, theme | "templates" for every kind of record |

## Implementations

The site lists products that read or write OPF as implementations, all in the same neutral form:
name, what it does with OPF (read, write, render, convert, host), the OPF version it targets and a
link. No implementation gets a logo, a badge or a call to action the others don't get.

- pptx.dev (hosted API, AI and file services) and storyd.ai (a business storytelling app) are
  listed this way, beside any third-party tool.
- pptx.gallery presents the default catalog; it is listed as the catalog browser.
- Sponsorship, where the site shows it, is one line of text in the footer and the one factual
  homepage note the site's design rules allow; it never appears in the spec or docs.

## Proof points to collect

- [ ] A conformance suite: a public corpus of valid and invalid documents with expected findings,
      so an implementation can say "passes the OPF 0.x conformance suite". Not built yet; no
      conformance claim until it exists.
- [ ] A written governance document (who approves spec changes, how a change is decided, how
      stewardship can move to a foundation). Today the process lives in `CONTRIBUTING.md` and the
      schema change issue template.
- [ ] Two or more independent implementations outside the stewards' own products.
- [ ] Download and dependent counts from npm, quoted with their date.
