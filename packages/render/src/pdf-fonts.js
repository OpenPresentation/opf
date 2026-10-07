import { create } from "fontkit";
import { skipUndecodableLookups } from "./font-registry.js";
import { isTrueTypeOutlines, subsetTrueType } from "./pdf-subset.js";
import { hex, name, num, sha256, textString, utf16Hex } from "./pdf-writer.js";

// Font selection, shaping and embedding for the vector PDF export (RR-12). Fonts come only from the faces the
// caller supplies (the same bundled font files, `fontFiles` and `fontDirs` the PNG preview draws with, and the
// `@font-face` data of the SVG itself); nothing is read from the system and nothing is fetched. A face whose
// OS/2 embedding bits forbid embedding is never embedded.

const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace"]);

// Parsed faces are kept between calls (keyed by file path, size and modification time) so a deck exported twice does
// not read, hash and parse the same font files again; the bytes of a face never change what it embeds.
const FILE_CACHE = new Map();
let cachedBytes = 0;
const CACHE_LIMIT_BYTES = 192 * 1024 * 1024;

function remember(key, prototype) {
  if (FILE_CACHE.has(key)) return;
  FILE_CACHE.set(key, prototype);
  cachedBytes += prototype.data.length;
  for (const [oldest, value] of FILE_CACHE) {
    if (cachedBytes <= CACHE_LIMIT_BYTES || oldest === key) break;
    FILE_CACHE.delete(oldest);
    cachedBytes -= value.data.length;
  }
}

export class FontLibrary {
  constructor(options = {}) {
    this.options = options;
    this.faces = [];
    this.byHash = new Map();
    this.onDiagnostic = options.onDiagnostic ?? (() => {});
  }

  /** Register font bytes once (by content hash). Returns the face, or null when the file cannot be used for embedding. */
  addData(data, origin, declaredFamily) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const face = this.adopt(parseFace(bytes, hex(sha256(bytes)), origin), origin);
    // The family a style sheet declares for the data names the face too (the name table may say something else).
    if (face && declaredFamily) face.names.add(declaredFamily.toLowerCase());
    return face;
  }

  /** Register a font file through the cross-call cache; `stat` is {size, mtimeMs} and `read` returns the bytes. */
  async addFile(file, stat, read) {
    const key = `${file}|${stat.size}|${stat.mtimeMs}`;
    let prototype = FILE_CACHE.get(key);
    if (!prototype) {
      const bytes = new Uint8Array(await read());
      prototype = parseFace(bytes, hex(sha256(bytes)), file.split(/[\\/]/).pop());
      if (!prototype.error) remember(key, prototype);
    }
    return this.adopt(prototype, prototype.origin);
  }

  adopt(prototype, origin) {
    if (prototype.error) {
      this.onDiagnostic({ code: "pdf-font-unreadable", message: `A font could not be read and was not used: ${prototype.error}`, origin });
      return null;
    }
    if (this.byHash.has(prototype.hash)) return this.byHash.get(prototype.hash);
    const face = { ...prototype, names: new Set(prototype.names), id: this.faces.length };
    this.byHash.set(prototype.hash, face);
    this.faces.push(face);
    if (face.unusable) {
      this.onDiagnostic({
        code: face.unusable,
        message: face.unusable === "pdf-font-embedding-restricted"
          ? `Font '${[...face.names][0]}' forbids embedding (OS/2 fsType), so it is not embedded in the PDF and is never used for vector text.`
          : `Font '${[...face.names][0]}' has no TrueType (glyf) outlines, so it cannot be subset for the PDF and is not used for vector text.`,
        family: [...face.names][0], origin,
      });
    }
    return face;
  }

  usable() {
    return this.faces.filter((face) => face.embeddable);
  }

  /**
   * The best face for a CSS font-family list in a weight and style, by the CSS font matching rules: the first named
   * family that has a face wins; generic names map through `genericFamilies`.
   */
  match(families, weight, italic) {
    const usable = this.usable();
    for (const raw of families) {
      const family = raw.toLowerCase();
      const wanted = GENERIC.has(family) ? this.options.genericFamilies?.(family) ?? [] : [family];
      for (const candidate of wanted) {
        const group = usable.filter((face) => face.names.has(candidate.toLowerCase()));
        if (group.length) return { face: bestStyle(group, weight, italic), requested: raw };
      }
    }
    return null;
  }

  /** A face (nearest to `style`) that has a glyph for the code point, in library order; used for per-character fallback. */
  fallbackFor(codePoint, weight, italic, exclude) {
    const candidates = this.usable().filter((face) => face !== exclude && hasGlyph(face, codePoint));
    if (!candidates.length) return null;
    const exact = candidates.filter((face) => face.italic === italic);
    const pool = exact.length ? exact : candidates;
    return [...pool].sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight) || a.id - b.id)[0];
  }
}

function parseFace(data, hash, origin) {
  try {
    const font = create(data);
    if (!font?.layout || !font.unitsPerEm) throw new Error("Font collections must name one face.");
    // fontkit caches one Glyph per glyph id and keeps the code points of the first use, so a glyph that several
    // letters share (the dotless base of Arabic beh and noon) would report the wrong character everywhere after the
    // first. Hand out a fresh view per call that carries this call's code points.
    const original = font.getGlyph.bind(font);
    font.getGlyph = (id, codePoints = []) => {
      const view = Object.create(original(id));
      view.codePoints = codePoints;
      return view;
    };
    const os2 = font["OS/2"];
    const names = new Set();
    for (const key of ["fontFamily", "preferredFamily"]) {
      const value = font.getName?.(key, "en");
      if (value) names.add(String(value).toLowerCase());
    }
    if (font.familyName) names.add(String(font.familyName).toLowerCase());
    let weight = os2?.usWeightClass ?? (font.head?.macStyle?.bold ? 700 : 400);
    if (weight > 0 && weight < 10) weight *= 100;
    const italic = Boolean(os2?.fsSelection?.italic || font.head?.macStyle?.italic || font.italicAngle);
    const fsType = os2?.fsType ?? {};
    let unusable;
    if (!isTrueTypeOutlines(data)) unusable = "pdf-font-unsupported-format";
    else if (fsType.noEmbedding || fsType.bitmapOnly) unusable = "pdf-font-embedding-restricted";
    // A corrupt loca/glyf/hmtx fails here, as an unreadable font, not later as a RangeError.
    if (!unusable) subsetTrueType(data, [0]);
    return {
      hash, data, font, origin, names, weight, italic, unusable,
      upem: font.unitsPerEm, postscriptName: font.postscriptName || [...names][0] || "Font",
      embeddable: !unusable, subsettable: !fsType.noSubsetting, fsType: fsTypeBits(fsType),
      license: String(font.getName?.("licenseDescription", "en") ?? "").replace(/\s+/g, " ").trim().slice(0, 160) || undefined,
      restriction: fsType.viewOnly && !fsType.editable ? "preview-and-print" : undefined,
      cmapCache: new Map(), nominalCache: new Map(),
    };
  } catch (error) {
    return { hash, origin, error: error instanceof Error ? error.message : String(error) };
  }
}

function fsTypeBits(fsType) {
  return (fsType.noEmbedding ? 0x2 : 0) | (fsType.viewOnly ? 0x4 : 0) | (fsType.editable ? 0x8 : 0) | (fsType.noSubsetting ? 0x100 : 0) | (fsType.bitmapOnly ? 0x200 : 0);
}

export function hasGlyph(face, codePoint) {
  let value = face.cmapCache.get(codePoint);
  if (value === undefined) {
    value = face.font.hasGlyphForCodePoint(codePoint);
    face.cmapCache.set(codePoint, value);
  }
  return value;
}

function bestStyle(group, weight, italic) {
  const sameStyle = group.filter((face) => face.italic === italic);
  const pool = sameStyle.length ? sameStyle : group;
  const weights = [...new Set(pool.map((face) => face.weight))].sort((a, b) => a - b);
  let order;
  const below = weights.filter((value) => value < weight).reverse(), above = weights.filter((value) => value > weight);
  if (weight >= 400 && weight <= 500) {
    const between = weights.filter((value) => value > weight && value <= 500);
    order = [weight, ...between, ...below, ...above.filter((value) => value > 500)];
  } else if (weight < 400) order = [weight, ...below, ...above];
  else order = [weight, ...above, ...below];
  const target = order.find((value) => weights.includes(value));
  return pool.find((face) => face.weight === target) ?? pool[0];
}

/**
 * Shape `text` with `face` and return glyphs left to right: {gid, codePoints, advance, xOffset, yOffset} in font units.
 * `direction` is "ltr" or "rtl" (the caller has already applied the bidirectional algorithm), `features` an object of
 * OpenType feature booleans, `language` an OpenType language tag. Shaping that fontkit cannot complete degrades the
 * same way the registry's measurement does (marks off, then plain character mapping).
 */
export function shape(face, text, { features, language, direction } = {}) {
  const font = face.font;
  const attempt = (extra) => {
    const merged = features || extra ? { ...features, ...extra } : undefined;
    return font.layout(text, merged, undefined, language, direction);
  };
  let run;
  try { run = attempt(); } catch {
    if (skipUndecodableLookups(font)) { try { run = attempt(); } catch { /* fall through */ } }
    if (!run) { try { run = attempt({ abvm: false, blwm: false, mark: false, mkmk: false }); } catch { /* fall through */ } }
  }
  if (run) {
    return run.glyphs.map((glyph, index) => ({
      gid: glyph.id,
      codePoints: glyph.codePoints ?? [],
      advance: run.positions[index].xAdvance,
      xOffset: run.positions[index].xOffset ?? 0,
      yOffset: run.positions[index].yOffset ?? 0,
    }));
  }
  const glyphs = [];
  for (const character of text) {
    const glyph = font.glyphForCodePoint(character.codePointAt(0));
    glyphs.push({ gid: glyph.id, codePoints: [character.codePointAt(0)], advance: glyph.advanceWidth, xOffset: 0, yOffset: 0 });
  }
  return direction === "rtl" ? glyphs.reverse() : glyphs;
}

/** Tracks which glyphs of which faces a document uses, then writes the Type0/CIDFontType2 font objects. */
export class FontEmbedder {
  constructor(file) {
    this.file = file;
    this.uses = new Map();
  }

  use(face) {
    let entry = this.uses.get(face);
    if (!entry) {
      entry = { face, resource: `F${this.uses.size + 1}`, object: this.file.reserve(), cids: new Map() };
      this.uses.set(face, entry);
    }
    return entry;
  }

  /**
   * Record a drawn glyph and return its CID. A CID stands for one glyph drawing one piece of text: a font that builds
   * several letters from one shared glyph (Arabic letters differing only by their dots, which are separate glyphs)
   * gets one CID per letter, each with its own Unicode value, so the glyph-to-Unicode map is exact. All CIDs of a glyph
   * share its outline through the CIDToGIDMap.
   */
  record(entry, glyph) {
    // Every space separator (no-break, thin, ideographic...) is copied as a plain space; text that uses one of the
    // others is marked by the caller so its exact characters survive as /ActualText.
    const spaceLike = glyph.codePoints.length === 1 && /^\p{Zs}$/u.test(String.fromCodePoint(glyph.codePoints[0]));
    const codePoints = spaceLike ? [0x20] : glyph.codePoints;
    const key = glyph.gid + "|" + codePoints.join(",");
    let known = entry.cids.get(key);
    if (known === undefined) {
      known = { cid: entry.cids.size, gid: glyph.gid, codePoints };
      entry.cids.set(key, known);
    }
    return known.cid;
  }

  /** Write every font object; returns the diagnostics (one `pdf-font-embedded` per face). */
  finish() {
    const reports = [];
    for (const entry of this.uses.values()) reports.push(this.#write(entry));
    return reports;
  }

  #write(entry) {
    const { face } = entry;
    const scale = 1000 / face.upem;
    const cids = [...entry.cids.values()];
    const used = [...new Set(cids.map((item) => item.gid))].sort((a, b) => a - b);
    let fontBytes = face.data, mapping = null, embedding = "full";
    if (face.subsettable) {
      const subset = subsetTrueType(face.data, used);
      fontBytes = subset.data;
      mapping = subset.mapping;
      embedding = "subset";
    }
    const digest = hex(sha256(new TextEncoder().encode(face.hash + ":" + used.join(","))));
    const tag = [...Array(6).keys()].map((index) => String.fromCharCode(65 + (parseInt(digest.slice(index * 2, index * 2 + 2), 16) % 26))).join("");
    const base = tag + "+" + face.postscriptName.replace(/[^A-Za-z0-9-]/g, "");
    const file = this.file;
    const fontFile = file.addStream("/Length1 " + fontBytes.length, fontBytes);

    const ascent = face.font.ascent, descent = face.font.descent, bbox = face.font.bbox;
    const descriptor = file.add(
      "/Type/FontDescriptor/FontName" + name(base) + "/Flags " + (face.italic ? 96 : 32) +
      "/FontBBox[" + [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY].map((value) => num(value * scale, 0)).join(" ") + "]" +
      "/ItalicAngle " + num(face.font.italicAngle || 0, 2) + "/Ascent " + num(ascent * scale, 0) + "/Descent " + num(descent * scale, 0) +
      "/CapHeight " + num((face.font.capHeight || ascent) * scale, 0) + "/StemV " + num(50 + Math.max(0, face.weight - 100) / 10, 0) + "/FontFile2 " + fontFile + " 0 R",
    );

    // CIDs are numbered in order of first use; the CIDToGIDMap sends each to its glyph in the (renumbered) font program.
    const cache = new Map();
    const widths = "0[" + cids.map((item) => num(nominalAdvance(face, item.gid, cache), 2)).join(" ") + "]";
    const map = new Uint8Array(cids.length * 2);
    for (const item of cids) { const to = mapping ? mapping.get(item.gid) : item.gid; map[item.cid * 2] = to >> 8; map[item.cid * 2 + 1] = to & 0xff; }
    const cidToGid = " " + file.addStream("", map) + " 0 R";
    const cidFont = file.add(
      "/Type/Font/Subtype/CIDFontType2/BaseFont" + name(base) + "/CIDSystemInfo<</Registry(Adobe)/Ordering(Identity)/Supplement 0>>" +
      "/FontDescriptor " + descriptor + " 0 R/CIDToGIDMap" + cidToGid + "/DW 0/W[" + widths + "]",
    );
    const toUnicode = file.addStream("", toUnicodeCMap(cids));
    file.set(entry.object, "/Type/Font/Subtype/Type0/BaseFont" + name(base) + "/Encoding/Identity-H/DescendantFonts[" + cidFont + " 0 R]/ToUnicode " + toUnicode + " 0 R");
    return {
      code: "pdf-font-embedded", family: [...face.names][0], postscriptName: face.postscriptName, weight: face.weight, italic: face.italic,
      glyphs: used.length, bytes: fontBytes.length, embedding, fsType: face.fsType, ...(face.restriction ? { embeddingRestriction: face.restriction } : {}),
      ...(face.license ? { license: face.license } : {}), origin: face.origin,
    };
  }
}

function nominalWidth(face, gid) {
  return face.font.getGlyph(gid).advanceWidth * 1000 / face.upem;
}

/** The width the PDF assumes for a glyph (what the font dictionary's /W says); shaped advances are corrected against it. */
export function nominalAdvance(face, gid, cache) {
  let value = cache.get(gid);
  if (value === undefined) {
    value = Math.round(nominalWidth(face, gid) * 100) / 100;
    cache.set(gid, value);
  }
  return value;
}

// A glyph that stands for no character of its own (a diacritic or dot the font split off a letter) maps to a zero width
// space: extractors drop it, and viewers that honour /ActualText never see it.
function toUnicodeCMap(cids) {
  const pairs = cids.map((item) => [item.cid, item.codePoints]).sort((a, b) => a[0] - b[0]);
  let body = "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo<</Registry(Adobe)/Ordering(UCS)/Supplement 0>> def\n/CMapName/Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n";
  for (let start = 0; start < pairs.length; start += 100) {
    const chunk = pairs.slice(start, start + 100);
    body += `${chunk.length} beginbfchar\n`;
    for (const [id, codePoints] of chunk) body += `<${id.toString(16).toUpperCase().padStart(4, "0")}> <${utf16Hex(String.fromCodePoint(...(codePoints.length ? codePoints : [0x200b])))}>\n`;
    body += "endbfchar\n";
  }
  body += "endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n";
  return body;
}

export { textString };
