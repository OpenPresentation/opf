// RR-06 gaps: image upload. A local file becomes an `assets` entry (or goes to the host's onAddAsset)
// and is used by a logo, watermark, slide image, background or header/footer zone in one undo step.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import * as pptx from "@openpresentation/opf-pptx";
import { createEditorSession } from "../dist/index.js";
import {
  DEFAULT_MAX_IMAGE_BYTES,
  IMAGE_ACCEPT,
  applyImageUpload,
  assetIdOf,
  checkImageBytes,
  prepareAssetAlt,
  prepareImageAsset,
  readImageFile,
  setAssetAlt,
  sniffImageType,
  uniqueAssetId,
} from "../dist/assets.js";
import { prepareDesignOption, prepareHeaderFooterZone, prepareLogoVariant, LOGO_VARIANTS } from "../dist/design-options.js";
import { prepareBackground } from "../dist/background-options.js";

const bytesOf = (...values) => Uint8Array.from(values);
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
const JPEG = bytesOf(0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9);
const GIF = Uint8Array.from([...new TextEncoder().encode("GIF89a"), 1, 0, 1, 0, 0, 0, 0, 0x3b]);
const WEBP = Uint8Array.from([...new TextEncoder().encode("RIFF"), 4, 0, 0, 0, ...new TextEncoder().encode("WEBPVP8 "), 0, 0, 0, 0]);
const SVG = new TextEncoder().encode('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#369"/></svg>');
const file = (bytes, name, type) => new File([bytes], name, { type });

const deck = () => ({
  name: "Upload fixture",
  design: { theme: "minimal", fontScheme: "aptos" },
  organization: { id: "acme", name: "Acme" },
  slides: [
    { id: "cover", title: "Cover", subtitle: "Upload" },
    { id: "body", title: "Body", text: "Text" },
  ],
});
const session = () => createEditorSession(deck(), { rejectInvalid: true });

// Types: every accepted type is recognized by its bytes, and nothing else is.
assert.deepEqual([sniffImageType(PNG), sniffImageType(JPEG), sniffImageType(GIF), sniffImageType(WEBP), sniffImageType(SVG)], ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);
assert.equal(sniffImageType(new TextEncoder().encode("hello")), undefined);
assert.equal(sniffImageType(new TextEncoder().encode("<html><svg></svg></html>")), undefined, "an SVG must start with its root element");
assert.equal(IMAGE_ACCEPT, "image/png,image/jpeg,image/gif,image/webp,image/svg+xml");
assert.equal(DEFAULT_MAX_IMAGE_BYTES, 2 * 1024 * 1024);

// Validation messages say what to do.
const rejects = (bytes, options, code, pattern) => assert.throws(() => checkImageBytes(bytes, options), (error) => error.code === code && pattern.test(error.message), `${code} ${pattern}`);
rejects(new Uint8Array(), { name: "a.png" }, "invalid-image", /is empty/);
rejects(PNG, { name: "big.png", maxBytes: 10 }, "image-too-large", /"big\.png" is 68 bytes; the limit is 10 bytes\. Resize or compress it, or host it and use a web address instead\./);
rejects(new TextEncoder().encode("not an image"), { name: "notes.png", declaredType: "image/png" }, "invalid-image", /not a PNG, JPEG, GIF, WebP or SVG image/);
rejects(PNG, { name: "photo.jpg", declaredType: "image/jpeg" }, "invalid-image", /says it is JPEG but its contents are PNG/);
rejects(PNG, { name: "photo.jpg" }, "invalid-image", /says it is JPEG but its contents are PNG/);
rejects(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), { name: "x.svg" }, "invalid-image", /script or embedded content/);
rejects(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>'), { name: "x.svg" }, "invalid-image", /script or embedded content/);
assert.equal(checkImageBytes(PNG, { name: "logo.png", declaredType: "image/png" }).mediaType, "image/png");
assert.equal(checkImageBytes(SVG, { name: "logo.svg", declaredType: "" }).mediaType, "image/svg+xml", "an unreported type is decided by the bytes");
const big = new Uint8Array(DEFAULT_MAX_IMAGE_BYTES + 1);
big.set(PNG);
await assert.rejects(readImageFile(file(big, "huge.png", "image/png")), (error) => error.code === "image-too-large" && /"huge.png" is 2048 KB; the limit is 2048 KB|is 2048.0 KB|limit is 2048 KB/.test(error.message) || /2048/.test(error.message));
await assert.rejects(readImageFile({}), (error) => error.code === "invalid-image");

// Asset ids are free ids built from the file name.
assert.equal(uniqueAssetId({}, "Company Logo (final).PNG"), "company-logo-final");
assert.equal(uniqueAssetId({ assets: { logo: "x", "logo-2": "y" } }, "logo.svg"), "logo-3");
assert.equal(uniqueAssetId({}, "???.png"), "image");
assert.equal(assetIdOf("asset:logo"), "logo");
assert.equal(assetIdOf({ src: "asset:mark", alt: "x" }), "mark");
assert.equal(assetIdOf("https://example.com/a.png"), undefined);

// One upload, one undo step, for every place an image can go.
const uploads = [
  { name: "logo variant", build: (ref, doc) => prepareLogoVariant(doc, "light", ref), check: (doc, ref) => assert.equal(doc.design.logo.light, ref) },
  { name: "organization logo", build: (ref, doc) => prepareDesignOption(doc, "organizationLogo", ref), check: (doc, ref) => assert.equal(doc.organization.logo, ref) },
  { name: "watermark", build: (ref, doc) => prepareDesignOption(doc, "watermark", { src: ref }), check: (doc, ref) => assert.equal(doc.design.watermark, ref) },
  { name: "slide image", build: (ref, doc) => prepareDesignOption(doc, "slideImage", { src: ref }, { slideIndex: 0 }), check: (doc, ref) => assert.equal(doc.slides[0].design.slideImage.src, ref) },
  { name: "background", build: (ref, doc) => prepareBackground(doc, { type: "image", image: { src: ref, fit: "cover" } }), check: (doc, ref) => assert.equal(doc.design.background.image.src, ref) },
  { name: "footer image", build: (ref, doc) => prepareHeaderFooterZone(doc, "footer", "right", { image: ref }), check: (doc, ref) => assert.equal(doc.design.footer.right.image, ref) },
];
for (const [index, entry] of uploads.entries()) {
  const editor = session();
  const before = editor.presentation;
  const source = [PNG, JPEG, GIF, WEBP, SVG, PNG][index];
  const name = ["logo.png", "photo.jpg", "anim.gif", "pic.webp", "mark.svg", "badge.png"][index];
  const type = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/png"][index];
  const change = await applyImageUpload(editor, file(source, name, type), entry.build, { alt: "  A short description  " });
  assert.equal(change.changed, true, entry.name);
  assert.equal(change.reference, `asset:${change.assetId}`);
  entry.check(editor.presentation, change.reference);
  const asset = editor.presentation.assets[change.assetId];
  assert.match(asset.src, new RegExp(`^data:${type.replace("+", "\\+")};base64,`), `${entry.name}: a data URI of the right type`);
  assert.equal(asset.alt, "A short description");
  assert.equal(asset.title, name);
  assert.equal(asset.mediaType, type);
  assert.equal(editor.snapshot().undoDepth, 1, `${entry.name}: one undo step`);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true, entry.name);
  assert.equal(change.patches[0].path.startsWith("/assets"), true);
  if (index === 0) assert.ok((await pptx.toPptx(structuredClone(editor.presentation), { strictAssets: true })).byteLength > 0, "an uploaded logo exports");
  editor.undo();
  assert.deepEqual(editor.presentation, before, `${entry.name}: one Undo removes the asset and the use`);
  editor.redo();
  entry.check(editor.presentation, change.reference);
}
assert.equal(LOGO_VARIANTS.length, 12);
// All 12 logo variants take an upload.
for (const variant of LOGO_VARIANTS) {
  const editor = session();
  await applyImageUpload(editor, file(PNG, `${variant}.png`, "image/png"), (ref, doc) => prepareLogoVariant(doc, variant, ref));
  assert.ok(JSON.stringify(editor.get("design.logo")).includes("asset:"), variant);
  assert.equal(editor.snapshot().undoDepth, 1);
}

// Ids stay unique across uploads; alt text edits the asset in one step.
{
  const editor = session();
  const build = (ref, doc) => prepareLogoVariant(doc, "default", ref);
  const first = await applyImageUpload(editor, file(PNG, "logo.png", "image/png"), build);
  const second = await applyImageUpload(editor, file(PNG, "logo.png", "image/png"), build);
  assert.deepEqual([first.assetId, second.assetId], ["logo", "logo-2"]);
  assert.equal(editor.get("assets.logo.alt"), undefined, "no alt text unless given");
  const alt = setAssetAlt(editor, "logo", "Acme logo");
  assert.equal(alt.changed, true);
  assert.equal(editor.get("assets.logo.alt"), "Acme logo");
  assert.equal(setAssetAlt(editor, "logo", "Acme logo").changed, false);
  setAssetAlt(editor, "logo", "");
  assert.equal(editor.get("assets.logo.alt"), undefined);
  assert.throws(() => prepareAssetAlt(editor.presentation, "nope", "x"), (error) => error.code === "unknown-asset");
  // A plain string asset becomes an object only when it needs alt text.
  const plain = createEditorSession({ assets: { a: "data:image/png;base64,AAAA" }, slides: [{ title: "x", text: "y" }] });
  setAssetAlt(plain, "a", "Described");
  assert.deepEqual(plain.get("assets.a"), { src: "data:image/png;base64,AAAA", alt: "Described" });
  setAssetAlt(plain, "a", "");
  assert.equal(plain.get("assets.a"), "data:image/png;base64,AAAA");
}

// Refusals change nothing.
{
  const editor = session();
  const build = (ref, doc) => prepareLogoVariant(doc, "default", ref);
  await assert.rejects(applyImageUpload(editor, file(new TextEncoder().encode("plain text"), "logo.png", "image/png"), build), (error) => error.code === "invalid-image");
  await assert.rejects(applyImageUpload(editor, file(PNG, "logo.png", "image/png"), build, { maxBytes: 20 }), (error) => error.code === "image-too-large");
  assert.equal(editor.snapshot().undoDepth, 0);
  assert.deepEqual(editor.presentation, deck());
  // A build that fails leaves no orphaned asset behind.
  await assert.rejects(applyImageUpload(editor, file(PNG, "logo.png", "image/png"), (ref, doc) => prepareDesignOption(doc, "organizationLogo", ref, { slideIndex: 0 })), (error) => error.code === "invalid-scope");
  assert.equal(editor.get("assets"), undefined);
  assert.equal(editor.snapshot().undoDepth, 0);
}

// A host that stores images itself: onAddAsset gets the bytes and returns the reference; assets is untouched.
{
  const editor = session();
  const seen = [];
  const build = (ref, doc) => prepareDesignOption(doc, "watermark", { src: ref });
  const change = await applyImageUpload(editor, file(PNG, "mark.png", "image/png"), build, {
    alt: "Mark",
    onAddAsset: async (image) => {
      seen.push(image);
      return `https://cdn.example.com/${image.name}`;
    },
  });
  assert.equal(change.assetId, undefined);
  assert.equal(editor.get("design.watermark"), "https://cdn.example.com/mark.png");
  assert.equal(editor.get("assets"), undefined, "nothing is added to assets");
  assert.equal(editor.snapshot().undoDepth, 1);
  assert.deepEqual([seen[0].name, seen[0].mediaType, seen[0].size, seen[0].alt, seen[0].bytes.length], ["mark.png", "image/png", PNG.length, "Mark", PNG.length]);
  const stored = await applyImageUpload(editor, file(PNG, "logo.png", "image/png"), (ref, doc) => prepareLogoVariant(doc, "default", ref), { onAddAsset: () => ({ src: "asset:host-logo" }) });
  assert.equal(stored.reference, "asset:host-logo");
  // The hook sees only validated files, and a bad answer changes nothing.
  let called = false;
  await assert.rejects(applyImageUpload(editor, file(new TextEncoder().encode("x"), "a.png", "image/png"), build, { onAddAsset: () => ((called = true), "x") }), (error) => error.code === "invalid-image");
  assert.equal(called, false);
  const depth = editor.snapshot().undoDepth;
  await assert.rejects(applyImageUpload(editor, file(PNG, "a.png", "image/png"), build, { onAddAsset: () => "" }), (error) => error.code === "invalid-asset-reference");
  await assert.rejects(applyImageUpload(editor, file(PNG, "a.png", "image/png"), build, { onAddAsset: () => { throw new Error("storage is offline"); } }), /storage is offline/);
  assert.equal(editor.snapshot().undoDepth, depth);
}

// prepareImageAsset is pure and adds /assets when the document has none, /assets/<id> when it does.
{
  const presentation = deck();
  const image = { name: "Logo.png", mediaType: "image/png", bytes: PNG, size: PNG.length };
  const first = prepareImageAsset(presentation, image);
  assert.deepEqual(first.patches.map((patch) => [patch.op, patch.path]), [["add", "/assets"]]);
  assert.deepEqual(presentation, deck());
  const second = prepareImageAsset({ ...presentation, assets: { x: "y" } }, image);
  assert.deepEqual(second.patches.map((patch) => patch.path), ["/assets/logo"]);
  assert.throws(() => prepareImageAsset({ ...presentation, assets: { logo: "y" } }, image, { id: "logo" }), (error) => error.code === "asset-exists");
}

console.log("Image uploads: 5 types by their bytes, size cap and type/content/script refusals, one undo step for logo (all 12 variants), organization logo, watermark, slide image, background and zone image, asset ids and alt text, and the onAddAsset host hook.");
