// RR-55: the names and shapes are the 0.14 API (loadFonts, renderSvg for a whole deck, { fonts }); the installed side adapts the published 0.13 packages to them until the release-prep moves it.
// Engine entry points for the font-switch matrix when it runs against sibling source checkouts
// (`pnpm test:fonts`). The published-package consumer writes an `engines-installed.mjs` with the
// same exports that resolves every package from the consumer's own node_modules instead.
import {createRequire} from 'node:module';

export {BUNDLED_FONT_MANIFEST, loadFonts} from '../../../opf-render/dist/fonts-node.js';
export {createScriptTextMeasurement, designatedFamilies, detectScripts, fontPolicyFor} from '../../../opf-render/dist/fonts.js';
export {renderSvg, svgToPng} from '../../../opf-render/dist/index.js';
export {checkTypefaces, fromPptx, toPptx} from '../../../opf-pptx/dist/index.js';
export {createEditorSession} from '../../../opf-editor/dist/index.js';
export {defaultCatalog} from '@openpresentation/opf/catalog';
export {resolveFontFamilies, resolveFontSchemeReference, resolveScriptFonts} from '@openpresentation/opf/composition';
export {validate} from '@openpresentation/opf';

const require = createRequire(new URL('../../../opf-pptx/package.json', import.meta.url));
export const {strToU8, unzipSync, zipSync} = require('fflate');
export const {XMLValidator} = require('fast-xml-parser');
export const source = {kind: 'sibling-source'};
