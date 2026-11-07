const P = 'packages/javascript/src/pagination.ts';
export default [
  [P, `        } else if (!contentFields.has(key)) result[key] = clone(value);
      }
      return root || hasContent ? result : undefined;`,
  `        } else if (key === 'text' && isShapeBlock(node)) {
          // SH-02: a shape's text goes with its shape (the leaf is the shape item, \`<block>.shape\` or \`<block>.path\`).
          if (portions.has(\`\${path}.shape\`) || portions.has(\`\${path}.path\`)) result[key] = clone(value);
        } else if (!contentFields.has(key)) result[key] = clone(value);
      }
      return root || hasContent ? result : undefined;`],
  [P, `import `, `import {isShapeBlock} from './shape-block.js';\nimport `],
  ['packages/javascript/src/rule-content.ts', `const BODY_FIELDS = ['text', 'items', 'bullets', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'diagram'] as const;`,
    `const BODY_FIELDS = ['text', 'items', 'bullets', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'diagram', 'shape', 'path'] as const;`],
  ['packages/javascript/src/stats.ts', `const KIND_ORDER = ['text', 'items', 'bullets', 'quote', 'metric', 'code', 'timeline', 'diagram', 'chart', 'table', 'image', 'video'] as const;`,
    `const KIND_ORDER = ['text', 'items', 'bullets', 'quote', 'metric', 'code', 'timeline', 'diagram', 'chart', 'table', 'image', 'video', 'shape'] as const;`],
];
