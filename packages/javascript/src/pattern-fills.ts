/**
 * DrawingML preset pattern fills (ECMA-376 20.1.10.51 ST_PresetPatternVal) as 8x8 bitmaps,
 * shared by the SVG preview (RR-07) and the PPTX export, which writes the same names as native
 * `a:pattFill prst="..."`.
 *
 * ECMA-376 names the 54 presets but does not define their pixels; PowerPoint draws each as an
 * 8x8 one-bit tile (the same hatch set GDI+ calls HatchStyle). These tiles are authored for this
 * project from the preset names and the PowerPoint pattern gallery, without copying any
 * third-party table: lines and grids are written as formulas, the percent tints as an
 * ordered-dither (Bayer) tile, and the irregular presets as pixel art. Each tile is one pixel =
 * one 1/96 inch unit, anchored at the top-left of the filled shape, foreground where a bit is
 * set. `scripts/derive-pattern-bitmaps.mjs` in opf-render compares or replaces a tile from a
 * PowerPoint export when the native check disagrees.
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

const BAYER_COUNT: Record<string, number> = {
  pct5: 4, pct10: 6, pct20: 13, pct25: 16, pct30: 19, pct40: 26, pct50: 32, pct60: 38, pct70: 45, pct75: 48, pct80: 51, pct90: 58,
};
const BAYER2 = [[0, 2], [3, 1]];
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
/** 8x8 Bayer threshold: 4 * M4 + M2 of the quadrant. */
const bayer = (x: number, y: number) => 4 * BAYER4[y % 4]![x % 4]! + BAYER2[y >> 2]![x >> 2]!;

const mod = (value: number) => ((value % 8) + 8) % 8;
type Rule = (x: number, y: number) => boolean;
const WAVE = [4, 2, 1, 2, 4, 6, 7, 6];
const ZIG = [0, 1, 2, 3, 3, 2, 1, 0];

const RULES: Record<string, Rule> = {
  horz: (_x, y) => y === 0,
  vert: x => x === 0,
  ltHorz: (_x, y) => y % 4 === 0,
  ltVert: x => x % 4 === 0,
  dkHorz: (_x, y) => y % 4 < 2,
  dkVert: x => x % 4 < 2,
  narHorz: (_x, y) => y % 2 === 0,
  narVert: x => x % 2 === 0,
  dashHorz: (x, y) => (y === 0 && x < 4) || (y === 4 && x >= 4),
  dashVert: (x, y) => (x === 0 && y < 4) || (x === 4 && y >= 4),
  cross: (x, y) => x === 0 || y === 0,
  dnDiag: (x, y) => mod(x - y) === 0,
  upDiag: (x, y) => mod(x + y) === 7,
  ltDnDiag: (x, y) => mod(x - y) % 4 === 0,
  ltUpDiag: (x, y) => mod(x + y) % 4 === 3,
  dkDnDiag: (x, y) => mod(x - y) % 4 < 2,
  dkUpDiag: (x, y) => mod(x + y) % 4 >= 2,
  wdDnDiag: (x, y) => mod(x - y) < 3,
  wdUpDiag: (x, y) => mod(x + y) >= 5,
  dashDnDiag: (x, y) => mod(x - y) % 4 === 0 && x % 4 < 2,
  dashUpDiag: (x, y) => mod(x + y) % 4 === 3 && x % 4 < 2,
  diagCross: (x, y) => mod(x - y) % 4 === 0 || mod(x + y) % 4 === 3,
  smCheck: (x, y) => ((x >> 1) + (y >> 1)) % 2 === 0,
  lgCheck: (x, y) => ((x >> 2) + (y >> 2)) % 2 === 0,
  smGrid: (x, y) => x % 4 === 0 || y % 4 === 0,
  lgGrid: (x, y) => x === 0 || y === 0,
  dotGrid: (x, y) => (y % 4 === 0 && x % 2 === 0) || (x % 4 === 0 && y % 2 === 0),
  solidDmnd: (x, y) => Math.abs(x - 3.5) + Math.abs(y - 3.5) <= 3,
  openDmnd: (x, y) => mod(x + y) === 3 || mod(x - y) === 4,
  dotDmnd: (x, y) => (mod(x + y) === 3 || mod(x - y) === 4) && x % 2 === 0,
  plaid: (x, y) => ((y < 4 || x < 4) && (x + y) % 2 === 0),
  trellis: (x, y) => mod(x - y) < 2 || mod(x + y) >= 6,
  wave: (x, y) => WAVE[x] === y,
  diagBrick: (x, y) => mod(x + y) % 4 === 3 || (x === 0 && y === 0) || (x === 1 && y === 1) || (x === 4 && y === 0) || (x === 5 && y === 1),
  zigZag: (x, y) => y === ZIG[x] || y === ZIG[x]! + 4,
};

const ART: Record<string, string[]> = {
  smConfetti: ['#...#...', '.....#..', '..#.....', '.......#', '.#...#..', '....#...', '#.....#.', '...#....'],
  lgConfetti: ['##....##', '##....##', '..##....', '..##....', '....##..', '....##..', '##....##', '##....##'],
  horzBrick: ['########', '#.......', '#.......', '#.......', '########', '....#...', '....#...', '....#...'],
  sphere: ['.##..##.', '#..##..#', '#..##..#', '.##..##.', '.##..##.', '#..##..#', '#..##..#', '.##..##.'],
  weave: ['#####.#.', '....#.#.', '#####.#.', '....#.#.', '#.#.####', '#.#.....', '#.#.####', '#.#.....'],
  divot: ['#.#.....', '.#......', '........', '........', '....#.#.', '.....#..', '........', '........'],
  shingle: ['##......', '..##....', '....##..', '......##', '##......', '..##....', '....##..', '......##'],
};

function rows(preset: string): number[] | undefined {
  const art = ART[preset];
  if (art) return art.map(row => [...row].reduce((bits, cell, index) => cell === '#' ? bits | (0x80 >> index) : bits, 0));
  const count = BAYER_COUNT[preset];
  const rule = count !== undefined ? ((x: number, y: number) => bayer(x, y) < count) : RULES[preset];
  if (!rule) return undefined;
  return Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => rule(x, y) ? 0x80 >> x : 0).reduce((a, b) => a | b, 0));
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
