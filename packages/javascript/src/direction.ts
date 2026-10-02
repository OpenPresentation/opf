/**
 * Text direction primitives shared by composition, the renderer and the PPTX exporter (RR-05).
 * Pure: no fonts, DOM or catalogs. Deck direction comes from the presentation language's script
 * (script-fonts.ts); a paragraph's own direction comes from its first strong character.
 */

/** Paragraph base direction. */
export type TextDirection = "ltr" | "rtl";

/**
 * Letters of right-to-left scripts (Unicode Bidi_Class R or AL), plus RLM
 * (U+200F) and ALM (U+061C). Digits, marks and punctuation of those scripts
 * are weak or neutral, so only letters count. Old Uyghur (U+10F70-10FAF) and
 * Garay (U+10D40-10D8F) are matched by code-point block, because JavaScript
 * engines do not all know those Script values yet; an engine without their
 * letters treats them as non-letters.
 */
const strongRtl =
  /[\u200F\u061C]|(?=\p{L})[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}\p{Script=Hanifi_Rohingya}\p{Script=Mandaic}\p{Script=Samaritan}\p{Script=Mende_Kikakui}\p{Script=Imperial_Aramaic}\p{Script=Phoenician}\p{Script=Kharoshthi}\p{Script=Old_South_Arabian}\p{Script=Old_North_Arabian}\p{Script=Avestan}\p{Script=Inscriptional_Parthian}\p{Script=Inscriptional_Pahlavi}\p{Script=Psalter_Pahlavi}\p{Script=Old_Turkic}\p{Script=Old_Hungarian}\p{Script=Nabataean}\p{Script=Palmyrene}\p{Script=Hatran}\p{Script=Manichaean}\p{Script=Sogdian}\p{Script=Old_Sogdian}\p{Script=Elymaic}\p{Script=Chorasmian}\p{Script=Yezidi}\p{Script=Cypriot}\p{Script=Lydian}\p{Script=Meroitic_Cursive}\p{Script=Meroitic_Hieroglyphs}\u{10F70}-\u{10FAF}\u{10D40}-\u{10D8F}]/u;
/** Letters (and letter numbers such as Roman numerals) of every other script (Bidi_Class L), plus LRM (U+200E). */
const strongLtr = /[\u200E\p{L}\p{Nl}]/u;

/**
 * The base direction of one paragraph in a deck, shared by the renderer and
 * the PPTX exporter so preview and export agree. In a right-to-left deck a
 * paragraph is right-to-left when its first strong character is
 * right-to-left, or when it has no strong character (digits, punctuation or
 * empty text); a paragraph whose first strong character is left-to-right
 * (for example an English quote or code) stays left-to-right. In a
 * left-to-right deck every paragraph is left-to-right.
 *
 * Strong characters follow UAX #9 rule P2: text inside directional isolates
 * (LRI, RLI or FSI up to the matching PDI) is skipped. Letters count as
 * strong; RTL letters are those of right-to-left scripts. The result does not
 * depend on locale data, only on the JavaScript engine's Unicode tables.
 */
export function paragraphDirection(text: string, deckDirection: TextDirection | string | undefined): TextDirection {
  if (deckDirection !== "rtl") return "ltr";
  let isolates = 0;
  for (const char of String(text ?? "")) {
    if (char === "\u2066" || char === "\u2067" || char === "\u2068") isolates += 1;
    else if (char === "\u2069") isolates = Math.max(0, isolates - 1);
    else if (isolates === 0) {
      if (strongRtl.test(char)) return "rtl";
      if (strongLtr.test(char)) return "ltr";
    }
  }
  return "rtl";
}

/** Horizontal alignment as drawn: the physical left, centre or right of the text box. */
export type PhysicalAlignment = "left" | "center" | "right";

/**
 * Authored alignment is logical for right-to-left text (RR-05): `left` means the start edge and
 * `right` the end edge, so in a right-to-left paragraph `left` is drawn at the right edge and
 * `right` at the left edge. `center` is unchanged, and so is every left-to-right paragraph.
 */
export function physicalAlignment(alignment: PhysicalAlignment | undefined, direction: TextDirection | undefined): PhysicalAlignment {
  const value = alignment ?? "left";
  if (direction !== "rtl" || value === "center") return value;
  return value === "left" ? "right" : "left";
}

/**
 * The base direction at a UTF-16 offset of `text`, where paragraphs are the segments between hard
 * line breaks (CR, LF or CRLF). Every wrapped line of a paragraph shares its direction, so a
 * line made only of Latin words or digits never changes the paragraph it belongs to.
 */
export function paragraphDirectionAt(text: string, deckDirection: TextDirection | string | undefined): (offset: number) => TextDirection {
  if (deckDirection !== "rtl") return () => "ltr";
  const source = String(text ?? ""), starts: number[] = [], directions: TextDirection[] = [];
  let start = 0;
  const close = (end: number) => { starts.push(start); directions.push(paragraphDirection(source.slice(start, end), "rtl")); };
  for (const match of source.matchAll(/\r\n|\r|\n/g)) { close(match.index); start = match.index + match[0].length; }
  close(source.length);
  return offset => {
    for (let index = starts.length - 1; index >= 0; index--) if (offset >= starts[index]!) return directions[index]!;
    return directions[0]!;
  };
}
