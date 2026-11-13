// RR-105, the second line of defense: when a conversion's drawing fails only because the fonts handle had not prepared a face,
// the conversion (core's runExport, behind `opf convert` and `convert`) prepares exactly that face and draws again, and reports
// it as fonts/prepared-late. The handle here stands in for an analysis that omits a face the export needs: its `ensure`
// prepares nothing for the presentation, only explicit measurement requests (the path late preparation uses).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gallery} from '@openpresentation/gallery';
import {convert} from '@openpresentation/opf';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';

const renderOptions = {catalogs: [gallery]}, date = '2026-11-12';
// The title wraps and splits at its colon, so the qualifier is set in the body face (Intos 400) beside the heading face.
const deck = {slides: [{title: 'Preset shapes 49 to 60: notchedRightArrow to leftRightArrowCallout', blocks: [{shape: 'rect'}]}]};
const EMPTY = {slides: []};

/** A demand handle prepared for a one-line title (the heading face only) whose analysis then sees nothing. */
async function blindHandle({prepareRequests}) {
  const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: {slides: [{title: 'Quarterly review'}]}, renderOptions});
  const ensure = fonts.ensure.bind(fonts), requests = [];
  fonts.ensure = (_presentation, options = {}) => {
    if (options.measurementRequests?.length) requests.push(...options.measurementRequests);
    return prepareRequests && options.measurementRequests?.length ? ensure(EMPTY, options) : Promise.resolve({scripts: [], lazy: [], uncovered: []});
  };
  return {fonts, requests};
}
const held = fonts => fonts.registry.describeFaces().map(face => `${face.family} ${face.weight}${face.italic ? ' italic' : ''}`);

for (const [format, extra] of [['pptx', {}], ['svg', {text: 'paths'}]]) {
  test(`${format}: a face the analysis missed is prepared late, reported, and the export succeeds`, async () => {
    const {fonts} = await blindHandle({prepareRequests: true});
    assert.ok(!held(fonts).includes('Intos 400'), 'the stand-in analysis left the body face unprepared');
    const result = await convert(deck, {...renderOptions, date, format, fonts, ...extra});
    assert.ok(result.files.length > 0);
    const late = result.findings.filter(finding => finding.ruleId === 'fonts/prepared-late');
    assert.equal(late.length, 1, JSON.stringify(result.findings));
    assert.equal(late[0].severity, 'info');
    // The PPTX exporter names the role family, the SVG renderer the family it already resolved.
    assert.ok(['Aptos', 'Intos'].includes(late[0].fontFamily), late[0].fontFamily);
    assert.equal(late[0].fontWeight, 400);
    assert.equal(late[0].italic, false);
    assert.equal(late[0].path, '/slides/0/title');
    assert.ok(held(fonts).includes('Intos 400'), 'exactly the named face was prepared');
    assert.ok(!result.findings.some(finding => finding.severity === 'error'), 'the failed attempt left no error behind');
  });
}

test('the late output equals the output of a handle that prepared the face up front', async () => {
  const {fonts} = await blindHandle({prepareRequests: true});
  const late = await convert(deck, {...renderOptions, date, format: 'pptx', fonts});
  const upfront = await convert(deck, {...renderOptions, date, format: 'pptx', fonts: await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: deck, renderOptions})});
  assert.deepEqual(late.files.map(file => file.bytes), upfront.files.map(file => file.bytes));
  assert.ok(!upfront.findings.some(finding => finding.ruleId === 'fonts/prepared-late'), 'the fixpoint prepares it with no late preparation');
});

test('a face that cannot be prepared still fails with the prepared-face error, naming the face', async () => {
  const {fonts, requests} = await blindHandle({prepareRequests: false});
  await assert.rejects(convert(deck, {...renderOptions, date, format: 'pptx', fonts}), error => {
    const text = `${error.message} ${JSON.stringify(error.findings ?? error.report?.findings ?? [])} ${error.cause?.message ?? ''}`;
    assert.match(text, /selected face is not prepared/);
    assert.match(text, /Aptos/);
    return true;
  });
  assert.equal(requests.length, 1, 'one late preparation was tried for the face, not repeated');
});
