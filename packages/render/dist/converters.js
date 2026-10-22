// RR-63: the native and heavy converters are optional peer dependencies, loaded the first time an export needs them. A host that
// only draws SVG (a browser, a server that never exports) installs none of them. Each loader names its package with a literal
// `import()` so a Node bundler or file tracer still sees it; nothing here is reachable from the browser entries
// (`/svg`, `/fonts-browser`, `/export-browser`), and `scripts/build-browser-check.mjs` asserts that.
import { OPFRenderError } from "./svg.js";

/** What each converter is for and the range the renderer is tested with (the same ranges as `peerDependencies` in package.json). */
export const CONVERTERS = Object.freeze({
  "@resvg/resvg-js": { range: "^2.6.2", purpose: "PNG output, raster-mode PDF and the raster fallback of vector PDF", load: () => import("@resvg/resvg-js") },
  sharp: { range: "^0.35.5", purpose: "decoding WebP and rotated JPEG pictures for PNG output, and pictures in vector PDF output", load: () => import("sharp") },
  "pdf-lib": { range: "^1.17.1", purpose: "raster-mode PDF output (`mode: \"raster\"`)", load: () => import("pdf-lib") },
});

const cache = new Map();

/** The module namespace of a converter, or an `OPFRenderError` with code `converter-missing` that names the package to install. */
export function loadConverter(name) {
  const converter = CONVERTERS[name];
  if (!converter) throw new TypeError(`Unknown converter ${name}.`);
  if (!cache.has(name)) {
    const pending = converter.load().catch((error) => {
      cache.delete(name);
      throw converterMissing(name, converter, error);
    });
    cache.set(name, pending);
  }
  return cache.get(name);
}

function converterMissing(name, converter, error) {
  const cause = error instanceof Error ? error.message : String(error);
  const absent = (error?.code === "ERR_MODULE_NOT_FOUND" || error?.code === "MODULE_NOT_FOUND") && (cause.includes(`'${name}'`) || cause.includes(`"${name}"`));
  const install = `npm install ${name}@${converter.range}`;
  return new OPFRenderError("converter-missing", absent
    ? `${name} is not installed. It is an optional peer dependency of @openpresentation/opf-render, used for ${converter.purpose}: run \`${install}\`.`
    : `${name} is installed but could not be loaded (${cause}). It is used for ${converter.purpose}: reinstall it with \`${install}\` for this platform.`,
  { package: name, range: converter.range, install, purpose: converter.purpose, installed: !absent, cause });
}

/** True for the error `loadConverter` raises: callers that wrap errors let it through unchanged. */
export const isConverterMissing = (error) => error?.code === "converter-missing";
