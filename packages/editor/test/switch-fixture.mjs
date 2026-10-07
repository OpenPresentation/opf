// Shared fixture for the FF-16 dimension-switch tests (switches.mjs, switches-export.mjs).
// One case per pptx.gallery dimension, with the exact patch the switch must produce.

// The slide sizes (the schema's DimensionPreset) and each one's composed canvas in px (96 per inch)
// and exported slide size in EMU (914400 per inch), as core and opf-pptx produce them.
export const SLIDE_SIZES = {
  "16:9": { width: 1280, height: 720, cx: 12192000, cy: 6858000 },
  "4:3": { width: 960, height: 720, cx: 9144000, cy: 6858000 },
  "16:10": { width: 960, height: 600, cx: 9144000, cy: 5715000 },
  "1:1": { width: 720, height: 720, cx: 6858000, cy: 6858000 },
  "4:5": { width: 720, height: 900, cx: 6858000, cy: 8572500 },
  "9:16": { width: 720, height: 1280, cx: 6858000, cy: 12192000 },
  letter: { width: 1056, height: 816, cx: 10058400, cy: 7772400 },
  a4: { width: 1122.24, height: 793.92, cx: 10689336, cy: 7562088 },
  widescreen: { width: 1280, height: 720, cx: 12192000, cy: 6858000 },
  standard: { width: 960, height: 720, cx: 9144000, cy: 6858000 },
};

// gallery-support.md sectionAnchors, in order. The editor must cover every one.
export const GALLERY_DIMENSIONS = [
  "layouts",
  "color-schemes",
  "font-schemes",
  "languages",
  "backgrounds",
  "narratives",
  "charts",
  "themes",
  "audiences",
  "tones",
  "socials",
  "headers-footers",
  "blocks",
  "image-treatments",
];

// RR-41: the document-level dimensions the gallery does not page yet, switched the same way.
export const EXTRA_DIMENSIONS = ["slide-sizes", "purposes"];

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const baseDeck = () => ({
  name: "Switch fixture",
  design: { theme: "minimal", fontScheme: "aptos", colorScheme: "cool-horizon" },
  language: "english",
  narrative: "problem-solution",
  tone: "formal",
  audience: ["executive"],
  speaker: { id: "alice", name: "Alice Chen" },
  organization: { id: "acme", name: "Acme" },
  assets: { cover: PIXEL },
  slides: [
    { id: "title", layout: "title-subtitle", title: "Quarterly review", subtitle: "Switch fixture" },
    {
      id: "chart",
      layout: "chart-1x",
      title: "Revenue",
      chart: { type: "column", data: { columns: ["Series", "Q1", "Q2", "Q3"], rows: [["Revenue", 12, 19, 27]] } },
    },
    { id: "blocks", layout: "text-1x", title: "Blocks", blocks: [{ text: "One" }, { items: ["First", "Second"] }] },
  ],
});

const header = { left: { text: "Brand" }, right: { slideNumber: true } };
const footer = { center: { text: "Confidential" } };

// `patches` is the exact patch for the fixture; `slide` is the slide whose preview must react.
// `preview` says how the shared SVG preview changes: "svg" (different output), "metadata"
// (authoring metadata; the SVG is deliberately identical), "image" (needs slide-image support
// in the installed renderer) or "language" (a renderer with the FF-19 language model marks the
// SVG lang; an older one draws the same SVG).
export const cases = [
  {
    dimension: "layouts",
    value: "text-2x",
    options: { slideIndex: 0 },
    slide: 0,
    preview: "svg",
    // Populating the declared placeholders replaces the slide in one operation.
    check: (presentation) => {
      assertEqual(presentation.slides[0].layout, "text-2x");
      assertEqual(presentation.slides[0].title, "Quarterly review");
      assertEqual(presentation.slides[0].blocks.length, 2);
    },
    patchPaths: ["/slides/0"],
  },
  {
    dimension: "color-schemes",
    value: "forest-green",
    options: {},
    slide: 0,
    preview: "svg",
    patches: [{ op: "replace", path: "/design/colorScheme", value: "forest-green" }],
  },
  {
    dimension: "font-schemes",
    value: "georgia",
    options: {},
    slide: 0,
    preview: "svg",
    patches: [{ op: "replace", path: "/design/fontScheme", value: "georgia" }],
    fonts: { heading: "Georgia", body: "Georgia" },
  },
  {
    dimension: "languages",
    value: "japanese",
    options: {},
    slide: 0,
    preview: "language",
    patches: [{ op: "replace", path: "/language", value: "japanese" }],
  },
  {
    dimension: "backgrounds",
    value: { type: "solid", color: "#FFEEEE" },
    options: {},
    slide: 0,
    preview: "svg",
    patches: [{ op: "add", path: "/design/background", value: { type: "solid", color: "#FFEEEE" } }],
  },
  {
    dimension: "narratives",
    value: "scqa",
    options: {},
    slide: 0,
    preview: "metadata",
    patches: [{ op: "replace", path: "/narrative", value: "scqa" }],
  },
  {
    dimension: "charts",
    value: "line",
    options: { slideIndex: 1 },
    slide: 1,
    preview: "svg",
    patches: [{ op: "replace", path: "/slides/1/chart/type", value: "line" }],
  },
  {
    dimension: "themes",
    value: "classic",
    options: {},
    slide: 0,
    preview: "svg",
    // The theme bundle is written explicitly, as the gallery's theme snippet does. Classic's
    // color scheme equals the deck's, so that key needs no patch.
    patches: [
      { op: "replace", path: "/design/theme", value: "classic" },
      { op: "replace", path: "/design/fontScheme", value: "tenorite" },
      { op: "add", path: "/design/background", value: { type: "theme", slot: "light1" } },
      { op: "add", path: "/design/dimensions", value: "widescreen" },
    ],
    fonts: { heading: "Tenorite Display", body: "Tenorite" },
  },
  {
    dimension: "audiences",
    value: ["board"],
    options: {},
    slide: 0,
    preview: "metadata",
    patches: [{ op: "replace", path: "/audience", value: ["board"] }],
  },
  {
    dimension: "tones",
    value: "casual",
    options: {},
    slide: 0,
    preview: "metadata",
    patches: [{ op: "replace", path: "/tone", value: "casual" }],
  },
  {
    dimension: "socials",
    value: { platform: "linkedin", handle: "alice-chen" },
    options: {},
    slide: 0,
    preview: "metadata",
    patches: [{ op: "add", path: "/speaker/socials", value: { linkedin: "alice-chen" } }],
  },
  {
    dimension: "headers-footers",
    value: { header, footer },
    options: {},
    slide: 0,
    preview: "svg",
    patches: [
      { op: "add", path: "/design/header", value: header },
      { op: "add", path: "/design/footer", value: footer },
    ],
  },
  {
    dimension: "blocks",
    value: "chart",
    options: { path: "slides.2.blocks.0" },
    slide: 2,
    preview: "svg",
    patchPaths: ["/slides/2/blocks/0", "/slides/2/blocks/0"],
    check: (presentation) => {
      assertEqual(Object.keys(presentation.slides[2].blocks[0]).join(), "chart");
      assertEqual(presentation.slides[2].blocks[1].items.length, 2);
    },
  },
  {
    dimension: "image-treatments",
    value: { slideImage: { src: "asset:cover", position: "right" }, imageFill: "crop" },
    // A deck-level slide image only reaches layouts that declare one, so the preview case is
    // slide-scoped. The deck-level patch is asserted in switches.mjs.
    options: { slideIndex: 0 },
    slide: 0,
    preview: "image",
    patches: [{ op: "add", path: "/slides/0/design", value: { slideImage: { src: "asset:cover", position: "right" }, imageFill: "crop" } }],
  },
  {
    dimension: "slide-sizes",
    value: "4:3",
    options: {},
    slide: 0,
    preview: "svg",
    patches: [{ op: "add", path: "/design/dimensions", value: "4:3" }],
  },
  {
    dimension: "purposes",
    value: "decide",
    options: {},
    slide: 0,
    preview: "metadata",
    patches: [{ op: "add", path: "/purpose", value: "decide" }],
  },
];

function assertEqual(actual, expected) {
  if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
