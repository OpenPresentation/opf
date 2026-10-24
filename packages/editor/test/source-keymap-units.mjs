// The key-binding table of the source editor (src/source-keymap.js): its integrity, how strokes are named and read, and that no key is installed outside it.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { GROUPS, TABLE, createKeymap, eventMatches, parseStroke, platformOf, strokeOf, strokeText } from '../src/source-keymap.js';

const PLATFORMS = ['mac', 'win', 'linux'];
const event = (key, mods = {}, code = '') => ({ key, code, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });

test('table: ids are unique, groups are known, titles are present', () => {
  const ids = TABLE.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  for (const item of TABLE) {
    assert.ok(GROUPS.includes(item.group), `${item.id}: group ${item.group}`);
    assert.ok(item.title && /^[A-Z]/.test(item.title), `${item.id}: title`);
    assert.ok(Array.isArray(item.keys), `${item.id}: keys`);
  }
});

test('table: every stroke parses on every platform', () => {
  for (const item of TABLE) for (const binding of item.keys) for (const platform of PLATFORMS) {
    const stroke = strokeOf(binding, platform);
    if (!stroke || /Click|Drag$/.test(stroke)) continue;
    for (const one of stroke.split(' ')) assert.doesNotThrow(() => parseStroke(one, platform), `${item.id}: ${one}`);
  }
});

test('table: one stroke is not two commands on a platform, unless they apply at different times', () => {
  for (const platform of PLATFORMS) {
    const seen = new Map();
    for (const item of TABLE) {
      if (item.documentedOnly || item.installedWith) continue;
      for (const binding of item.keys) {
        const stroke = strokeOf(binding, platform);
        if (!stroke || /Click|Drag$/.test(stroke)) continue;
        const key = `${stroke}|${item.when ?? ''}`;
        // Tab and Enter mean different things with the list open (when) and without; the same text at the same time is a conflict.
        assert.ok(!seen.has(key), `${platform}: ${stroke} is bound to ${seen.get(key)} and ${item.id}`);
        seen.set(key, item.id);
      }
    }
  }
});

test('table: the first stroke of a chord is not also a command of its own', () => {
  for (const platform of PLATFORMS) {
    const singles = new Set(), firsts = new Set();
    for (const item of TABLE) for (const binding of item.keys) {
      const stroke = strokeOf(binding, platform);
      if (!stroke || /Click|Drag$/.test(stroke)) continue;
      const parts = stroke.split(' ');
      if (parts.length > 1 && !item.documentedOnly) firsts.add(parts[0]); else if (!item.documentedOnly) singles.add(stroke);
    }
    for (const first of firsts) assert.ok(!singles.has(first), `${platform}: ${first} starts a chord and is a command`);
  }
});

test('strokeText: words and symbols per platform', () => {
  assert.equal(strokeText('Mod-Shift-o', 'mac'), 'Cmd+Shift+O');
  assert.equal(strokeText('Mod-Shift-o', 'win'), 'Ctrl+Shift+O');
  assert.equal(strokeText('Mod-Alt-[', 'mac'), 'Cmd+Alt+[');
  assert.equal(strokeText('Mod-k Mod-0', 'linux'), 'Ctrl+K Ctrl+0');
  assert.equal(strokeText('Ctrl-Space', 'mac'), 'Ctrl+Space');
  assert.equal(strokeText('Alt-ArrowDown', 'mac'), 'Alt+Down');
  assert.equal(strokeText('Alt-A', 'mac'), 'Alt+Shift+A', 'an upper-case letter is Shift');
  assert.equal(strokeText('Mod-Shift-o', 'mac', { symbols: true }), '⇧⌘O');
  assert.equal(strokeText('Escape', 'win', { symbols: true }), 'Esc');
});

test('platformOf reads navigator.platform like CodeMirror', () => {
  assert.equal(platformOf('MacIntel'), 'mac');
  assert.equal(platformOf('iPhone'), 'mac');
  assert.equal(platformOf('Win32'), 'win');
  assert.equal(platformOf('Linux x86_64'), 'linux');
});

test('eventMatches: exact modifiers, lowercase letters with Shift, the physical key under Alt', () => {
  const shiftO = parseStroke('Mod-Shift-o', 'win');
  assert.ok(eventMatches(event('O', { ctrlKey: true, shiftKey: true }), shiftO));
  assert.ok(eventMatches(event('o', { ctrlKey: true, shiftKey: true }), shiftO), 'a platform that reports a lowercase letter with Shift');
  assert.ok(!eventMatches(event('o', { ctrlKey: true }), shiftO), 'Shift missing');
  assert.ok(!eventMatches(event('o', { ctrlKey: true, shiftKey: true, altKey: true }), shiftO), 'extra Alt');
  assert.ok(!eventMatches(event('o', { metaKey: true, shiftKey: true }), shiftO), 'Cmd is not Ctrl');
  const format = parseStroke('Alt-Shift-f', 'mac');
  assert.ok(eventMatches(event('Ï', { altKey: true, shiftKey: true }, 'KeyF'), format), 'macOS Option changes the character; the key is read from its place');
  const chordStart = parseStroke('Mod-k', 'mac');
  assert.ok(eventMatches(event('k', { metaKey: true }), chordStart));
  assert.ok(!eventMatches(event('k', { metaKey: true, shiftKey: true }), chordStart), 'Cmd+Shift+K (Delete Line) is not the start of a chord');
  assert.ok(eventMatches(event('F1'), parseStroke('F1', 'win')));
  assert.ok(eventMatches(event('0', { ctrlKey: true }, 'Digit0'), parseStroke('Mod-0', 'win')));
});

test('createKeymap: bind records keys per platform and returns CodeMirror bindings', () => {
  const runs = [() => 1, () => 2];
  for (const platform of PLATFORMS) {
    const km = createKeymap({ platform });
    const bindings = km.bind('suggest.accept', runs);
    assert.deepEqual(bindings.map((binding) => binding.key), ['Tab', 'Enter']);
    assert.deepEqual(bindings.map((binding) => binding.run), runs);
    const rows = km.shortcuts();
    assert.deepEqual(rows.map((row) => row.id), ['suggest.accept']);
    assert.deepEqual(rows[0].keys, ['Tab', 'Enter']);
  }
  const mac = createKeymap({ platform: 'mac' }), win = createKeymap({ platform: 'win' });
  mac.bind('suggest.trigger', () => 0); win.bind('suggest.trigger', () => 0);
  assert.deepEqual(mac.shortcuts()[0].keys, ['Ctrl+Space', 'Cmd+I']);
  assert.deepEqual(win.shortcuts()[0].keys, ['Ctrl+Space']);
  assert.deepEqual(win.shortcuts('mac')[0].keys, ['Ctrl+Space', 'Cmd+I'], 'the list can be asked for another platform');
  assert.throws(() => mac.bind('no.such.command', () => 0), /No key binding/);
  assert.throws(() => mac.bind('help.shortcuts', () => 0), /bindDom/);
});

test('createKeymap: bindDom builds the strokes of a chord, spread titles CodeMirror commands and reports the ones without a title', async () => {
  const km = createKeymap({ platform: 'win' });
  km.bindDom('fold.all', () => true);
  assert.equal(km.dom.length, 1);
  assert.equal(km.dom[0].strokes[0].length, 2);
  assert.equal(km.shortcuts()[0].keys[0], 'Ctrl+K Ctrl+0');
  const { defaultKeymap } = await import('@codemirror/commands');
  const { searchKeymap } = await import('@codemirror/search');
  const { historyKeymap } = await import('@codemirror/commands');
  const { closeBracketsKeymap } = await import('@codemirror/autocomplete');
  km.spread(defaultKeymap); km.spread(searchKeymap); km.spread(historyKeymap.filter((binding) => binding.run.name !== 'redo'));
  const untitled = km.unlisted();
  // closeBrackets' Backspace is the editor's own and hidden; everything else CodeMirror binds has a title.
  assert.deepEqual(untitled.filter((stroke) => !closeBracketsKeymap.some((binding) => binding.key === stroke)), [], `bindings without a title: ${untitled}`);
  const rows = km.shortcuts();
  assert.ok(rows.find((row) => row.id === 'lines.moveUp').keys.includes('Alt+Up'));
  assert.ok(rows.every((row) => row.title && row.group && row.keys.length), 'every row has a title, a group and keys');
});

test('no key is installed outside the table: keymap.of is only used in the files that read it from there', () => {
  const dir = new URL('../src/', import.meta.url);
  const allowed = new Set(['json-editor.js', 'source-diagnostics.js', 'source-keymap.js', 'source-hints.js' /* its own modal Escape, listed as hint.close */, 'source-navigation-ui.js' /* the Escape of the peek, references and rename widgets, listed as nav.close */]);
  for (const name of readdirSync(dir).filter((file) => file.endsWith('.js'))) {
    const text = readFileSync(new URL(name, dir), 'utf8');
    const uses = (text.match(/\bkeymap\.of\(/g) ?? []).length;
    if (uses) assert.ok(allowed.has(name), `${name} installs key bindings (keymap.of) outside source-keymap.js: add them to the table`);
  }
});
