// RR-63: the PDF format entry (Node). The default vector `svgToPdf` needs no converter for text and shapes; it loads the optional peer
// `sharp` for pictures and `@resvg/resvg-js` for the rare element it rasterizes, and `mode: "raster"` also loads `pdf-lib`. A converter
// that is not installed rejects with `OPFRenderError` code `converter-missing`. For a page use `@openpresentation/opf-render/export-browser`.
export { svgToPdf } from "./raster.js";
