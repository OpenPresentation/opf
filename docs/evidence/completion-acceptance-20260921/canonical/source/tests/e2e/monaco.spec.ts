import { expect, test, type Request } from '@playwright/test';

test('bundled JSON worker provides schema diagnostics, completion and recovery offline', async ({ page, baseURL }) => {
  const errors: string[] = [];
  const pendingScripts = new Set<Request>();
  const applicationOrigin = new URL(baseURL!).origin;
  page.on('request', request => {
    const url = new URL(request.url());
    if (request.resourceType() === 'script' && /^https?:$/.test(url.protocol) && url.origin !== applicationOrigin) pendingScripts.add(request);
  });
  page.on('requestfinished', request => pendingScripts.delete(request));
  page.on('requestfailed', request => pendingScripts.delete(request));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (/Could not create web worker|Unexpected usage|worker.*failed/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  await page.goto('/inspector');
  const input = page.getByRole('textbox', { name: 'Editor content' });
  await expect(input).toBeVisible();
  const replaceBuffer = async (text: string) => {
    await page.evaluate(value => navigator.clipboard.writeText(value), text);
    await input.focus();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+v');
  };

  // This is valid JSON but invalid OPF: the marker must come from schema validation.
  await replaceBuffer('{"name": 42, "slides": []}');
  const editor = page.locator('.monaco-editor').first();
  const diagnostics = editor.locator('.squiggly-error, .squiggly-warning');
  await expect(diagnostics).not.toHaveCount(0);
  await input.focus();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('F8');
  await expect(editor.locator('.zone-widget')).toContainText('string');
  expect(page.workers().length).toBeGreaterThan(0);
  for (const worker of page.workers()) {
    expect(new URL(worker.url()).origin).toBe(new URL(page.url()).origin);
  }
  await input.press('Escape');
  await expect(editor.locator('.zone-widget')).not.toBeVisible();
  // The diagnostics above prove application-worker readiness. Deployed pages also
  // initialize account UI asynchronously. An empty request set can precede those
  // downloads; require the SDK's loaded UI version before cutting the network.
  if (await page.locator('script[data-clerk-js-script]').count()) {
    await expect.poll(() => page.evaluate(() =>
      (window as Window & {Clerk?: {uiVersion?: string}}).Clerk?.uiVersion), {
      timeout: 20_000,
      message: 'Configured account UI finishes loading before the offline worker check',
    }).toBeTruthy();
  }
  await expect.poll(() => pendingScripts.size, {timeout: 20_000}).toBe(0);
  await page.context().setOffline(true);

  // Incomplete property text cannot be moved by asynchronous format-on-paste.
  await replaceBuffer('{\n  "na');
  await expect(editor.locator('.view-lines')).toHaveText(/^\{\s*"na$/);
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Control+Space');
  await expect(editor.locator('.suggest-widget')).toBeVisible();
  await expect(editor.locator('.suggest-widget')).toContainText('name');
  await page.keyboard.press('Escape');

  await replaceBuffer('{"name": "Worker recovery", "slides": [{"title": "Valid again"}]}');
  await expect(diagnostics).toHaveCount(0);
  await expect(page.getByTestId('playground-status-bar')).toContainText('0 errors / 0 warnings');
  await expect(editor).toContainText('Valid again');
  expect(errors).toEqual([]);
});
