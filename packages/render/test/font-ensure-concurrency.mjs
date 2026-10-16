import assert from 'node:assert/strict';
import {loadFonts} from '../dist/fonts-node.js';

const japanese = {language:'ja', slides:[{title:'日本語'}]};
const hebrew = {language:'he', slides:[{title:'שלום'}]};
const uniqueFaces = fonts => {
  const keys = fonts.registry.describeFaces().map(face => `${face.family}:${face.weight}:${face.italic}`);
  assert.equal(new Set(keys).size, keys.length, 'every loaded face remains unique');
  assert.equal(new Set(fonts.fontFiles).size, fonts.fontFiles.length, 'files are not added twice');
};
{
  const fonts = await loadFonts();
  const before = fonts.fontFiles.length;
  const [first, second] = await Promise.all([fonts.ensure(japanese), fonts.ensure(japanese)]);
  assert.deepEqual(first.scripts, ['@expo-google-fonts/noto-sans-jp']);
  assert.deepEqual(second, {scripts:[], lazy:[], uncovered:[]});
  assert.equal(fonts.fontFiles.length, before + 2);
  assert.deepEqual(fonts.pending(japanese), []);
  uniqueFaces(fonts);
}
{
  const fonts = await loadFonts();
  const [first, second] = await Promise.all([fonts.ensure(japanese), fonts.ensure(hebrew)]);
  assert.deepEqual(first.scripts, ['@expo-google-fonts/noto-sans-jp']);
  assert.deepEqual(second.scripts, ['@expo-google-fonts/noto-sans-hebrew', '@expo-google-fonts/noto-serif-hebrew']);
  assert.deepEqual(fonts.pending(japanese), []);
  assert.deepEqual(fonts.pending(hebrew), []);
  uniqueFaces(fonts);
}
{
  const inherited = [], perCall = [], fonts = await loadFonts({onDiagnostic: note => inherited.push(note)});
  const failure = new Error('host diagnostic failure');
  const failed = fonts.ensure({slides:[{title:'ᏣᎳᎩ'}]}, {onDiagnostic: note => {perCall.push(note); throw failure;}});
  const recovered = fonts.ensure(japanese);
  await assert.rejects(failed, error => error === failure, 'preserve original per-call error identity');
  assert.deepEqual((await recovered).scripts, ['@expo-google-fonts/noto-sans-jp']);
  assert.deepEqual(perCall.map(note => [note.code, note.script]), [['script-font-unavailable', 'Cher']]);
  assert.deepEqual(inherited, [], 'per-call diagnostic override remains authoritative');
  const invalid = fonts.ensure(null), afterInvalid = fonts.ensure(hebrew);
  await assert.rejects(invalid, {code:'invalid-font-scripts'});
  assert.deepEqual((await afterInvalid).scripts, ['@expo-google-fonts/noto-sans-hebrew', '@expo-google-fonts/noto-serif-hebrew']);
  uniqueFaces(fonts);
}
console.log('Node ensure: concurrent same/different scripts, isolated results/options, error identity and queue recovery.');
