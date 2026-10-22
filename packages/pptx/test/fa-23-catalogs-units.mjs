import assert from 'node:assert/strict';
import {recoverColorScheme, recoverTheme} from '../src/theme-colors.js';
import {observeLanguage} from '../src/script-fonts.js';
import {fontPitchFamilies, PITCH_FAMILY} from '../src/package-fonts.js';

// FA-23 (OPF 0.15), catalogs half: the pure functions behind import recovery, language import and font pitch, with
// hand-built records (no catalog data). test/fa-23-catalogs.mjs covers the same paths end to end through core.

const slots = {dark1: '#000000', light1: '#FFFFFF', dark2: '#011842', light2: '#F0F0F0', accent1: '#2874A6', accent2: '#1B4F72', accent3: '#5499C7', accent4: '#7BDBB2', accent5: '#3AC67A', accent6: '#24A89E', hyperlink: '#0000EE', followedHyperlink: '#551A8B'};
const colors = Object.fromEntries(Object.entries(slots).map(([slot, value]) => [slot, value.slice(1)]));
// Records as the importer builds them from the host default catalog: the record key is the id.
const horizon = {id: 'horizon', name: 'Horizon', ...slots};
const other = {id: 'other', name: 'Other', ...slots, accent1: '#123456'};

// 1. Colour-scheme recovery: an exact match is the bare id; no registered records (no catalog) give inline slots; a
// near match is inline, relative to the record the clrScheme names.
assert.deepEqual(recoverColorScheme({colors, unreadable: [], name: 'Horizon'}, [horizon, other]), {value: 'horizon', exact: true});
assert.deepEqual(recoverColorScheme({colors, unreadable: [], name: 'Horizon'}, []), {value: slots, exact: false}, 'no catalog: inline slots');
assert.deepEqual(recoverColorScheme({colors: {...colors, accent2: 'ABCDEF'}, unreadable: [], name: 'Horizon'}, [horizon]), {value: {id: 'horizon', accent2: '#ABCDEF'}, exact: false});

// 2. Theme recovery resolves the theme's own references through the callbacks (core resolution, the theme's group first).
const theme = {id: 'calm', name: 'Calm', colorScheme: 'horizon', fontScheme: 'pair'};
const resolvers = {
  themes: [theme],
  colorScheme: record => (record.colorScheme === 'horizon' ? horizon : null),
  fontFamilies: record => (record.fontScheme === 'pair' ? {heading: 'Aptos Display', body: 'Aptos'} : null),
};
assert.deepEqual(recoverTheme({themeName: 'Calm', colors, majorFont: 'Georgia', minorFont: 'Georgia'}, resolvers), {id: 'calm'}, 'corroborated by the colour scheme');
assert.deepEqual(recoverTheme({themeName: 'Calm', colors: {...colors, accent1: '000000'}, majorFont: 'Aptos Display', minorFont: 'Aptos'}, resolvers), {id: 'calm'}, 'corroborated by the fonts');
assert.deepEqual(recoverTheme({themeName: 'Calm', colors: {...colors, accent1: '000000'}, majorFont: 'Georgia', minorFont: 'Georgia'}, resolvers), {unverified: 'calm'});
assert.deepEqual(recoverTheme({themeName: 'Calm', colors, majorFont: 'Aptos Display', minorFont: 'Aptos'}, {themes: [], colorScheme: () => null, fontFamilies: () => null}), {}, 'no catalog: no theme id');
assert.deepEqual(recoverTheme({themeName: 'Calm', colors, majorFont: 'Aptos Display', minorFont: 'Aptos'}, {...resolvers, colorScheme: () => null, fontFamilies: () => null}), {unverified: 'calm'}, 'unresolvable theme references corroborate nothing');

// 3. Language import: the dominant run tag is the BCP-47 tag imported; no catalog is consulted.
const run = tag => `<a:rPr lang="${tag}"/>`;
const observed = observeLanguage({slides: [run('ja-JP') + run('ja-JP') + run('en-US')], theme: '', themePath: null, slideThemes: []});
assert.equal(observed.lang, 'ja-JP');
assert.equal(observed.language, 'ja-JP');
assert.equal('match' in observed, false, 'no catalog match is computed');
assert.deepEqual(observed.ranked, [['ja-JP', 2], ['en-US', 1]]);
assert.equal(observeLanguage({slides: [run('x-none') + run('und')], theme: ''}).language, undefined, 'tags that name no language are not imported');
assert.equal(observeLanguage({slides: [run('haw-US')], theme: ''}).language, 'haw-US', 'a tag outside any table imports as itself');

// 4. Font pitch: each slide's resolved scheme, then the catalog records (embedded and registered) where all agree.
const pitch = fontPitchFamilies([{scheme: {type: 'serif', major: 'Georgia', minor: 'Georgia'}, code: 'Roboto Mono'}],
  [{type: 'monospace', major: 'Consolas', minor: 'Consolas'}, {type: 'sans-serif', major: 'Inter', minor: 'Inter'}, {type: 'serif', major: 'Inter', minor: 'Inter'}]);
assert.equal(pitch.get('Georgia'), PITCH_FAMILY.serif);
assert.equal(pitch.get('Consolas'), PITCH_FAMILY.monospace);
assert.equal(pitch.has('Inter'), false, 'records that disagree give no pitch');
assert.equal(pitch.get('Roboto Mono'), PITCH_FAMILY.monospace);

console.log('FA-23 catalog units passed: colour-scheme and theme recovery against registered records, BCP-47 language import, font pitch from records.');
