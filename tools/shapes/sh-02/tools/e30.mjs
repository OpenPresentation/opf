const T = 'packages/render/test/image-treatments.mjs';
export default [
  [T, `async function pixels(png) {`, `// SH-02: outlines are SH-01's evaluated presets (L in place of 0.14's H and V), so they are compared as the points they visit.
function outlinePoints(d) {
  if (d === undefined) return undefined;
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [], points = [];
  let command = '', x = 0, y = 0;
  for (let at = 0; at < tokens.length;) {
    if (/[A-Za-z]/.test(tokens[at])) { command = tokens[at++]; if (command === 'Z') continue; }
    const read = () => Number(tokens[at++]);
    if (command === 'H') x = read(); else if (command === 'V') y = read();
    else if (command === 'A') { const arc = [read(), read(), read(), read(), read()]; x = read(); y = read(); points.push(...arc.slice(0, 2).map(value => Math.round(value * 1000) / 1000)); }
    else { x = read(); y = read(); }
    points.push(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000);
  }
  return points;
}

async function pixels(png) {`],
  [T, `    assert.equal(image.shape.path, expected.frame.shape, \`\${slug}: outline\`);
    assert.equal(image.overlay?.shape.path, expected.frame.overlay, \`\${slug}: overlay outline\`);`, `    assert.deepEqual(outlinePoints(image.shape.path), outlinePoints(expected.frame.shape), \`\${slug}: outline\`);
    assert.deepEqual(outlinePoints(image.overlay?.shape.path), outlinePoints(expected.frame.overlay), \`\${slug}: overlay outline\`);`],
  [T, `    assert.equal(background.overlay?.shape.path, expected.frame.overlay, \`\${slug}: overlay outline\`);`, `    assert.deepEqual(outlinePoints(background.overlay?.shape.path), outlinePoints(expected.frame.overlay), \`\${slug}: overlay outline\`);`],
];
