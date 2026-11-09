// RR-112: saved DrawingML autofit is a body-level cache, applied only after
// resolving each current run. Never mutate inherited or cached native styles.
const choices = ['a:noAutofit', 'a:spAutoFit', 'a:normAutofit'];
const object = value => value && typeof value === 'object' && !Array.isArray(value);

function percentage(value, fallback, minimum, maximum, name, report) {
  if (value === undefined) return fallback;
  const token = typeof value === 'string' ? value.trim() : '';
  const numeric = /^\+?\d+$/.test(token);
  const percent = /^\+?(?:\d+(?:\.\d+)?|\.\d+)%$/.test(token);
  const result = numeric ? Number(token) / 100000 : percent ? Number(token.slice(0, -1)) / 100 : NaN;
  if (!Number.isFinite(result) || result < minimum || result > maximum) {
    report('unsupported-native-autofit', `The saved ${name} is not a supported ${minimum * 100}–${maximum * 100}% value; it was not applied. Current text and unscaled sizes were retained for review.`);
    return fallback;
  }
  return result;
}

/** Nearest explicit choice wins; a bare normAutofit resets both cached values. */
export function nativeAutofit(bodyProperties, report = () => {}) {
  for (const body of bodyProperties) {
    if (body === undefined || body === null) continue;
    if (!object(body)) {
      report('unsupported-native-autofit', 'Repeated or malformed native body properties prevent unambiguous saved autofit recovery; no inherited factor was guessed.');
      return {scale: 1, reduction: 0};
    }
    const present = choices.filter(key => Object.hasOwn(body, key));
    if (!present.length) continue;
    if (present.length !== 1 || !object(body[present[0]])) {
      report('unsupported-native-autofit', 'Conflicting, repeated or malformed native autofit choices were not applied; current text and unscaled sizes were retained for review.');
      return {scale: 1, reduction: 0};
    }
    const kind = present[0];
    if (kind !== 'a:normAutofit') return {mode: kind === 'a:noAutofit' ? 'none' : 'resize', scale: 1, reduction: 0};
    const saved = body[kind];
    return {mode: 'shrink',
      scale: percentage(saved.fontScale, 1, 0.01, 1, 'fontScale', report),
      reduction: percentage(saved.lnSpcReduction, 0, 0, 1, 'lnSpcReduction', report)};
  }
  return {scale: 1, reduction: 0};
}

/** sz remains in hundredths of a point until the existing run reader converts it. */
export function scaledNativeRun(properties, fit, report = () => {}) {
  if (fit.scale === 1) return properties;
  const size = Number(properties.sz);
  if (!Number.isFinite(size) || size <= 0) {
    report('unsupported-native-autofit-size', 'A saved fontScale has no resolved positive current run size; current text was retained without inventing an effective font size.');
    return properties;
  }
  return {...properties, sz: size * fit.scale};
}

export function reportNativeAutofit(fit, report) {
  if (fit.scale !== 1) report('native-autofit-applied', 'Saved native fontScale was applied once to the resolved current run sizes in points. These literal sizes, including sizes below the composition floor, were retained for review; OPF reflows the text and does not retain PowerPoint\'s automatic refitting behavior.');
  if (fit.reduction !== 0) report('native-autofit-line-spacing', 'Saved lnSpcReduction affects percentage paragraph line spacing, not explicit point spacing or paragraph before/after spacing. OPF body text has no paragraph line-spacing override, so this spacing is not retained in the reflowed presentation; review the imported output.');
}
