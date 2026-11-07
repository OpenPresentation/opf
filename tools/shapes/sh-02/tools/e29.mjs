const S = 'packages/render/src/shapes.js';
export default [
  [S, `  const accessible = shape.decorative || (shape.alt === undefined && !item.text) ? HIDDEN : { role: "img", "aria-label": shape.alt ?? undefined };
  const body = (defs.length ? helpers.tag("defs", {}, defs.join("")) : "") + outline + text;
  const content = shape.link ? helpers.tag("a", { href: shape.link }, body) : body;
  return helpers.tag("g", { ...(shape.alt !== undefined && !shape.decorative ? accessible : shape.decorative ? HIDDEN : {}), ...helpers.trace }, content);
}

export { colorTransform, applyColorTransform };
`, `  // A decorative shape is hidden from assistive technology; alt text names the shape; otherwise its text is what is read.
  const accessible = shape.decorative ? HIDDEN : shape.alt !== undefined ? { role: "img", "aria-label": shape.alt } : {};
  const body = (defs.length ? helpers.tag("defs", {}, defs.join("")) : "") + outline + text;
  const content = shape.link ? helpers.tag("a", { href: shape.link }, body) : body;
  return helpers.tag("g", { ...accessible, ...helpers.trace }, content);
}
`],
  [S, `import { colorTransform, applyColorTransform, patternRuns, textColorForFill } from "@openpresentation/opf/composition";`, `import { patternRuns, textColorForFill } from "@openpresentation/opf/composition";`],
];
