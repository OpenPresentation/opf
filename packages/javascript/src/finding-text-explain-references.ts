/**
 * The hand-written `fix` and example of the rest of the format rules, the references rules and the policy rule, for `explain`
 * (`finding-text-explain.ts`). Internal module.
 */
import { type ExplainDetail, ex } from "./finding-text-explain-util.js";

const NARRATIVE = { name: "Arc", beats: [{ id: "hook", name: "Hook" }, { id: "proof", name: "Proof" }] };
const GALLERY_LAYOUT = { name: "Mine", regions: [{ name: "title" }] };
const DATA = { columns: ["Quarter", "Revenue"], rows: [["Q1", 12]] };

export const REFERENCES_EXPLAIN: Readonly<Record<string, ExplainDetail>> = {
  "opf/run-color-unrecognized": ex(
    "Write a hex color (`#1F4E79`), a color scheme name (`accent1`, `text`) or a `var:` reference to a declared color variable.",
    { title: "Results", text: [{ text: "Up", color: "accnt1" }] },
    { title: "Results", text: [{ text: "Up", color: "accent1" }] },
  ),
  "opf/numbering-start-ignored": ex(
    "Add `numbering` to the list, or remove `start`. A start number only matters on a numbered list.",
    { title: "Steps", items: [{ text: "Third step", start: 3 }] },
    { title: "Steps", numbering: "decimal", items: [{ text: "Third step", start: 3 }] },
  ),
  "opf/slide-size-out-of-range": ex(
    "Use a custom `widthInches` and `heightInches` between 1 and 56, or a preset size.",
    { design: { dimensions: { widthInches: 0.5, heightInches: 60 } }, slides: [{ title: "Poster" }] },
    { design: { dimensions: { widthInches: 13.333, heightInches: 7.5 } }, slides: [{ title: "Poster" }] },
  ),
  "opf/undeclared-catalog": ex(
    "Declare the catalog group under `catalogs` (with its source), or write the reference without the group prefix.",
    { slides: [{ title: "Welcome", layout: "acme:hero" }] },
    { slides: [{ title: "Welcome", layout: "hero" }] },
  ),
  "opf/asset-reference": ex(
    "Add the asset to `assets` under that id, or name an asset that exists. External files and URLs are never fetched.",
    { assets: { logo: { src: "https://example.com/logo.png", alt: "Acme logo" } }, slides: [{ title: "Welcome", image: "asset:lgog" }] },
    { assets: { logo: { src: "https://example.com/logo.png", alt: "Acme logo" } }, slides: [{ title: "Welcome", image: "asset:logo" }] },
  ),
  "opf/asset-cycle": ex(
    "Give one asset in the loop a real source (an https:// address or embedded data) instead of an `asset:` reference to the next one.",
    { assets: { a: "asset:b", b: "asset:a" }, slides: [{ title: "Welcome", image: "asset:a" }] },
    { assets: { a: "asset:b", b: { src: "https://example.com/b.png", alt: "Team" } }, slides: [{ title: "Welcome", image: "asset:a" }] },
  ),
  "opf/catalog-record": ex(
    "Fix the record the way the message says (it names the field and what it should be). References to an invalid record are reported too until it is valid.",
    { catalogs: { custom: { themes: { mine: { name: "Mine", background: "light1" } } } }, slides: [{ title: "Welcome" }] },
    { catalogs: { custom: { themes: { mine: { name: "Mine", background: { type: "theme", slot: "light1" } } } } }, slides: [{ title: "Welcome" }] },
  ),
  "opf/layout-template": ex(
    "Correct the region list: 1 to 12 entries, a `direction` of `row` or `column`, numeric sizes above 0 (or `auto` only in a column), and at most three levels of splits.",
    { catalogs: { custom: { layouts: { mine: { name: "Mine", direction: "row", regions: [{ name: "title" }, { name: "a", accepts: ["text"], size: "auto" }, { name: "b", accepts: ["text"] }] } } } }, slides: [{ title: "Welcome", layout: "mine" }] },
    { catalogs: { custom: { layouts: { mine: { name: "Mine", regions: [{ name: "title" }, { name: "a", accepts: ["text"], size: "auto" }, { name: "b", accepts: ["text"] }] } } } }, slides: [{ title: "Welcome", layout: "mine" }] },
  ),
  "opf/layout-region": ex(
    "Name each body region with a unique lowercase id that is not reserved (`title`, `subtitle`, `tag`, `auto`, `left`, `center`, `right`, `top`, `middle`, `bottom`), and give it something to accept.",
    { catalogs: { custom: { layouts: { mine: { name: "Mine", regions: [{ name: "title" }, { name: "left", accepts: ["text"] }] } } } }, slides: [{ title: "Welcome", layout: "mine" }] },
    { catalogs: { custom: { layouts: { mine: { name: "Mine", regions: [{ name: "title" }, { name: "body", accepts: ["text"] }] } } } }, slides: [{ title: "Welcome", layout: "mine" }] },
  ),
  "opf/unresolved-reference": ex(
    "Choose an id the catalog has (the finding lists the nearest), embed the record under `catalogs.custom`, register the catalog that defines it, or remove the reference.",
    { slides: [{ title: "Pillars", layout: "pilars" }] },
    { slides: [{ title: "Pillars", layout: "pillars" }] },
  ),
  "opf/catalog-record-not-in-source": ex(
    "Move the record to `catalogs.custom` (and drop the group prefix from its references), or use an id the catalog publishes.",
    { catalogs: { default: { source: "https://www.pptx.gallery", layouts: { "my-special": GALLERY_LAYOUT } } }, slides: [{ title: "Welcome", layout: "my-special" }] },
    { catalogs: { custom: { layouts: { "my-special": GALLERY_LAYOUT } } }, slides: [{ title: "Welcome", layout: "my-special" }] },
  ),
  "opf/unused-reference": ex(
    "Cite the reference from a text, bullet or list item, or remove it. Nothing is drawn for a reference nobody cites.",
    { references: [{ id: "gartner", text: "Gartner, 2026" }], slides: [{ title: "Market", text: "Up 12%" }] },
    { references: [{ id: "gartner", text: "Gartner, 2026" }], slides: [{ title: "Market", text: [{ text: "Up 12%", cite: "gartner" }] }] },
  ),
  "opf/unused-dataset": ex(
    "Point a chart or table at the dataset with `dataset`, or remove it.",
    { datasets: { sales: DATA }, slides: [{ title: "Revenue", text: "Up 12%" }] },
    { datasets: { sales: DATA }, slides: [{ title: "Revenue", chart: { type: "column", alt: "Revenue", data: { dataset: "sales" } } }] },
  ),
  "opf/unknown-beat": ex(
    "Use one of the narrative's beat ids, add the beat to the narrative record, or remove the `beat` link.",
    { narrative: "arc", catalogs: { custom: { narratives: { arc: NARRATIVE } } }, slides: [{ title: "Intro", beat: "intro" }] },
    { narrative: "arc", catalogs: { custom: { narratives: { arc: NARRATIVE } } }, slides: [{ title: "Intro", beat: "hook" }] },
  ),
  "opf/slide-theme-dimensions": ex(
    "Set `design.dimensions` on the deck, or give every slide's theme the same dimensions. A PPTX has one slide size.",
    { design: { theme: "minimal" }, catalogs: { custom: { themes: { "wide-a4": { name: "A4", dimensions: "a4" } } } }, slides: [{ title: "Letter", design: { theme: "wide-a4" } }] },
    { design: { theme: "minimal", dimensions: "a4" }, catalogs: { custom: { themes: { "wide-a4": { name: "A4", dimensions: "a4" } } } }, slides: [{ title: "Letter", design: { theme: "wide-a4" } }] },
  ),
  "opf/variable-unknown": ex(
    "Declare the variable under `variables`, correct the name, or write `\\{{` for literal braces.",
    { variables: { name: { type: "text", value: "Acme" } }, slides: [{ title: "Hello {{nmae}}" }] },
    { variables: { name: { type: "text", value: "Acme" } }, slides: [{ title: "Hello {{name}}" }] },
  ),
  "opf/variable-unknown-value": ex(
    "Declare the variable the value belongs to under `variables`, or drop the value. The values are what a host passes when it fills the deck (`validate` option `values`, `opf fill`); one for an undeclared variable is ignored.",
    { values: { name: "Acme", nope: 1 } },
    { values: { name: "Acme" } },
  ),
  "opf/variable-unused": ex(
    "Use the variable as `{{id}}` or `var:id` where it belongs, or remove its declaration.",
    { variables: { client: { type: "text", value: "Acme" } }, slides: [{ title: "Proposal" }] },
    { variables: { client: { type: "text", value: "Acme" } }, slides: [{ title: "Proposal for {{client}}" }] },
  ),
  "opf/variable-reference-unknown": ex(
    "Declare the color variable under `variables`, or use another color. Until then a default color is drawn.",
    { slides: [{ title: "Results", text: [{ text: "Up", color: "var:brand" }] }] },
    { variables: { brand: { type: "color", value: "#1F4E79" } }, slides: [{ title: "Results", text: [{ text: "Up", color: "var:brand" }] }] },
  ),
  "opf/contract": ex(
    "Change the value to one the host's policy allows (the finding lists them), or ask the host to widen the policy.",
    { slides: [{ title: "Welcome", layout: "cover" }] },
    { slides: [{ title: "Welcome", layout: "text" }] },
  ),
};
