import { createCanvasEditor } from "../src/canvas.js";
import { createEditorSession } from "../src/index.js";
import { loadBrowserFontRegistry } from "@openpresentation/opf-render/fonts-browser";
import { renderSvg } from "@openpresentation/opf-render";
const output = document.querySelector("#results"),
  host = document.querySelector("#canvas");
let checks = 0;
const check = (truth, message) => {
  if (!truth) throw new Error(message);
  checks++;
  output.textContent += `PASS ${message}\n`;
};
const paint = () =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
const input = (element, value) => {
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
};
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=";
try {
  const faces = (
    await fetch("./fonts.json").then((response) => response.json())
  ).filter(
    (face) =>
      ["Roboto", "Roboto Mono"].includes(face.family) &&
      [400, 700].includes(face.weight) &&
      !face.italic,
  );
  const entries = faces.map((face) => ({
    ...face,
    data: Uint8Array.from(atob(face.dataUrl.split(",")[1]), (c) =>
      c.charCodeAt(0),
    ),
  }));
  const fonts = await loadBrowserFontRegistry(entries);
  const loadedFaces = [...document.fonts];
  check(
    loadedFaces.length === entries.length &&
      loadedFaces.every((face) => face.status === "loaded"),
    "browser uses loaded font files",
  );
  const original = {
    design: { fontScheme: "roboto" },
    slides: [
      { title: "Original title", text: "Body stays editable." },
      {
        title: "Structured content",
        composition: { mode: "grid", columns: 2 },
        blocks: [
          {
            table: {
              columns: ["Quarter", "Revenue"],
              rows: [
                ["Q1", 12],
                ["Q2", 18],
              ],
            },
          },
          {
            chart: {
              type: "column",
              data: {
                columns: ["Quarter", "Revenue"],
                rows: [
                  ["Q1", 12],
                  ["Q2", 18],
                ],
              },
            },
          },
          { metric: { value: 98, label: "Retention", unit: "%" } },
          { quote: { text: "A clear next step.", attribution: "Team" } },
          { items: ["First item", "Second item"] },
          {
            timeline: [
              { when: "Now", what: "Build" },
              { when: "Next", what: "Ship" },
            ],
          },
          { image: { src: image, alt: "Sample image" } },
          { code: { source: "const value = 1;", language: "javascript" } },
        ],
      },
    ],
  };
  const editor = createEditorSession(original, { rejectInvalid: true });
  let draft,
    errors = [];
  const options = { textMeasurement: fonts.textMeasurement };
  const canvas = createCanvasEditor(host, {
    editor,
    renderOptions: options,
    onDraft: (event) => (draft = event.document),
    onError: (error) => errors.push(error.message),
  });
  await canvas.ready;
  canvas.beginEdit("slides.0.title");
  input(host.querySelector("textarea"), "Updated title");
  await paint();
  check(
    editor.get("slides.0.title") === "Original title" &&
      draft.slides[0].title === "Updated title",
    "typing creates a live draft without changing history",
  );
  const rendered = host.querySelector(".opf-canvas-preview").textContent;
  check(rendered.includes("Updated title"), "draft is visibly rendered by SVG");
  const textShapes = (element) =>
    [...element.querySelectorAll("text")].map((node) => [
      node.textContent,
      node.getAttribute("x"),
      node.getAttribute("y"),
      node.getAttribute("font-size"),
    ]);
  const reference = document.createElement("div");
  reference.innerHTML = renderSvg(draft, options);
  check(
    JSON.stringify(textShapes(host.querySelector("svg"))) ===
      JSON.stringify(textShapes(reference)),
    "draft glyph positions match standalone renderer",
  );
  check(
    canvas.commit() && editor.get("slides.0.title") === "Updated title",
    "inline commit writes OPF",
  );
  editor.undo();
  check(
    editor.get("slides.0.title") === "Original title" && !editor.canUndo,
    "one undo restores the whole edit",
  );
  canvas.beginEdit("slides.0.title");
  input(host.querySelector("textarea"), "Cancel this");
  await paint();
  canvas.cancel();
  check(
    editor.get("slides.0.title") === "Original title" && !editor.canUndo,
    "cancel discards draft without history",
  );
  canvas.beginEdit("slides.0.title");
  input(host.querySelector("textarea"), "Rebased title");
  editor.set("name", "Independent change");
  await paint();
  canvas.commit();
  check(
    editor.get("name") === "Independent change" &&
      editor.get("slides.0.title") === "Rebased title",
    "unrelated edits are preserved",
  );
  canvas.beginEdit("slides.0.title");
  input(host.querySelector("textarea"), "Stale draft");
  editor.set("slides.0.title", "External title");
  await paint();
  check(
    canvas.editingPath === null &&
      editor.get("slides.0.title") === "External title" &&
      errors.length === 1,
    "conflicting edit cancels stale draft",
  );
  errors = [];
  canvas.beginEdit("slides.0.title");
  input(host.querySelector("textarea"), "Switch while editing");
  const stopNavigation = editor.subscribe(() => canvas.setSlide(1));
  check(
    canvas.setSlide(1) &&
      editor.get("slides.0.title") === "Switch while editing",
    "slide navigation commits without reentrant conflicts",
  );
  stopNavigation();
  canvas.setSlide(1);
  canvas.beginEdit("slides.1.blocks.0.table.rows.0.1");
  input(host.querySelector("textarea"), "27");
  await paint();
  canvas.commit();
  check(
    editor.get("slides.1.blocks.0.table.rows.0.1") === 27,
    "table cells edit inline and preserve numbers",
  );
  canvas.beginEdit("slides.1.blocks.0.table.rows.0.1");
  input(host.querySelector("textarea"), "");
  await paint();
  check(
    !canvas.commit() && editor.get("slides.1.blocks.0.table.rows.0.1") === 27,
    "invalid numeric input does not change document",
  );
  canvas.cancel();
  errors = [];
  const cases = [
    ["chart", "data · rows · 1 · 2", "31", "data.rows.0.1", 31, 1],
    ["metric", "value", "99", "value", 99, 2],
    ["quote", "text", "Revised quote", "text", "Revised quote", 3],
    ["items", "1", "Revised list item", "0", "Revised list item", 4],
    ["timeline", "1 · what", "Review", "0.what", "Review", 5],
    ["image", "alt", "Changed image", "alt", "Changed image", 6],
    ["code", "source", "let result = 2;", "source", "let result = 2;", 7],
  ];
  for (const [kind, label, value, field, expected, index] of cases) {
    const path = `slides.1.blocks.${index}.${kind}`;
    canvas.beginEdit(path);
    const fieldInput = [...host.querySelectorAll("textarea,input")].find(
      (input) => input.getAttribute("aria-label") === label,
    );
    check(!!fieldInput, `${kind} exposes structured fields`);
    input(fieldInput, value);
    await paint();
    check(
      canvas.commit() && editor.get(`${path}.${field}`) === expected,
      `${kind} edits round-trip through OPF`,
    );
  }
  canvas.beginEdit("slides.1.blocks.4.items");
  [...host.querySelectorAll("button")]
    .find(
      (button) =>
        button.getAttribute("aria-label") === "Add /slides/1/blocks/4/items",
    )
    .click();
  check(
    editor.get("slides.1.blocks.4.items").length === 3,
    "list items can be added",
  );
  canvas.cancel();
  check(errors.length === 0, "structured content produced no render errors");
  canvas.destroy();
  check(host.children.length === 0, "destroy removes the canvas");
  const propertyHost = document.createElement("div");
  document.body.append(propertyHost);
  const docked = createCanvasEditor(host, {
    editor,
    slideIndex: 1,
    renderOptions: options,
    propertiesContainer: propertyHost,
  });
  await docked.ready;
  docked.beginEdit("slides.1.blocks.2.metric");
  check(
    propertyHost.querySelector("form") && !host.querySelector("form"),
    "property forms can be docked outside the slide",
  );
  input(propertyHost.querySelector('[aria-label="value"]'), "100");
  docked.commit();
  check(
    editor.get("slides.1.blocks.2.metric.value") === 100 &&
      !propertyHost.children.length,
    "docked properties commit and clean up",
  );
  docked.beginEdit("slides.1.blocks.2.metric");
  docked.destroy();
  check(!propertyHost.children.length, "destroy cleans up docked properties");
  propertyHost.remove();
  editor.set('design.titleAlignment','right');
  const aligned=createCanvasEditor(host,{editor,slideIndex:0,renderOptions:options});
  await aligned.ready;aligned.beginEdit('slides.0.title');
  check(host.querySelector('textarea').style.textAlign==='right','right aligned text uses a matching caret overlay');
  aligned.destroy();
  fonts.dispose();
  check(
    loadedFaces.every((face) => !document.fonts.has(face)),
    "font disposal removes owned faces",
  );
  output.textContent += `\n${checks} checks passed`;
  document.title = `PASS ${checks} canvas checks`;
} catch (error) {
  output.textContent += `\nFAIL ${error.stack}`;
  document.title = "FAIL canvas checks";
  throw error;
}
