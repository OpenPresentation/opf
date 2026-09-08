import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { validatePresentation } from "../dist/index.js";
import {
  exampleCategories,
  examples,
  galleries,
  getExample,
  getExamplesByCategory,
  getExamplesByGallery,
  getGallery,
} from "../dist/examples.js";
import { docs, getDoc } from "../dist/docs.js";

describe("example catalog sanity", () => {
  test("has at least one example", () => {
    assert.ok(examples.length > 0, "expected at least one example deck");
  });

  test("has at least one gallery", () => {
    assert.ok(galleries.length > 0, "expected at least one gallery");
  });

  test("example categories include 'gallery'", () => {
    assert.ok(exampleCategories.includes("gallery"));
  });
});

describe("every bundled example validates cleanly", () => {
  for (const example of examples) {
    test(`example '${example.slug}' has the expected shape and validates without warnings`, () => {
      assert.equal(typeof example.slug, "string");
      assert.ok(example.file.startsWith("examples/"));
      assert.equal(typeof example.category, "string");
      assert.ok(example.deck && typeof example.deck === "object");
      const result = validatePresentation(example.deck);
      assert.equal(
        result.valid,
        true,
        `Example ${example.slug} failed validation: ${JSON.stringify(result.errors, null, 2)}`,
      );
      assert.equal(
        result.warnings.length,
        0,
        `Example ${example.slug} references unknown catalog ids: ${JSON.stringify(result.warnings, null, 2)}`,
      );
    });
  }
});

describe("galleries", () => {
  for (const gallery of galleries) {
    test(`gallery '${gallery.slug}' is well-formed`, () => {
      assert.ok(gallery.slug.length > 0);
      assert.ok(gallery.dir.startsWith("examples/gallery/"));
      assert.ok(gallery.examples.length > 0, `gallery ${gallery.slug} is empty`);
    });
  }

  test("getExamplesByGallery matches gallery.examples length for the first gallery", () => {
    const firstGallery = galleries[0];
    const firstGalleryExamples = getExamplesByGallery(firstGallery.slug);
    assert.equal(firstGalleryExamples.length, firstGallery.examples.length);
  });

  test("getGallery resolves a known slug and returns undefined for a bogus one", () => {
    const firstGallery = galleries[0];
    assert.ok(getGallery(firstGallery.slug));
    assert.equal(getGallery("definitely-does-not-exist"), undefined);
  });
});

test("getExample resolves a known slug", () => {
  const firstExample = examples[0];
  assert.equal(getExample(firstExample.slug)?.slug, firstExample.slug);
});

test("getExamplesByCategory returns results for a known category", () => {
  assert.ok(getExamplesByCategory("gallery").length > 0);
});

describe("bundled docs", () => {
  test("has at least one doc", () => {
    assert.ok(docs.length > 0, "expected at least one doc");
  });

  for (const doc of docs) {
    test(`doc '${doc.slug}' has required fields`, () => {
      assert.equal(typeof doc.slug, "string");
      assert.ok(doc.file.startsWith("docs/"));
      assert.ok(doc.title.length > 0, `doc ${doc.slug} missing title`);
      assert.ok(doc.markdown.length > 0, `doc ${doc.slug} missing markdown`);
    });
  }

  test("doc slugs include 'schema-reference' and getDoc resolves known/unknown slugs", () => {
    const docSlugs = docs.map((d) => d.slug);
    assert.ok(docSlugs.includes("schema-reference"));
    assert.equal(getDoc("schema-reference")?.slug, "schema-reference");
    assert.equal(getDoc("missing-doc"), undefined);
    assert.ok(!docSlugs.includes("BACKLOG"));
  });
});

describe("fenced JSON presentation examples embedded in docs", () => {
  // Every presentation-shaped JSON example embedded in the shipped docs must
  // validate cleanly — docs that teach the format cannot drift from the schema.
  const fencedPresentationExamples = [];
  for (const doc of docs) {
    const fencedBlocks = [...doc.markdown.matchAll(/```json\n([\s\S]*?)```/g)];
    let blockIndex = 0;
    for (const [, block] of fencedBlocks) {
      let parsed;
      try {
        parsed = JSON.parse(block);
      } catch {
        continue;
      }
      if (!parsed || !Array.isArray(parsed.slides)) {
        continue;
      }
      fencedPresentationExamples.push({ doc, parsed, blockIndex });
      blockIndex += 1;
    }
  }

  for (const { doc, parsed, blockIndex } of fencedPresentationExamples) {
    test(`doc '${doc.slug}' fenced JSON example #${blockIndex} validates cleanly`, () => {
      const result = validatePresentation(parsed);
      assert.equal(
        result.valid,
        true,
        `doc ${doc.slug} has an invalid presentation example: ${JSON.stringify(result.errors, null, 2)}`,
      );
      assert.equal(
        result.warnings.length,
        0,
        `doc ${doc.slug} example references unknown catalog ids: ${JSON.stringify(result.warnings, null, 2)}`,
      );
    });
  }

  test("at least 5 presentation examples are validated across docs", () => {
    assert.ok(
      fencedPresentationExamples.length >= 5,
      `expected at least 5 presentation examples across docs, found ${fencedPresentationExamples.length}`,
    );
  });
});
