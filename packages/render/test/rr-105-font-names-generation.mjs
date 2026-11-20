// RR-105: the browser registry's role-name resolver (registry.fontNames) rebuilds its face pool only when the registry says the
// faces changed (registry.facesGeneration), instead of describing and serializing every face on every resolveStyle/resolveFont.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createFontRegistry} from '../dist/font-registry.js';
import {lazyFontNames} from '../dist/lazy-fonts.js';
import {lazyFontList} from '../dist/lazy-font-list.js';
import {loadFonts} from '../dist/fonts-node.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const full = await loadFonts({pack: 'office', substitutionPolicy: 'metric'});
const eager = full.registry.embeddedFonts.map(face => ({family: face.family, weight: face.weight, italic: face.italic, data: new Uint8Array(Buffer.from(face.dataUrl.split(',')[1], 'base64'))}));
const lazy = lazyFontList();
const bytesOf = async file => new Uint8Array(await readFile(path.join(root, file)));

// The registry's generation: stable while reading, bumped by addFaces, absent from the public (enumerable) surface.
const registry = createFontRegistry(eager.map(face => ({...face})), {substitutionPolicy: 'metric'});
assert.ok(!Object.keys(registry).includes('facesGeneration'), 'the generation is not public API');
const start = registry.facesGeneration;
assert.equal(typeof start, 'number');
registry.describeFaces({selection: true}); registry.resolveFont?.({fontFamily: eager[0].family, fontWeight: eager[0].weight});
assert.equal(registry.facesGeneration, start, 'reading faces does not change the generation');
assert.throws(() => registry.addFaces([{...eager[0]}]), {code: 'duplicate-font-face'});
assert.equal(registry.facesGeneration, start, 'a refused addFaces (atomic) does not change the generation');
const held = new Set(registry.describeFaces().map(face => `${face.family}|${face.weight}|${face.italic}`));
const add = lazy.find(face => !held.has(`${face.family}|${face.weight}|${!!face.italic}`));
assert.ok(add, 'a vendored face that is not held');
const addFile = async face => ({family: face.family, weight: face.weight, italic: face.italic, embed: 'used', data: await bytesOf(face.file)});
registry.addFaces([await addFile(add)]);
assert.ok(registry.facesGeneration !== start, 'addFaces changes the generation');

// lazyFontNames with a generation describes the faces once per generation, and sees a change.
let describes = 0;
const fresh = createFontRegistry(eager.map(face => ({...face})), {substitutionPolicy: 'metric'});
const describeFaces = options => { describes++; return fresh.describeFaces(options); };
const names = lazyFontNames({lazy, describeFaces, generation: () => fresh.facesGeneration, policy: 'metric'});
const plain = lazyFontNames({lazy, describeFaces: options => fresh.describeFaces(options), policy: 'metric'});
const families = [...new Set(eager.map(face => face.family))];
const styles = families.flatMap(fontFamily => [400, 700].map(fontWeight => ({fontFamily, fontWeight})));
const answers = () => styles.map(style => [names.resolveStyle(style), names.resolveFont(style), plain.resolveStyle(style), plain.resolveFont(style)]);
const first = answers();
for (const [withGeneration, , withoutGeneration] of first) assert.deepEqual(withGeneration, withoutGeneration, 'same answers as the signature comparison');
for (let index = 0; index < 50; index++) answers();
// plain describes on every call; the generation-driven resolver described once.
describes = 0;
for (let index = 0; index < 50; index++) styles.map(style => names.resolveStyle(style));
assert.equal(describes, 0, 'no face is described while the generation stays the same');

// A face that arrives later is seen at once (its family now resolves to itself, not to a substitute).
const missing = lazy.find(face => !fresh.describeFaces().some(heldFace => heldFace.family === face.family && heldFace.weight === face.weight && heldFace.italic === !!face.italic));
const probe = {fontFamily: missing.family, fontWeight: missing.weight, italic: !!missing.italic};
const before = names.resolveFont(probe);
fresh.addFaces([await addFile(missing)]);
describes = 0;
const after = names.resolveFont(probe);
assert.equal(describes, 1, 'one describe after the generation changed');
assert.equal(after.resolvedFamily, missing.family);
assert.equal(after.substitute, false);
assert.deepEqual(after, plain.resolveFont(probe), 'identical to the uncached answer after the change');
assert.ok(before.resolvedFamily !== undefined);
console.log('registry.fontNames: pool rebuilt only when the registry generation changes, answers identical to the signature comparison');
