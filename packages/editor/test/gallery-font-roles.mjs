// FF-17 (font-fidelity-everywhere): gallery apply keeps every font-scheme
// role the record schema defines (major/minor and code).
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { loadOpfGalleryItem } from "../dist/galleries.js";
import { createEditorSession } from "../dist/index.js";

const codeSlide = {
  id: "code",
  layout: "code-1x",
  title: "Rule",
  code: { source: "const score = urgency * confidence;", language: "ts" },
};
const textSlide = { id: "text", title: "Title", text: "Body copy" };
const apply = (source, slides = [codeSlide]) =>
  loadOpfGalleryItem({
    raw: {
      opf: { name: "Gallery font scheme", design: { fontScheme: source.id ?? source.slug }, slides },
      metadata: { category: "font-schemes", source },
    },
  });
// FA-23: the item's record is embedded by id (no $schema or id) under `custom` (the item has no gallery URL here).
const attached = (presentation) => Object.values(presentation.catalogs.custom.fontSchemes)[0];
function measured(presentation, slideIndex = 0) {
  const families = new Set();
  createEditorSession(presentation).composeSlide(slideIndex, {
    fonts: {
      textMeasurement: {
        measure: (text, size, style) => {
          families.add(style.fontFamily);
          return text.length * size * 0.5;
        },
      },
    },
  });
  return families;
}

// Current pptx.gallery descriptor shape: family-name heading/body plus a code role.
const gallery = await apply({
  $schema: "https://pptx.dev/schema/opf-font-scheme/v1",
  id: "team-mono",
  name: "Team Mono",
  heading: "Inter",
  body: "Inter",
  code: "JetBrains Mono",
  accent: "Georgia",
  type: "sans-serif",
  app: "google-slides",
  languageFamily: "latin",
  headingStack: '"Inter", sans-serif',
});
assert.deepEqual(attached(gallery), {
  name: "Team Mono",
  major: "Inter",
  minor: "Inter",
  type: "sans-serif",
  app: "google-slides",
  languageFamily: "latin",
  code: "JetBrains Mono",
});
// accent is not part of the font-scheme record schema, so it is not attached.
assert.equal(validate(gallery, { only: ["format"] }).valid, true);
const galleryFamilies = measured(gallery);
assert.ok(galleryFamilies.has("JetBrains Mono"), "code keeps the gallery role");
assert.ok(!galleryFamilies.has("Roboto Mono"), "no Roboto Mono fallback");

// String heading/body map onto the pair only; code is kept as a role.
const roles = await apply(
  {
    id: "role-scheme",
    name: "Role scheme",
    heading: "Source Serif 4",
    body: "Source Sans 3",
    code: "Source Code Pro",
  },
  [textSlide, codeSlide],
);
assert.deepEqual(attached(roles), {
  name: "Role scheme",
  major: "Source Serif 4",
  minor: "Source Sans 3",
  code: "Source Code Pro",
});
assert.equal(validate(roles, { only: ["format"] }).valid, true);
assert.deepEqual([...measured(roles)].sort(), ["Source Sans 3", "Source Serif 4"]);
assert.ok(measured(roles, 1).has("Source Code Pro"));
// A later inline major/minor override on the applied scheme still wins.
roles.design.fontScheme = {
  id: "role-scheme",
  major: "Override Display",
  minor: "Override Text",
};
assert.equal(validate(roles, { only: ["format"] }).valid, true);
assert.deepEqual([...measured(roles)].sort(), ["Override Display", "Override Text"]);
assert.ok(measured(roles, 1).has("Source Code Pro"));

// Explicit major/minor win over string heading/body, and invalid values are dropped.
const explicit = await apply({
  id: "explicit-pair",
  major: "Aptos Display",
  minor: "Aptos",
  heading: "Ignored",
  body: "Ignored",
  code: 42,
  accent: { weight: 700 },
  type: "display",
});
assert.deepEqual(attached(explicit), {
  name: "explicit-pair",
  major: "Aptos Display",
  minor: "Aptos",
});

// Legacy descriptors (slug + heading/body strings) attach exactly as before.
const legacy = await apply(
  { slug: "legacy-sans", name: "Legacy Sans", heading: "Arial", body: "Arial" },
  [textSlide],
);
assert.deepEqual(attached(legacy), {
  name: "Legacy Sans",
  major: "Arial",
  minor: "Arial",
});

// The shared last-resort font scheme is covered by test/default-font-scheme.mjs (FF-35).

console.log("gallery font-scheme roles passed");
