import { expect, test, type Locator, type Page } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import manifest from '../../package.json';

const hostileDeck = {
  name: 'Untrusted shared document',
  slides: [{
    title: '<script>window.__opfInjected=true</script>',
    blocks: [
      { text: [
        { text: 'Unsafe script link', link: 'javascript:window.__opfInjected=true' },
        { text: ' Unsafe data link', link: 'data:text/html,<script>window.__opfInjected=true</script>' },
        { text: ' Safe web link', link: 'https://example.invalid/opf-security' },
        { text: '"><svg onload="window.__opfInjected=true">' },
      ] },
      { image: { src: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="window.__opfInjected=true"/>').toString('base64'), alt: '"><img src=x onerror="window.__opfInjected=true">' } },
    ],
  }],
};

async function verifySafePreview(page: Page, surface: Locator, interactive = true) {
  // Wait for the single-slide test document to replace the starter deck before
  // checking its renderer. Font loading starts after that hydration stage.
  await expect(surface).toHaveCount(1);
  await expect(surface).toBeVisible();
  await expect(surface.locator('svg').first()).toBeVisible();
  await expect(surface.locator('script, foreignObject, iframe, img, [onload], [onerror]')).toHaveCount(0);
  const hrefs = await surface.locator('a').evaluateAll(anchors => anchors.map(anchor => anchor.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(0);
  expect(hrefs.every(href => href === 'https://example.invalid/opf-security')).toBe(true);
  if (interactive) {
    // Ordinary clicks must reach the visible surface; a forced click on covered
    // renderer artwork does not prove the canvas's actual input boundary.
    await surface.getByText('Unsafe script link', { exact: true }).click();
  } else {
    expect(await surface.evaluate(node => node.closest('[inert]') !== null)).toBe(true);
  }
  expect(await page.evaluate(() => (window as unknown as { __opfInjected?: boolean }).__opfInjected)).toBeUndefined();
}

test('published SVG renderer keeps hostile shared and imported document strings inert', async ({ page }) => {
  const { validatePresentation } = await import('@openpresentation/opf');
  expect(validatePresentation(hostileDeck).errors).toEqual([]);
  const dialogs: string[] = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.type()); await dialog.dismiss(); });
  const encoded = gzipSync(JSON.stringify(hostileDeck)).toString('base64url');
  await page.goto(`/inspector#opf=${encoded}`);
  await expect(page.getByText('Loaded shared deck from URL.', { exact: true })).toBeVisible();
  const canvas = page.getByTestId('inspector-canvas-overlay');
  await expect(canvas).toBeVisible();
  await verifySafePreview(page, page.locator(`[data-opf-renderer="${manifest.dependencies['@openpresentation/opf-render']}"] div[role="img"]`), false);
  await verifySafePreview(page, canvas);
  await page.goto('/author');
  await page.getByRole('tablist', { name: 'Document view' }).getByRole('tab', { name: /^preview/ }).click();
  await expect(page.getByRole('button', { name: 'Import file', exact: true })).toBeEnabled();
  await page.getByLabel('Import OPF or PowerPoint', { exact: true }).setInputFiles({ name: 'untrusted.opf.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(hostileDeck)) });
  await verifySafePreview(page, page.getByLabel('Import preview'));
  await page.getByRole('button', { name: 'Open presentation', exact: true }).click();
  await verifySafePreview(page, page.locator(`[data-opf-editor="${manifest.dependencies['@openpresentation/opf-editor']}"]`));
  expect(dialogs).toEqual([]);
});
