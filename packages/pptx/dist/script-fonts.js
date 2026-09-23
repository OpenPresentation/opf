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
  return {deck, slides, lang: deck.lang, rtl};
}

const escapeAttribute = value => String(value).replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;"}[char]));

/**
 * Theme major/minor ea/cs from the resolved heading/body slots, and the
 * language's own per-script supplement. Only the supplement's script entry
 * changes; the rest of the vendored per-script list is FF-08's call.
 *
 * For a language written in the latin slot (Latin, Cyrillic, Greek and others) the
 * vendored empty ea/cs stay empty unless the design font scheme sets that
 * slot explicitly. Filling them with the latin family is gated on FF-05 (core
 * script-font-model.md): it did not remove PowerPoint's nameless/Aptos font
 * entries, and empty slots keep PowerPoint's per-script theme fallback for
 * East Asian or complex-script text typed later. Other languages fill both.
 */
export function themeScriptFonts(xml, plan) {
  const {heading, body, supplement} = plan.deck;
  for (const [tag, slots, family] of [["majorFont", heading, supplement?.heading], ["minorFont", body, supplement?.body]]) {
    xml = xml.replace(new RegExp(`<a:${tag}>[\\s\\S]*?</a:${tag}>`), block => {
      // With no script-specific choice the slot repeats the theme's own latin
      // face exactly as written, as the run slots do.
      const latin = /<a:latin typeface="([^"]*)"/.exec(block)?.[1];
      for (const [element, slot] of SCRIPT_SLOTS) {
        if (plan.deck.scriptRole === "latin" && plan.deck.sources[slot] !== "fontScheme") continue;
        const face = plan.deck.sources[slot] === "latin" && latin ? latin : escapeAttribute(slots[slot]);
        block = block.replace(new RegExp(`<a:${element}\\b[^>]*/>`), `<a:${element} typeface="${face}"/>`);
      }
      if (supplement && family) {
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
 * In a right-to-left deck every paragraph states its direction from core's
 * paragraphDirection() over its own text: rtl="1" when it is right-to-left,
 * else an explicit rtl="0", because the master default levels start
 * right-to-left. Alignment is left as composed.
 */
function paragraphRtl(xml, deckDirection) {
  return xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (paragraph, body) => {
    const text = [...body.matchAll(/<a:t>([^<]*)<\/a:t>|<a:br\b/g)].map(match => match[1] === undefined ? "\n" : decodeText(match[1])).join("");
    const value = paragraphDirection(text, deckDirection) === "rtl" ? "1" : "0";
    const properties = /^(\s*)<a:pPr\b([^>]*?)(\/?)>/.exec(body);
    if (!properties) return `<a:p><a:pPr rtl="${value}"/>${body}</a:p>`;
    const attributes = / rtl="[^"]*"/.test(properties[2]) ? properties[2].replace(/ rtl="[^"]*"/, ` rtl="${value}"`) : `${properties[2]} rtl="${value}"`;
    return `<a:p>${properties[1]}<a:pPr${attributes}${properties[3]}>${body.slice(properties[0].length)}</a:p>`;
  });
}

/** Master, layout and presentation default paragraph levels start right-to-left. */
const levelRtl = xml => xml.replace(/(<a:(?:lvl\dpPr|defPPr)\b[^>]*?\srtl=")0(")/g, "$11$2");

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
    if (plan.rtl) xml = paragraphRtl(xml, plan.deck.direction);
  } else if (/^ppt\/(?:charts\/chart|notesSlides\/notesSlide)\d+\.xml$/.test(path)) {
    xml = runScriptFonts(xml, resolved, false);
    if (plan.rtl && path.startsWith("ppt/notesSlides/")) xml = paragraphRtl(xml, plan.deck.direction);
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
  const ranked = [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
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
export function languageDiagnostics(imported, observed, report) {
  if (!report) return;
  const {lang, match, ranked, rtlParagraphs, theme} = observed;
  if (lang === undefined) {
    if (rtlParagraphs) report({code: "rtl-language-mismatch", path: "language", message: `${rtlParagraphs} right-to-left paragraph(s) carry no run language, so no presentation language was imported.`});
    return;
  }
  if (ranked.length > 1) {
    report({code: "mixed-run-languages", path: "language",
      message: `Runs use ${ranked.length} languages (${ranked.map(([tag, count]) => `${tag} x${count}`).join(", ")}). OPF has one presentation language, so ${lang} was imported.`});
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
