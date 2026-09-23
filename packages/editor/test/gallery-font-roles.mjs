// FF-17 (font-fidelity-everywhere): gallery apply keeps every font-scheme
// role the record schema defines (major/minor and code), and the editor's last-resort
// font scheme stays pinned (see opf docs/design-resolution.md).
import assert from "node:assert/strict";
import { validatePresentation } from "@openpresentation/opf";
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
const attached = (document) => document.catalogs.fontSchemes.records[0];
function measured(document, slideIndex = 0) {
  const families = new Set();
  createEditorSession(document).composeSlide(slideIndex, {
    textMeasurement: {
      measure: (text, size, style) => {
        families.add(style.fontFamily);
        return text.length * size * 0.5;
      },
    },
  });
  return families;
}

// Current pptx.gallery descriptor shape: string heading/body plus a code role.
const gallery = await apply({
  $schema: "https://pptx.dev/schema/opf-font-scheme/v1",
  id: "team-mono",
  name: "Team Mono",
  heading: "Inter",
  body: "Inter",
  code: { family: "JetBrains Mono", weight: 400, bogus: true },
  accent: "Georgia",
  type: "sans-serif",
  app: "Google Slides",
  languageFamily: "latin",
  headingStack: '"Inter", sans-serif',
});
assert.deepEqual(attached(gallery), {
  $schema: "https://openpresentation.org/schema/opf-font-scheme/v1",
  id: "team-mono",
  name: "Team Mono",
  major: "Inter",
  minor: "Inter",
  type: "sans-serif",
  app: "Google Slides",
  languageFamily: "latin",
  code: { family: "JetBrains Mono", weight: 400 },
});
// accent is not part of the font-scheme record schema, so it is not attached.
assert.equal(validatePresentation(gallery).valid, true);
const galleryFamilies = measured(gallery);
assert.ok(galleryFamilies.has("JetBrains Mono"), "code keeps the gallery role");
assert.ok(!galleryFamilies.has("Roboto Mono"), "no Roboto Mono fallback");

// Font-object heading/body map onto the pair only; code is kept as a role.
const roles = await apply(
  {
    id: "role-scheme",
    name: "Role scheme",
    heading: { family: "Source Serif 4", weight: 700 },
    body: { family: "Source Sans 3" },
    code: "Source Code Pro",
  },
  [textSlide, codeSlide],
);
assert.deepEqual(attached(roles), {
  $schema: "https://openpresentation.org/schema/opf-font-scheme/v1",
  id: "role-scheme",
  name: "Role scheme",
  major: "Source Serif 4",
  minor: "Source Sans 3",
  code: { family: "Source Code Pro" },
});
assert.equal(validatePresentation(roles).valid, true);
assert.deepEqual([...measured(roles)].sort(), ["Source Sans 3", "Source Serif 4"]);
assert.ok(measured(roles, 1).has("Source Code Pro"));
// A later inline major/minor override on the applied scheme still wins.
roles.design.fontScheme = {
  id: "role-scheme",
  major: "Override Display",
  minor: "Override Text",
};
assert.equal(validatePresentation(roles).valid, true);
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
  $schema: "https://openpresentation.org/schema/opf-font-scheme/v1",
  id: "explicit-pair",
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
  $schema: "https://openpresentation.org/schema/opf-font-scheme/v1",
  id: "legacy-sans",
  name: "Legacy Sans",
  major: "Arial",
  minor: "Arial",
});

// Pinned last resort: a theme without a font scheme composes in Roboto (the
// exporter uses aptos; the difference is documented in opf design-resolution).
const bareTheme = {
  name: "Theme without font scheme",
  design: { theme: "bare" },
  catalogs: {
    themes: {
      records: [
        {
          $schema: "https://openpresentation.org/schema/opf-theme/v1",
          id: "bare",
          name: "Bare",
        },
      ],
    },
  },
  slides: [textSlide],
};
assert.deepEqual([...measured(bareTheme)].sort(), ["Roboto"]);
// With no design, the default minimal theme supplies aptos.
assert.deepEqual(
  [...measured({ name: "Defaults", slides: [textSlide] })].sort(),
  ["Aptos", "Aptos Display"],
);

console.log("gallery font-scheme roles and default scheme pin passed");
