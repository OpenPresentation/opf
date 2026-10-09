// RR-63: the PDF format entry (Node). The default vector `toPdf` needs no converter for text and shapes; it loads the optional peer
// `sharp` for pictures and `@resvg/resvg-js` for the rare element it rasterizes, and `raster: true` also loads `pdf-lib`. A converter
// that is not installed rejects with `OPFRenderError` code `converter-missing`. For a page use `@openpresentation/opf-render/export-browser`.
export { toPdf } from "./raster.js";
