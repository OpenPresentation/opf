// NT-09: `reader`, the application a PPTX is written for. Each reader stands for a set of toPptx's own options; "powerpoint" (the
// default) for none, so its export is the default export byte for byte. "keynote" (version 3) is three options: `typefaces: "safe"`
// (no missing-fonts banner, the lines break where the file does), `slideNumberFields: "static"` (a slide number with words around it is
// fixed text: Keynote keeps the words, and the number does not skip a hidden slide) and `smartArt: "shapes"` (a pyramid, matrix or cycle
// as native shapes instead of one fallback picture). A bare slide number stays a live field, so the wrong number after a hidden slide
// is not fixed by the set.
// `bodyText: "native"` is not in it: in Keynote 16.0 (2026-11-27) it made 2 slides worse and 4 better, because Keynote lays a body
// placeholder out wider than OPF's measured boxes (layout-sampler 42: the text widens into the bullet column; 26: the text runs to the
// slide's right edge). A caller can add it. `smartArt: "shapes"` made no slide worse in Keynote (152 slides compared).
// The two losses of the first pass (layout-sampler 13 without its dark panel, smartart 6 as a list) belong to `typefaces: "safe"` alone:
// OPF's own Arial preview shows them too (opf#1560). The three-option set itself was not run in Keynote; two passes bracket it.
// An option the caller sets wins over the set. The cost to a PowerPoint reader of a "keynote" file: Arial, Georgia and Courier New
// replace the deck's faces, such a slide number is fixed text that PowerPoint does not renumber, and there is no live SmartArt.
// A reader exists when its set has been measured in that application; there is no fallback for an unknown one.
import {OPFPptxError} from './errors.js';

const SETS = Object.freeze({
  powerpoint: Object.freeze({}),
  keynote: Object.freeze({typefaces: 'safe', slideNumberFields: 'static', smartArt: 'shapes'})
});

/** The readers `reader` takes, the default first. */
export const READERS = Object.freeze(Object.keys(SETS));

function checkReader(reader) {
  if (!Object.hasOwn(SETS, reader)) throw new OPFPptxError('invalid-reader-option', `reader must be ${READERS.map(name => `'${name}'`).join(' or ')}.`, {path: 'options.reader'});
}

/** The toPptx options `reader` stands for, as a new object: `{}` for "powerpoint". An unknown reader throws `invalid-reader-option`. */
export function readerOptions(reader) {
  checkReader(reader);
  return {...SETS[reader]};
}

/**
 * The options toPptx writes with: `options` without `reader`, plus each option of the reader's set that `options` does not set itself.
 * Without `reader`, `options` itself. A reader with `as: 'images'` throws: a pictures-only PPTX has no text, fonts or SmartArt.
 */
export function withReader(options) {
  if (options.reader === undefined) return options;
  checkReader(options.reader);
  if (options.as === 'images') throw new OPFPptxError('invalid-reader-option', "reader does not apply to as: 'images', where each slide is one picture.", {path: 'options.reader'});
  const {reader, ...rest} = options;
  for (const [name, value] of Object.entries(SETS[reader])) if (rest[name] === undefined) rest[name] = value;
  return rest;
}
