// Ephemeral first-use requirements, only owned by one Node ensure scope. No metrics or geometry are retained.
const LIMIT_ENTRIES = 4096,
  LIMIT_BYTES = 512 * 1024;
const MEASURE_SOFT = new Set(['missing-glyph', 'font-unavailable', 'font-style-unavailable']);
const PROBE_SOFT = new Set([
  ...MEASURE_SOFT,
  'unresolved-theme-font',
  'font-encoding-required',
  'math-font-required',
  'invalid-font-family',
]);
const FIELDS = [
  'fontFamily',
  'fontWeight',
  'italic',
  'symbolEncoding',
  'sourceFontFamily',
  'lang',
  'direction',
];
// Keep absent, own undefined, explicit null and values distinct; paths are deliberately first-use only.
const property = (object, field) => {
  const descriptor = Object.getOwnPropertyDescriptor(object, field);
  if (!descriptor) return [0];
  if (!Object.hasOwn(descriptor, 'value')) throw Error('opaque replay field');
  return descriptor.value === undefined
    ? [1]
    : descriptor.value === null
      ? [2]
      : [3, descriptor.value];
};
const identity = (choice) =>
  JSON.stringify([
    ...['family', 'weight', 'italic', 'familyGroup'].map((field) => property(choice.face, field)),
    property(choice, 'via'),
    property(choice, 'encoding'),
  ]);
const logical = (style) =>
  JSON.stringify(
    ['fontFamily', 'fontWeight', 'italic', 'symbolEncoding', 'fontFace', 'sourceFontFamily'].map(
      (field) => property(style, field),
    ),
  );
function styleKey(style) {
  if (
    !style ||
    typeof style !== 'object' ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(style))
  )
    return;
  const values = [];
  for (const field of FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(style, field);
    if (descriptor && !Object.hasOwn(descriptor, 'value')) return;
    const value = descriptor?.value;
    if (
      value !== undefined &&
      value !== null &&
      !['string', 'boolean', 'number'].includes(typeof value)
    )
      return;
    if (value != null) {
      if (field === 'fontWeight') {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 1000)
          return;
      } else if (field === 'italic') {
        if (typeof value !== 'boolean') return;
      } else if (typeof value !== 'string') return;
    }
    values.push(property(style, field));
  }
  const path = Object.getOwnPropertyDescriptor(style, 'path');
  if (
    path &&
    (!Object.hasOwn(path, 'value') || (path.value !== undefined && typeof path.value !== 'string'))
  )
    return;
  const face = Object.getOwnPropertyDescriptor(style, 'fontFace');
  if (face) {
    if (!Object.hasOwn(face, 'value')) return;
    if (face.value != null) {
      if (
        typeof face.value !== 'object' ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(face.value))
      )
        return;
      const parts = [];
      for (const field of ['family', 'bold', 'italic']) {
        const item = Object.getOwnPropertyDescriptor(face.value, field);
        if (
          !item ||
          !Object.hasOwn(item, 'value') ||
          typeof item.value !== (field === 'family' ? 'string' : 'boolean')
        )
          return;
        parts.push(item.value);
      }
      if (Reflect.ownKeys(face.value).length !== 3) return;
      values.push([3, ['face', parts]]);
    } else values.push(property(style, 'fontFace'));
  } else values.push([0]);
  return JSON.stringify(values);
}
function snapshot(style) {
  const copy = {};
  for (const key of Reflect.ownKeys(style)) {
    if (typeof key !== 'string') return;
    const item = Object.getOwnPropertyDescriptor(style, key);
    if (!item?.enumerable || !Object.hasOwn(item, 'value')) return;
    const value = item.value;
    if (
      value === undefined ||
      value === null ||
      ['string', 'boolean'].includes(typeof value) ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      copy[key] = value;
    else if (
      key === 'fontFace' &&
      value &&
      typeof value === 'object' &&
      typeof value.family === 'string' &&
      typeof value.bold === 'boolean' &&
      typeof value.italic === 'boolean'
    )
      copy[key] = { family: value.family, bold: value.bold, italic: value.italic };
    else return;
  }
  return copy;
}
function poolOf(faces) {
  const result = new Map();
  let bytes = 0;
  for (const face of faces) {
    if (
      typeof face.family !== 'string' ||
      face.family.length > LIMIT_BYTES / 4 ||
      (face.familyGroup !== undefined && typeof face.familyGroup !== 'string') ||
      !Number.isFinite(face.weight) ||
      typeof face.italic !== 'boolean' ||
      (face.scripts !== undefined &&
        (!Array.isArray(face.scripts) || face.scripts.some((script) => typeof script !== 'string')))
    )
      return;
    const key = JSON.stringify([face.family.toLowerCase(), face.weight, face.italic]);
    if (result.has(key)) return;
    const value = JSON.stringify([
      face.family,
      face.familyGroup ?? face.family,
      !!face.fallbackOnly,
      face.scripts ?? null,
    ]);
    bytes += 2 * (key.length + value.length);
    if (bytes > LIMIT_BYTES) return;
    result.set(key, value);
  }
  return { result, bytes };
}
export function createPreparationReplay() {
  let candidate,
    recording = false,
    disabled = false;
  const invalidate = () => {
    disabled = true;
    recording = false;
    candidate = undefined;
  };
  const add = (key, make) => {
    if (!recording || !candidate) return;
    if (candidate.seen.has(key)) return;
    let event, retained;
    try {
      event = make();
      if (!event) {
        invalidate();
        return;
      }
      retained = 2 * (key.length + JSON.stringify(event).length);
    } catch {
      invalidate();
      return;
    }
    if (candidate.events.length >= LIMIT_ENTRIES || candidate.bytes + retained > LIMIT_BYTES) {
      invalidate();
      return;
    }
    candidate.bytes += retained;
    candidate.seen.add(key);
    candidate.events.push(event);
  };
  const contextOf = (keys, optionsToken, registry) => {
    if (
      typeof registry.preparationContext !== 'string' ||
      registry.mapFamily !== undefined ||
      typeof registry.coverage !== 'function'
    )
      return;
    let pool;
    try {
      pool = poolOf(registry.faces);
    } catch {
      return;
    }
    if (!pool) return;
    const key = JSON.stringify([
      registry.preparationContext,
      keys.context,
      keys.slides,
      optionsToken,
      property(registry, 'policy'),
      property(registry, 'aliases'),
      [...(registry.aliases ?? new Map())],
      property(registry, 'fallbackFamily'),
      property(registry, 'preserveChosenFamilies'),
      property(registry, 'mapFamily'),
    ]);
    const bytes = 2 * key.length + pool.bytes;
    if (bytes > LIMIT_BYTES) return;
    return { key, pool: pool.result, bytes };
  };
  const begin = (keys, optionsToken, registry, complete) => {
    if (disabled) return false;
    if (candidate) {
      recording = false;
      return false;
    }
    const context = complete && contextOf(keys, optionsToken, registry);
    if (!context) {
      invalidate();
      return false;
    }
    candidate = { ...context, events: [], seen: new Set(), entries: undefined, positive: true };
    recording = true;
    return true;
  };
  const finish = (entries) => {
    if (recording && candidate) candidate.entries = entries;
    recording = false;
  };
  const selection = (style, preserveChosen, choice, resolved) => {
    if (!recording) return;
    let key;
    try {
      key = styleKey(style);
    } catch {
      invalidate();
      return;
    }
    if (key === undefined) {
      invalidate();
      return;
    }
    add('s' + Number(preserveChosen) + key, () => {
      const copy = snapshot(style);
      return (
        copy && {
          kind: 'selection',
          style: copy,
          preserveChosen,
          identity: identity(choice),
          logical: logical(resolved),
        }
      );
    });
  };
  const coverage = (kind, text, size, style, run) => {
    let eventKey;
    if (recording) {
      let key;
      try {
        key =
          typeof text === 'string' && Number.isFinite(size) && size > 0
            ? styleKey(style)
            : undefined;
      } catch {
        invalidate();
      }
      if (key === undefined || text.length > LIMIT_BYTES / 2) invalidate();
      else eventKey = kind + '\0' + key + '\0' + text;
    }
    let outcome = 'ok';
    try {
      return run();
    } catch (error) {
      outcome = error?.code ?? 'fatal';
      throw error;
    } finally {
      if (eventKey && recording) {
        const soft = kind === 'measure' ? MEASURE_SOFT : PROBE_SOFT;
        if (outcome !== 'ok' && !soft.has(outcome)) {
          invalidate();
        } else {
          if (outcome !== 'ok' && candidate) candidate.positive = false;
          add(eventKey, () => {
            const copy = snapshot(style);
            return copy && { kind, text, size, style: copy, outcome };
          });
        }
      }
    }
  };
  const replay = (keys, optionsToken, registry, select) => {
    if (disabled || !candidate?.entries) return;
    recording = false;
    const context = contextOf(keys, optionsToken, registry),
      old = candidate;
    if (
      !context ||
      context.key !== old.key ||
      context.pool.size !== old.pool.size ||
      [...old.pool].some(([key, value]) => context.pool.get(key) !== value) ||
      !old.positive
    ) {
      invalidate();
      return;
    }
    for (const event of old.events) {
      if (event.kind === 'selection') {
        let actual;
        try {
          actual = select(event.style, event.preserveChosen);
        } catch {
          invalidate();
          return;
        }
        if (actual.identity !== event.identity || actual.logical !== event.logical) {
          invalidate();
          return;
        }
      } else {
        try {
          registry.coverage(event.text, event.size, event.style);
        } catch (error) {
          const soft = event.kind === 'measure' ? MEASURE_SOFT : PROBE_SOFT;
          if (!soft.has(error?.code)) {
            invalidate();
            throw error;
          }
          invalidate();
          return;
        }
      }
    }
    const entries = old.entries;
    invalidate();
    return entries;
  };
  return { begin, finish, selection, coverage, replay, invalidate, release: invalidate };
}
export function selectionIdentity(choice, resolved) {
  return { identity: identity(choice), logical: logical(resolved) };
}
