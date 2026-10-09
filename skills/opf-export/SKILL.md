---
name: opf-export
description: "Render OPF in a browser or export OPF to SVG, PNG, PDF, and PPTX; inspect PPTX imports. Use for font/asset fidelity, reproducible output, and distinguishing schema validity from visual/export parity."
license: MIT
---

# Preview and export OPF

Start with a validated OPF document and the output formats the user requested. Preserve OPF as the editable source. Read [rendering and conversion](references/rendering.md) for the concrete local APIs and environment boundaries.

## Files: `convert`, from code or the shell

One call turns a file into another, the formats named by the file names. In a Node application or script use core's `@openpresentation/opf` (in a browser or worker the file functions reject with `node-only`); from a shell, `opf convert` runs the same code:

```js
import * as opf from '@openpresentation/opf';

await opf.convert('deck.opf.md', 'deck.pdf');
await opf.convert('deck.opf.md', 'slides/deck.png', { slides: '1-3', scale: 2 }); // slides/deck-001.png, -002, -003
await opf.convert('deck.pptx', 'deck.opf.yaml');      // import; the result's findings say what the import could not keep
const deck = await opf.open('deck.opf.md');            // the presentation (a .pptx path or bytes is imported)
await opf.save(deck, 'deck.opf.yaml');
const { files, findings } = await opf.convert(deck, { format: 'pptx' }); // bytes, nothing written
```

```sh
opf convert deck.opf.md deck.pdf
opf convert deck.pptx deck.opf.yaml
```

Inputs: `.pptx` (or its bytes), `.opf.md`, `.yaml`/`.yml`, `.json`, or a deck object. Outputs: `.pdf`, `.pptx`, `.png` and `.svg` (one file per slide beside the output; one selected slide is written to the output itself), `.zip` (the slides; `format: 'svg'` for SVG), and the deck forms. Options are the flags of `opf export` in camel case: `slides`, `includeHidden`, `paginate`, `scale`, `raster`, `text` (`fonts`, `system` or `paths`), `charts` (`auto`, `native` or `picture`), `provenance`, `images`, `date`, `catalogs`, `fonts` (a handle, or a folder or list of folders), `assetDir`, `signals`, `overwrite`, and for output without a path `zip` and `name`. It is deterministic: bundled open fonts (prepared once per process), no system fonts, no network, no clock (pass `date` for a date field); local images resolve next to the input file. Every file is produced before any is written, atomically; `convert` replaces an existing output (`overwrite: false` refuses), while the commands refuse one without `--force`. `@openpresentation/opf-render` and `@openpresentation/opf-pptx` are optional peers, installed as needed; a missing one throws `OPFExportError` or `OPFImportError` with `code` `peer-not-installed` and the install command (the command exits 2). Read `findings` (`import/`, `render/`, `pptx/`, `pdf/`, `fonts/` rules) as the evidence; an invalid deck throws `invalid-presentation` with located findings. Reference: [files in Node](references/rendering.md#files-in-node).

`opf render`, `opf export` and `opf import` remain for stdin and stdout and per-command control; they print the `opf validate` report shape with `outputs`, and `--fail-on warning` fails on warnings. Use the engine APIs below when you need your own fonts handle, a browser preview or an option `convert` does not expose.

## Establish the rendering inputs

Use coordinated versions of `@openpresentation/opf`, `opf-render`, and `opf-pptx`. The repository's preview tarballs can contain APIs absent from published packages. Determine the actual installed exports before using them.

Resolve design, dimensions, catalog records, assets, and required font faces. Pass the catalogs the host registered (`{ catalogs }`) to every engine, or embed the records first (`embed`); nothing fetches a catalog, and a strict export fails on a reference that resolves nowhere. SVG accepts embedded raster data or an explicit host image resolver; PPTX has a separate resolver contract and may require different handling. Resolve only the resources needed for the user's task. Do not treat a resource URL as authorization to upload the deck elsewhere.

Pass the same text measurement provider to preview and PPTX export. Use identical pinned font files in the browser and measurement engine. Rendering a named family without loading its bytes can silently substitute fonts and change line breaks.

## Ship fonts as pinned, licensed files

Font bytes come from pinned packages or vendored files with a recorded hash, never from a font CDN at runtime. A stylesheet, import or preconnect hint that points at Google Fonts, Typekit, Bunny Fonts or a similar service hands every viewer's IP address to a third party (a German court treated that as a privacy violation in 2022), and it ties previews and audits to the network and to whatever the CDN serves that day. A build step that downloads a font once and then serves it from your own origin is fine; confirm the built output makes no font requests.

Before bundling a family, open the license file that ships with the font files and confirm it grants exactly one of OFL-1.1, Apache-2.0, MIT or UFL-1.0. Refuse GPL-family, proprietary and unclear-provenance fonts, and do not trust the source site's label. For each bundled face record the SPDX id, any Reserved Font Name, the source URL, the package and exact version, and the sha256. A Reserved Font Name only stops a modified version (subset, instance, converted copy) from using the reserved name in its name. If the family or file name you would serve contains the reserved name, ship only the copyright holder's own unmodified file and record the pinned upstream URL and matching hash; if it does not (a subset named differently from the reserved name), a modified copy is fine. Read the font's upstream license file, since a package can omit the line, and treat a notice you cannot parse as a failure rather than as no reserved name.

## Verify what the user will receive

Collect path-specific diagnostics, inspect rendered slides, and check requested exports. Use explicit pagination before preview/export when needed, and export those exact pages. Shared geometry does not guarantee identical pixels in browsers and PowerPoint.

Do not describe successful serialization as complete fidelity. Rich-text shaping, advanced chart variants, video playback, automatic branding placement, and external assets have known limitations in the current ecosystem. Native PPTX font names and line breaks do not mean font binaries are embedded. Describe substitutions or unsupported visuals that affect the requested deck.

Font policy (owner decisions, 2026-09-29; canonical text in `docs/font-fidelity.md` of the core repository): the user's selected font is the source of truth, and license-restricted (proprietary) fonts are never bundled or embedded. Previews, SVG and the editor draw an open look-alike that should look similar and be metric-compatible, so text takes the same size and wraps as in PowerPoint (Calibri as Carlito). Aptos, Aptos Display, Aptos Narrow and Aptos Serif preview as Intos (metric-compatible, in the opf-render office pack). Where no metric-compatible replacement exists yet, a visual-only look-alike is a documented fallback and a known layout-fidelity gap, not the end state. PPTX export always writes the selected name (for example `typeface="Aptos"`), never the replacement, so PowerPoint opens the file and shows the actual font. Only open fonts may be embedded, through the explicit embed path. Selected-name export is on opf-pptx main; published opf-pptx 0.9.1 still writes the substitute, so check the installed version before promising it.

PPTX import is a conversion with limitations, not an assurance of lossless round-trip for arbitrary Office files. Validate and inspect the imported OPF and retain the original when making a derivative artifact.

Prefer new output paths while developing a conversion; follow the user's explicit overwrite preferences. Creating a local export does not include publishing or sending it.
