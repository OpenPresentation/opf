// Language tags, right-to-left paragraphs and East Asian/complex-script fonts
// (font-fidelity-everywhere FF-07). Core's resolveScriptFonts() owns the model;
// this module only writes its result into the package PptxGenJS generated, and
// reads it back on import. Design: core docs/programs/font-fidelity-everywhere/
// script-font-model.md ("OOXML mapping").
//
// Core releases before the resolver (0.11.0 and earlier) export no
// resolveScriptFonts. The exporter then writes exactly what it wrote before
// FF-07 (lang="en-US", empty theme ea/cs, no rtl) and reports
// `language-export-unavailable` for a document that names a language. A core
// with the resolver but without paragraphDirection() marks no paragraph
// direction and reports `paragraph-direction-unavailable` for an RTL deck.
import * as opfCore from "@openpresentation/opf";

const resolver = typeof opfCore.resolveScriptFonts === "function" ? opfCore.resolveScriptFonts : null;
// RR-05: authored alignment is logical for right-to-left text (`left` is the start edge). Core owns the rule; a core without it
// reports no line directions either, so the fallback never has anything to flip.
export const physicalAlignment = typeof opfCore.physicalAlignment === "function" ? opfCore.physicalAlignment : alignment => alignment;
// The one paragraph-direction rule shared with the renderer (core FF-07).
const paragraphDirection = typeof opfCore.paragraphDirection === "function" ? opfCore.paragraphDirection : null;

const SCRIPT_SLOTS = [["ea", "eastAsian"], ["cs", "complexScript"]];

/** Whether the installed core exports the FF-18 language/script resolver. */
export function scriptFontsAvailable() {
  return resolver !== null;
}

/**
 * Resolve the deck (slide 0, which also sets the theme) and every slide.
 * Returns null when core has no resolver.
 */
export function planScriptFonts(presentation, report) {
  if (!resolver) {
    if (presentation.language !== undefined) report?.({code: "language-export-unavailable", path: "language",
      message: "The installed @openpresentation/opf has no resolveScriptFonts, so the PPTX keeps lang=\"en-US\", empty theme East Asian/complex-script fonts and left-to-right paragraphs. Use a core release with the FF-18 language model."});
    return null;
  }
  const count = Array.isArray(presentation.slides) ? presentation.slides.length : 0;
  let slides, deck;
  try {
    slides = Array.from({length: count}, (_, slideIndex) => resolver(presentation, {slideIndex}));
    deck = slides[0] ?? resolver(presentation);
  } catch (error) {
    // Keep exporting as before FF-07 rather than failing on the language model.
    report?.({code: "language-export-unavailable", path: "language",
      message: `Script fonts could not be resolved (${error instanceof Error ? error.message : String(error)}), so the PPTX keeps lang="en-US", empty theme East Asian/complex-script fonts and left-to-right paragraphs.`});
    return null;
  }
  if (presentation.language !== undefined && deck.languageSource === "default") {
    report?.({code: "language-unresolved", path: "language",
      message: `The presentation language could not be resolved locally (a URL, pkg: reference or unknown id), so the PPTX uses ${deck.lang}.`});
  }
  let rtl = deck.rtl;
  if (rtl && !paragraphDirection) {
    rtl = false;
    report?.({code: "paragraph-direction-unavailable", path: "language",
      message: "The installed @openpresentation/opf has no paragraphDirection, so right-to-left paragraphs are not marked; the preview and export must share that rule. Use a core release that exports it."});
  }
  return {deck, slides, lang: deck.lang, rtl, contentEastAsian: contentEastAsianFonts(presentation, deck, report)};
}

// FF-05: East Asian characters in a deck whose own language has no East Asian font (an English deck with Japanese
// text) still need a real East Asian theme font; an empty slot reads as an unresolved +mn-ea in PowerPoint. The
// script of the text picks the language core resolves it for: kana is Japanese, hangul Korean, Han alone Simplified
// Chinese. Returns {heading, body} families, or null when the deck language already selects one or the text has none.
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u, HANGUL = /\p{Script=Hangul}/u, HAN = /\p{Script=Han}/u;
function contentEastAsianFonts(presentation, deck, report) {
  if (deck.sources.eastAsian !== "latin") return null;
  let kana = false, hangul = false, han = false;
  const seen = new Set();
  const walk = value => {
    if (typeof value === "string") {
      kana ||= KANA.test(value); hangul ||= HANGUL.test(value); han ||= HAN.test(value);
    } else if (value && typeof value === "object" && !seen.has(value)) {
      seen.add(value);
      for (const item of Object.values(value)) walk(item);
    }
  };
  walk(presentation.slides);
  const language = kana ? "japanese" : hangul ? "korean" : han ? "chinese-simplified" : null;
  if (!language) return null;
  try {
    const resolved = resolver({...presentation, language}, {slideIndex: 0});
    return resolved.sources.eastAsian === "latin" ? null : {heading: resolved.heading.eastAsian, body: resolved.body.eastAsian};
  } catch (error) {
    report?.({code: "language-export-unavailable", path: "language",
      message: `East Asian theme fonts for the East Asian text could not be resolved (${error instanceof Error ? error.message : String(error)}); the theme names the latin family for them.`});
    return null;
  }
}

// RR-17 (RR-42 native run, 2026-10-02): Office's theme carries per-language script entries that core's script model does
// not name, because the language is written in a script core treats as Latin or as the plain complex-script slot:
// `Viet` (Vietnamese, `vi`) and `Uigh` (Uyghur, `ug`). PowerPoint applies the entry to runs in that language and lists its
// family in Presentation.Fonts, so the Office default (Viet: Times New Roman / Arial) named a font the deck never uses.
// The deck's own language entry names the family the deck uses for its text: the theme latin family (major latin in
// majorFont, minor latin in minorFont); for Uyghur, the complex-script family when the deck selects one. Entries for
// other languages stay as vendored.
const LANGUAGE_SCRIPT_SUPPLEMENTS = [[/^vi(?:-|$)/i, "Viet"], [/^ug(?:-|$)/i, "Uigh"]];
function languageScriptSupplement(deck) {
  const match = LANGUAGE_SCRIPT_SUPPLEMENTS.find(([tag]) => tag.test(String(deck.lang ?? "")));
  if (!match) return undefined;
  const script = match[1];
  const role = script === "Uigh" && deck.sources?.complexScript && deck.sources.complexScript !== "latin" ? "complexScript" : "latin";
  return {script, heading: deck.heading?.[role], body: deck.body?.[role]};
}

const escapeAttribute = value => String(value).replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;"}[char]));

/**
 * Theme major/minor ea/cs from the resolved heading/body slots, and the
 * language's own per-script supplement. Only the supplement's script entry
 * changes; the rest of the vendored per-script list is FF-08's call.
 *
 * FF-49: a slot is written only when a script font is actually selected for it,
 * that is when the resolver's source for that slot is not `latin`: the design
 * font scheme's explicit `eastAsian`/`complexScript`, the scheme's own script
 * family, or the language's script font (Model C). Every other slot keeps the
 * vendored empty typeface, exactly as Office's own themes leave it, so PowerPoint
 * picks its per-language default for script text typed later and the package
 * names nothing the author did not select (core script-font-model.md, "Theme
 * slots (FF-49)"). Latin, Cyrillic and Greek decks keep both slots empty, and a
 * Japanese deck writes `ea` only.
 */
export function themeScriptFonts(xml, plan) {
  const {heading, body} = plan.deck;
  // Core's supplement (the language's script entry, such as Arab for Uyghur) and the language's own entry (Viet, Uigh).
  const supplements = [plan.deck.supplement, languageScriptSupplement(plan.deck)].filter((entry, index, all) => entry && all.findIndex(other => other?.script === entry.script) === index);
  for (const [tag, slots, role] of [["majorFont", heading, "heading"], ["minorFont", body, "body"]]) {
    xml = xml.replace(new RegExp(`<a:${tag}>[\\s\\S]*?</a:${tag}>`), block => {
      for (const [element, slot] of SCRIPT_SLOTS) {
        // FF-05: the East Asian slot always names a font (a script font, a font for the East Asian text, else the latin
        // family): PowerPoint lists an empty slot as an empty-name font through every paragraph end mark. Complex script
        // stays empty unless a script font is selected.
        const content = element === "ea" && plan.deck.sources[slot] === "latin" ? plan.contentEastAsian?.[tag === "majorFont" ? "heading" : "body"] : undefined;
        if (plan.deck.sources[slot] === "latin" && element !== "ea") continue;
        const face = escapeAttribute(content ?? slots[slot]);
        block = block.replace(new RegExp(`<a:${element}\\b[^>]*/>`), `<a:${element} typeface="${face}"/>`);
      }
      for (const supplement of supplements) {
        const family = supplement[role];
        if (!family) continue;
        const entry = `<a:font script="${supplement.script}" typeface="${escapeAttribute(family)}"/>`;
        const existing = new RegExp(`<a:font script="${supplement.script}" typeface="[^"]*"/>`);
        block = existing.test(block) ? block.replace(existing, entry) : block.replace(`</a:${tag}>`, `${entry}</a:${tag}>`);
      }
      return block;
    });
  }
  return xml;
}

// PptxGenJS writes run fonts as latin/ea/cs triples naming one face (charts
// may omit ea). Theme references (+mj-lt, +mn-ea) are left alone.
const RUN_FONTS = /(<a:latin typeface="([^"]*)"[^>]*\/>)(\s*)(<a:ea typeface="([^"]*)"[^>]*\/>)?(\s*)(<a:cs\s+typeface="([^"]*)"[^>]*\/>)?/g;

/**
 * Explicit run ea/cs from the resolved slots. A slot whose source is `latin`
 * (no script-specific font was chosen) keeps repeating the run's own face, as
 * before FF-07, so Latin decks keep their run bytes. Otherwise the run's role
 * picks the heading or body slot: its face when that names exactly one role,
 * else the shape (native OPF headings are heading, everything else body).
 */
function runScriptFonts(xml, resolved, headingShape) {
  return xml.replace(RUN_FONTS, (match, latinElement, latin, gap1, eaElement = "", ea, gap2, csElement = "", cs) => {
    if (latin.startsWith("+")) return match;
    const isHeading = escapeAttribute(resolved.heading.latin) === latin, isBody = escapeAttribute(resolved.body.latin) === latin;
    const slots = isHeading !== isBody ? (isHeading ? resolved.heading : resolved.body) : headingShape ? resolved.heading : resolved.body;
    // Only a slot that repeats the run's face and has a script-specific choice
    // changes; it then drops PptxGenJS's pitch/charset hints for that face.
    const slot = (element, key, face, original) => {
      const target = escapeAttribute(slots[key]);
      return face === latin && resolved.sources[key] !== "latin" && target !== face ? `<a:${element} typeface="${target}"/>` : original;
    };
    return `${latinElement}${gap1}${slot("ea", "eastAsian", ea, eaElement)}${gap2}${slot("cs", "complexScript", cs, csElement)}`;
  });
}

const RUN_LANGUAGE = /(<a:(?:rPr|endParaRPr|defRPr)\b[^>]*?\slang=")en-US(")/g;

const decodeText = value => value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos));/gi, (entity, decimal, hex, name) =>
  decimal ? String.fromCodePoint(Number(decimal)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : {amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'"}[name.toLowerCase()]);

/**
 * RR-05 bidi runs. PowerPoint treats the digits of a run tagged with a right-to-left language as numbers of that language and
 * orders them as their own item, so "v2.0" or "PowerPoint 365" inside an Arabic or Hebrew run reads "2.0v" or "365PowerPoint".
 * Splitting each left-to-right Latin phrase into its own run tagged en-US keeps it one item that PowerPoint orders left to right.
 */
const LATIN_WORD = /[0-9\p{Script=Latin}]/u, LATIN_LETTER = /\p{Script=Latin}/u, PHRASE_JOINER = /[ \u00a0.,:;&'\u2019/+*_@#=-]/;

/** Ranges [start, end) of the Latin phrases of a decoded string: a Latin letter through the last Latin letter or digit joined by spaces and word punctuation. */
export function latinPhrases(text) {
  const ranges = [];
  for (let index = 0; index < text.length;) {
    const char = String.fromCodePoint(text.codePointAt(index));
    if (!LATIN_LETTER.test(char)) { index += char.length; continue; }
    let end = index + char.length;
    for (let cursor = end; cursor < text.length;) {
      const next = String.fromCodePoint(text.codePointAt(cursor));
      if (LATIN_WORD.test(next)) { cursor += next.length; end = cursor; continue; }
      if (!PHRASE_JOINER.test(next)) break;
      // Joiners count only when a Latin letter or digit follows them directly.
      let after = cursor + next.length;
      while (after < text.length && PHRASE_JOINER.test(text[after])) after += 1;
      if (after < text.length && LATIN_WORD.test(String.fromCodePoint(text.codePointAt(after)))) cursor = after; else break;
    }
    ranges.push([index, end]);
    index = end;
  }
  return ranges;
}

const encodeText = value => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const RUN = /<a:r>(<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*[^/]>[\s\S]*?<\/a:rPr>)<a:t>([^<]*)<\/a:t><\/a:r>/g;

/** Split the runs of a right-to-left paragraph so each Latin phrase is its own en-US run. */
function splitLatinRuns(body) {
  return body.replace(RUN, (run, properties, escaped) => {
    const text = decodeText(escaped), phrases = latinPhrases(text);
    if (!phrases.length) return run;
    const make = (value, lang) => `<a:r>${lang ? properties.replace(/\slang="[^"]*"/, ` lang="${lang}"`) : properties}<a:t>${encodeText(value)}</a:t></a:r>`;
    const pieces = [];
    let cursor = 0;
    for (const [from, to] of phrases) {
      if (from > cursor) pieces.push(make(text.slice(cursor, from)));
      pieces.push(make(text.slice(from, to), "en-US"));
      cursor = to;
    }
    if (cursor < text.length) pieces.push(make(text.slice(cursor)));
    return pieces.join("");
  });
}

/**
 * In a right-to-left deck every paragraph states its direction. The writers mark the lines of a paragraph they laid out
 * (rtl="1", the direction core computed once for the whole paragraph, so wrapped lines never differ); any other paragraph takes
 * core's paragraphDirection() over its own text: rtl="1" when it is right-to-left, else an explicit rtl="0", because the master
 * default levels start right-to-left. A right-to-left paragraph with no explicit alignment starts at the right edge (logical
 * alignment: the master default is left), and its Latin phrases become en-US runs (see splitLatinRuns). With `notes` the
 * alignment is also set on an explicit left paragraph, because the notes writers pass no alignment of their own.
 */
function paragraphRtl(xml, deckDirection, {notes = false} = {}) {
  return xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (paragraph, body) => {
    const text = [...body.matchAll(/<a:t>([^<]*)<\/a:t>|<a:br\b/g)].map(match => match[1] === undefined ? "\n" : decodeText(match[1])).join("");
    const properties = /^(\s*)<a:pPr\b([^>]*?)(\/?)>/.exec(body);
    const marked = properties && / rtl="([01])"/.exec(properties[2]);
    const rtl = marked ? marked[1] === "1" : paragraphDirection(text, deckDirection) === "rtl";
    const value = rtl ? "1" : "0";
    if (rtl) body = splitLatinRuns(body);
    if (!properties) return `<a:p><a:pPr rtl="${value}"${rtl ? " algn=\"r\"" : ""}/>${body}</a:p>`;
    let attributes = / rtl="[^"]*"/.test(properties[2]) ? properties[2].replace(/ rtl="[^"]*"/, ` rtl="${value}"`) : `${properties[2]} rtl="${value}"`;
    if (rtl) {
      if (!/\salgn="/.test(attributes)) attributes += " algn=\"r\"";
      else if (notes) attributes = attributes.replace(/ algn="l"/, " algn=\"r\"");
    }
    return `<a:p>${properties[1]}<a:pPr${attributes}${properties[3]}>${body.slice(properties[0].length)}</a:p>`;
  });
}

/** Tables of a right-to-left deck run right to left: the first column is the rightmost, as core's layout draws it. */
const tableRtl = xml => xml.replace(/<a:tblPr\b([^>]*?)(\/?)>/g, (match, attributes, close) => / rtl="/.test(attributes) ? match : `<a:tblPr rtl="1"${attributes}${close}>`);

/**
 * Master, layout and presentation default paragraph levels start right-to-left, and a left-aligned level starts at the right edge
 * (logical alignment): text typed later in an Arabic or Hebrew deck then reads and aligns as the exported slides do.
 */
const levelRtl = xml => xml.replace(/<a:(?:lvl\dpPr|defPPr)\b[^>]*?\srtl="0"[^>]*>/g, level => level.replace(/\srtl="0"/, " rtl=\"1\"").replace(/\salgn="l"/, " algn=\"r\""));

/**
 * Apply the plan to one generated XML part. `slideIndex` names the slide a
 * slide, chart or notes part belongs to.
 */
export function partScriptFonts(path, xml, plan, slideIndex) {
  if (/^ppt\/theme\/theme\d+\.xml$/.test(path)) return themeScriptFonts(xml, plan);
  if (!path.startsWith("ppt/") || !path.endsWith(".xml")) return xml;
  const resolved = plan.slides[slideIndex] ?? plan.deck;
  if (plan.lang !== "en-US") xml = xml.replace(RUN_LANGUAGE, `$1${escapeAttribute(plan.lang)}$2`);
  if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) {
    xml = xml.replace(/<p:(sp|graphicFrame)>[\s\S]*?<\/p:\1>/g, shape =>
      runScriptFonts(shape, resolved, /<p:cNvPr\b[^>]*\bname="OPF heading /.test(shape)));
    if (plan.rtl) xml = tableRtl(paragraphRtl(xml, plan.deck.direction));
  } else if (/^ppt\/(?:charts\/chart(?:Ex)?|notesSlides\/notesSlide)\d+\.xml$/.test(path)) {
    xml = runScriptFonts(xml, resolved, false);
    if (plan.rtl && path.startsWith("ppt/notesSlides/")) xml = paragraphRtl(xml, plan.deck.direction, {notes: true});
  } else if (plan.rtl && /^ppt\/(?:slideMasters\/slideMaster\d+|slideLayouts\/slideLayout\d+|notesMasters\/notesMaster\d+|presentation)\.xml$/.test(path)) {
    xml = levelRtl(xml);
  }
  return xml;
}

// ---------------------------------------------------------------------------
// Import

const LANGUAGE_TAG = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const attribute = (xml, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(xml)?.[1];

/**
 * Match an OOXML run language to the OPF language to import. A catalog id is
 * used when that record exports exactly this tag again: an exact BCP-47 tag,
 * then a curated `ooxmlLang` (preferring the same primary language). A tag
 * that core still resolves to a catalog record (for example en-NZ to English)
 * is imported as the tag itself, so it round-trips. Without core's resolver,
 * a record whose tag is the primary language alone is accepted too.
 * Returns {language, record, shared} or null when nothing matches.
 */
export function matchCatalogLanguage(lang, catalogs) {
  const records = Array.isArray(catalogs?.languages) ? catalogs.languages : [];
  const key = lang.toLowerCase(), primary = key.split("-")[0];
  const lower = value => typeof value === "string" ? value.toLowerCase() : undefined;
  const shared = records.filter(record => lower(record.bcp47) === key || lower(record.ooxmlLang) === key);
  const exports = record => !resolver || resolver({language: record.id}).lang.toLowerCase() === key;
  const record = shared.find(record => lower(record.bcp47) === key && exports(record))
    ?? shared.find(record => lower(record.bcp47)?.split("-")[0] === primary && exports(record))
    ?? shared.find(exports);
  if (record) return {language: record.id, record, shared};
  if (resolver) {
    const resolved = resolver({language: lang});
    // A tag core cannot resolve falls back to its default language; that is no match.
    const matched = resolved.languageSource !== "default" && resolved.languageId && records.find(candidate => candidate.id === resolved.languageId);
    return matched ? {language: lang, record: matched, shared: []} : null;
  }
  const byPrimary = records.find(candidate => lower(candidate.bcp47) === primary);
  return byPrimary ? {language: byPrimary.id, record: byPrimary, shared: []} : null;
}

/**
 * Observe the presentation language in run `lang`. `slides` and `theme` are
 * XML strings. `language` is a catalog id, the run's tag when no catalog
 * record matches, or undefined when the runs carry no language; `lang` is the
 * dominant run tag itself. Nothing is reported here: languageDiagnostics()
 * reports against the final imported document, after FF-32 provenance.
 */
export function observeLanguage({slides, theme, catalogs}) {
  const counts = new Map();
  let rtlParagraphs = 0;
  for (const xml of slides) {
    for (const [, lang] of xml.matchAll(/<a:rPr\b[^>]*?\slang="([^"]+)"/g)) {
      // Values that name no language are not counted: malformed tags, x-none, und and zxx.
      if (!LANGUAGE_TAG.test(lang) || /^(?:und|zxx)(?:-|$)/i.test(lang)) continue;
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
    rtlParagraphs += xml.match(/<a:pPr\b[^>]*?\srtl="1"/g)?.length ?? 0;
  }
  const ranked = [...counts].sort((left, right) => right[1] - left[1] || (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0));
  const lang = ranked[0]?.[0];
  const match = lang === undefined ? null : matchCatalogLanguage(lang, catalogs);
  return {lang, language: lang === undefined ? undefined : match?.language ?? lang, match, ranked, rtlParagraphs, theme};
}

/**
 * Reconcile the observed language with a stored FF-32 `language` reference.
 * The stored reference wins while the runs still carry its OOXML tag (or no
 * tag, or it cannot be resolved locally); otherwise the observed language
 * stays and `metadata-reference-changed` names the reference. Returns the
 * provenance groups to apply.
 */
export function reconcileLanguage(groups, observed, report) {
  const index = groups.findIndex(item => item.field === "language");
  if (index < 0 || observed.lang === undefined || !resolver) return groups;
  const stored = groups[index].ops.find(op => op.path?.length === 1 && op.path[0] === "language")?.value;
  if (stored === undefined) return groups;
  const resolved = resolver({language: stored});
  if (resolved.languageSource === "default" || resolved.lang.toLowerCase() === observed.lang.toLowerCase()) return groups;
  report?.({code: "metadata-reference-changed", path: "language",
    message: `Runs now use ${observed.lang}, not ${resolved.lang} of the stored language, so the stored language was not restored; the imported language follows the runs.`});
  return groups.filter((_, position) => position !== index);
}

/**
 * Diagnostics for the final imported document: several run languages, a run
 * tag that maps ambiguously or to no catalog record (only when that observed
 * language was kept), right-to-left paragraphs under a left-to-right
 * language, and theme East Asian/complex-script fonts the document does not
 * reproduce.
 */
/** Whether the language observed in the runs is written right to left. */
export function observedRtl(observed) {
  if (observed.lang === undefined) return false;
  try { return resolver ? resolver({language: observed.language}).rtl === true : observed.match?.record.direction === "rtl"; } catch { return false; }
}

export function languageDiagnostics(imported, observed, report) {
  if (!report) return;
  const {lang, match, ranked, rtlParagraphs, theme} = observed;
  if (lang === undefined) {
    if (rtlParagraphs) report({code: "rtl-language-mismatch", path: "language", message: `${rtlParagraphs} right-to-left paragraph(s) carry no run language, so no presentation language was imported.`});
    return;
  }
  // RR-05: a right-to-left deck's Latin phrases are their own en-US runs; they are not a second presentation language.
  const languages = observedRtl(observed) ? ranked.filter(([tag]) => tag === lang || tag !== "en-US") : ranked;
  if (languages.length > 1) {
    report({code: "mixed-run-languages", path: "language",
      message: `Runs use ${languages.length} languages (${languages.map(([tag, count]) => `${tag} x${count}`).join(", ")}). OPF has one presentation language, so ${lang} was imported.`});
  }
  const kept = imported.language === observed.language;
  if (kept && !match) report({code: "language-uncatalogued", path: "language", message: `Run language ${lang} matches no languages catalog record; it was imported as a BCP-47 tag.`});
  else if (kept && match.shared.length > 1 && !match.shared.some(record => record.bcp47?.toLowerCase() === lang.toLowerCase())) {
    report({code: "language-ambiguous", path: "language",
      message: `Run language ${lang} is the OOXML tag of ${match.shared.map(record => record.id).join(", ")}; ${match.language} was imported.`});
  }
  const resolved = resolver ? resolver(imported) : null;
  const rtl = resolved ? resolved.rtl : match?.record.direction === "rtl";
  if (rtlParagraphs && !rtl) {
    report({code: "rtl-language-mismatch", path: "language", message: `${rtlParagraphs} right-to-left paragraph(s) do not match the left-to-right language ${typeof imported.language === "string" ? imported.language : lang}; paragraph direction is not imported separately.`});
  }
  if (theme && resolved) {
    for (const [tag, role] of [["majorFont", "heading"], ["minorFont", "body"]]) {
      const block = new RegExp(`<a:${tag}>[\\s\\S]*?</a:${tag}>`).exec(theme)?.[0];
      if (!block) continue;
      const latin = attribute(/<a:latin\b[^>]*\/>/.exec(block)?.[0] ?? "", "typeface");
      for (const [element, slot] of SCRIPT_SLOTS) {
        const face = attribute(new RegExp(`<a:${element}\\b[^>]*/>`).exec(block)?.[0] ?? "", "typeface");
        if (!face || face.startsWith("+") || face === latin || face === escapeAttribute(resolved[role][slot])) continue;
        report({code: "script-font-not-imported", path: "design.fontScheme",
          message: `Theme ${tag} ${slot} font "${face}" differs from both its latin font and what the imported document resolves, and is not represented in the imported OPF.`});
      }
    }
  }
}

/**
 * FF-05: PptxGenJS writes every run's East Asian and complex-script font as a copy of the Latin face, with the
 * charsets of other scripts (-122, -120). PowerPoint lists such a run font as an empty-name font in
 * Presentation.Fonts and hides the real one (the charset is not the cause: a bare typeface does the same).
 * PowerPoint's own runs name only the Latin face; East Asian and complex-script faces come from the paragraph or
 * master style and the theme slots (+mn-ea, +mn-cs), which the exporter writes. A run keeps no explicit ea/cs
 * typeface; theme references stay.
 */
export function stripRunScriptFonts(xml) {
  return xml.replace(/<a:(?:ea|cs)\s+typeface="(?!\+)[^"]*"[^>]*\/>/g, "");
}

/**
 * Without core's resolver the theme's East Asian slot still repeats the latin family of its font group, which keeps
 * the paragraph end marks from reading an empty font (see themeScriptFonts).
 */
export function themeEastAsianFromLatin(xml) {
  return xml.replace(/<a:(majorFont|minorFont)>[\s\S]*?<\/a:\1>/g, block => {
    const latin = /<a:latin\b[^>]*\btypeface="([^"]+)"/.exec(block)?.[1];
    return latin ? block.replace(/<a:ea typeface=""\/>/, `<a:ea typeface="${latin}"/>`) : block;
  });
}
