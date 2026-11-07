export default [
  ['packages/javascript/src/schema-check.ts', `    for (const field of shapeOptionFields) if (hasOwn(value, field)) issues.push(`, `    // A slide's own \`hidden\` hides the slide.
    for (const field of shapeOptionFields) if (hasOwn(value, field) && !(field === "hidden" && options.slideRoot)) issues.push(`],
];
