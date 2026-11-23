import { isRecord, visitContentPayloads } from "./content-walk.js";

/**
 * v0.35: the language a slide's text implies when the document declares none.
 *
 * A deck written in Arabic or Hebrew with no `language` was laid out left to right, as English, with whatever face had the
 * letters. Now a slide (or, for the deck as a whole, all slides) whose letters are mostly of one right-to-left script is resolved
 * as that script's language: `ar` for the Arabic script, `he` for Hebrew. The slide then gets what a deck that declares the
 * language gets: the script's default fonts, a right-to-left layout and the language tag in the exported file. Only these two
 * scripts are read from the text: for any other script the language changes less than the direction does, and one script can be
 * many languages. A declared language, on the deck, the slide or as an option, always wins; `opf/missing-language` says what
 * was read from the text.
 *
 * Pure: no fonts, catalogs or DOM. The letters counted are the slide's title, subtitle and tag and, in every block, its text,
 * list items (with their descriptions) and table cells. Notes are not drawn on the slide and do not count.
 */
const RTL_SCRIPTS: readonly (readonly [language: string, letters: RegExp])[] = [
  ["ar", /(?=\p{L})\p{Script=Arabic}/gu],
  ["he", /(?=\p{L})\p{Script=Hebrew}/gu],
];
const LETTERS = /\p{L}/gu;

/** The plain text of a text value: a string, rich runs, or an object with `text`. */
function plain(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((run) => (typeof run === "string" ? run : isRecord(run) && typeof run.text === "string" ? run.text : "")).join("");
  if (isRecord(value) && value.text !== undefined) return plain(value.text);
  return "";
}

/** The text a slide draws, joined. */
function slideText(slide: Record<string, unknown>): string {
  const parts: string[] = [plain(slide.title), plain(slide.subtitle), plain(slide.tag)];
  const payload = (node: Record<string, unknown>) => {
    parts.push(plain(node.text));
    for (const field of ["items", "bullets"] as const) {
      const list = node[field];
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        parts.push(plain(entry));
        if (isRecord(entry)) parts.push(plain(entry.description));
      }
    }
    const table = isRecord(node.table) ? node.table : undefined;
    for (const cell of Array.isArray(table?.columns) ? table.columns : []) parts.push(isRecord(cell) && typeof cell.name === "string" ? cell.name : plain(isRecord(cell) && "value" in cell ? cell.value : cell));
    for (const row of Array.isArray(table?.rows) ? table.rows : []) for (const cell of Array.isArray(row) ? row : []) parts.push(plain(isRecord(cell) && "value" in cell ? cell.value : cell));
  };
  payload(slide);
  visitContentPayloads(slide, "", (node) => payload(node));
  return parts.join("\n");
}

/**
 * The language tag the text of slide `slideIndex` implies (of all slides when it is undefined): `ar` or `he` when more than
 * half of the letters are of that script, otherwise undefined. Only call it for a document that declares no language.
 */
export function languageOfText(document: Record<string, unknown>, slideIndex?: number): string | undefined {
  const slides = Array.isArray(document.slides) ? document.slides : [];
  const chosen = slideIndex === undefined ? slides : [slides[slideIndex]];
  let text = "";
  for (const slide of chosen) if (isRecord(slide)) text += `${slideText(slide)}\n`;
  if (!text.trim()) return undefined;
  const letters = text.match(LETTERS)?.length ?? 0;
  if (!letters) return undefined;
  for (const [language, pattern] of RTL_SCRIPTS) {
    if ((text.match(pattern)?.length ?? 0) * 2 > letters) return language;
  }
  return undefined;
}
