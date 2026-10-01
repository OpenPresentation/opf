/**
 * DrawingML preset pattern fills (ECMA-376 20.1.10.51 ST_PresetPatternVal) as 8x8 bitmaps,
 * shared by the SVG preview (RR-07) and the PPTX export, which writes the same names as native
 * `a:pattFill prst="..."`.
 *
 * ECMA-376 names the 54 presets but does not define their pixels. These tiles are MEASURED from
 * desktop PowerPoint (Office 365, Windows, 2026-10-01): each preset was exported as a full-slide
 * pattern background (black on white) to a 1280 x 720 PNG and opf-render's
 * `scripts/derive-pattern-bitmaps.mjs` voted every pixel into its (x mod 8, y mod 8) cell; every
 * tile was uniform across all repeats (confidence 1.00) at one image pixel per pattern pixel, so a
 * pattern pixel is one 1/96 inch unit. The tile is anchored at the slide's top-left corner (the
 * phase of the line, grid and diagonal presets matched at no shift). Measured pixel data is
 * committed as data; no third-party table was used. A tile is one row per line, '#' = foreground,
 * '.' = background, top to bottom, left to right.
 */

/** ST_PresetPatternVal, in specification order. */
export const PATTERN_PRESETS: readonly string[] = Object.freeze([
  'pct5', 'pct10', 'pct20', 'pct25', 'pct30', 'pct40', 'pct50', 'pct60', 'pct70', 'pct75', 'pct80', 'pct90',
  'horz', 'vert', 'ltHorz', 'ltVert', 'dkHorz', 'dkVert', 'narHorz', 'narVert', 'dashHorz', 'dashVert',
  'cross', 'dnDiag', 'upDiag', 'ltDnDiag', 'ltUpDiag', 'dkDnDiag', 'dkUpDiag', 'wdDnDiag', 'wdUpDiag', 'dashDnDiag', 'dashUpDiag', 'diagCross',
  'smCheck', 'lgCheck', 'smGrid', 'lgGrid', 'dotGrid', 'smConfetti', 'lgConfetti', 'horzBrick', 'diagBrick',
  'solidDmnd', 'openDmnd', 'dotDmnd', 'plaid', 'sphere', 'weave', 'divot', 'shingle', 'wave', 'trellis', 'zigZag',
]);

/** Engine ids that are not DrawingML names, with the preset they draw and export as. */
export const PATTERN_PRESET_ALIASES: Readonly<Record<string, string>> = Object.freeze({ diagStripe: 'wdUpDiag' });

/** The pattern size PowerPoint tiles: 8 x 8 units, one unit per 1/96 inch. */
export const PATTERN_TILE_SIZE = 8;

const MEASURED: Record<string, string> = {
  pct5: '#......./......../......../......../....#.../......../......../........',
  pct10: '#......./......../....#.../......../#......./......../....#.../........',
  pct20: '#...#.../......../..#...#./......../#...#.../......../..#...#./........',
  pct25: '#...#.../..#...#./#...#.../..#...#./#...#.../..#...#./#...#.../..#...#.',
  pct30: '#.#.#.#./.#...#../#.#.#.#./...#...#/#.#.#.#./.#...#../#.#.#.#./...#...#',
  pct40: '#.#.#.#./.#.#.#.#/#.#.#.#./.#.#...#/#.#.#.#./.#.#.#.#/#.#.#.#./...#.#.#',
  pct50: '#.#.#.#./.#.#.#.#/#.#.#.#./.#.#.#.#/#.#.#.#./.#.#.#.#/#.#.#.#./.#.#.#.#',
  pct60: '###.###./.#.#.#.#/#.###.##/.#.#.#.#/###.###./.#.#.#.#/#.###.##/.#.#.#.#',
  pct70: '.###.###/##.###.#/.###.###/##.###.#/.###.###/##.###.#/.###.###/##.###.#',
  pct75: '.###.###/########/##.###.#/########/.###.###/########/##.###.#/########',
  pct80: '###.####/########/#######./########/###.####/########/#######./########',
  pct90: '########/########/########/####.###/########/########/########/.#######',
  horz: '########/......../......../......../......../......../......../........',
  vert: '#......./#......./#......./#......./#......./#......./#......./#.......',
  ltHorz: '########/......../......../......../########/......../......../........',
  ltVert: '#...#.../#...#.../#...#.../#...#.../#...#.../#...#.../#...#.../#...#...',
  dkHorz: '########/########/......../......../########/########/......../........',
  dkVert: '##..##../##..##../##..##../##..##../##..##../##..##../##..##../##..##..',
  narHorz: '########/......../########/......../########/......../########/........',
  narVert: '.#.#.#.#/.#.#.#.#/.#.#.#.#/.#.#.#.#/.#.#.#.#/.#.#.#.#/.#.#.#.#/.#.#.#.#',
  dashHorz: '####..../......../......../......../....####/......../......../........',
  dashVert: '#......./#......./#......./#......./....#.../....#.../....#.../....#...',
  cross: '########/#......./#......./#......./#......./#......./#......./#.......',
  dnDiag: '#......./.#....../..#...../...#..../....#.../.....#../......#./.......#',
  upDiag: '.......#/......#./.....#../....#.../...#..../..#...../.#....../#.......',
  ltDnDiag: '#...#.../.#...#../..#...#./...#...#/#...#.../.#...#../..#...#./...#...#',
  ltUpDiag: '...#...#/..#...#./.#...#../#...#.../...#...#/..#...#./.#...#../#...#...',
  dkDnDiag: '##..##../.##..##./..##..##/#..##..#/##..##../.##..##./..##..##/#..##..#',
  dkUpDiag: '..##..##/.##..##./##..##../#..##..#/..##..##/.##..##./##..##../#..##..#',
  wdDnDiag: '##.....#/###...../.###..../..###.../...###../....###./.....###/#.....##',
  wdUpDiag: '#.....##/.....###/....###./...###../..###.../.###..../###...../##.....#',
  dashDnDiag: '......../......../#...#.../.#...#../..#...#./...#...#/......../........',
  dashUpDiag: '......../......../...#...#/..#...#./.#...#../#...#.../......../........',
  diagCross: '#......#/.#....#./..#..#../...##.../...##.../..#..#../.#....#./#......#',
  smCheck: '#..##..#/.##..##./.##..##./#..##..#/#..##..#/.##..##./.##..##./#..##..#',
  lgCheck: '####..../####..../####..../####..../....####/....####/....####/....####',
  smGrid: '########/#...#.../#...#.../#...#.../########/#...#.../#...#.../#...#...',
  lgGrid: '########/#......./#......./#......./#......./#......./#......./#.......',
  dotGrid: '#.#.#.#./......../#......./......../#......./......../#......./........',
  smConfetti: '#......./....#.../.#....../......#./...#..../.......#/..#...../.....#..',
  lgConfetti: '#.##...#/..##..../......##/...##.##/##.##.../##....../....##../#...##.#',
  horzBrick: '########/#......./#......./#......./########/....#.../....#.../....#...',
  diagBrick: '.......#/......#./.....#../....#.../...##.../..#..#../.#....#./#......#',
  solidDmnd: '...#..../..###.../.#####../#######./.#####../..###.../...#..../........',
  openDmnd: '#.....#./.#...#../..#.#.../...#..../..#.#.../.#...#../#.....#./.......#',
  dotDmnd: '#......./......../..#...#./......../....#.../......../..#...#./........',
  plaid: '#.#.#.#./.#.#.#.#/#.#.#.#./.#.#.#.#/####..../####..../####..../####....',
  sphere: '.###.###/#...#..#/#...####/#...####/.###.###/#..##.../#####.../#####...',
  weave: '#...#.../.#.#.#../..#...#./.#...#.#/#...#.../...#.#../..#...#./.#.#...#',
  divot: '......../...#..../....#.../...#..../......../#......./.......#/#.......',
  shingle: '......##/#....#../.#..#.../..##..../....##../......#./.......#/.......#',
  wave: '......../...##.../..#..#.#/##....../......../...##.../..#..#.#/##......',
  trellis: '########/.##..##./########/#..##..#/########/.##..##./########/#..##..#',
  zigZag: '#......#/.#....#./..#..#../...##.../#......#/.#....#./..#..#../...##...',
};

function rows(preset: string): number[] | undefined {
  const art = MEASURED[preset];
  if (!art) return undefined;
  return art.split('/').map(row => [...row].reduce((bits, cell, index) => (cell === '#' ? bits | (0x80 >> index) : bits), 0));
}

const BITMAPS = new Map<string, readonly number[]>();
for (const preset of PATTERN_PRESETS) {
  const bitmap = rows(preset);
  if (bitmap) BITMAPS.set(preset, Object.freeze(bitmap));
}

/** The DrawingML preset a pattern id draws as: a preset name, an alias (diagStripe), or undefined. */
export function resolvePatternPreset(preset: unknown): string | undefined {
  if (typeof preset !== 'string') return undefined;
  if (BITMAPS.has(preset)) return preset;
  return Object.hasOwn(PATTERN_PRESET_ALIASES, preset) ? PATTERN_PRESET_ALIASES[preset] : undefined;
}

/** Eight row bytes, top to bottom, most significant bit = leftmost pixel; undefined for an unknown id. */
export function patternBitmap(preset: unknown): readonly number[] | undefined {
  const resolved = resolvePatternPreset(preset);
  return resolved === undefined ? undefined : BITMAPS.get(resolved);
}

/** Horizontal runs of set pixels (`x`, `y`, `width` in tile units), in reading order. */
export function patternRuns(preset: unknown): { x: number; y: number; width: number }[] | undefined {
  const bitmap = patternBitmap(preset);
  if (!bitmap) return undefined;
  const runs: { x: number; y: number; width: number }[] = [];
  bitmap.forEach((row, y) => {
    for (let x = 0; x < 8; x++) {
      if (!(row & (0x80 >> x))) continue;
      const start = x;
      while (x + 1 < 8 && row & (0x80 >> (x + 1))) x++;
      runs.push({ x: start, y, width: x - start + 1 });
    }
  });
  return runs;
}
