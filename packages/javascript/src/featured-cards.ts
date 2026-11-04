/**
 * LH-131: the featured card of a pair or a set, read from the slide's content only (never from a slide or block id). Claude Design
 * draws the second card of a problem and its solution, or of a before and after, and the tier a pricing set marks as recommended or
 * most popular, on the slide's dark emphasis surface, with the other cards plain; this finds that card.
 *
 * - A pair: exactly two cells whose labels name opposite sides (PAIR_WORDS): the cell that names the second side ("after", "the
 *   solution") is featured, wherever it stands.
 * - A set: two to six cells of which exactly one names a featured tier (TIER_WORDS) in its label or a short text (a list's entries are
 *   features, not marks, and are not read).
 *
 * A cell is a root block that is a group (its label: its first block when that is a short text, or its first metric's label) or a
 * metric (its label); every cell of a set is of one kind, and nothing else among the root blocks is a cell. The words are those of the
 * languages engines know (engine-vocabularies `LANGUAGES`) that write them; a deck in any of them is matched whatever its `language`.
 */
// composition.ts MAX_COMPOSITION_DEPTH (not imported: composition imports this module).
const MAX_COMPOSITION_DEPTH = 32;

/** The kinds of featured cell: one side of a named pair, or the marked tier of a set. */
export type FeaturedKind = 'before-after' | 'problem-solution' | 'tier';
export interface FeaturedCells {
  kind: FeaturedKind;
  /** The root block index of the featured cell. */
  featured: number;
  /** Every cell of the pair or set, the featured one included, in block order. */
  cells: number[];
}

/** The longest label (in characters) and the most words a cell's label may have to name a side of a pair. */
export const FEATURED_LABEL_MAX_CHARACTERS = 40, FEATURED_LABEL_MAX_WORDS = 4;
/** The longest text (in characters) read for a tier's mark: a label, a price note, a tag; longer texts are content. */
export const FEATURED_MARK_MAX_CHARACTERS = 80;
/** The most cells a featured set may have (a pricing table's tiers). */
export const FEATURED_MAX_CELLS = 6;

// The two sides of each pair, first side then second (featured) side, by language. Words are matched whole and without case; words in
// scripts written without spaces (Han, kana) are matched inside the label.
const PAIR_WORDS: Readonly<Record<'before-after' | 'problem-solution', readonly [readonly string[], readonly string[]]>> = {
  'before-after': [
    ['before', 'vorher', 'avant', 'antes', 'prima', 'voor', 'vooraf', 'przed', 'до', 'önce', 'öncesi', 'قبل', 'לפני', '이전', '전', '以前', '之前', '前'],
    ['after', 'nachher', 'après', 'después', 'depois', 'dopo', 'na', 'achteraf', 'po', 'после', 'sonra', 'sonrası', 'بعد', 'אחרי', '이후', '후', '以後', '之后', '之後', '後', '后'],
  ],
  'problem-solution': [
    ['problem', 'challenge', 'issue', 'pain', 'herausforderung', 'problème', 'défi', 'problema', 'reto', 'desafío', 'desafio', 'sfida', 'probleem', 'uitdaging', 'wyzwanie', 'проблема', 'sorun', 'zorluk', 'مشكلة', 'المشكلة', 'التحدي', 'בעיה', 'הבעיה', 'אתגר', 'האתגר', '문제', '과제', '課題', '问题', '問題', '挑战', '痛点'],
    ['solution', 'answer', 'lösung', 'solución', 'solução', 'soluzione', 'oplossing', 'rozwiązanie', 'решение', 'çözüm', 'حل', 'الحل', 'פתרון', 'הפתרון', '해결책', '솔루션', '解決策', '解决方案', '解決方案', 'ソリューション'],
  ],
};
// The marks of a featured tier, by language.
const TIER_WORDS: readonly string[] = [
  'recommended', 'most popular', 'popular', 'best value', 'empfohlen', 'empfehlung', 'beliebt', 'beliebteste', 'am beliebtesten',
  'recommandé', 'recommandée', 'populaire', 'le plus populaire', 'recomendado', 'recomendada', 'más popular', 'mais popular',
  'consigliato', 'consigliata', 'più popolare', 'aanbevolen', 'populair', 'populairst', 'meest populair', 'polecany', 'polecane',
  'najpopularniejszy', 'рекомендуем', 'рекомендуемый', 'популярный', 'самый популярный', 'önerilen', 'popüler', 'en popüler',
  'موصى به', 'الأكثر شيوعا', 'الأكثر شيوعًا', 'الأكثر شعبية', 'الأكثر طلبا', 'מומלץ', 'פופולרי', 'הכי פופולרי', '추천', '인기',
  'おすすめ', 'オススメ', '推奨', '人気', '推荐', '推薦', '最受欢迎', '最受歡迎', '热门', '熱門',
];

const record = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
// A text value (a string or rich runs) as plain text.
const plain = (value: unknown): string | undefined => typeof value === 'string' ? value
  : Array.isArray(value) && value.every(run => typeof run === 'string' || typeof record(run).text === 'string') ? value.map(run => typeof run === 'string' ? run : record(run).text).join('') : undefined;
const normalize = (text: string): string => text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
// Han and kana are written without spaces, so their words are found inside the text; other words stand whole.
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const escapePattern = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const matchers = new Map<string, RegExp>();
function names(text: string, word: string): boolean {
  if (UNSPACED.test(word)) return text.includes(word);
  let pattern = matchers.get(word);
  if (!pattern) { pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapePattern(word)}(?:$|[^\\p{L}\\p{N}])`, 'u'); matchers.set(word, pattern); }
  return pattern.test(text);
}
const namesAny = (text: string, words: readonly string[]) => words.some(word => names(text, word));

// A cell's kind and its texts: `label` (what names its side), `marks` (where a tier's mark is read). Undefined for a block that is no cell.
function cellOf(block: unknown): { kind: 'group' | 'metric'; label?: string; marks: string[] } | undefined {
  const host = record(block);
  if (host.caption !== undefined) return undefined;
  if (Array.isArray(host.blocks)) {
    const marks: string[] = [];
    let label: string | undefined;
    const walk = (blocks: unknown[], depth: number) => {
      for (const child of blocks) {
        const node = record(child);
        if (Array.isArray(node.blocks)) { if (depth < MAX_COMPOSITION_DEPTH) walk(node.blocks, depth + 1); continue; }
        const text = plain(node.text), metric = record(node.metric);
        if (text !== undefined) { if (label === undefined && !marks.length) label = text; if ([...text].length <= FEATURED_MARK_MAX_CHARACTERS) marks.push(text); }
        if (node.metric !== undefined) {
          if (label === undefined && !marks.length && typeof metric.label === 'string') label = metric.label;
          for (const field of ['label', 'description']) if (typeof metric[field] === 'string' && [...metric[field]].length <= FEATURED_MARK_MAX_CHARACTERS) marks.push(metric[field]);
        }
        if (node.text === undefined && node.metric === undefined && label === undefined) label = '';
      }
    };
    walk(host.blocks, 1);
    return { kind: 'group', ...(label ? { label } : {}), marks };
  }
  if (host.metric !== undefined && Object.keys(host).every(key => ['metric', 'region', 'id', 'type', 'emphasis', 'composition'].includes(key))) {
    const metric = record(host.metric), marks = ['label', 'description'].flatMap(field => typeof metric[field] === 'string' && [...metric[field]].length <= FEATURED_MARK_MAX_CHARACTERS ? [metric[field] as string] : []);
    return { kind: 'metric', ...(typeof metric.label === 'string' ? { label: metric.label } : {}), marks };
  }
  return undefined;
}
// A label short enough to name a side: at most FEATURED_LABEL_MAX_WORDS words and FEATURED_LABEL_MAX_CHARACTERS characters.
const shortLabel = (label: string | undefined): label is string => label !== undefined && [...label.trim()].length <= FEATURED_LABEL_MAX_CHARACTERS && label.trim().split(/\s+/u).length <= FEATURED_LABEL_MAX_WORDS;

/**
 * The featured cell among a slide's root `blocks`, or undefined. `skip` leaves root blocks out (blocks composition places elsewhere).
 * The caller keeps an author's own emphasis: it does not ask when any block sets `emphasis: true`, and drops the result when the featured
 * block sets `emphasis: false`.
 */
export function featuredCells(blocks: readonly unknown[], skip: (index: number) => boolean = () => false): FeaturedCells | undefined {
  const cells: { index: number; kind: 'group' | 'metric'; label?: string; marks: string[] }[] = [];
  for (const [index, block] of blocks.entries()) {
    if (skip(index)) continue;
    const cell = cellOf(block);
    if (cell) cells.push({ index, ...cell });
  }
  if (cells.length < 2 || cells.length > FEATURED_MAX_CELLS || new Set(cells.map(cell => cell.kind)).size !== 1) return undefined;
  const indexes = cells.map(cell => cell.index);
  if (cells.length === 2) {
    const [first, second] = cells.map(cell => shortLabel(cell.label) ? normalize(cell.label) : undefined);
    if (first !== undefined && second !== undefined) for (const kind of ['before-after', 'problem-solution'] as const) {
      const [opening, closing] = PAIR_WORDS[kind];
      const sides = [first, second].map(label => namesAny(label, opening) ? namesAny(label, closing) ? undefined : 'first' : namesAny(label, closing) ? 'second' : undefined);
      if (sides[0] && sides[1] && sides[0] !== sides[1]) return { kind, featured: cells[sides[0] === 'second' ? 0 : 1]!.index, cells: indexes };
    }
  }
  const marked = cells.filter(cell => cell.marks.some(text => namesAny(normalize(text), TIER_WORDS)));
  return marked.length === 1 ? { kind: 'tier', featured: marked[0]!.index, cells: indexes } : undefined;
}
