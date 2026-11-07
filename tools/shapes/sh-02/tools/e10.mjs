const C = 'packages/javascript/src/composition.ts';
const S = 'packages/javascript/src/shape-block.ts';
export default [
  [C, `      if (text.overflow) diagnostics.push({ code: 'text-overflow', path: textPath, message: 'The text does not fit inside the shape at the readable minimum size; give the shape more room (a larger cell or another aspectRatio), shorten the text or lower its padding.' });
    }`, `      if (text.overflow) diagnostics.push({ code: 'text-overflow', path: textPath, message: 'The text does not fit inside the shape at the readable minimum size; give the shape more room (a larger cell or another aspectRatio), shorten the text or lower its padding.' });
      // The text block sits at the shape's anchor in its box (PowerPoint's a:bodyPr anchor): the preview draws the fit in textArea.
      const area = shape.textBox, height = Math.max('richLines' in text ? (text as RichTextFit).height : text.lines.length * text.lineHeight, text.placement?.height ?? 0);
      const offset = Math.max(0, shape.anchor === 'middle' ? (area.height - height) / 2 : shape.anchor === 'bottom' ? area.height - height : 0);
      text = translateTextFit(text, round(offset));
      shape.textArea = { x: area.x, y: round(area.y + offset), width: area.width, height: round(Math.min(area.height, height)) };
    }`],
  [S, `  anchor: 'top' | 'middle' | 'bottom';
  textDirection:`, `  anchor: 'top' | 'middle' | 'bottom';
  /** Where the fitted text block is drawn: \`textBox\` narrowed to the text's height at the anchor (present when the shape has text). */
  textArea?: Box;
  textDirection:`],
];
