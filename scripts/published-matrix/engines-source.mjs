// RR-55, RR-74: the names and shapes are the 0.18 API (loadFonts, toSvg for a whole deck, toPng, { fonts }); the installed side adapts a published renderer older than 0.18 to them until the release plan moves.
// Engine entry points for the font-switch matrix when it runs against sibling source checkouts
// (`pnpm test:fonts`). The published-package consumer writes an `engines-installed.mjs` with the
// same exports that resolves every package from the consumer's own node_modules instead.
import {createRequire} from 'node:module';

export {BUNDLED_FONT_MANIFEST, loadFonts} from '../../../opf-render/dist/fonts-node.js';
export {createScriptTextMeasurement, designatedFamilies, detectScripts, fontPolicyFor} from '../../../opf-render/dist/fonts.js';
export {toSvg, toPng} from '../../../opf-render/dist/index.js';
export {checkTypefaces, fromPptx, toPptx} from '../../../opf-pptx/dist/index.js';
export {createEditorSession} from '../../../opf-editor/dist/index.js';
export {catalogDisplay, defaultCatalog} from '@openpresentation/opf/catalog';
export {resolveFontFamilies, resolveScriptFonts} from '@openpresentation/opf/composition';
export {resolveFontScheme, resolveReference, validate} from '@openpresentation/opf';

const require = createRequire(new URL('../../../opf-pptx/package.json', import.meta.url));
export const {strToU8, unzipSync, zipSync} = require('fflate');
export const {XMLValidator} = require('fast-xml-parser');
export const source = {kind: 'sibling-source'};
