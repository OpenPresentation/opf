// CE-29: a bare page for one editor part (review pill, help button, toolbar actions): the package stylesheet and a bundle of the part's module,
// the way a host's bundler would ship it. No workspace, no fonts, no catalog. `entry` is the module to expose as `window.part`.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { buildStyles } from '../../scripts/build-styles.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

export async function startPartPage({ entry, body = '<div id="host" class="opf-ui" style="padding:12px"></div>', viewport = { width: 900, height: 600 }, colorScheme, context = {} }) {
  const result = await build({
    stdin: { resolveDir: root, contents: `import * as part from ${JSON.stringify(entry)}; window.part = part;` },
    bundle: true, platform: 'browser', format: 'iife', write: false, minify: !process.env.OPF_TEST_UNMINIFIED, conditions: ['browser'], logLevel: 'error',
  });
  const css = (await buildStyles(new URL('../../src/styles/', import.meta.url))).css;
  const browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport, ...(colorScheme ? { colorScheme } : {}), ...context });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0">${body}</body>`);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: result.outputFiles[0].text });
  return { page, browser, errors, async close() { await browser.close(); } };
}
