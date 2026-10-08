// A TypeScript consumer of the published OPF packages (RR-04, FF-10): it is type-checked against the shipped declarations
// and then run, so it proves the packages install, resolve, type-check and execute as a downstream project would use them.
import {createHash} from 'node:crypto';
import {validate} from '@openpresentation/opf';
import {defaultCatalog} from '@openpresentation/opf/catalog';
import {resolveScriptFonts} from '@openpresentation/opf/composition';
import type {Presentation} from '@openpresentation/opf/types';
import {createEditorSession} from '@openpresentation/opf-editor';
import {checkTypefaces, fromPptx, toPptx} from '@openpresentation/opf-pptx';
import {renderSvg, svgToPng} from '@openpresentation/opf-render';
import {createScriptTextMeasurement} from '@openpresentation/opf-render/fonts';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';

const sha256 = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');

const deck: Presentation = {
  name: 'Published consumer',
  language: 'en',
  design: {theme: 'minimal', fontScheme: 'calibri'},
  slides: [
    {id: 'title', title: 'Quarterly review', subtitle: 'Results and next steps'},
    {id: 'chart', layout: 'chart-1x', title: 'Revenue', chart: {type: 'column', data: {columns: ['Quarter', 'Revenue'], rows: [['Q1', 4], ['Q2', 7], ['Q3', 9]]}}}
  ]
};
// @ts-expect-error slides must stay an array: the published declarations reject it
const broken: Presentation = {slides: 42};
void broken;

if (!validate(deck, {only: ['format']}).valid) throw new Error('the consumer deck is not valid OPF');
if (Object.keys(defaultCatalog.fontSchemes ?? {}).length === 0) throw new Error('the published default catalog is empty');

// The registry holds only the renderer's bundled faces: no host font is read.
const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'all'});
// OPF 0.15: this host registers the published default catalog with every call (the deck names gallery records by id).
const catalogs = [defaultCatalog];
const measured = {catalogs, fonts: {textMeasurement: createScriptTextMeasurement(fonts.textMeasurement, resolveScriptFonts(deck, {catalogs}))}};
const svgs: string[] = renderSvg(deck, measured);
if (svgs.length !== deck.slides.length) throw new Error('one preview per slide expected');
const png: Uint8Array = await svgToPng(svgs[0], {fonts});

const pptx: Uint8Array = await toPptx(deck, measured);
const inventory = checkTypefaces(pptx, {families: ['Calibri', 'Roboto Mono'], monospace: ['Roboto Mono']});
if (inventory.violations.length > 0) throw new Error(`typeface violations: ${JSON.stringify(inventory.violations)}`);
const reimported = await fromPptx(pptx);
if (!validate(reimported, {only: ['format']}).valid) throw new Error('the re-imported deck is not valid OPF');

const editor = createEditorSession(deck, {rejectInvalid: true, catalogs});
editor.setCatalog('design.fontScheme', 'fontSchemes', 'georgia');
const switched = await toPptx(editor.presentation, measured);
if (sha256(switched) === sha256(pptx)) throw new Error('switching the font scheme must change the export');
while (editor.canUndo) editor.undo();

console.log(JSON.stringify({consumer: 'ok', fontFiles: fonts.fontFiles.length, svg: sha256(svgs.join('\0')), png: sha256(png), pptx: sha256(pptx), fontsUsed: inventory.fontsUsed, loadSystemFonts: fonts.loadSystemFonts}));
