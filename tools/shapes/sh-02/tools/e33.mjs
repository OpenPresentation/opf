const T = 'packages/pptx/test/native-conformance.mjs';
export default [
  [T, `      if (!placeholder && hasText && !filled && !textBox) fail('text-box', path, \`text shape "\${name}" is not a text box\`);
      const body = /<a:bodyPr\b[^>]*>/.exec(shape)?.[0];
      if (hasText && body) {`, `      // SH-02: a shape block is a shape whose text sits in its preset's text rectangle at its own insets (a:bodyPr lIns and the rest).
      const shapeBlock = /^OPF shape /.test(name ?? '');
      if (!placeholder && hasText && !filled && !textBox && !shapeBlock) fail('text-box', path, \`text shape "\${name}" is not a text box\`);
      const body = /<a:bodyPr\b[^>]*>/.exec(shape)?.[0];
      if (hasText && body && !shapeBlock) {`],
];
