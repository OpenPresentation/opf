// RR-105 (opf#1293): a run whose family is its theme's heading or body family names the theme font (+mj-lt, +mn-lt, and the East Asian
// and complex-script slots where the deck's script font is the theme's), so Design > Variants > Fonts restyles the deck. Other families
// keep their names; the look and the imported document do not change.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';
import {typefacesNotOfficeSafe} from '../dist/index.js';
import {referenceThemeFonts, themeFontSlots} from '../src/theme-font-references.js';

const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const base = {seed: 1293, timestamp: '2026-11-12T00:00:00Z', zipDate: '2026-11-12T00:00:00Z', fonts};
const faces = xml => [...xml.matchAll(/<a:(latin|ea|cs)\b[^>]*\btypeface="([^"]*)"/g)].map(([, slot, face]) => `${slot}:${face}`);
async function exported(deck, extra = {}) {
  const diagnostics = [];
  await fonts.ensure(deck);
  const bytes = new Uint8Array(await toPptx(deck, {...base, ...extra, onDiagnostic: value => diagnostics.push(value)}));
  return {bytes, entries: unzipSync(bytes), diagnostics};
}
const part = (out, path) => strFromU8(out.entries[path]);

// 1. The pure rewrite: theme slots only, by slot, a family both slots hold by role, references and other names untouched.
{
  const theme = '<a:fontScheme name="x"><a:majorFont><a:latin typeface="Montserrat"/><a:ea typeface="Noto Sans JP"/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Work Sans"/><a:ea typeface="Noto Sans JP"/><a:cs typeface=""/></a:minorFont></a:fontScheme>';
  const slots = themeFontSlots(theme);
  assert.deepEqual(slots, {mj: {lt: 'Montserrat', ea: 'Noto Sans JP'}, mn: {lt: 'Work Sans', ea: 'Noto Sans JP'}});
  const run = (name, inner) => `<p:sp><p:nvSpPr><p:cNvPr id="2" name="${name}"/></p:nvSpPr><p:txBody><a:p><a:r><a:rPr>${inner}</a:rPr><a:t>x</a:t></a:r></a:p></p:txBody></p:sp>`;
  const xml = run('OPF heading slides.0.title line 0', '<a:latin typeface="Montserrat" pitchFamily="34" charset="0"/><a:ea typeface="Noto Sans JP"/>')
    + run('OPF text slides.0.text line 0', '<a:latin typeface="Work Sans"/><a:ea typeface="Noto Sans JP"/><a:cs typeface="Work Sans"/>')
    + run('Other', '<a:latin typeface="Roboto Mono"/><a:latin typeface="Montserrat SemiBold"/><a:latin typeface="+mn-lt"/>');
  // The second run's cs names its latin face on purpose (the theme's cs slot is empty): latin and cs stay together, by name.
  assert.deepEqual(faces(referenceThemeFonts(xml, slots, {isHeading: shape => shape.includes('OPF heading')})), [
    'latin:+mj-lt', 'ea:+mj-ea', 'latin:Work Sans', 'ea:+mn-ea', 'cs:Work Sans', 'latin:Roboto Mono', 'latin:Montserrat SemiBold', 'latin:+mn-lt']);
  // Fingerprinted shapes (proofing and fragment records) keep every name.
  assert.equal(referenceThemeFonts(xml, slots, {keep: () => true}), xml);
}

// 2. A deck: titles name the heading slot, body text, lists and tables the body slot; no slide names a theme family by name. Charts keep
// the family by name (FF-08: every chart text element names the deck's body face itself).
const deck = {design: {fontScheme: {major: 'Montserrat', minor: 'Work Sans'}}, slides: [
  {title: 'Quarterly results show steady growth in every region', items: ['First point', 'Second point'], notes: 'Speaker notes'},
  {title: 'A table', table: {columns: ['Metric', 'Value'], rows: [['Growth', '24%'], ['Margin', '31%']]}},
  {title: 'A chart', chart: {type: 'column', data: {columns: ['Quarter', 'Sales'], rows: [['Q1', 10], ['Q2', 14], ['Q3', 18]]}}},
  {title: ['Rich ', {text: 'title', italic: true}], text: 'Body text under a rich title.'}
]};
{
  const out = await exported(deck);
  const theme = themeFontSlots(part(out, 'ppt/theme/theme1.xml'));
  for (const path of Object.keys(out.entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))) {
    const named = faces(part(out, path)).filter(face => !face.includes(':+'));
    for (const face of named) {
      const [slot, family] = face.split(':'), key = {latin: 'lt', ea: 'ea', cs: 'cs'}[slot];
      assert.ok(theme.mj[key] !== family && theme.mn[key] !== family, `${path}: ${face} is a theme family written by name`);
    }
  }
  const slide1 = part(out, 'ppt/slides/slide1.xml');
  assert.match(slide1, /<a:latin typeface="\+mj-lt"/, 'the title names the heading font');
  assert.match(slide1, /<a:latin typeface="\+mn-lt"/, 'the body names the body font');
  assert.match(part(out, 'ppt/slides/slide2.xml'), /<a:tbl>[\s\S]*<a:latin typeface="\+mn-lt"/, 'table cells name the body font');
  const chart = Object.keys(out.entries).find(path => /^ppt\/charts\/chart\d+\.xml$/.test(path));
  assert.match(part(out, chart), /<a:latin typeface="Work Sans"\/>/, 'chart text names the body face');
  assert.doesNotMatch(part(out, chart), /typeface="\+m[jn]-/, 'no theme reference in a chart');
  const back = await fromPptx(out.bytes);
  assert.deepEqual(back.slides.map(slide => slide.title), deck.slides.map(slide => slide.title), 'titles round trip');
  assert.deepEqual(back.design?.fontScheme, deck.design.fontScheme, 'the font scheme round trips');
}

// 3. Safe typefaces: the theme and the runs name the safe family, so runs still reference it; the not-office-safe finding is unchanged.
{
  const selected = await exported(deck), safe = await exported(deck, {typefaces: 'safe'});
  // The finding (core's typeface-not-office-safe) reads the families the package names, the theme's included.
  assert.deepEqual(typefacesNotOfficeSafe(selected.bytes), ['Montserrat', 'Work Sans'], 'the selected families are still reported');
  assert.match(part(safe, 'ppt/slides/slide1.xml'), /<a:latin typeface="\+mj-lt"/);
  assert.deepEqual(themeFontSlots(part(safe, 'ppt/theme/theme1.xml')).mj.lt, 'Arial');
  assert.deepEqual(typefacesNotOfficeSafe(safe.bytes), []);
}
