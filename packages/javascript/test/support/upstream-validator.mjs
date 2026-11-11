// Test-only source forwarding: count actual cache computations AND public composeSlide calls by slide index.
// Reports are unchanged. The source pipeline and Node schema engine stay real; no fake composition/cache is supplied.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));
const { build } = createRequire(require.resolve('tsup'))('esbuild');
const token = Symbol.for('opf.test.upstreamComposition');

export async function instrumentedValidator() {
  const artifacts = path.join(root, 'artifacts');
  await mkdir(artifacts, { recursive: true });
  const directory = await mkdtemp(path.join(artifacts, 'upstream-validator-'));
  let active;
  globalThis[token] = {
    compose(index = 0) { if (active) active.compose[index] = (active.compose[index] ?? 0) + 1; },
    compute(index) { if (active) active.compute[index] = (active.compute[index] ?? 0) + 1; },
    result(index, result) { if (active) active.geometry[index] = structuredClone(result.composition); },
  };
  try {
    const composition = path.join(root, 'src/composition.ts'), slides = path.join(root, 'src/rule-slides.ts');
    const output = path.join(directory, 'validator.mjs');
    const seen = new Set();
    await build({
      stdin: { contents: "export {createValidator,validate} from './src/validator.ts'; export {resolveSlideContext} from './src/slide-context.ts'; export {lonePayload,SHORT_MESSAGE_WORDS,LONE_DISPLAY_SIZES} from './src/composition.ts'; export {inlineDatasets} from './src/chart-data.ts';", resolveDir: root },
      outfile: output, bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent',
      plugins: [{ name: 'actual-upstream-composition-counts', setup(builder) {
        builder.onResolve({ filter: /^#schema-engine$/ }, () => ({ path: path.join(root, 'src/schema-engine-ajv.ts') }));
        builder.onLoad({ filter: /(?:composition|rule-slides)\.ts$/ }, async ({ path: file }) => {
          if (file !== composition && file !== slides) return;
          const source = await readFile(file, 'utf8');
          const marker = file === composition
            ? 'export function composeSlide(input: unknown, options: ComposeSlideOptions = {}): SlideComposition {'
            : 'const compute = (): Composed => {';
          assert.equal(source.split(marker).length, 2, 'one actual source instrumentation site');
          const observation = file === composition ? `globalThis[Symbol.for('opf.test.upstreamComposition')]?.compose(options.slideIndex);` : `globalThis[Symbol.for('opf.test.upstreamComposition')]?.compute(index);`;
          let contents = source.replace(marker, marker + observation);
          if (file === slides) {
            const returned = 'const composed = lazy(() => memo ? memo(index, compute) : compute());';
            assert.equal(source.split(returned).length, 2, 'one actual cache-consumer observation site');
            contents = contents.replace(returned, "const composed = lazy(() => { const result = memo ? memo(index, compute) : compute(); globalThis[Symbol.for('opf.test.upstreamComposition')]?.result(index, result); return result; });");
          }
          seen.add(file);
          return { contents, loader: 'ts', resolveDir: path.dirname(file) };
        });
      } }],
    });
    assert.equal(seen.size, 2);
    const api = await import(pathToFileURL(output).href);
    return {
      ...api,
      audit(checker, document, options = {}) {
        const counters = () => ({ compose: document.slides.map(() => 0), compute: document.slides.map(() => 0), geometry: document.slides.map(() => undefined) });
        active = counters();
        let report, counts, cold, coldGeometry;
        try { report = checker.validate(document, options); counts = active; } finally { active = undefined; }
        active = counters();
        try { cold = api.validate(document, options); coldGeometry = active.geometry; } finally { active = undefined; }
        assert.deepEqual(report, cold, 'every full finding, location, fix, count and check equals cold validation');
        assert.deepEqual(counts.geometry, coldGeometry, 'every final public composition returned from the cache equals the actual cold geometry');
        return { report, ...counts };
      },
      async close() { delete globalThis[token]; await rm(directory, { recursive: true, force: true }); },
    };
  } catch (error) { delete globalThis[token]; await rm(directory, { recursive: true, force: true }); throw error; }
}
