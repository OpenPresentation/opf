// Owned, unmeasured asset-builder child only. Forward all operations unchanged;
// record actual Node module and filesystem inputs, including font/license bytes.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import {registerHooks, syncBuiltinESMExports} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';

const output = process.env.OPF_OWNER_ASSET_TRACE;
if (!output) throw Error('Asset trace needs its explicit owned output path');
const read = fs.readFileSync.bind(fs), append = fs.appendFileSync.bind(fs), seen = new Map();
function record(input, cause) {
  if (typeof input === 'number') throw Error('Unbound file descriptor asset input');
  const file = input instanceof URL ? fileURLToPath(input) : path.resolve(String(input));
  const bytes = read(file), sha256 = createHash('sha256').update(bytes).digest('hex');
  if (seen.has(file) && seen.get(file) !== sha256) throw Error('Asset input changed while preparing: ' + file);
  if (!seen.has(file)) {seen.set(file, sha256); append(output, JSON.stringify({file, cause, bytes: bytes.length, sha256}) + '\n');}
}
const syncRead = fs.readFileSync, asyncRead = fsp.readFile, asyncCopy = fsp.copyFile;
fs.readFileSync = function (file, ...args) {record(file, 'readFileSync'); return syncRead.call(this, file, ...args);};
fsp.readFile = async function (file, ...args) {record(file, 'readFile'); return asyncRead.call(this, file, ...args);};
fsp.copyFile = async function (source, ...args) {record(source, 'copyFile'); return asyncCopy.call(this, source, ...args);};
syncBuiltinESMExports();
registerHooks({resolve(specifier, context, nextResolve) {const result = nextResolve(specifier, context); if (result.url.startsWith('file:')) record(new URL(result.url), 'module-resolve'); return result;}});
