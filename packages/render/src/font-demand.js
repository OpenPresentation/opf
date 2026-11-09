// RR-114: Node face-level preparation. The complete allowed metadata decides selection; only selected bytes are read.
import { BUNDLED_FONT_MANIFEST } from './font-manifest.js';
import { FONT_SELECTION_METADATA } from './font-selection-metadata.js';
import { createFontRegistry, OPFFontError } from './font-registry.js';
import { createFontAnalysis } from './lazy-fonts.js';
import { scriptFontAliases } from './script-fonts.js';
import {
  analyzePresentationScripts,
  createScriptAnalysis,
  nextFallbackPackage,
  scriptFontPackages,
  scriptSelectionOf,
  uncoveredCjkCharacters,
} from './script-font-pack.js';

const key = (face) =>
  String(face.family).toLowerCase() + '\0' + face.weight + '\0' + !!face.italic;
const packageKey = (pkg, face) => pkg.name + '\0' + face.file;
const groups = new Map(
  FONT_SELECTION_METADATA.map((face) => [
    face.package + '\0' + face.file,
    face,
  ]),
);
function candidate(pkg, face, fallbackOnly = false) {
  const group = groups.get(packageKey(pkg, face));
  if (group && group.sha256 !== face.sha256)
    throw new OPFFontError(
      'font-selection-metadata-mismatch',
      'Regenerate selection metadata for the reviewed font manifest.',
      { package: pkg.name, file: face.file },
    );
  return {
    ...face,
    familyGroup: group?.familyGroup ?? face.family,
    package: pkg.name,
    pkg,
    id: packageKey(pkg, face),
    file: pkg.vendored ? pkg.vendored + '/' + face.file : face.file,
    sourceFile: face.file,
    license: pkg.license,
    ...(pkg.scripts ? { scripts: [...pkg.scripts] } : {}),
    ...(fallbackOnly ? { fallbackOnly: true } : {}),
  };
}
const publicFace = (face) => ({
  package: face.package,
  family: face.family,
  weight: face.weight,
  italic: face.italic,
  file: face.file,
  sha256: face.sha256,
  license: face.license,
});

export async function createNodeDemand(
  pack,
  options,
  { loadPackages, callerFaces, renamedAliases },
) {
  const registryOptions =
    pack === 'office'
      ? {
          substitutionPolicy: 'metric',
          ...options,
          ...(options.includeOpenFonts === false
            ? {}
            : { aliases: { ...renamedAliases(), ...options.aliases } }),
        }
      : options;
  const own = await callerFaces(options.faces),
    controls = {};
  const registry = createFontRegistry(own.entries, registryOptions, {
    allowEmpty: true,
    controls,
  });
  const loaded = {
    fontFiles: [...own.fontFiles],
    packages: [],
    selection: undefined,
  };
  registry.fontFiles = loaded.fontFiles;
  const analysis = createFontAnalysis(),
    scriptMemory = createScriptAnalysis({ fonts: analysis }),
    fallbacks = new Set();
  const skipped = new Set(),
    diagnosed = new Set(),
    order = new Map();
  const remember = (faces) => {
    for (const face of faces)
      if (!order.has(key(face))) order.set(key(face), order.size);
  };
  remember(registry.describeFaces());
  let generation = 0;
  function context(presentation, renderOptions, initial = false, mapFamily) {
    const empty =
      Array.isArray(presentation.slides) && presentation.slides.length === 0;
    const scriptAnalysis = empty
      ? { profile: {}, detected: [], design: [], cjk: new Set() }
      : analyzePresentationScripts(
          presentation,
          undefined,
          renderOptions,
          scriptMemory,
        );
    const mode = initial ? options.scripts : 'auto';
    const selection =
      mode === 'auto'
        ? scriptSelectionOf(scriptAnalysis)
        : { detected: [], scripts: [], unavailable: [] };
    const scripts =
      mode === 'auto'
        ? scriptFontPackages(selection.scripts)
        : mode === undefined
          ? []
          : scriptFontPackages(mode);
    const required = new Set(scripts.map((pkg) => pkg.name));
    const packs =
      pack === 'office'
        ? [
            'office',
            ...(options.includeOpenFonts === false ? [] : ['open']),
            ...(options.includeBaseFonts === false ? [] : ['base']),
          ]
        : pack === 'base'
          ? ['base']
          : [];
    const packages = packs.flatMap((name) =>
      BUNDLED_FONT_MANIFEST.packages.filter((pkg) => pkg.pack === name),
    );
    if (pack === 'office')
      packages.push(
        ...scriptFontPackages(['Latn']).filter(
          (pkg) => !required.has(pkg.name),
        ),
      );
    packages.push(
      ...scripts,
      ...BUNDLED_FONT_MANIFEST.packages.filter((pkg) =>
        fallbacks.has(pkg.name),
      ),
    );
    const seen = new Set(),
      universe = [];
    for (const pkg of packages) {
      if (seen.has(pkg.name)) continue;
      seen.add(pkg.name);
      for (const face of pkg.faces)
        universe.push(
          candidate(
            pkg,
            face,
            pack === 'office' &&
              pkg.name === '@expo-google-fonts/noto-sans' &&
              !required.has(pkg.name),
          ),
        );
    }
    const held = registry.describeFaces({ selection: true }),
      heldKeys = new Set(held.map(key));
    const faces = [
      ...held,
      ...universe.filter(
        (face) => !heldKeys.has(key(face)) && !skipped.has(face.package),
      ),
    ];
    const aliases = new Map(
      Object.entries({
        ...scriptFontAliases(
          new Set(
            faces
              .filter((face) => face.scripts && !face.fallbackOnly)
              .map((face) => face.family),
          ),
        ),
        ...registryOptions.aliases,
      }).map(([from, to]) => [from.toLowerCase(), to]),
    );
    const drawn =
      Array.isArray(presentation.slides) && presentation.slides.length === 0
        ? []
        : analysis.faces(presentation, renderOptions, {
            faces,
            policy: registryOptions.substitutionPolicy ?? 'none',
            aliases,
            fallbackFamily: registryOptions.fallbackFamily,
            coverageKey: generation,
            mapFamily,
            coverage(text, size, style) {
              if (
                heldKeys.has(
                  key({
                    family: style.fontFamily,
                    weight: style.fontWeight ?? 400,
                    italic: !!style.italic,
                  }),
                )
              )
                registry.textMeasurement.measure(text, size, style);
            },
          });
    const wanted = new Set(drawn.map(key));
    return {
      scriptAnalysis,
      selection,
      mode,
      required,
      orderedPackages: packages,
      universe,
      needed: universe.filter(
        (face) =>
          wanted.has(key(face)) &&
          !heldKeys.has(key(face)) &&
          !skipped.has(face.package),
      ),
    };
  }
  function notify(code, details, message, diagnostic) {
    const id = code + '\0' + (details.package ?? details.script);
    if (diagnosed.has(id)) return;
    diagnosed.add(id);
    diagnostic?.({ code, ...details, message });
  }
  async function ensure(
    presentation,
    {
      onDiagnostic = options.onDiagnostic,
      renderOptions = options.renderOptions,
      initial = false,
      mapFamily,
    } = {},
  ) {
    if (presentation === null || typeof presentation !== 'object')
      throw new OPFFontError(
        'invalid-font-scripts',
        'ensure needs the presentation whose text decides its fonts.',
      );
    const added = [],
      addedPackages = new Set();
    for (;;) {
      const plan = context(presentation, renderOptions, initial, mapFamily);
      // Preserve the historical whole-pack CSS order, independently of which styles an edit happens to add first.
      for (const pkg of plan.orderedPackages) remember(pkg.faces);
      if (plan.mode === 'auto') {
        const selection = (loaded.selection ??= {
          detected: [],
          scripts: [],
          unavailable: [],
          packages: [],
          notInstalled: [],
        });
        registry.scriptSelection = selection;
        for (const name of ['detected', 'scripts', 'unavailable'])
          for (const value of plan.selection[name])
            if (!selection[name].includes(value)) selection[name].push(value);
        for (const script of plan.selection.unavailable)
          notify(
            'script-font-unavailable',
            { script },
            "No pinned open font serves script '" +
              script +
              "'; that text uses the design font.",
            onDiagnostic,
          );
      }
      controls.activateScriptFamilies?.(
        plan.universe
          .filter((face) => face.scripts && !face.fallbackOnly)
          .map((face) => face.family),
      );
      if (plan.needed.length) {
        const selected = [];
        for (const face of plan.needed) {
          let pkg = selected.find((pkg) => pkg.name === face.package);
          if (!pkg) selected.push((pkg = { ...face.pkg, faces: [] }));
          pkg.faces.push({ ...face, file: face.sourceFile });
        }
        const missing = [],
          mandatory = selected.filter(
            (pkg) => plan.mode !== 'auto' || !pkg.scripts,
          ),
          optional = selected.filter(
            (pkg) => plan.mode === 'auto' && pkg.scripts,
          );
        const batches = await Promise.all([
          loadPackages(mandatory, undefined, {
            what: 'The presentation selected font faces',
          }),
          loadPackages(optional, missing),
        ]);
        const extra = {
          entries: batches.flatMap((batch) => batch.entries),
          fontFiles: batches.flatMap((batch) => batch.fontFiles),
          packages: batches.flatMap((batch) => batch.packages),
        };
        if (extra.entries.length) {
          registry.addFaces(
            extra.entries.map((entry) =>
              entry.scripts ? { ...entry, embed: 'used' } : entry,
            ),
          );
          loaded.fontFiles.push(...extra.fontFiles);
          generation++;
        }
        for (const pkg of extra.packages) {
          if (
            !missing.some((item) => item.package === pkg) &&
            !loaded.packages.includes(pkg)
          ) {
            loaded.packages.push(pkg);
            if (selected.find((item) => item.name === pkg)?.scripts)
              addedPackages.add(pkg);
          }
        }
        for (const face of plan.needed)
          if (!missing.some((item) => item.package === face.package))
            added.push(publicFace(face));
        for (const item of missing) {
          skipped.add(item.package);
          if (
            loaded.selection &&
            !loaded.selection.notInstalled.includes(item.package)
          )
            loaded.selection.notInstalled.push(item.package);
          notify(
            'script-font-not-installed',
            { package: item.package, scripts: item.scripts },
            'Install ' +
              item.package +
              '@' +
              item.version +
              ' to preview ' +
              item.scripts.join(', ') +
              ' text with its designated open font.',
            onDiagnostic,
          );
        }
        continue;
      }
      if (plan.mode === 'auto') {
        const covers = (character) => registry.scriptFacesCover(character),
          seen = new Set([...loaded.packages, ...skipped, ...fallbacks]);
        const next = nextFallbackPackage(plan.scriptAnalysis, {
          covers,
          loaded: seen,
        });
        if (next) {
          fallbacks.add(next.name);
          generation++;
          continue;
        }
        const uncovered = uncoveredCjkCharacters(plan.scriptAnalysis, {
          covers,
          limit: 8,
        });
        loaded.selection.uncovered = uncovered;
        if (uncovered.length)
          notify(
            'script-glyph-uncovered',
            { script: uncovered.join(''), characters: uncovered },
            'No loaded script face covers some drawn characters; the renderer reports missing-glyph for them.',
            onDiagnostic,
          );
        for (const name of loaded.packages)
          if (
            (plan.required.has(name) || fallbacks.has(name)) &&
            !loaded.selection.packages.includes(name)
          )
            loaded.selection.packages.push(name);
      }
      return {
        scripts: [...addedPackages],
        lazy: added,
        uncovered: [...(loaded.selection?.uncovered ?? [])],
      };
    }
  }
  function pending(presentation, renderOptions = options.renderOptions) {
    const plan = context(presentation, renderOptions);
    if (plan.needed.length)
      return [
        ...new Set(
          plan.needed.map((face) => face.package + '/' + face.sourceFile),
        ),
      ];
    const next = nextFallbackPackage(plan.scriptAnalysis, {
      covers: (character) => registry.scriptFacesCover(character),
      loaded: new Set([...loaded.packages, ...skipped, ...fallbacks]),
    });
    return next ? [next.name] : [];
  }
  await ensure(options.presentation, { initial: true });
  return {
    registry,
    loaded,
    ensure,
    pending,
    orderFaces: (faces) =>
      faces.sort(
        (a, b) =>
          (order.get(key(a)) ?? Infinity) - (order.get(key(b)) ?? Infinity),
      ),
  };
}
