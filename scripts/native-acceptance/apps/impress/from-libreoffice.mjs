// NT-06: what the LibreOffice qualification runner (scripts/libreoffice/run.mjs) knows about one case in one font profile,
// as a result.json of the shared native format (core/result/README.md). Pure functions: nothing here starts LibreOffice
// or reads a file; run.mjs passes the facts and output.mjs writes and validates the files.
//
// The run directory is <out>/native/ beside the runner's own results.json:
//   native/run.json                                  one per runner invocation, every profile
//   native/files/<fileId>/result.json                one per case and profile
//   native/files/<fileId>/slides/slide-001.png ...   LibreOffice's rendering of each visible slide
//   native/files/<fileId>/resaved.pptx               LibreOffice's own PowerPoint copy
//
// fileId (NT-14): <deck>~<variant>.<profile>. For a manifest deck, deck and variant are the manifest's own ("smartart",
// "shapes"; "default" for a deck with one export), so the same deck and variant read the same in the Keynote and PowerPoint
// runs; the font profile ("opf", "stock") is appended to the variant after a ".". Manifest variant names never contain a ".",
// so the last "." splits the variant from the profile. A case that is not a manifest deck (LibreOffice's own cases, the shared
// fixtures) has its case id as the deck (lower case, "~" written as ".") and the variant "default". One run covers both
// profiles, so the profile in the variant keeps a file id unique, and `fonts` says the profile in each result.json. The input
// is <out>/inputs/<case id>.pptx, so file.path is "<case id>.pptx" relative to that input root. Until NT-14 the id was
// <case id>~<profile> (the case id of a qualification case with its "~" written as "." and a "q-" prefix).
//
// The four verbs, from what the runner really does:
// - open: LibreOffice headless converting the file to PDF (`soffice --convert-to pdf`). "done" when the PDF exists, else
//   "failed" with the conversion's message. No seconds: the runner converts all files in one soffice call. slideCount is the
//   slide count of LibreOffice's own PowerPoint copy (hidden slides counted), the only place LibreOffice states it.
//   Import warnings: LibreOffice has no warnings window, and the one soffice call's output (soffice.log) does not say which
//   file a line belongs to, so warnings are "not-read".
// - render: the runner rasterizes every page of LibreOffice's PDF (pdf.js on a canvas, the measuring tools of
//   docs/libreoffice.md) at the size of OPF's preview, or 1280 px wide where a case has no preview; run.mjs writes those
//   pictures into slides/. LibreOffice's PDF leaves hidden slides out, so a hidden slide has picture null.
// - probe: not-run. The runner does not read LibreOffice's object model; the round-trip step reads its PowerPoint copy.
// - resave: LibreOffice's own PowerPoint copy (`soffice --convert-to "pptx:Impress MS PowerPoint 2007 XML"`), copied to
//   resaved.pptx; `import` is OPF's import of that copy, which the runner already does.
// The runner's defects and differences of a case stay in results.json; only a failed conversion, a failed re-export, a failed
// import and a fault of the runner itself have a place here.
import { emptyResult, fileId, runFileEntry, SCHEMA_VERSION, validateResult, validateRun } from '../../core/result/result.mjs';

export const TARGET = 'impress';
/** The width of LibreOffice's slide pictures for a case without OPF's preview (the compare step's width). */
export const PICTURE_WIDTH = 1280;

/** UTC date-time without milliseconds. */
export const utc = (date = new Date()) => date.toISOString().replace(/\.\d{3}Z$/u, 'Z');

/**
 * { deck, variant, id } of a case in a font profile: variant = "<variant>.<profile>". `deck` and `variant` are the manifest's
 * deck and variant for a qualification case; without them the deck is the case id ("~" as ".") and the variant "default".
 */
export function fileIdentity(caseId, profile, { deck, variant } = {}) {
  const name = String(deck ?? String(caseId).replaceAll('~', '.')).toLowerCase();
  const base = String(variant ?? 'default').toLowerCase();
  if (base.includes('.')) throw new Error(`from-libreoffice: variant "${base}" must not contain "." (the font profile follows it after one)`);
  const joined = `${base}.${String(profile).toLowerCase()}`;
  return { deck: name, variant: joined, id: fileId(name, joined) };
}

/**
 * The application from `soffice --version` as the runner records it ("LibreOffice 26.8.2.2 9dea406ab7…"): name
 * "LibreOffice Impress" (the component that opens a .pptx), version and build hash. A line that does not parse is kept as
 * the version, so a broken installation shows in the result instead of a made-up version.
 */
export function applicationFrom(versionLine) {
  const line = String(versionLine ?? '').trim();
  const match = /^(LibreOffice(?:Dev)?)\s+(\d+(?:\.\d+)+)(?:\s+([0-9a-f]{7,})(?=\s|$))?/u.exec(line);
  if (!match) return { name: 'LibreOffice Impress', version: line || 'unknown' };
  return { name: `${match[1]} Impress`, version: match[2], ...(match[3] ? { build: match[3] } : {}) };
}

const OS_NAMES = { linux: 'Linux', darwin: 'macOS', win32: 'Windows' };

/** { os, version } from Node's platform and the release the runner records (the OS release's PRETTY_NAME on Linux). */
export function systemFrom({ platform, release }) {
  const os = OS_NAMES[platform];
  if (!os) throw new Error(`from-libreoffice: platform "${platform}" is not one of ${Object.keys(OS_NAMES).join(', ')}`);
  return { os, version: String(release || 'unknown') };
}

/** The OPF that exported the inputs: the checkout's opf-pptx version and commit, as results.json records them. */
export function opfFrom(environment) {
  const version = environment.packages?.['@openpresentation/opf-pptx'];
  if (!version) throw new Error('from-libreoffice: the environment records no @openpresentation/opf-pptx version');
  return { version, ...(/^[0-9a-f]{7,40}$/u.test(environment.commit ?? '') ? { commit: environment.commit } : {}) };
}

const runnerFault = (measured) => (measured.defects ?? []).find((defect) => defect.check === 'runner');

/**
 * One result.json.
 *   impressResult({ caseId, deck?, variant?, profile, environment, system, input: { path, sha256, unchangedAfterRun }, hidden, measured, facts, started, finished })
 * environment: results.json's environment. hidden: one boolean per slide of the input, in file order. measured: the runner's
 * cases/<id>/result-<profile>.json. facts (what run.mjs saw on disk; each falls back to `measured`):
 *   converted   the PDF exists               resaved     LibreOffice's PowerPoint copy was written to `resavedPath`
 *   slideCount  slides in LibreOffice's copy pictures    per visible slide, in order, the picture path written or null
 *   pixelSize   [w, h] when every picture has that size
 */
export function impressResult({ caseId, deck: manifestDeck, variant: manifestVariant, profile, environment, system, input, hidden, measured, facts = {}, started, finished }) {
  const { deck, variant } = fileIdentity(caseId, profile, { deck: manifestDeck, variant: manifestVariant });
  const result = emptyResult({
    target: TARGET,
    application: applicationFrom(environment.libreoffice),
    system,
    fonts: profile,
    opf: opfFrom(environment),
    file: { deck, variant, path: input.path, sha256: input.sha256, unchangedAfterRun: input.unchangedAfterRun ?? null },
    started,
    finished,
  });
  const { verbs } = result;
  const converted = facts.converted ?? measured.converted === true;
  if (!converted) {
    // Nothing else ran on a file LibreOffice could not open: no PDF to draw, and its re-export failed the same way.
    verbs.open.status = 'failed';
    verbs.open.message = measured.conversionError ?? 'LibreOffice produced no PDF';
    return result;
  }
  verbs.open.status = 'done';
  if (facts.slideCount !== undefined) {
    if (facts.slideCount === hidden.length) verbs.open.slideCount = facts.slideCount;
    else verbs.open.message = `LibreOffice's PowerPoint copy has ${facts.slideCount} slides, the file ${hidden.length}`;
  }

  const pictures = facts.pictures ?? [];
  const fault = runnerFault(measured);
  if (fault) {
    verbs.render.status = 'failed';
    verbs.render.message = `the runner could not measure LibreOffice's PDF: ${fault.detail}`;
  } else if (pictures.some(Boolean)) {
    verbs.render.status = 'done';
    if (facts.pixelSize) verbs.render.pixelSize = facts.pixelSize;
    if (measured.pages !== measured.slides) verbs.render.message = `LibreOffice's PDF has ${measured.pages} pages for ${measured.slides} visible slides`;
  }

  const resaved = facts.resaved ?? measured.roundTrip?.converted === true;
  if (resaved) {
    verbs.resave.status = 'done';
    verbs.resave.path = facts.resavedPath ?? 'resaved.pptx';
    const imported = measured.roundTrip?.import;
    if (imported?.ok) verbs.resave.import = { status: 'imported', slideCount: imported.slides };
    else if (imported) verbs.resave.import = { status: 'failed', error: imported.error ?? 'OPF could not import the copy' };
  } else if (measured.roundTrip && !measured.roundTrip.converted) {
    verbs.resave.status = 'failed';
    verbs.resave.message = 'LibreOffice could not re-export the file as PPTX';
  }

  // The format lists slides when render or probe ran; probe never runs here.
  if (verbs.render.status !== 'not-run') {
    let visible = 0;
    result.slides = hidden.map((isHidden, position) => ({
      index: position + 1,
      hidden: isHidden,
      layout: null,
      picture: isHidden ? null : (pictures[visible++] ?? null),
      notes: null,
      objects: [],
    }));
  }
  return result;
}

/**
 * The run.json of one runner invocation. `results` are the result.json values in run order; `profiles` the font profiles
 * that ran (run.json's `fonts`, comma separated). check is "ready" (the runner has no check verb; it ran), with a reason
 * when the LibreOffice it ran is not the pinned one. `tier` is the manifest tier whose decks the run covered (smoke, release,
 * full), null for a hand-picked list; the run also opened LibreOffice's own cases beside them.
 */
export function impressRun({ environment, system, profiles, started, finished, results, tier = null }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    target: TARGET,
    application: applicationFrom(environment.libreoffice),
    system,
    fonts: profiles.join(','),
    opf: opfFrom(environment),
    tier,
    baseline: null,
    started,
    finished,
    check: { status: 'ready', reasons: environment.pinned === false ? [`LibreOffice is not the pinned ${environment.libreofficePinned}`] : [] },
    files: results.map(runFileEntry),
  };
}

/** Throws when a result.json or run.json value does not validate; the message names the file and every error. */
export function assertValid(kind, value, label = kind) {
  const { ok, errors } = kind === 'run' ? validateRun(value) : validateResult(value);
  if (!ok) throw new Error(`native ${label} does not validate:\n  ${errors.join('\n  ')}`);
  return value;
}
