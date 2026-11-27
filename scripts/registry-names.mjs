// The names a published @openpresentation/opf package uses for the keys and fields OPF 0.37 renamed.
//
// The registry consumers leg runs this checkout's scripts against the packages the registry's `latest` names. Between a breaking merge
// and its release that is one release behind the checkout: the checkout writes `minFontSizePx`, the published 0.36.0 still writes
// `minFontSize`. A script that reads a renamed field from a published package's output, or passes a renamed key into a published
// package, asks this module for the name that installed version has, by the version in the package's manifest. It returns ONE name for
// a version, never "either": a script keeps its comparisons exactly as strict as they were, reading each side under its own name.
//
// Keyed by the 0.37 name (what the checkout writes). 0.37.0 and later use it as it is; earlier releases use the value.
const BEFORE_0_37 = Object.freeze({
  scriptGroup: 'languageFamily', // FontScheme (values latin, ea, cs before 0.37)
  anchor: 'verticalAlign', // a styled table cell's style
  organization: 'organizationId', // a speaker
  minFontSizePx: 'minFontSize', // a composition, and the layout parts and options derived from it
  maxFontSizePx: 'maxFontSize',
  link: 'url', // a reference
  appearance: 'tone', // a picture or gradient background
  lineSeries: 'line', // a combo chart
});

const FROM_0_37 = Object.freeze(Object.fromEntries(Object.keys(BEFORE_0_37).map((name) => [name, name])));

/** The names of the renamed keys for the installed package `version` (a semver string such as `0.36.0` or `0.37.0-next.1`). */
export function publishedNames(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version));
  if (!match) throw new TypeError(`Not a package version: ${String(version)}`);
  const major = Number(match[1]), minor = Number(match[2]);
  return major > 0 || minor >= 37 ? FROM_0_37 : BEFORE_0_37;
}

/** The names this checkout uses (always the 0.37 ones). */
export const checkoutNames = FROM_0_37;
