import assert from 'node:assert/strict';
import { STUDIO_COMMAND_IDS, STUDIO_INSERT_KINDS, contextMenuGroups, createStudioCommands, studioCommandDefinitions } from '../dist/studio-commands.js';
import { matchKey } from '../dist/studio-kit/commands.js';

// CE-20: the Studio's command registry (src/studio-commands.js) against STUDIO-SPEC sections 6 and 14: every command id of the spec is there with a
// label and a group, the keymap binds the spec's keys, `when` gives a reason when a command is off, the context menu names registered commands
// only, and a host's keymap and commands are taken. The browser suites (test/studio-*-browser.mjs) run the commands in a real Studio.
const SPEC_IDS = [
  'studio.tool.select', 'studio.tool.hand', 'studio.tool.text',
  'studio.zoom.in', 'studio.zoom.out', 'studio.zoom.100', 'studio.zoom.fit', 'studio.panels.toggle', 'studio.source.toggle', 'studio.layout.playground', 'studio.layout.studio',
  'studio.select.parent', 'studio.select.children', 'studio.select.next', 'studio.select.previous', 'studio.select.siblings',
  'studio.cut', 'studio.copy', 'studio.paste', 'studio.duplicate', 'studio.delete', 'studio.undo', 'studio.redo',
  'studio.move.earlier', 'studio.move.later', 'studio.move.intoPrevious', 'studio.move.intoNext', 'studio.group', 'studio.ungroup', 'studio.regions.place', 'studio.regions.release',
  'studio.text.edit', 'studio.data.edit', 'studio.image.crop',
  'studio.slide.new', 'studio.slide.duplicate', 'studio.slide.delete', 'studio.slide.hide', 'studio.slide.next', 'studio.slide.previous', 'studio.layout.edit',
  'studio.present', 'studio.present.current', 'studio.find', 'studio.replace', 'studio.export', 'studio.file.open', 'studio.file.download.json', 'studio.file.download.yaml', 'studio.file.download.markdown', 'studio.shortcuts',
  ...STUDIO_INSERT_KINDS.map((kind) => `studio.insert.${kind}`),
  'studio.convert.text', 'studio.convert.chart', 'studio.convert.table',
];
for (const id of SPEC_IDS) assert.ok(STUDIO_COMMAND_IDS.includes(id), `the registry has ${id}`);
assert.equal(new Set(STUDIO_COMMAND_IDS).size, STUDIO_COMMAND_IDS.length, 'no id twice');
for (const command of studioCommandDefinitions()) {
  assert.ok(command.label && command.group && typeof command.run === 'function', `${command.id} has a label, a group and run`);
}

// The keymap (section 6): a key event finds the command it names.
const key = (spec) => {
  const parts = spec.split('+');
  const name = parts.pop();
  return { key: name, code: '', shiftKey: parts.includes('Shift'), altKey: parts.includes('Alt'), ctrlKey: parts.includes('Ctrl'), metaKey: parts.includes('Meta') };
};
const registry = createStudioCommands();
const ready = {
  layout: 'studio', readOnly: false, inSync: true, fontsLoading: false, slideIndex: 1, hasSource: true, hasFind: true, hasExport: true,
  selectedKeys: () => ['/slides/@a/blocks/@b'], primaryKey: () => '/slides/@a/blocks/@b',
  selectedNodes: () => [{ kind: 'block', type: 'text', key: '/slides/@a/blocks/@b', children: [] }], primaryNode: () => ({ kind: 'block', type: 'text', key: '/slides/@a/blocks/@b', children: [] }),
  slideScope: () => false, hasClipboard: () => true, canUndo: () => true, canRedo: () => true, slideCount: () => 3, groupBeside: () => true,
  canPlaceInRegions: () => true, canReleaseRegions: () => 'not in regions', canEditLayout: () => true, textTarget: () => 'slides.0.blocks.0.text',
  canInsert: () => true, canConvert: (kind) => (kind === 'list' ? true : 'no'), hasSibling: () => true,
};
const expectKey = (combo, id, scope = 'canvas') => {
  const found = registry.match(key(combo), ready, { scope }) ?? registry.match(key(combo), ready, { scope: 'global' });
  assert.equal(found?.id, id, `${combo} runs ${id}`);
};
for (const [combo, id] of [
  ['v', 'studio.tool.select'], ['h', 'studio.tool.hand'], ['t', 'studio.tool.text'], ['Meta+=', 'studio.zoom.in'], ['Ctrl+-', 'studio.zoom.out'],
  ['Shift+)', 'studio.zoom.100'], ['Shift+!', 'studio.zoom.fit'], ['Shift+Enter', 'studio.select.parent'], ['ArrowRight', 'studio.select.next'], ['ArrowUp', 'studio.select.previous'],
  ['[', 'studio.move.earlier'], [']', 'studio.move.later'], ['Alt+ArrowUp', 'studio.move.earlier'], ['Alt+ArrowRight', 'studio.move.later'], ['Shift+{', 'studio.move.intoPrevious'], ['Shift+}', 'studio.move.intoNext'],
  ['Meta+a', 'studio.select.siblings'], ['Meta+d', 'studio.duplicate'], ['Delete', 'studio.delete'], ['Backspace', 'studio.delete'], ['Ctrl+c', 'studio.copy'], ['Ctrl+x', 'studio.cut'], ['Ctrl+v', 'studio.paste'],
  ['Meta+g', 'studio.group'], ['F2', 'studio.text.edit'], ['PageDown', 'studio.slide.next'], ['PageUp', 'studio.slide.previous'], ['Ctrl+`', 'studio.source.toggle'], ['Meta+\\', 'studio.panels.toggle'],
  ['Meta+/', 'studio.shortcuts'], ['Shift+?', 'studio.shortcuts'], ['F1', 'studio.shortcuts'], ['F5', 'studio.present'], ['Shift+F5', 'studio.present.current'], ['Meta+Alt+Enter', 'studio.present.current'],
  ['Meta+z', 'studio.undo'], ['Shift+Meta+z', 'studio.redo'], ['Ctrl+y', 'studio.redo'],
]) expectKey(combo, id);
assert.equal(registry.match(key('Shift+Meta+g'), { ...ready, primaryNode: () => ({ kind: 'group', children: ['x'] }) }, { scope: 'canvas' })?.id, 'studio.ungroup');
assert.ok(matchKey(key('Ctrl+`'), 'Ctrl-`'));

// `when`: a reason, never a silent no.
const readOnly = { ...ready, readOnly: true };
for (const id of ['studio.delete', 'studio.group', 'studio.paste', 'studio.insert.text', 'studio.slide.new', 'studio.move.earlier']) {
  assert.equal(registry.list(readOnly).find((entry) => entry.id === id).reason, 'This editor is read-only.', `${id} says why it is off`);
}
const heading = { ...ready, selectedNodes: () => [{ kind: 'heading', type: 'title' }] };
assert.equal(registry.list(heading).find((entry) => entry.id === 'studio.move.earlier').reason, 'A heading cannot move.');
assert.equal(registry.list(heading).find((entry) => entry.id === 'studio.delete').reason, 'A heading cannot be deleted.');
assert.equal(registry.list({ ...ready, inSync: false }).find((entry) => entry.id === 'studio.group').enabled, false, 'an invalid source turns structure off');
assert.equal(registry.list({ ...ready, fontsLoading: true }).find((entry) => entry.id === 'studio.group').reason, 'Fonts are loading.');
assert.equal(registry.list({ ...ready, layout: 'playground' }).find((entry) => entry.id === 'studio.insert.chart').enabled, false, 'Insert is the Studio\'s');
assert.equal(registry.list(ready).find((entry) => entry.id === 'studio.convert.list').enabled, true);
assert.equal(registry.list(ready).find((entry) => entry.id === 'studio.convert.chart').enabled, false);

// The context menu names registered commands only, in the spec's groups.
for (const slide of [false, true]) for (const group of contextMenuGroups({ slide })) for (const id of group) assert.ok(registry.has(id), `the menu's ${id} is registered`);
assert.deepEqual(contextMenuGroups()[0], ['studio.cut', 'studio.copy', 'studio.paste', 'studio.duplicate', 'studio.delete']);

// A host's keymap and commands.
const hosted = createStudioCommands({ extra: [{ id: 'host.share', label: 'Share', group: 'Host', keys: ['Mod-Shift-s'], run: () => true }], keymap: { 'studio.source.toggle': ['Mod-Alt-s'], 'studio.tool.text': null } });
assert.equal(hosted.match(key('Meta+Alt+s'), ready, { scope: 'global' })?.id, 'studio.source.toggle', 'a host rebinds a command');
assert.equal(hosted.match(key('Ctrl+`'), ready, { scope: 'global' }), null, 'and its old key is free');
assert.equal(hosted.match(key('t'), ready, { scope: 'global' }), null, 'null unbinds');
assert.equal(hosted.match(key('Meta+Shift+s'), ready, { scope: 'global' })?.id, 'host.share', 'a host command has its key');
console.log(`studio commands: ${SPEC_IDS.length} spec ids registered, the keymap of section 6, reasons when off, the context menu and host keymaps`);
