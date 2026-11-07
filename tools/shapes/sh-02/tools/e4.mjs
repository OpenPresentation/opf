const C = 'packages/javascript/src/composition.ts';
export default [
  [C, `const roundBox = (box: LayoutBox): LayoutBox => ({ x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });\n`,
    `const roundBox = (box: LayoutBox): LayoutBox => ({ x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });
/** SH-02: an image frame's mask: any of the 187 presets, with the block's adjust values (OPF units), from SH-01's geometry (shape-block.ts presetMask). */
export function imageShape(preset: string, box: LayoutBox, adjust?: Record<string, number>): ImageShape {
  return presetMask(preset, box, adjust);
}
`],
  [C, `import {layoutDiagram,type ComposedDiagram,type DiagramIssue,type DiagramMeasure} from './diagram.js';\n`,
    `import {layoutDiagram,type ComposedDiagram,type DiagramIssue,type DiagramMeasure} from './diagram.js';
import {composeShape,composeStroke,isShapeBlock,presetMask,stackedText,PICTURE_STROKE_WIDTH,type ComposedShape,type ComposedStroke} from './shape-block.js';
import {isPresetShape} from './shape-geometry.js';
`],
];
