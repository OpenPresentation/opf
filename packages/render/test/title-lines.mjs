// The title lines of a slide SVG, for the browser fixtures that hold a title's runs to their accepted advances. A content title is
// drawn at its role size (54 px) only when it fits one line there: LH-51 steps it down (49.4933, 45, 40.4933 px) to the largest size
// that keeps it on one line, so a title is found by its source path, not its size. The SVG is rendered with `trace`, which adds the
// data-opf-* attributes only: `traced` asserts that, so the fixture measures exactly the SVG a host draws.
import assert from 'node:assert/strict';

/** The <text> lines of a slide's title (both parts of a split "Topic: qualifier" title carry the title's path). */
export const titleLines = 'text[data-opf-path$=".title"]';

/** `tracedSvg` (rendered with `trace: true`) after asserting that it is `plainSvg` plus data-opf-* attributes. */
export function traced(tracedSvg, plainSvg, label) {
  assert.equal(tracedSvg.replace(/ data-opf-[a-z-]+="[^"]*"/g, ''), plainSvg, `${label}: the traced SVG differs from the drawn SVG beyond its data-opf-* attributes`);
  return tracedSvg;
}
