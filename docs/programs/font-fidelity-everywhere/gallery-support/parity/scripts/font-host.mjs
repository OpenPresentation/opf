// Modelled preview font hosts for the parity harness's fontResolution check (FF-38). Read-only against opf-render.
//
// The check asks what a preview of a value draws with. That depends on the host, so the harness names the host it models:
//
//   gallery      (default) The pptx.gallery editor. opf-editor 0.10.x builds its browser registry with
//                loadFonts({faces: <the office pack's eager faces>, substitutionPolicy: 'visual', fallbackFamily: 'Roboto',
//                scriptBaseUrl, lazyFontsBaseUrl}) and, before any document is rendered or measured, runs its font gate
//                (createFontGate, src/font-gate.js): registry.ensureLazyFonts(document) then registry.ensureScripts(document), repeated
//                until nothing is pending. That loads the vendored preview faces (Intos, the open pack) and the script (Noto) faces the
//                document's text and font schemes need. This module runs the same calls against the same package files, with a
//                stand-in for the Font Loading API (document.fonts, FontFace) and for fetch (the files come from the installed
//                opf-render and @expo-google-fonts packages, hash-verified by the renderer as in a browser). It is a model of the
//                browser host in Node, not a browser: no pixel is drawn.
//   node-auto    opf-render in Node: loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation}).
//                Same families to load, different loader (see the Sylfaen note in the parity report).
//   office-only  The model before 2026-09-30: the office pack and no script faces.
//
// One registry per distinct load: what a document gets depends on the scripts and vendored faces it needs and, through glyph fallback,
// on the CJK characters it draws. Values with the same key share a registry, so the large script faces load once, not 850 times.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const FONT_HOST_MODELS = ['gallery', 'node-auto', 'office-only'];
const MAX_ROUNDS = 4; // opf-editor font-gate.js: a load that cannot finish stops after this many rounds

const otherNonLatin = doc => [...new Set([...JSON.stringify(doc)].filter(c => c.codePointAt(0) > 0x2e7f))].sort().join('');

/** A stand-in for the Font Loading API: document.fonts and FontFace that accept whatever the registry registers. */
function fakeFontLoading() {
  class FontFace { constructor(family, bytes, descriptors) { Object.assign(this, {family, bytes, descriptors}); } async load() { return this; } }
  const fonts = new Set(); fonts.ready = Promise.resolve();
  return {fonts, defaultView: {FontFace}};
}

/**
 * @param {{renderDir: string, model?: string}} a `renderDir` is the opf-render worktree (dist/ built, node_modules installed)
 */
export async function createFontHosts({renderDir, model = 'gallery'}) {
  if (!FONT_HOST_MODELS.includes(model)) throw new Error(`PARITY_FONT_HOST must be one of ${FONT_HOST_MODELS.join(', ')}, not ${model}`);
  const imp = file => import(pathToFileURL(path.join(renderDir, file)).href);
  const nodeFonts = await imp('dist/fonts-node.js'), browserFonts = await imp('dist/fonts-browser.js');
  const require = createRequire(path.join(renderDir, 'package.json'));
  // The eager faces the editor ships: fonts.json is the office pack's embeddedFonts (scripts/build-playground.mjs), decoded as playground.js does.
  const eager = model === 'gallery'
    ? JSON.parse(JSON.stringify((await nodeFonts.loadFonts({pack: 'office'})).registry.embeddedFonts))
      .map(face => ({family: face.family, weight: face.weight, italic: face.italic, license: face.license, data: Uint8Array.from(Buffer.from(face.dataUrl.split(',')[1], 'base64'))}))
    : null;
  const served = async url => {
    const script = url.match(/^https:\/\/fonts\.example\/script-fonts\/([^/]+)\/(.*)$/);
    const file = script ? path.join(path.dirname(require.resolve(`@expo-google-fonts/${script[1]}/package.json`)), script[2]) : path.join(renderDir, url.replace('https://fonts.example/', ''));
    try { const b = await readFile(file); return {ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)}; }
    catch { return {ok: false, status: 404}; }
  };

  // opf-render 0.11.5 loads vendored faces by face (FF-41): the editor's gate fetches only the faces a document draws. The host therefore
  // resolves a family through the faces the document draws in it (family -> [{weight, italic}]), not through an unloaded Regular.
  // Older renderers have no presentationFaces and load whole families, so the default Regular face is what they hold.
  function drawnFaces(doc) {
    const out = new Map();
    if (typeof browserFonts.presentationFaces !== 'function') return out;
    for (const f of browserFonts.presentationFaces(structuredClone(doc), {})) { const k = f.family.toLowerCase(); (out.get(k) ?? out.set(k, []).get(k)).push({weight: f.weight, italic: !!f.italic}); }
    return out;
  }
  const faceKey = doc => typeof browserFonts.presentationFaces === 'function'
    ? [...browserFonts.presentationFaces(structuredClone(doc), {})].map(f => [f.family, f.weight, !!f.italic]).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)
    : [...browserFonts.presentationFamilies(structuredClone(doc))].sort();

  async function galleryHost(doc) {
    const handle = await browserFonts.loadFonts({faces: eager, document: fakeFontLoading(), fetch: served, substitutionPolicy: 'visual', fallbackFamily: 'Roboto',
      scriptBaseUrl: 'https://fonts.example/script-fonts/', lazyFontsBaseUrl: 'https://fonts.example/'});
    const registry = handle.registry;
    // The editor's font gate (opf-editor src/font-gate.js), unchanged in logic.
    const pending = () => [...(registry.pendingLazyFonts?.(doc) ?? []).map(f => f.file), ...(registry.pendingScripts?.(doc) ?? [])];
    let gate = {ok: true};
    try {
      for (let round = 0; round < MAX_ROUNDS && pending().length; round++) { await registry.ensureLazyFonts(doc); await registry.ensureScripts(doc); }
      if (pending().length) gate = {ok: false, code: 'fonts-unavailable', message: `${pending().join(', ')} did not finish loading`};
    } catch (e) { gate = {ok: false, code: 'fonts-unavailable', message: String(e.cause?.message ?? e.message).slice(0, 160)}; }
    const sel = browserFonts.autoScriptSelection(doc);
    const drawn = drawnFaces(doc);
    // A role family the document draws no text in (a title-only layout has no body text) loads nothing, but it would load its vendored face the
    // moment an edit draws it (the gate runs before every render). Its preview is what a registry holding every vendored face resolves it to.
    const undrawn = [...browserFonts.presentationFamilies(structuredClone(doc))].filter(f => !drawn.has(f.toLowerCase()));
    let unloaded = null;
    if (undrawn.length) {
      // A second registry, given what the gate would load once an edit draws text in each such family (heading and body of a probe slide).
      const probe = (await browserFonts.loadFonts({faces: eager, document: fakeFontLoading(), fetch: served, substitutionPolicy: 'visual', fallbackFamily: 'Roboto',
        scriptBaseUrl: 'https://fonts.example/script-fonts/', lazyFontsBaseUrl: 'https://fonts.example/'})).registry;
      for (const family of undrawn) {
        const probeDoc = {name: 'probe', design: {fontScheme: {id: 'probe', name: 'probe', major: family, minor: family}}, slides: [{title: 'Probe', text: 'Probe'}]};
        try { await probe.ensureLazyFonts(probeDoc); } catch { /* the family keeps whatever the registry resolves without it */ }
      }
      unloaded = {registry: probe, resolutions: new Map()};
    }
    return {registry, fonts: {textMeasurement: handle.textMeasurement}, gate, diagnostics: [], selection: {...sel, packages: registry.loadedScriptPackages}, drawn, unloaded};
  }

  async function nodeHost(doc, withScripts) {
    const diagnostics = [];
    const opts = {pack: 'office', substitutionPolicy: 'visual'};
    if (withScripts) Object.assign(opts, {scripts: 'auto', presentation: structuredClone(doc), onDiagnostic: d => diagnostics.push({code: d.code, ...(d.script ? {script: d.script} : {}), ...(d.package ? {package: d.package} : {})})});
    const handle = await nodeFonts.loadFonts(opts), registry = handle.registry; const sel = registry.scriptSelection;
    return {registry, fonts: handle, gate: {ok: true}, diagnostics, selection: sel ? {detected: sel.detected, scripts: sel.scripts, unavailable: sel.unavailable, packages: sel.packages, notInstalled: sel.notInstalled, uncovered: sel.uncovered ?? []} : null};
  }

  const cache = new Map();
  return {
    model,
    async hostFor(doc) {
      const key = model === 'office-only' ? 'office-only'
        : JSON.stringify([browserFonts.autoScriptSelection(doc), otherNonLatin(doc), ...(model === 'gallery' ? [faceKey(doc)] : [])]);
      if (!cache.has(key)) cache.set(key, (async () => ({...(model === 'gallery' ? await galleryHost(doc) : await nodeHost(doc, model === 'node-auto')), resolutions: new Map()}))());
      return cache.get(key);
    },
  };
}
