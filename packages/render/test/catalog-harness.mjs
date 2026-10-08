// FA-23: the renderer is a library and registers no catalog; the host does. Tests whose documents name gallery records
// (themes such as `classic`, layouts such as `image-1x`, colour and font schemes) import the renderer from here, which
// registers the gallery snapshot explicitly, the way a host does. Tests of what happens without a catalog import
// ../dist/index.js directly. A call's own `catalogs` replaces the default.
import { defaultCatalog } from '@openpresentation/opf/catalog';
import * as renderer from '../dist/index.js';

export * from '../dist/index.js';
export { defaultCatalog };
export const catalogs = Object.freeze([defaultCatalog]);
export const withCatalogs = (options = {}) => ({ catalogs, ...options });
export const renderSvg = (input, options) => renderer.renderSvg(input, withCatalogs(options));
export const renderSlideSvg = (input, index, options) => renderer.renderSlideSvg(input, index, withCatalogs(options));
export const resolvePresentation = (input, options) => renderer.resolvePresentation(input, withCatalogs(options));
