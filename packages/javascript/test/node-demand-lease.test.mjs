import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsup'))('esbuild');

test('shared Node font lease forwards the actual composition context, releases after ensure failures and serializes reuse', {
  timeout: 10000,
}, async () => {
  const base = path.resolve(tmpdir()),
    directory = await mkdtemp(path.join(base, 'opf-rr114-lease-'));
  try {
    const modulePath = path.join(directory, 'fonts.mjs');
    await build({
      entryPoints: [
        fileURLToPath(new URL('../src/node/fonts.ts', import.meta.url)),
      ],
      outfile: modulePath,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node22',
    });
    const { leaseSharedFonts } = await import(pathToFileURL(modulePath).href);
    const events = [],
      first = { slides: [{ text: 'First' }] },
      second = { slides: [{ text: 'Second' }] },
      context = {
        catalogs: [{ source: 'https://catalog.example/lease' }],
        date: '2026-11-09',
      };
    let fail = true;
    const handle = {
      registry: {
        clearSubstitutions() {
          events.push('clear');
        },
      },
      pending(_doc, options) {
        assert.equal(options, context);
        return ['face'];
      },
      async ensure(doc, options) {
        assert.equal(options.renderOptions, context);
        events.push(doc);
        if (fail) {
          fail = false;
          throw Object.assign(Error('Owned simulated missing package'), {
            code: 'font-resource-unavailable',
            details: { package: 'owned-fixture' },
          });
        }
      },
    };
    const renderer = {
      fonts: {
        autoScriptSelection(_doc, options) {
          assert.equal(options, context);
          return {};
        },
        async loadFonts(options) {
          assert.deepEqual(options.presentation, { slides: [] });
          events.push('load');
          return handle;
        },
      },
    };
    const reporter = {
      add() {
        throw Error('Unexpected diagnostic');
      },
    };
    await assert.rejects(
      leaseSharedFonts(renderer, first, [], reporter, false, context),
      (error) =>
        error.code === 'font-resource-unavailable' &&
        error.details.package === 'owned-fixture',
    );
    const a = await leaseSharedFonts(
      renderer,
      first,
      [],
      reporter,
      false,
      context,
    );
    let nextReady = false;
    const next = leaseSharedFonts(
      renderer,
      second,
      [],
      reporter,
      false,
      context,
    ).then((value) => {
      nextReady = true;
      return value;
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(
      nextReady,
      false,
      'next conversion cannot prepare/mutate the leased registry',
    );
    assert.equal(events.filter((event) => event === second).length, 0);
    a.release();
    const b = await next;
    assert.equal(b.handle, handle);
    b.release();
    assert.equal(
      events.filter((event) => event === 'load').length,
      1,
      'neutral preparation is reused after failure',
    );
    assert.deepEqual(
      events.filter((event) => typeof event === 'object'),
      [first, first, second],
    );
  } finally {
    const relative = path.relative(base, path.resolve(directory));
    assert.ok(
      relative && !relative.startsWith('..') && !path.isAbsolute(relative),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
