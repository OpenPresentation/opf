// A family that only an optional script package serves (Noto Naskh Arabic, the font of the noto-sans-arabic font scheme) fails with an
// error that names the npm package and its pinned version, not only "load the 'scripts' font pack". The base registry holds no script face.
import assert from 'node:assert/strict';
import {loadFonts, scriptFontPackages} from '../dist/fonts-node.js';

const {registry} = await loadFonts({pack: 'base'});
const [naskh] = scriptFontPackages(['Arab']).filter(pkg => pkg.faces.some(face => face.family === 'Noto Naskh Arabic'));
assert.ok(naskh, 'the manifest has a package for Noto Naskh Arabic');
assert.throws(() => registry.resolveFont({fontFamily: 'Noto Naskh Arabic', fontWeight: 400}), error => {
  assert.equal(error.code, 'font-unavailable');
  assert.ok(error.message.includes(`install ${naskh.name}@${naskh.version}`), error.message);
  assert.doesNotMatch(error.message, /load the 'scripts' font pack/);
  assert.equal(error.details.pack, 'scripts');
  assert.equal(error.details.package, naskh.name);
  assert.equal(error.details.version, naskh.version);
  return true;
});
// The office pack's open families keep the message that names the pack.
assert.throws(() => registry.resolveFont({fontFamily: 'Montserrat', fontWeight: 400}), error => error.code === 'font-unavailable' && /load the 'office' font pack/.test(error.message) && error.details.package === undefined);
console.log('A script family without its package names the package to install.');
