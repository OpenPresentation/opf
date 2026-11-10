// RR-105: the native wrap planner measures the exact family/style flags serialized by the writer.
import assert from 'node:assert/strict';
import {unzipSync, strFromU8} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx} from './helpers/default-catalog.mjs';
import {nativeTitleWrapBox} from '../src/native-body.js';

const title = 'Native title measurement follows the physical family over every measured line of the heading';
const deck = family => ({design: {fontScheme: {major: family, minor: family}}, slides: [{title, text: 'Body'}]});
const headingShapes = bytes => [...strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
  .map(([shape]) => shape).filter(shape => shape.includes('name="OPF heading slides.0.title line '));
const calls = [], resolutions = [];
const provider = {
  resolveFont: style => ({substitute: false, compatibility: 'exact', family: style.fontFamily}),
  resolveStyle: style => {
    if (style.path === 'slides.0.title') resolutions.push({...style});
    return {...style, ...(style.path === 'slides.0.title' && style.fontFamily === 'Logical Title' ? {
      sourceFontFamily: 'Segoe UI Light', fontFace: {family: 'Native Medium', bold: false, italic: false}
    } : {})};
  },
  measure: (text, size, style) => {
    if (style.path === 'slides.0.title') calls.push({...style, text, size});
    // Deliberately distinct advances: measuring the logical family cannot pass this control.
    return text.length * size * (style.fontFamily === 'Native Medium' ? .49 : .5);
  }
};
const diagnostics = [], bytes = await toPptx(deck('Logical Title'), {fonts: {textMeasurement: provider}, bodyText: 'native', onDiagnostic: value => diagnostics.push(value)});
const [shape] = headingShapes(bytes);
assert.equal(headingShapes(bytes).length, 1, 'an exact physical face remains a native title');
assert.match(shape, /<p:ph type="title"\/>/);
assert.match(shape, /<a:latin typeface="Native Medium"/);
assert.ok(!/<a:rPr[^>]*\bb="1"/.test(shape), 'the physical legacy family stays regular');
assert.ok(resolutions.some(style => style.fontFamily === 'Native Medium' && style.fontWeight === 400 && style.italic === false && !('fontFace' in style) && !('sourceFontFamily' in style)), 'resolve physical native style without metadata for the logical/source face');
assert.ok(calls.filter(style => style.fontFamily === 'Native Medium').length >= 4, 'both line and next-word widths use physical-face advances');
assert.ok(calls.filter(style => style.fontFamily === 'Native Medium').every(style => style.fontWeight === 400 && style.italic === false));
assert.ok(!diagnostics.some(value => value.code === 'native-body-fallback'));
assert.match(shape, /<a:noAutofit\/>/);

// A provider unable to establish physical-face metrics must preserve measured lines rather than infer compatibility.
const item = {value: 'Alpha beta gamma delta', box: {x: 0, y: 0, width: 300, height: 100}, textStyle: {fontFamily: 'Logical', fontWeight: 700}, text: {fontSize: 32, lines: ['Alpha beta ', 'gamma delta']}};
for (const measurement of [{measure: () => 1}, {resolveFont: () => {throw Object.assign(new Error('missing'), {code: 'font-unavailable'});}}]) {
  const reasons = [];
  assert.equal(nativeTitleWrapBox(item, {width: 500, contentBox: {x: 0, width: 500}}, measurement, {nativeStyle: {fontFamily: 'Physical', fontWeight: 400}, report: reason => reasons.push(reason)}), undefined);
  assert.deepEqual(reasons, ['font-metrics']);
}
assert.throws(() => nativeTitleWrapBox(item, {width: 500}, {resolveFont: () => {throw new Error('provider defect');}}, {nativeStyle: {fontFamily: 'Physical'}}), /provider defect/, 'unrelated provider errors remain errors');

const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
for (const [family, typefaces, written, fallback] of [
  ['Roboto', 'selected', 'Roboto', false], ['Arial', 'selected', 'Arial', false],
  ['Segoe UI Light', 'selected', 'Segoe UI Light', true], ['Segoe UI Semilight', 'selected', 'Segoe UI Semilight', true],
  ['Bookman Old Style', 'selected', 'Bookman Old Style', true], ['Segoe UI Light', 'safe', 'Arial', false],
  ['Bookman Old Style', 'safe', 'Arial', false]
]) {
  const input = deck(family); input.slides[0].title = 'Native title measurement follows the physical family over every measured line';
  const notes = [], result = await toPptx(input, {fonts, typefaces, bodyText: 'native', onDiagnostic: value => notes.push(value)}), shapes = headingShapes(result);
  assert.ok(shapes.every(value => value.includes('<a:latin typeface="' + written + '"')), family + ': preserve the serialized family');
  assert.equal(notes.some(value => value.path === 'slides.0.title' && value.code === 'native-body-fallback' && value.reason === 'font-metrics'), fallback, family + '/' + typefaces + ': fidelity follows the serialized family');
  if (!fallback) { assert.equal(shapes.length, 1, family + '/' + typefaces + ': ' + JSON.stringify(notes)); assert.match(shapes[0], /<p:ph type="title"\/>/); }
  assert.ok(shapes.every(value => !/normAutofit|spAutoFit/.test(value)), family + ': no automatic font resizing');
  assert.ok(shapes.every(value => /<a:rPr[^>]*\bsz="[1-9]\d*"/.test(value)), family + ': explicit font sizes');
}
console.log('RR-105: writer physical-face advances/style flags, source-family metadata, selected/safe and Light/Semilight title controls pass.');
