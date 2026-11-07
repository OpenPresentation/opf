// node golden-svg.mjs <worktree> <key>: the SVG of one render template golden slide (by key) as that worktree draws it.
const [tree, key] = process.argv.slice(2);
const { toSvg } = await import(`file:///${tree}/packages/render/dist/index.js`);
const { layouts, templateDeck } = await import(`file:///${tree}/packages/render/test/layout-template-fixture.mjs`);
for (const { keys, deck } of Object.keys(layouts).map(templateDeck)) {
  const at = keys.indexOf(key);
  if (at >= 0) { process.stdout.write(toSvg(deck, at + 1)); break; }
}
