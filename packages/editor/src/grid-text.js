// Spreadsheet text for the data grid (RR-24): reading pasted TSV/CSV, writing TSV, and reading and
// writing numbers in a stated number format. Everything here is pure and deterministic; nothing reads
// the clipboard, the page or the network. The rules are documented in docs/data-grid.md.
//
// Numbers are never guessed. A grid cell is read in one number format, "1,234.56" (decimal point) or
// "1.234,56" (decimal comma), chosen by the caller or taken from the locale. Text that is not a number
// in that format is reported with a reason, never turned into 0 or into a gap.

export class GridTextError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "GridTextError";
    this.code = code;
    this.details = details;
  }
}

// --- delimited text ------------------------------------------------------------------------------

const CANDIDATES = ["\t", ";", ","];

// Split `text` into records the way RFC 4180 does, with `delimiter`: fields in double quotes may hold
// the delimiter, line breaks and doubled quotes. A quote only opens a quoted field at the start of a
// field; inside an unquoted field it is plain text, as spreadsheets write it.
function split(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let closed = false;
  let started = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += char;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = "";
      closed = false;
      started = false;
    } else if (char === "\n" || char === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      closed = false;
      started = false;
      if (char === "\r" && text[index + 1] === "\n") index += 1;
    } else if (char === '"' && !started && !closed) {
      quoted = true;
      started = true;
    } else if (closed) {
      // Text after a closing quote ("a"b): keep it, as Excel and Sheets do.
      field += char;
    } else {
      started = true;
      field += char;
    }
  }
  if (quoted) throw new GridTextError("unclosed-quote", "A quoted field is never closed. Check the quotes in the pasted text.", { delimiter });
  if (field !== "" || row.length || closed || started) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function stripQuoted(line) {
  let out = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (!quoted) out += char;
  }
  return out;
}

/**
 * The delimiter of pasted text: a tab when the text has one (spreadsheets copy tab-separated), else
 * the semicolon or comma that splits every non-empty line into the same number of fields (semicolon
 * first, because comma decimals are common where semicolon CSV is), else a tab (one column).
 */
export function detectDelimiter(text) {
  const source = String(text ?? "").replace(/^\u{FEFF}/u, "");
  const lines = source.split(/\r\n|\n|\r/).map(stripQuoted).filter((line) => line.length);
  if (lines.some((line) => line.includes("\t"))) return "\t";
  for (const candidate of [";", ","]) {
    const counts = lines.map((line) => line.split(candidate).length - 1);
    if (counts.length && counts[0] > 0 && counts.every((count) => count === counts[0])) return candidate;
  }
  // Ragged but delimited: take the candidate that appears most.
  let best = "\t";
  let most = 0;
  for (const candidate of [";", ","]) {
    const total = lines.reduce((sum, line) => sum + line.split(candidate).length - 1, 0);
    if (total > most) {
      most = total;
      best = candidate;
    }
  }
  return best;
}

/**
 * Read pasted TSV or CSV text into rows of strings. The delimiter is detected unless `options.delimiter`
 * is given (one of tab, semicolon, comma). A byte-order mark is dropped and the final line break
 * is not a row. Rows keep their own lengths; use {@link rectangular} to pad them. Never reads numbers:
 * every field stays text. Throws `GridTextError` (`unclosed-quote`, `invalid-delimiter`).
 */
export function parseDelimited(text, options = {}) {
  if (typeof text !== "string") throw new GridTextError("invalid-text", "Expected text.");
  const source = text.replace(/^\u{FEFF}/u, "");
  const delimiter = options.delimiter ?? detectDelimiter(source);
  if (!CANDIDATES.includes(delimiter)) throw new GridTextError("invalid-delimiter", "The delimiter is a tab, a semicolon or a comma.", { delimiter });
  if (source === "") return { rows: [], delimiter };
  return { rows: split(source, delimiter), delimiter };
}

/** Pad ragged rows with empty text to the longest row. Returns `{ rows, width }`. */
export function rectangular(rows) {
  const width = rows.reduce((most, row) => Math.max(most, row.length), 0);
  return { rows: rows.map((row) => (row.length < width ? [...row, ...Array(width - row.length).fill("")] : row)), width };
}

/**
 * Write rows of text as TSV (default) or with another delimiter. A field is quoted when it holds the
 * delimiter, a double quote or a line break, so a spreadsheet pastes it back cell for cell.
 */
export function toDelimited(rows, options = {}) {
  const delimiter = options.delimiter ?? "\t";
  const quote = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return rows.map((row) => row.map(quote).join(delimiter)).join(options.newline ?? "\n");
}

// --- numbers -------------------------------------------------------------------------------------

/** The number formats a grid reads and writes. */
export const NUMBER_FORMATS = Object.freeze({
  ".": Object.freeze({ decimal: ".", label: "1,234.56" }),
  ",": Object.freeze({ decimal: ",", label: "1.234,56" }),
});

/**
 * The format for `format` ("." or ",", or "auto" for the locale's own decimal separator). `locale` is a
 * BCP 47 tag; without one, or for a locale this runtime does not know, the decimal point is used.
 */
export function resolveNumberFormat(format = "auto", locale) {
  if (format === "." || format === ",") return NUMBER_FORMATS[format];
  let decimal = ".";
  try {
    const part = new Intl.NumberFormat(locale || undefined).formatToParts(1.1).find((entry) => entry.type === "decimal")?.value;
    // A decimal comma, or the Arabic decimal separator, reads as a comma; everything else as a point.
    if (part === "," || part === "\u{66B}") decimal = ",";
  } catch {
    decimal = ".";
  }
  return NUMBER_FORMATS[decimal];
}

const CURRENCY = "[$€£¥₹₩₽₺₪฿₫₴₦₱₡]";
const SPACE_LIKE = /[ \xa0\u{2007}\u{2009}\u{202F}]/gu;
const alternate = (decimal) => (decimal === "." ? "," : ".");
const formatLabel = (decimal) => NUMBER_FORMATS[decimal].label;

function readBody(body, decimal) {
  const group = decimal === "." ? "," : ".";
  const esc = (char) => (char === "." ? "\\." : char);
  const match = new RegExp(`^(\\d+|\\d{1,3}(?:[${esc(group)} '\\u2019]\\d{3})+)?(?:${esc(decimal)}(\\d+))?(?:[eE]([+-]?\\d+))?$`).exec(body);
  if (!match || (match[1] === undefined && match[2] === undefined)) return undefined;
  const integer = match[1] ?? "";
  // One grouping character throughout: 1,234,567 or 1 234 567, never 1,234 567.
  const groups = new Set(integer.replace(/\d/g, "").split(""));
  if (groups.size > 1) return undefined;
  return Number(`${integer.replace(/[^\d]/g, "") || "0"}${match[2] === undefined ? "" : `.${match[2]}`}${match[3] === undefined ? "" : `e${match[3]}`}`);
}

/**
 * Read one number written in a number format (`options.decimal`, "." or ","). Returns `{ empty: true }` for
 * blank text, `{ value }` for a number and `{ error }` (a sentence for the person) for anything else.
 *
 * Accepted: an optional sign (or accounting parentheses, or a Unicode minus), one currency symbol at
 * either end, grouping with the other separator, spaces, a non-breaking or thin space or an apostrophe
 * in groups of three, the decimal separator of the format, and an exponent (1.5e3). Refused, with a
 * reason: a percent sign (45% is 45 or 0.45, the cell cannot know), the other format's separators
 * where the digits would change meaning (1,5 in "1,234.56"), letters, "NaN" and "Infinity", and
 * integers beyond 2^53. Nothing is ever read as 0.
 */
export function parseGridNumber(input, options = {}) {
  const decimal = options.decimal === "," ? "," : ".";
  if (typeof input === "number") return Number.isFinite(input) ? { value: input } : { error: "Infinity and NaN are not chart values." };
  if (typeof input === "boolean") return { error: `${input} is not a number.` };
  let text = input === null || input === undefined ? "" : String(input).trim();
  if (text === "") return { empty: true };
  const original = text;
  text = text.replace(/\u{2212}/gu, "-");
  let negative = false;
  const parenthesized = /^\((.*)\)$/.exec(text);
  if (parenthesized) {
    negative = true;
    text = parenthesized[1].trim();
  }
  let sign = /^[+-]/.exec(text)?.[0] ?? "";
  text = text.slice(sign.length).trim();
  text = text.replace(new RegExp(`^${CURRENCY}\\s*`), "");
  if (!sign) {
    sign = /^[+-]/.exec(text)?.[0] ?? "";
    text = text.slice(sign.length);
  }
  text = text.replace(new RegExp(`\\s*${CURRENCY}$`), "").trim();
  if (text.includes("%"))
    return { error: `"${original}" has a percent sign, which a chart value cannot carry. Enter 45 to mean 45 percent, or 0.45 for a fraction.` };
  const value = readBody(text.replace(SPACE_LIKE, " "), decimal);
  if (value === undefined || !Number.isFinite(value)) {
    const other = alternate(decimal);
    const elsewhere = readBody(text.replace(SPACE_LIKE, " "), other);
    const hint = elsewhere !== undefined && Number.isFinite(elsewhere)
      ? ` It reads as a number in the ${formatLabel(other)} format: switch the number format, or retype it with a ${decimal === "." ? "period" : "comma"} for the decimal.`
      : ` Use digits, an optional sign and the ${formatLabel(decimal)} format.`;
    return { error: `"${original}" is not a number in the ${formatLabel(decimal)} format.${hint}` };
  }
  let result = (negative ? -1 : 1) * (sign === "-" ? -1 : 1) * value;
  if (Number.isInteger(result) && !Number.isSafeInteger(result)) return { error: `"${original}" is too large to keep exactly.` };
  if (Object.is(result, -0)) result = 0;
  return { value: result };
}

/** Write a number in a number format: the shortest text that reads back the same, no grouping. */
export function formatGridNumber(value, options = {}) {
  const text = String(value);
  return options.decimal === "," ? text.replace(".", ",") : text;
}

/** Whether `text` is exactly how JavaScript writes the number it reads as (12, -3.5, 1e21), so storing it as a number changes nothing visible. */
export function isCanonicalNumber(text) {
  if (typeof text !== "string" || text === "" || text !== text.trim()) return false;
  const value = Number(text);
  return Number.isFinite(value) && String(value) === text && !Object.is(value, -0);
}
