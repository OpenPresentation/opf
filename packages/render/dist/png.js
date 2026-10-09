// RR-63: the PNG format entry (Node). `toPng` loads the optional peers `@resvg/resvg-js` (and `sharp` for WebP and rotated JPEG
// pictures) on first use and rejects with `OPFRenderError` code `converter-missing` when they are not installed. For a page use
// `@openpresentation/opf-render/export-browser`.
export { toPng } from "./raster.js";
