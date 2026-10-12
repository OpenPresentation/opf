// OPF 0.15 (FA-23): core ships no built-in catalog records, so a document's bare gallery ids ('classic', 'cover',
// 'roboto', 'cool-horizon', ...) resolve only from the catalogs the host registers. Tests whose documents name gallery ids
// import these wrappers instead of the bare functions: each registers the default catalog (the pinned gallery snapshot)
// unless the call passes its own `catalogs`.
import {gallery as defaultCatalog} from '@openpresentation/gallery';
import {resolveScriptFonts as coreResolveScriptFonts} from '@openpresentation/opf/composition';
import * as render from '@openpresentation/opf-render/svg';
import * as pptx from '../../dist/index.js';

export {defaultCatalog};
export const catalogs = Object.freeze([defaultCatalog]);

const withCatalogs = (options = {}) => (options.catalogs === undefined ? {...options, catalogs} : options);

export const toPptx = (document, options) => pptx.toPptx(document, withCatalogs(options));
export const fromPptx = (bytes, options) => pptx.fromPptx(bytes, withCatalogs(options));
// toSvg(deck, options?) draws every slide; toSvg(deck, slide, options?) draws the selected slide(s) (1-based).
export const toSvg = (document, ...rest) => {
  while (rest.length && rest.at(-1) === undefined) rest.pop();
  const last = rest.at(-1);
  const options = last !== null && typeof last === 'object' && !Array.isArray(last) ? rest.pop() : undefined;
  return render.toSvg(document, ...rest, withCatalogs(options));
};
export const resolvePresentation = (document, options) => render.resolvePresentation(document, withCatalogs(options));
export const resolveScriptFonts = (document, options) => coreResolveScriptFonts(document, withCatalogs(options));
