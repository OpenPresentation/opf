const IO = 'packages/editor/src/image-options.js';
const DC = 'packages/editor/src/design-controls.js';
const CC = 'packages/editor/src/content-controls.js';
const DT = 'packages/editor/src/image-options.d.ts';
const SW = 'packages/editor/src/switches.d.ts';
const ST = 'packages/javascript/src/convert/structure.ts';
export default [
  [IO, `// Image blocks (FA-22/FA-23, OPF 0.15): every content picture is an image block, and its framing lives on the block: fit and
// focus, the treatments (shape, corner radius, border, opacity, recolor, overlay, aspect ratio) and placement (bleed to one slide`,
  `// Image blocks (FA-22/FA-23, OPF 0.15): every content picture is an image block, and its framing lives on the block: fit and
// focus, the treatments (shape, adjust, stroke, opacity, recolor, overlay, aspect ratio) and placement (bleed to one slide`],
  [IO, `import { isAuthoringColorRef } from "./color-authoring.js";`, `import { isAuthoringColorRef } from "./color-authoring.js";
import { PRESET_SHAPES } from "@openpresentation/opf/shape-geometry";`],
  [IO, `export const IMAGE_SHAPES = Object.freeze(["rectangle", "rounded", "circle", "hexagon"]);`, `/** SH-02: a frame's mask is any of the 187 DrawingML presets (rect, roundRect, ellipse, hexagon, chevron, ...). */
export const IMAGE_SHAPES = PRESET_SHAPES;`],
  [IO, `export const IMAGE_TREATMENT_FIELDS = Object.freeze(["fit", "focus", "aspectRatio", "shape", "cornerRadius", "border", "opacity", "recolor", "overlay", "placement", "portrait"]);`,
    `export const IMAGE_TREATMENT_FIELDS = Object.freeze(["fit", "focus", "aspectRatio", "shape", "adjust", "stroke", "opacity", "recolor", "overlay", "placement", "portrait"]);`],
  [IO, `    case "cornerRadius": {
      const radius = Number(value);
      if (!fraction(radius, 0, 0.5)) throw bad("The corner radius is a share of the frame's shorter side from 0 to 0.5.", { field: key, value });
      return radius;
    }
    case "border": {
      if (!isObject(value)) throw bad("A border is { color, width }.", { field: key, value });
      const width = Number(value.width);
      if (!fraction(width, 0, 64)) throw bad("The border width is from 0 to 64 reference pixels.", { field: key, value });
      return { color: colorRef(value.color, "The border color"), width };
    }`, `    case "adjust": {
      // SH-02: the preset's adjust values (roundRect's adj is the corner radius, a share of the shorter side from 0 to 0.5).
      if (!isObject(value) || Object.values(value).some((entry) => typeof entry !== "number" || !Number.isFinite(entry))) throw bad("Adjust values are { name: number }, for example { adj: 0.12 } for a roundRect's corner.", { field: key, value });
      return { ...value };
    }
    case "stroke": {
      // SH-02: the picture's line (renamed from border): "none", or { color, width, dash, ... }.
      if (value === "none") return value;
      if (!isObject(value)) throw bad("A stroke is { color, width } (with an optional dash, cap, join and the rest), or \\"none\\".", { field: key, value });
      const out = { ...value };
      if (value.width !== undefined) {
        out.width = Number(value.width);
        if (!fraction(out.width, 0, 64)) throw bad("The stroke width is from 0 to 64 reference pixels.", { field: key, value });
      }
      if (value.color !== undefined) out.color = typeof value.color === "string" ? colorRef(value.color, "The stroke color") : value.color;
      return out;
    }`],
  [IO, ` * The image block's framing as a form shows it: \`{ path, fit, focus, aspectRatio, shape, cornerRadius, border, opacity, recolor,`, ` * The image block's framing as a form shows it: \`{ path, fit, focus, aspectRatio, shape, adjust, stroke, opacity, recolor,`],
  [DC, `    const shape = selectField("img-shape", "Shape", { empty: "Rectangle", onChange: (value) => treat({ shape: value === "" ? null : value }, "Image shape changed.") });
    shape.setOptions(IMAGE_SHAPES.filter((value) => value !== "rectangle").map((value) => ({ value, label: titleCase(value) })));
    const radius = numberField("img-radius", "Corner radius", { min: 0, max: 0.5, step: 0.02, help: "Share of the shorter side", onCommit: (value) => treat({ cornerRadius: value }, "Corner radius changed.") });`,
  `    const shape = selectField("img-shape", "Shape", { empty: "Rectangle", onChange: (value) => treat({ shape: value === "" ? null : value }, "Image shape changed.") });
    shape.setOptions(IMAGE_SHAPES.filter((value) => value !== "rect").map((value) => ({ value, label: value })));
    // SH-02: a roundRect frame's corner is its adjust value adj (a share of the shorter side).
    const radius = numberField("img-radius", "Corner radius", { min: 0, max: 0.5, step: 0.02, help: "Share of the shorter side", onCommit: (value) => treat({ adjust: value === null ? null : { adj: value } }, "Corner radius changed.") });`],
  [DC, `    const borderCommit = () => {
      const ref = borderColor.input.value.trim();
      treat({ border: ref ? { color: ref, width: borderWidth.input.value === "" ? 2 : Number(borderWidth.input.value) } : null }, ref ? "Border changed." : "Border removed.");
    };
    const borderColor = textField("img-border-color", "Border color", { list: true, placeholder: "dark1 or #1F2937", help: "Clear to remove", onCommit: borderCommit });
    borderColor.setList(COLOR_NAMES);
    const borderWidth = numberField("img-border-width", "Border width", { min: 0, max: 64, step: 1, onCommit: borderCommit });`,
  `    // SH-02: the picture's line is its stroke (renamed from border).
    const borderCommit = () => {
      const ref = borderColor.input.value.trim();
      treat({ stroke: ref ? { color: ref, width: borderWidth.input.value === "" ? 2 : Number(borderWidth.input.value) } : null }, ref ? "Stroke changed." : "Stroke removed.");
    };
    const borderColor = textField("img-border-color", "Stroke color", { list: true, placeholder: "dark1 or #1F2937", help: "Clear to remove", onCommit: borderCommit });
    borderColor.setList(COLOR_NAMES);
    const borderWidth = numberField("img-border-width", "Stroke width", { min: 0, max: 64, step: 1, onCommit: borderCommit });`],
  [DC, `        shape.set(current.shape && current.shape !== "rectangle" ? current.shape : "");
        radius.set(current.cornerRadius === undefined ? "" : String(current.cornerRadius));
        radius.wrap.hidden = current.shape !== "rounded";`, `        shape.set(current.shape && current.shape !== "rect" ? current.shape : "");
        radius.set(current.adjust?.adj === undefined ? "" : String(current.adjust.adj));
        radius.wrap.hidden = current.shape !== "roundRect";`],
  [DC, `        borderColor.set(current.border?.color ?? "");
        borderWidth.set(current.border?.width === undefined ? "" : String(current.border.width));`, `        borderColor.set(typeof current.stroke?.color === "string" ? current.stroke.color : "");
        borderWidth.set(current.stroke?.width === undefined ? "" : String(current.stroke.width));`],
  [CC, `"shape", "cornerRadius", "border", "opacity",`, `"shape", "adjust", "stroke", "opacity",`],
  [DT, `"shape", "cornerRadius", "border", "opacity",`, `"shape", "adjust", "stroke", "opacity",`],
  [DT, `  cornerRadius?: number | null;`, `  adjust?: Record<string, number> | null;`],
  [DT, `  border?: { color: string; width: number } | null;`, `  stroke?: "none" | { color?: string | { color: string; lighten?: number; darken?: number }; width?: number; [key: string]: unknown } | null;`],
  [SW, `shape, cornerRadius, border, opacity,`, `shape, adjust, stroke, opacity,`],
  [ST, `"shape", "cornerRadius", "border", "opacity",`, `"shape", "adjust", "stroke", "opacity",`],
];
