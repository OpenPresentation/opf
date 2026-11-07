export default [
  ['packages/mcp/test/mcp-workerd.test.mjs', `		// About 7.1 MB unminified, 1.1 MB of it the diagram types validate_deck loads to check a deck's diagrams.
		assert.ok(lean.bytes < 7_500_000, \`\${lean.bytes} bytes\`);`, `		// About 7.1 MB unminified, 1.1 MB of it the diagram types validate_deck loads to check a deck's diagrams. SH-02: composition evaluates
		// the 187 preset shapes (SH-01's geometry table, about 0.3 MB), so a deck's shape blocks validate: 7,785,356 bytes.
		assert.ok(lean.bytes < 7_900_000, \`\${lean.bytes} bytes\`);`],
  ['packages/mcp/test/mcp.test.mjs', `		assert.ok(bytes < 1_035_000, \`\${bytes} bytes of documentation\`);`, `		// SH-02 added docs/shapes.md (the property map and the 187 presets) and the shape vocabulary of the schema reference: 1,077,362 bytes.
		assert.ok(bytes < 1_090_000, \`\${bytes} bytes of documentation\`);`],
];
