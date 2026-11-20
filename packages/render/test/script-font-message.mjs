// One wording for "a script font package is not installed", whichever path reports it: loadFonts (auto), ensure, the CJK glyph-fallback chain
// and demand loading all build the message with scriptFontNotInstalledMessage, so an author sees the pinned package and the three install forms.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scriptFontNotInstalledMessage} from '../src/script-font-message.js';

const message=scriptFontNotInstalledMessage('Install @expo-google-fonts/noto-sans-jp@0.4.5 for glyphs the loaded CJK faces lack.','@expo-google-fonts/noto-sans-jp','0.4.5');
assert.match(message,/^Install @expo-google-fonts\/noto-sans-jp@0\.4\.5 for glyphs the loaded CJK faces lack\. Install it where the CLI runs/);
for(const form of ['npm install -g @expo-google-fonts/noto-sans-jp@0.4.5','npm install @expo-google-fonts/noto-sans-jp@0.4.5 in the project','-p @expo-google-fonts/noto-sans-jp@0.4.5'])assert.ok(message.includes(form),form);
assert.ok(!scriptFontNotInstalledMessage('Install x.','x',undefined).includes('x@'),'a missing version names the bare package');

// Every place that reports script-font-not-installed builds its message with the helper (a new path cannot forget it).
const src=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','src');
const emitters=[];
for(const file of await readdir(src)){
  if(!file.endsWith('.js'))continue;
  const text=await readFile(path.join(src,file),'utf8');
  const emits=[...text.matchAll(/script-font-not-installed['"`]/g)].length;
  if(!emits||file==='script-font-message.js')continue;
  emitters.push(file);
  const uses=[...text.matchAll(/scriptFontNotInstalledMessage\(/g)].length;
  assert.ok(uses>=emits,`${file} reports script-font-not-installed ${emits} time(s) and builds ${uses} message(s) with scriptFontNotInstalledMessage`);
}
assert.deepEqual(emitters.sort(),['font-demand.js','fonts-node.js']);
console.log('script font install message: one wording on every path checked.');
