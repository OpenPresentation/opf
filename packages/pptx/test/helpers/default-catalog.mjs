// OPF 0.15 (FA-23): core ships no built-in catalog records, so a document's bare gallery ids ('classic', 'title-subtitle',
// 'roboto', 'cool-horizon', ...) resolve only from the catalogs the host registers. Tests whose documents name gallery ids
// import these wrappers instead of the bare functions: each registers the default catalog (the pinned gallery snapshot)
// unless the call passes its own `catalogs`.
import {defaultCatalog} from '@openpresentation/opf/catalog';
import {resolveScriptFonts as coreResolveScriptFonts} from '@openpresentation/opf/composition';
import * as render from '@openpresentation/opf-render/svg';
import * as pptx from '../../dist/index.js';

export {defaultCatalog};
export const catalogs = Object.freeze([defaultCatalog]);

const withCatalogs = (options = {}) => (options.catalogs === undefined ? {...options, catalogs} : options);

export const toPptx = (document, options) => pptx.toPptx(document, withCatalogs(options));
export const fromPptx = (bytes, options) => pptx.fromPptx(bytes, withCatalogs(options));
export const renderSvg = (document, options) => render.renderSvg(document, withCatalogs(options));
export const renderSlideSvg = (document, index, options) => render.renderSlideSvg(document, index, withCatalogs(options));
export const resolvePresentation = (document, options) => render.resolvePresentation(document, withCatalogs(options));
export const resolveScriptFonts = (document, options) => coreResolveScriptFonts(document, withCatalogs(options));
