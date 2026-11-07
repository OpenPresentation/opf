const T = 'packages/pptx/test/image-treatments-014.mjs';
export default [
  [T, `let same = 0, changed = 0;`, `// SH-02: a mask the block gives no adjust values writes an empty a:avLst (PowerPoint's defaults), where 0.14 wrote roundRect's and
// hexagon's defaults; a picture's line now names its cap, compound and dash (flat, single, solid: PowerPoint's defaults too).
const PRESET_DEFAULTS = {roundRect: {adj: '16667'}, hexagon: {adj: '25000', vf: '115470'}};
const geometry = geom => {
  if (!geom) return geom;
  const guides = [geom['a:avLst']?.['a:gd'] ?? []].flat().filter(gd => PRESET_DEFAULTS[geom.prst]?.[gd.name] !== gd.fmla?.replace('val ', ''));
  return {prst: geom.prst, 'a:avLst': guides.length ? {'a:gd': guides.length === 1 ? guides[0] : guides} : ''};
};
const line = ln => {
  if (!ln) return ln;
  const {cap, cmpd, ['a:prstDash']: dash, ...rest} = ln;
  if (cap !== undefined) assert.equal(cap, 'flat');
  if (cmpd !== undefined) assert.equal(cmpd, 'sng');
  if (dash !== undefined) assert.equal(dash.val, 'solid');
  return rest;
};
let same = 0, changed = 0;`],
  [T, "    sameNumbers(picture.geom, was.geom, `${slide.id} mask`);\n    sameNumbers(picture.ln, was.ln, `${slide.id} line`);", "    sameNumbers(geometry(picture.geom), geometry(was.geom), `${slide.id} mask`);\n    sameNumbers(line(picture.ln), was.ln, `${slide.id} line`);"],
  [T, "    sameNumbers(overlay['p:spPr']['a:prstGeom'], expected.overlay.geom, `${slide.id} overlay shape`);", "    sameNumbers(geometry(overlay['p:spPr']['a:prstGeom']), geometry(expected.overlay.geom), `${slide.id} overlay shape`);"],
];
