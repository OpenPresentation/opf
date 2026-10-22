// Colour fonts (FF-45). Noto Color Emoji ships COLRv1 and OT-SVG colour glyphs with empty outlines in `glyf`. Browsers
// draw them in colour (Chromium and Firefox from COLRv1, Safari from the SVG table), and fontkit shapes and measures the
// face, so the SVG names it. resvg (the raster path) draws neither COLRv1 nor OT-SVG glyphs and would paint nothing, so
// the raster path draws the package's monochrome stand-in (Noto Emoji) instead: measured advances are pinned by
// textLength where runs are positioned, and the raster shows a black-and-white silhouette, which is a documented limit.
import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";

/** Every colour face of the manifest: its family, package-relative file, colour format and the monochrome family the raster path draws. */
export const COLOR_FONT_FACES = Object.freeze(BUNDLED_FONT_MANIFEST.packages.filter(pkg => pkg.color).flatMap(pkg => pkg.faces.map(face => Object.freeze({
  family: face.family, file: face.file, package: pkg.name, format: pkg.color.format, rasterFamily: pkg.color.rasterFamily,
}))));
const rasterFamilyOf = new Map(COLOR_FONT_FACES.map(face => [face.family.toLowerCase(), face.rasterFamily]));
const colorFiles = COLOR_FONT_FACES.map(face => face.file.replace(/\\/g, "/"));

/** `files` without the colour faces, which resvg cannot draw (they would also catch its glyph fallback and paint nothing). */
export function rasterFontFiles(files) {
  return files.filter(file => { const normalized = String(file).replace(/\\/g, "/"); return !colorFiles.some(suffix => normalized.endsWith(`/${suffix}`)); });
}

const fontFamilyAttribute = /(\sfont-family\s*=\s*)(?:"([^"]*)"|'([^']*)')/g;
const unquote = name => name.trim().replace(/^(["'])(.*)\1$/, "$2");
/** SVG about to be rasterized only (never the emitted SVG): text in a colour family is drawn with its monochrome stand-in. */
export function monochromeColorFonts(svg) {
  if (!rasterFamilyOf.size || !/<(?:text|tspan)[\s>]/.test(svg)) return svg;
  return svg.replace(fontFamilyAttribute, (match, prefix, doubleQuoted, singleQuoted) => {
    const value = doubleQuoted ?? singleQuoted;
    const families = value.split(",");
    if (!families.some(name => rasterFamilyOf.has(unquote(name).toLowerCase()))) return match;
    const replaced = families.map(name => rasterFamilyOf.get(unquote(name).toLowerCase()) ?? name.trim()).join(", ");
    return `${prefix}"${replaced}"`;
  });
}
