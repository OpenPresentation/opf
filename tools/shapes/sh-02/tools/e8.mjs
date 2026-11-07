const S = 'packages/javascript/src/schema-check.ts';
export default [
  [S, `  "timeline",
  "blocks",
] as const;

type ContentKind =`, `  "timeline",
  "shape",
  "path",
  "blocks",
] as const;

type ContentKind =`],
  [S, `  | "timeline"
  | "diagram";`, `  | "timeline"
  | "diagram"
  | "shape";`],
  [S, `  image: {
    fields: ["image"],
    required: ["image"],
  },`, `  image: {
    // SH-02: an image block's \`shape\` is its frame's mask.
    fields: ["image", "shape"],
    required: ["image"],
  },`],
  [S, `  diagram: {
    fields: ["diagram"],
    required: ["diagram"],
  },
};`, `  diagram: {
    fields: ["diagram"],
    required: ["diagram"],
  },
  // SH-02: a preset (\`shape\` without \`image\`) or a custom \`path\`, with its \`text\` inside.
  shape: {
    fields: ["shape", "path", "text"],
    required: [],
    requireAny: ["shape", "path"],
  },
};`],
  [S, `const imageOptionFields = ["fit", "focus", "aspectRatio", "shape", "cornerRadius", "border", "opacity", "recolor", "overlay", "placement", "portrait"] as const;`,
    `const imageOptionFields = ["fit", "focus", "aspectRatio", "shape", "adjust", "stroke", "opacity", "recolor", "overlay", "placement", "portrait"] as const;
// SH-02: the image options a shape block also takes, and the keys only a shape block takes.
const shapeImageFields = new Set<string>(["aspectRatio", "shape", "adjust", "stroke", "opacity"]);
const shapeOptionFields = SHAPE_BLOCK_KEYS.filter((field) => field !== "path");`],
  [S, `function inferredKinds(value: Record<string, unknown>): ContentKind[] {
  const kinds: ContentKind[] = [];

  if (presentFields(value, contentKindSpecs.text.fields).length > 0) kinds.push("text");`, `function inferredKinds(value: Record<string, unknown>): ContentKind[] {
  const kinds: ContentKind[] = [];
  // SH-02: a shape block holds its own text; bullets beside it are a text payload of their own.
  const shape = isShapeBlock(value);

  if (shape) kinds.push("shape");
  if (presentFields(value, shape ? ["bullets"] : contentKindSpecs.text.fields).length > 0) kinds.push("text");`],
  [S, `  const imageOptionIssues = (reason: string, params: Record<string, unknown> = {}) => {
    for (const field of imageOptionFields) if (hasOwn(value, field)) issues.push(semanticIssue(pathFor(path, field), \`\${field} is only valid on an image payload; \${reason}\`, { code: "image-option-unsupported-payload", field, ...params }));
  };`, `  const imageOptionIssues = (reason: string, params: Record<string, unknown> = {}, except: ReadonlySet<string> = new Set()) => {
    for (const field of imageOptionFields) if (hasOwn(value, field) && !except.has(field)) issues.push(semanticIssue(pathFor(path, field), \`\${field} is only valid on an image payload; \${reason}\`, { code: "image-option-unsupported-payload", field, ...params }));
  };
  // SH-02: shape options on anything but a shape block.
  const shapeOptionIssues = (reason: string, params: Record<string, unknown> = {}) => {
    for (const field of shapeOptionFields) if (hasOwn(value, field)) issues.push(semanticIssue(pathFor(path, field), \`\${field} is only valid on a shape block; \${reason}\`, { code: "shape-option-unsupported-payload", field, ...params }));
  };`],
  [S, `    if (hasOwn(value, "caption")) issues.push(captionIssue("a group cannot carry one"));
    imageOptionIssues("a group cannot carry them");`, `    if (hasOwn(value, "caption")) issues.push(captionIssue("a group cannot carry one"));
    imageOptionIssues("a group cannot carry them");
    shapeOptionIssues("a group cannot carry them");`],
  [S, `  if (resolvedKind !== "image") imageOptionIssues(\`this payload is '\${resolvedKind}'\`, { type: resolvedKind });`,
    `  if (resolvedKind !== "image") imageOptionIssues(\`this payload is '\${resolvedKind}'\`, { type: resolvedKind }, resolvedKind === "shape" ? shapeImageFields : undefined);
  if (resolvedKind !== "shape") shapeOptionIssues(\`this payload is '\${resolvedKind}'\`, { type: resolvedKind });
  // SH-02: adjust names and ranges of the preset (an image's mask too), and a link on a hidden shape.
  if (resolvedKind === "shape" || resolvedKind === "image")
    for (const issue of shapeIssues(value, (...keys) => keys.reduce((at, key) => pathFor(at, key), path))) issues.push(semanticIssue(issue.path, issue.message, { code: issue.code, ...issue.params }));`],
];
