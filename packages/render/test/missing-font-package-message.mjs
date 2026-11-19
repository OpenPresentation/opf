// A deck whose fonts need a font package that is not installed (a Consolas design is drawn with Cousine, from
// @expo-google-fonts/cousine): loading its faces fails once with `font-resource-unavailable` whose message is a correct sentence
// naming the package and the faces that need it, and whose details carry `packages`, `faces` and the one `install` line, so a host
// (opf validate, opf doctor) can report it as a finding. An isolated copy of dist with no font package. Offline and deterministic.
import assert from 'node:assert/strict';
import {cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pins = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).peerDependencies;
const link = (name, into) => symlink(path.join(root, 'node_modules', name), path.join(into, 'node_modules', name), process.platform === 'win32' ? 'junction' : 'dir');

const temporary = await mkdtemp(path.join(tmpdir(), 'opf-missing-font-package-'));
try {
  await writeFile(path.join(temporary, 'package.json'), JSON.stringify({type: 'module'}));
  await cp(path.join(root, 'dist'), path.join(temporary, 'dist'), {recursive: true});
  await symlink(path.join(root, 'fonts'), path.join(temporary, 'fonts'), process.platform === 'win32' ? 'junction' : 'dir');
  await mkdir(path.join(temporary, 'node_modules/@expo-google-fonts'), {recursive: true});
  for (const name of ['fontkit', 'bidi-js', 'pako', 'harfbuzzjs', '@openpresentation']) await link(name, temporary);
  const fontsNode = await import(pathToFileURL(path.join(temporary, 'dist', 'fonts-node.js')));

  // As opf validate and convert prepare a deck: the office pack for a deck with no text, then the deck's own faces.
  const handle = await fontsNode.loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: {slides: []}});
  const deck = {design: {fontScheme: {heading: 'Consolas', body: 'Consolas'}}, slides: [{title: 'Mono', text: 'Body text'}]};
  const cousine = '@expo-google-fonts/cousine';
  await assert.rejects(handle.ensure(deck), error => {
    assert.equal(error.code, 'font-resource-unavailable');
    assert.deepEqual(error.details.packages, [cousine]);
    assert.deepEqual(error.details.faces, ['Cousine']);
    assert.equal(error.details.install, `npm install ${cousine}@${pins[cousine]}`);
    assert.equal(error.message, `This presentation needs a font package that is not installed (an optional peer dependency of @openpresentation/opf-render): ${cousine} (Cousine). Run \`npm install ${cousine}@${pins[cousine]}\`.`);
    return true;
  });

  // Several packages: the plural sentence, each package with its faces.
  await assert.rejects(fontsNode.loadFonts({pack: 'base'}), error => {
    for (const face of ['Roboto', 'Roboto Mono']) assert.ok(error.details.faces.includes(face), face);
    assert.match(error.message, /^The 'base' font pack needs font packages that are not installed \(optional peer dependencies of @openpresentation\/opf-render\): @expo-google-fonts\/roboto \(Roboto[^)]*\), @expo-google-fonts\/roboto-mono \(Roboto Mono\)\. Run `npm install /);
    return true;
  });
  console.log('missing-font-package-message: ok');
} finally {
  await rm(temporary, {recursive: true, force: true});
}
