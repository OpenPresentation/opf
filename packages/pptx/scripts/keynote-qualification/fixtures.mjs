// Project-authored fixtures. Native actions are instructions for the supervisor, never executable document content.
export const fixtureFontPolicy = {
  selected: 'Arial', previewAlias: 'Arimo', variants: ['regular', 'bold', 'italic', 'bold-italic'],
  nativeFileObservations: {
    scope: 'Root-reported 2026-10-15 preflight facts; generator does not inspect, install or register native fonts.',
    macOS: {regularSha256: '525979822591a3447cfc49d943d6f7683508e25543407871c0ed8fed05fd2bd9'},
    windows: {regularSha256: 'b3658eadae55e682b5f69eb64c439c1ecc8f196c0bb8d4756d145d13bc86476a'},
  },
  limits: 'File presence does not prove identical font versions, physical per-glyph selection, geometry or raster parity. Proprietary Arial files are never bundled.',
};
export function sourceDeck(image) {
  const slide = (id, fields) => ({...fields, notes: `${id} speaker notes: preserve this sentence.`});
  return {
    name: 'Keynote qualification', language: 'en-US',
    design: {fontScheme: {major: 'Arial', minor: 'Arial'}, dimensions: 'widescreen', footer: {left: {text: 'Keynote qualification'}, right: {text: '{{slide.number}}'}}},
    slides: [
      slide('K01', {layout: 'cover', title: 'Title and subtitle', subtitle: 'Native layout baseline'}),
      slide('K02', {layout: 'text', title: 'Paragraph editing', text: 'KN_ORIGINAL_PARAGRAPH. Keep this second sentence.\nA second authored paragraph.'}),
      slide('K03', {layout: 'text', title: 'Rich text', text: [{text: 'Bold words', bold: true}, ' and ', {text: 'italic words', italic: true}, ' and ', {text: 'bold italic words', bold: true, italic: true}, '\nA second rich paragraph.']}),
      slide('K04', {layout: 'text', title: 'List editing', items: ['KN_ORIGINAL_LIST', {text: 'Parent item', description: 'Description remains attached.'}, {text: 'Nested child', level: 1}, 'Final item']}),
      slide('K05', {layout: 'text', title: 'Long paragraph', text: 'A native editor should preserve words, spacing and paragraph boundaries while a user edits the content. '.repeat(10)}),
      slide('K06', {layout: 'text', title: 'Long list', items: ['A list item whose words wrap across more than one visual line while retaining its semantic item boundary. '.repeat(2), 'Second item remains independent.', {text: 'Third item', description: 'The description wraps separately from the item title and remains editable.'}]}),
      slide('K07', {layout: 'two-column', title: 'Layout and reapply', blocks: [{text: 'Left-column story remains visible.'}, {metric: {value: 24, label: 'teams in the pilot'}}]}),
      slide('K08', {layout: 'image', title: 'Replace this picture', image: {src: image, alt: 'Four colored quadrants and a circle'}, design: {imageFit: 'contain'}}),
      slide('K09', {layout: 'image-beside', title: 'Crop this picture', blocks: [{image: {src: image, alt: 'Crop witness'}, fit: 'cover', focus: {x: .25, y: .5}}, {text: 'Keep this caption while adjusting the crop.'}]}),
      slide('K10', {layout: 'chart', title: 'Column chart data', chart: {type: 'column', data: {columns: ['Quarter', 'Revenue'], rows: [['Q1', 12], ['Q2', 24], ['Q3', 18]]}}}),
      slide('K11', {layout: 'chart', title: 'Line chart style', chart: {type: 'line', data: {columns: ['Month', 'Demand'], rows: [['Jan', 10], ['Feb', 20], ['Mar', 15]]}}}),
      slide('K12', {layout: 'table', title: 'Table cell edit', table: {columns: ['Team', 'Count'], rows: [['KN_ORIGINAL_CELL', 12], ['Beta', 24]]}}),
      slide('K13', {layout: 'table', title: 'Rich table edit', table: {columns: ['Label', 'Note'], rows: [['Alpha', [{text: 'Bold cell', bold: true}, ' and plain']], ['Beta', 'Keep this row']]}}),
      slide('K14', {layout: 'text', title: 'Number reorder A', text: 'Move this slide after K15; observe the native slide number.'}),
      slide('K15', {layout: 'text', title: 'Number reorder B', text: 'This slide moves before K14; observe the native slide number.'}),
      slide('K16', {layout: 'text', title: 'Notes and final control', text: 'Untouched final control. Notes are edited separately.'}),
    ].map((value, index) => ({...value, title: `K${String(index + 1).padStart(2, '0')} ${value.title}`})),
  };
}

export const routes = {
  'no-op': {description: 'Open PPTX in Keynote, inspect without editing, save a new .key copy, export a new PPTX, then reopen both copies.', expectedSlides: 16, actions: []},
  'content-edits': {description: 'Edit a fresh imported copy, save a new .key file and export a new PPTX; reopen and inspect the native objects.', expectedSlides: 16, actions: [
    {id: 'paragraph', slide: 'K02', operation: 'Replace only KN_ORIGINAL_PARAGRAPH with KN_EDIT_PARAGRAPH; append a new paragraph using Return.', marker: 'KN_EDIT_PARAGRAPH', oldMarker: 'KN_ORIGINAL_PARAGRAPH', observe: 'Text editing boundary, paragraph count, font/style, wraps and retained second sentence.'},
    {id: 'rich-text', slide: 'K03', operation: 'Change Bold words to Bold edited and retain bold; italic words stays italic.', marker: 'Bold edited', oldMarker: 'Bold words', observe: 'One body vs line shapes, editable styles and paragraph boundaries.'},
    {id: 'list', slide: 'K04', operation: 'Replace KN_ORIGINAL_LIST with KN_EDIT_LIST; insert one list item with Return and change its indent once.', marker: 'KN_EDIT_LIST', oldMarker: 'KN_ORIGINAL_LIST', observe: 'Bullet/list controls, nesting, descriptions and line/paragraph topology.'},
    {id: 'long-text', slide: 'K05', operation: 'Append KN_EDIT_LONG to the body with one Return.', marker: 'KN_EDIT_LONG', observe: 'Clipping, growth, actual native font and editable body boundaries; do not infer fit from XML.'},
    {id: 'long-list', slide: 'K06', operation: 'Append KN_EDIT_LONG_LIST as one item with Return.', marker: 'KN_EDIT_LONG_LIST', observe: 'Continuation vs new list item and wrap behavior.'},
    {id: 'replace-image', slide: 'K08', operation: 'Use the native Replace Image control with assets/replacement.png; retain frame placement.', observe: 'Picture remains native/editable; capture replacement control and geometry.'},
    {id: 'crop-image', slide: 'K09', operation: 'Use native Edit Mask/crop; move the crop to the opposite quadrant without changing the caption.', observe: 'Native editable crop, retained image, frame and caption; capture before/after.'},
    {id: 'chart-data', slide: 'K10', operation: 'Open native Edit Chart Data; change Revenue Q2 from 24 to 900.', chartSeries: {name: 'Revenue', categories: ['Q1', 'Q2', 'Q3'], values: [12, 900, 18]}, observe: 'Native chart/data editor, labels and matching chart cache after export.'},
    {id: 'chart-style', slide: 'K11', operation: 'Use the native chart inspector to change the line color.', observe: 'Editable chart and series; record actual color and take a screenshot.'},
    {id: 'table-cell', slide: 'K12', operation: 'Edit first body row, first column from KN_ORIGINAL_CELL to KN_EDIT_CELL.', marker: 'KN_EDIT_CELL', oldMarker: 'KN_ORIGINAL_CELL', observe: 'Native table editor, row/column identity, cell contents.'},
    {id: 'table-style', slide: 'K13', operation: 'Change Bold cell to Bold edited cell; keep the bold run and other cells.', marker: 'Bold edited cell', observe: 'Rich cell editing and retained table structure.'},
    {id: 'notes', slide: 'K16', operation: 'Append KN_EDIT_NOTES in presenter notes, leaving slide text unchanged.', notesMarker: 'KN_EDIT_NOTES', observe: 'Native notes UI and exported notes part/reimport.'},
  ]},
  'layout-structure': {description: 'Use a separate fresh copy for layout, new-slide and numbering operations; save/export/reopen derivatives.', expectedSlides: 17, actions: [
    {id: 'placeholder-ui', slide: 'K01', operation: 'Inspect native Title, Body and Slide Number controls and object selection on K01, K02 and K14. Record unavailable controls as unsupported, never passed.', observe: 'Actual placeholder roles and object boundaries; source XML inventory is only a baseline.'},
    {id: 'new-slide', slide: 'K01', operation: 'Create one native slide using the imported Title/Body layout; enter KN_NEW_TITLE and KN_NEW_BODY. Do not duplicate an existing slide.', marker: 'KN_NEW_TITLE', secondMarker: 'KN_NEW_BODY', observe: 'Imported layout appears in chooser; Title/Body placeholders accept native input.'},
    {id: 'reapply', slide: 'K07', operation: 'Select a different imported layout, then reapply the original two-column layout using native layout controls.', observe: 'Content survives, native reapply behavior and geometry; unsupported controls remain a finding.'},
    {id: 'reorder', slide: 'K14', operation: 'Move K14 immediately after K15; enable/inspect Slide Number on those slides if the native control exists.', observe: 'Actual slide numbers update after reorder/save/reopen; cached a:t values alone are insufficient.'},
  ]},
};

// Explicit paired fixture only. The original sourceDeck and sealed 16-case
// baseline remain unchanged; measured/native modes share this exact source.
export function bodyDeck(image) {
  const deck = sourceDeck(image);
  deck.name = 'Keynote native body comparison';
  deck.slides[5] = {...deck.slides[5], layout: 'list', items: Array.from({length: 14}, (_, index) => `Agenda item ${index + 1} with a few more words`)};
  deck.slides.push({layout: 'list', title: 'K17 Flat bullet body', items: ['KN_ORIGINAL_FLAT_LIST', [{text: 'Bold flat item', bold: true}], 'Final flat item.'], notes: 'K17 speaker notes: preserve this sentence.'});
  return deck;
}

export function qualificationRoutes(bodyFixture = false) {
  const result = structuredClone(routes);
  if (bodyFixture) {
    for (const route of Object.values(result)) route.expectedSlides++;
    result['content-edits'].actions.push({id: 'flat-list', slide: 'K17', operation: 'Replace KN_ORIGINAL_FLAT_LIST with KN_EDIT_FLAT_LIST; append KN_NEW_FLAT_ITEM using Return within this same body.', marker: 'KN_EDIT_FLAT_LIST', secondMarker: 'KN_NEW_FLAT_ITEM', oldMarker: 'KN_ORIGINAL_FLAT_LIST', observe: 'One meaningful native body; real bullet controls, added semantic item, wrapping and preserved bold flat item.'});
  }
  return result;
}

export function outcomeTemplate(route, bodyFixture = false) {
  const definitions = qualificationRoutes(bodyFixture);
  if (!Object.hasOwn(definitions, route)) throw new Error(`Unknown qualification route: ${route}`);
  return {route, application: {name: 'Keynote', version: null, os: null}, directions: {
    'opf-to-pptx-to-keynote': {status: 'not-run', observations: []},
    'keynote-save-and-reopen': {status: 'not-run', observations: []},
    'keynote-to-pptx': {status: 'not-run', observations: []},
    'keynote-pptx-to-opf': {status: 'not-run', observations: []},
  }, actions: definitions[route].actions.map(action => ({id: action.id, status: 'not-run', evidence: [], observations: []})), nativeAcceptance: false};
}
