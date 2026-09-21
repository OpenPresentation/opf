import { expect, type Page } from '@playwright/test';

type ClipboardWrite = { text: string; complete: boolean };
declare global {
  interface Window { __opfClipboardWrites: ClipboardWrite[] }
}

export async function observeClipboardWrites(page: Page) {
  await page.addInitScript(() => {
    const writes: ClipboardWrite[] = [];
    window.__opfClipboardWrites = writes;
    const writeText = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = async (text: string) => {
      const write = { text, complete: false };
      writes.push(write);
      // Observe the authored buffer without stubbing the browser/OS operation.
      await writeText(text);
      write.complete = true;
    };
  });
}

export async function copySource(page: Page) {
  const before = await page.evaluate(() => window.__opfClipboardWrites.length);
  await page.getByRole('button', { name: /^(copy|copied)$/i, exact: true }).click();
  await expect.poll(() => page.evaluate(index => {
    return window.__opfClipboardWrites[index]?.complete;
  }, before)).toBe(true);
  const { submitted, clipboard } = await page.evaluate(async index => ({
    submitted: window.__opfClipboardWrites[index].text,
    clipboard: await navigator.clipboard.readText(),
  }), before);
  // The Clipboard API normalizes Windows text to CRLF. Assert that transport
  // separately; callers compare the unmodified submitted buffer exactly, so an
  // app-side EOL, whitespace, or escape change still fails source preservation.
  // https://www.w3.org/TR/clipboard-apis/#dom-clipboard-writetext
  const transported = process.platform === 'win32' ? submitted.replace(/\r?\n/g, '\r\n') : submitted;
  expect(clipboard).toBe(transported);
  return submitted;
}
