// The diagram's own size limits, below pele's defaults: a slide holds one readable drawing, not a document. They live here, apart from
// diagram.ts, because OPF's DOT and PlantUML readers (loaded on demand in a browser) enforce them themselves: a reader is also a public
// export, called with any text, so it never relies on its caller having checked the source.

/** The longest diagram source, in characters. */
export const DIAGRAM_SOURCE_LIMIT = 20000;
/** The most edges, messages, relations or arrows in one diagram. */
export const DIAGRAM_MAX_EDGES = 500;
/** How many times DOT subgraphs, PlantUML blocks or mind map levels nest: deeper drawings are unreadable on a slide and, written out, grow with the square of the depth. */
export const DIAGRAM_MAX_NESTING = 16;
/** pele's limit on the source a reader writes for it (a translated source is longer than what the author wrote). */
export const DIAGRAM_TRANSLATED_LIMIT = DIAGRAM_SOURCE_LIMIT * 16;
