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
function validStyle(style) {
  if (
    !style ||
    typeof style !== 'object' ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(style))
  )
    return;
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
      for (const field of ['family', 'bold', 'italic']) {
        const item = Object.getOwnPropertyDescriptor(face.value, field);
        if (
          !item ||
          !Object.hasOwn(item, 'value') ||
          typeof item.value !== (field === 'family' ? 'string' : 'boolean')
        )
          return;
      }
      if (Reflect.ownKeys(face.value).length !== 3) return;
    }
  }
  return true;
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
// Compare only fresh owned snapshots, never caller object identity or descriptors.
function sameStyleSnapshot(current, previous) {
  const keys = Reflect.ownKeys(current), oldKeys = Reflect.ownKeys(previous);
  if (keys.length !== oldKeys.length) return false;
  for (let index = 0; index < keys.length; index++) {
    const field = keys[index];
    if (field !== oldKeys[index]) return false;
    const value = current[field], old = previous[field];
    if (field === 'fontFace' && value !== null && old !== null && typeof value === 'object' && typeof old === 'object') {
      if (value.family !== old.family || value.bold !== old.bold || value.italic !== old.italic) return false;
    } else if (!Object.is(value, old)) return false;
  }
  return true;
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
  const reserve = (bytes) => {
    if (!candidate || candidate.bytes + bytes > LIMIT_BYTES) {
      invalidate();
      return false;
    }
    candidate.bytes += bytes;
    return true;
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
    // One previous style-ID scalar; its fixed bookkeeping is part of the same retained-data cap.
    if (context.bytes + 16 > LIMIT_BYTES) { invalidate(); return false; }
    candidate = {
      ...context,
      bytes: context.bytes + 16,
      previousStyleId: undefined,
      events: [],
      seen: new Map(),
      styles: [],
      styleIds: new Map(),
      texts: [],
      textIds: new Map(),
      paths: [],
      pathIds: new Map(),
      entries: undefined,
      positive: true,
    };
    recording = true;
    return true;
  };
  const finish = (entries) => {
    if (recording && candidate) candidate.entries = entries;
    recording = false;
  };
  // Intern FULL validated base snapshots. The separate path token belongs to the first unique event.
  const internStyle = (style) => {
    if (validStyle(style) === undefined) return;
    const copy = snapshot(style);
    if (!copy) return;
    delete copy.path;
    const previous = candidate.previousStyleId;
    if (previous !== undefined && sameStyleSnapshot(copy, candidate.styles[previous])) return previous;
    const key = JSON.stringify(
      Reflect.ownKeys(copy).map((field) => [field, property(copy, field)]),
    );
    const held = candidate.styleIds.get(key);
    if (held !== undefined) { candidate.previousStyleId = held; return held; }
    // Count both the retained signature and full snapshot data, with table/ref scalars.
    if (!reserve(4 * key.length + 32)) return;
    const id = candidate.styles.length;
    candidate.styleIds.set(key, id);
    candidate.styles.push(copy);
    candidate.previousStyleId = id;
    return id;
  };
  const internText = (text) => {
    const held = candidate.textIds.get(text);
    if (held !== undefined) return held;
    // The raw text key and array table retain the same string; no concatenated text copy is kept.
    if (!reserve(2 * text.length + 24)) return;
    const id = candidate.texts.length;
    candidate.textIds.set(text, id);
    candidate.texts.push(text);
    return id;
  };
  const internPath = (style) => {
    const descriptor = property(style, 'path'),
      tag = descriptor[0],
      value = descriptor[1];
    const paths = candidate.pathIds.get(tag),
      held = paths?.get(value);
    if (held !== undefined) return held;
    if (!reserve((typeof value === 'string' ? 2 * value.length : 0) + 24 + (paths ? 0 : 24)))
      return;
    const id = candidate.paths.length;
    if (paths) paths.set(value, id);
    else candidate.pathIds.set(tag, new Map([[value, id]]));
    candidate.paths.push({ tag, value });
    return id;
  };
  const seen = (kind, style, text) => candidate.seen.get(kind)?.get(style)?.has(text) === true;
  const add = (kind, style, text, path, event) => {
    if (!candidate) return;
    if (candidate.events.length >= LIMIT_ENTRIES) {
      invalidate();
      return;
    }
    const group = candidate.seen.get(kind),
      set = group?.get(style);
    // Scalar event refs/size/outcome, numeric seen entry, and newly retained nested map/set keys.
    const extra =
      event.kind === 'selection' ? 2 * (event.identity.length + event.logical.length) : 0;
    if (!reserve(64 + extra + (group ? 0 : 24 + 2 * kind.length) + (set ? 0 : 24))) return;
    if (set) set.add(text);
    else if (group) group.set(style, new Set([text]));
    else candidate.seen.set(kind, new Map([[style, new Set([text])]]));
    candidate.events.push({ ...event, style, text, path });
  };
  const selection = (style, preserveChosen, choice, resolved) => {
    if (!recording || !candidate) return;
    try {
      const id = internStyle(style);
      if (id === undefined) {
        invalidate();
        return;
      }
      const kind = 'selection:' + Number(preserveChosen);
      if (seen(kind, id, null)) return;
      const path = internPath(style);
      if (path === undefined) return;
      add(kind, id, null, path, {
        kind: 'selection',
        preserveChosen,
        identity: identity(choice),
        logical: logical(resolved),
      });
    } catch {
      invalidate();
    }
  };
  const coverage = (kind, text, size, style, run) => {
    let eligible = recording;
    if (eligible) {
      try {
        if (
          typeof text !== 'string' ||
          text.length > LIMIT_BYTES / 2 ||
          !Number.isFinite(size) ||
          size <= 0 ||
          validStyle(style) === undefined
        ) {
          invalidate();
          eligible = false;
        }
      } catch {
        invalidate();
        eligible = false;
      }
    }
    let outcome = 'ok';
    try {
      return run();
    } catch (error) {
      outcome = error?.code ?? 'fatal';
      throw error;
    } finally {
      if (eligible && recording && candidate) {
        const soft = kind === 'measure' ? MEASURE_SOFT : PROBE_SOFT;
        if (outcome !== 'ok' && !soft.has(outcome)) invalidate();
        else
          try {
            if (outcome !== 'ok') candidate.positive = false;
            const styleId = internStyle(style);
            if (styleId === undefined) {
              invalidate();
            } else {
              const textId = internText(text);
              if (textId !== undefined && !seen(kind, styleId, textId)) {
                const path = internPath(style);
                if (path !== undefined) add(kind, styleId, textId, path, { kind, size, outcome });
              }
            }
          } catch {
            invalidate();
          }
      }
    }
  };
  const styleFor = (old, event) => {
    const style = { ...old.styles[event.style] },
      path = old.paths[event.path];
    if (path.tag === 1) style.path = undefined;
    else if (path.tag === 3) style.path = path.value;
    return style;
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
      const style = styleFor(old, event);
      if (event.kind === 'selection') {
        let actual;
        try {
          actual = select(style, event.preserveChosen);
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
          registry.coverage(old.texts[event.text], event.size, style);
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
