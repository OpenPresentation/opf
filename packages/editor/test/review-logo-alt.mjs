import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { layoutFurniture } from "@openpresentation/opf/composition";
import { createEditorSession } from "../src/index.js";
import { altTextPatch, currentAltText, markDecorative, setReviewAltText } from "../src/review.js";

// RR-71 (OPF 0.18): a logo reference (`var:organization.logo.icon`) is a whole-field string. The Review panel's alt-text fix
// must never wrap it as `{ src: "var:…", alt }`: that is an ordinary image whose source is no longer the logo. The logo's alt
// lives on the organization (Organization.logo, each shape and onLight/onDark value a path or Asset), so the fix writes it
// there, on every asset the reference draws, and refuses a reference that names no logo.
const deck = () => ({
  organization: [
    { id: "acme", name: "Acme", role: "primary", logo: { full: "./acme.svg", icon: { onLight: "./mark.svg", onDark: "./mark-white.svg" } } },
    { id: "beta", name: "Beta", logo: "asset:beta-logo" },
  ],
  assets: { "beta-logo": "./beta.svg" },
  design: { logo: "var:organization.logo", footer: { left: { image: "var:organization.logo.icon", text: "Acme" }, right: { image: "var:organization.beta.logo.wordmark" } } },
  slides: [{ title: "One", text: "Body." }],
});
const footerImage = "/design/footer/left/image";

// The icon has a light and a dark asset: both get the alt; the reference itself is untouched.
{
  const presentation = deck();
  assert.deepEqual(altTextPatch(presentation, footerImage, "Acme"), [
    { op: "replace", path: "/organization/0/logo/icon/onLight", value: { src: "./mark.svg", alt: "Acme" } },
    { op: "replace", path: "/organization/0/logo/icon/onDark", value: { src: "./mark-white.svg", alt: "Acme" } },
  ]);
  const editor = createEditorSession(presentation);
  assert.equal(setReviewAltText(editor, footerImage, "  Acme  ").changed, true);
  assert.equal(editor.presentation.design.footer.left.image, "var:organization.logo.icon", "the reference stays a whole-field string");
  assert.deepEqual(editor.presentation.organization[0].logo.icon, { onLight: { src: "./mark.svg", alt: "Acme" }, onDark: { src: "./mark-white.svg", alt: "Acme" } });
  assert.equal(currentAltText(editor.presentation, footerImage), "Acme", "the field pre-fills from the organization");
  assert.equal(validate(editor.presentation).findings.filter((finding) => finding.severity === "error").length, 0);
  // Core still draws the logo from the reference (with its alt), not an image whose src is "var:…".
  const [part] = layoutFurniture({}, { presentation: editor.presentation }).parts.filter((entry) => entry.type === "image" && entry.zone === "left");
  assert.equal(part.reference, "var:organization.logo.icon");
  assert.deepEqual(part.image, { src: "./mark.svg", alt: "Acme" });
  assert.equal(setReviewAltText(editor, footerImage, "Acme").changed, false, "no change, no history entry");
  editor.undo();
  assert.deepEqual(editor.presentation, deck(), "one undoable change");
}

// design.logo names the full logo (one asset for both backgrounds): one operation.
assert.deepEqual(altTextPatch(deck(), "/design/logo", "Acme Corporation"), [{ op: "replace", path: "/organization/0/logo/full", value: { src: "./acme.svg", alt: "Acme Corporation" } }]);

// Another organization's logo through the assets registry: the alt goes on the registry entry, once.
{
  const editor = createEditorSession(deck());
  markDecorative(editor, "/design/footer/right/image");
  assert.equal(editor.presentation.design.footer.right.image, "var:organization.beta.logo.wordmark");
  assert.deepEqual(editor.presentation.assets["beta-logo"], { src: "./beta.svg", alt: "" });
  assert.equal(editor.presentation.organization[1].logo, "asset:beta-logo");
}

// A reference that names no logo is refused with a clear message, and nothing changes.
{
  const presentation = deck();
  delete presentation.organization[0].logo;
  const editor = createEditorSession(presentation);
  assert.throws(() => setReviewAltText(editor, footerImage, "Acme"), (error) => error.code === "unresolved-logo-alt" && /names no logo yet/.test(error.message) && /organization/.test(error.message));
  assert.deepEqual(editor.presentation, presentation);
  assert.equal(currentAltText(presentation, footerImage), "");
}

// An organization logo path (where core's missing-alt-text finding points) keeps the ordinary Asset object form.
assert.deepEqual(altTextPatch(deck(), "/organization/0/logo/full", "Acme"), [{ op: "replace", path: "/organization/0/logo/full", value: { src: "./acme.svg", alt: "Acme" } }]);

console.log("Review logo alt passed: a logo reference stays whole, its alt is written on the organization's light and dark assets (or the registry entry), and a reference with no logo is refused.");
