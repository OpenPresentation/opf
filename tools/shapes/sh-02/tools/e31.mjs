const F = 'packages/pptx/test/fa-23-image-drawingml.mjs';
const T = 'packages/pptx/test/image-treatments.mjs';
export default [
  [F, `  effects: {shape, stroke: {hex: '101820', alpha: 1, width: 4}, opacity: .8,`, `  effects: {shape, strokeXml: '<a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="101820"></a:srgbClr></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>', opacity: .8,`],
  [F, String.raw`<a:ln w="38100" algn="ctr"><a:solidFill><a:srgbClr val="101820"><\/a:srgbClr><\/a:solidFill><a:miter lim="800000"\/><\/a:ln>/`, String.raw`<a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="101820"><\/a:srgbClr><\/a:solidFill><a:prstDash val="solid"\/><a:miter lim="800000"\/><\/a:ln>/`],
  [T, `for (const [shape, extra] of [['rounded', { adjust: { adj: 0.12 } }], ['circle', {}], ['hexagon', {}], ['rectangle', {}]]) {`, `for (const [shape, extra] of [['roundRect', { adjust: { adj: 0.12 } }], ['ellipse', {}], ['hexagon', {}], ['rect', {}], ['star5', {}]]) {`],
  [T, `  assert.equal(block.shape, 'rounded');`, `  assert.equal(block.shape, 'roundRect');`],
];
