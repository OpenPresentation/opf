// Node-only bounded content guard for a single preparation's async transitions.
import { createHash } from 'node:crypto';
import { types } from 'node:util';
const MAX_BYTES = 2 * 1024 * 1024,
  MAX_WORK = 100000,
  MAX_DEPTH = 64;
export function preparationContext(presentation, options) {
  const hash = createHash('sha256'),
    active = new Set();
  let bytes = 0,
    work = 0;
  const put = (value) => {
    if (value.length > MAX_BYTES - bytes) throw null;
    const size = Buffer.byteLength(value);
    if ((bytes += size) > MAX_BYTES) throw null;
    hash.update(value);
  };
  const string = (value) => {
    if (value.length > MAX_BYTES - bytes) throw null;
    put(JSON.stringify(value));
  };
  const visit = (value, depth) => {
    if (++work > MAX_WORK || depth > MAX_DEPTH) throw null;
    if (value === null) {
      put('null;');
      return;
    }
    if (typeof value === 'string') {
      put('s');
      string(value);
      put(';');
      return;
    }
    if (typeof value === 'boolean') {
      put(value ? 'true;' : 'false;');
      return;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw null;
      put(Object.is(value, -0) ? 'n-0;' : 'n' + value + ';');
      return;
    }
    if (typeof value !== 'object' || types.isProxy(value) || active.has(value)) throw null;
    const array = Array.isArray(value),
      proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
      throw null;
    if (proto && Object.getOwnPropertyDescriptor(proto, 'toJSON')) throw null;
    active.add(value);
    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_WORK - work) throw null;
    put(array ? '[' : '{');
    let count = 0;
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || (array && key !== String(count++))) throw null;
      const item = Object.getOwnPropertyDescriptor(value, key);
      if (!item || !item.enumerable || !Object.hasOwn(item, 'value')) throw null;
      if (++work > MAX_WORK) throw null;
      string(key);
      put(':');
      visit(item.value, depth + 1);
    }
    if (array && count !== value.length) throw null;
    put(array ? ']' : '}');
    active.delete(value);
  };
  try {
    visit([presentation, options ?? {}], 0);
    return hash.digest('hex');
  } catch {
    return undefined;
  }
}
