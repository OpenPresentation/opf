// Module resolve hook: the published opf font-policy chunk resolves to the locally patched copy (see make-patch.mjs). Scratch only.
import {readFileSync} from 'node:fs';
const target = JSON.parse(readFileSync(new URL('./target.json', import.meta.url), 'utf8'));
export async function resolve(specifier, context, next) {
  const result = await next(specifier, context);
  return result.url === target.original ? {...result, url: target.patched, shortCircuit: true} : result;
}
