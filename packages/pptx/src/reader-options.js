// NT-09: `reader`, the application a PPTX is written for. Each reader stands for a set of toPptx's own options; "powerpoint" (the
// default) for none, so its export is the default export byte for byte. "keynote" (version 2) is the two options the owner's decision
// D2 names, `typefaces: "safe"` and `slideNumberFields: "static"`: Office-safe typefaces (no missing-fonts banner, the lines break where
// the file does) and a slide number with words around it as fixed text (Keynote keeps the words, and the number does not skip a hidden
// slide). A bare slide number stays a live field, so the wrong number after a hidden slide is not fixed by the set.
// `smartArt: "shapes"` and `bodyText: "native"` are not in it: measured in Keynote 16.0 on 2026-11-27, `bodyText: "native"` failed the
// condition agreed on opf#1298, no slide worse than without it (against the default export, 27 of 52 layout-sampler slides and 8 of 17
// smartart slides differ more from the preview; a seven-step cycle became a bulleted list and a callout lost its dark panel), so both
// stay options a caller can add. An option the caller sets wins over the set.
// Measured by exporting, not in Keynote: `typefaces: "safe"` (Arial is wider than the deck's face) leaves 2 of the 9 live SmartArt of the
// smartart deck as the fallback picture.
// The cost to a PowerPoint reader of a "keynote" file: Arial, Georgia and Courier New replace the deck's faces, and such a slide number
// is fixed text that PowerPoint does not renumber.
// A reader exists when its set has been measured in that application; there is no fallback for an unknown one.
import {OPFPptxError} from './errors.js';

const SETS = Object.freeze({
  powerpoint: Object.freeze({}),
  keynote: Object.freeze({typefaces: 'safe', slideNumberFields: 'static'})
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
