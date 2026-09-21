import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { createRequire } from 'node:module';
import path from 'node:path';
import manifest from '../../package.json';
// Target the retained renderer artwork; the same figure also owns an editable
// canvas SVG whose accessibility and pointer behavior are covered separately.
const rendererSelector = `[data-opf-renderer="${manifest.dependencies['@openpresentation/opf-render']}"] div[role="img"]`;

async function singleSlidePreview(page: Page, title: string, options: { timeout?: number } = {}) {
  const svg = page.locator(`${rendererSelector} svg`);
  // Preview updates follow source/gallery updates. Wait for this document,
  // rather than applying a strict single-element assertion to the starter deck.
  await expect(svg).toHaveCount(1, options);
  await expect(svg).toHaveAttribute('aria-label', title, options);
  return svg;
}

test('published long quotes retain their footer in actual wide/portrait previews and PowerPoint downloads', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const title = 'A quote and its source', footer = 'A reviewer - Recorded interview';
  const {fromPptx} = await import('@openpresentation/opf-pptx');
  const {validatePresentation} = await import('@openpresentation/opf');
  const require = createRequire(path.resolve('package.json'));
  const JSZip = createRequire(require.resolve('@openpresentation/opf-pptx'))('jszip');
  for(const dimensions of [{width:1280,height:720},{width:540,height:960}]) {
    const deck = {design:{fontScheme:'roboto',dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96}},slides:[{title,quote:{text:'A shared layout keeps the evidence readable when the words change. '.repeat(24),attribution:'A reviewer',source:'Recorded interview'}}]};
    await page.goto('/inspector#opf='+gzipSync(JSON.stringify(deck)).toString('base64url'));
    // Loading this fixture's font family already had a 20s readiness budget.
    // Apply it to the document checks that now precede the visibility check.
    const svg = await singleSlidePreview(page, title, { timeout: 20_000 });
    await expect(svg).toBeVisible({timeout:20_000});
    await expect(svg).toHaveAttribute('viewBox',`0 0 ${dimensions.width} ${dimensions.height}`);
    const bounds = await svg.evaluate((svg,{title,footer})=>{
      const texts=[...svg.querySelectorAll('text')];
      const source=texts.find(node=>node.textContent===footer);
      const body=texts.filter(node=>node!==source&&node.textContent!==title);
      return {bodyLines:body.length,bodyBottom:Math.max(...body.map(node=>node.getBBox().y+node.getBBox().height)),footerTop:source?.getBBox().y};
    },{title,footer});
    expect(bounds.bodyLines).toBeGreaterThan(1);
    expect(bounds.footerTop).toBeDefined();
    expect(bounds.bodyBottom).toBeLessThanOrEqual(bounds.footerTop!);
    const pending = page.waitForEvent('download');
    await page.getByRole('button',{name:'pptx',exact:true}).click();
    const download = await pending;
    expect(await download.failure()).toBeNull();
    const bytes = await readFile((await download.path())!);
    const restored = await fromPptx(bytes);
    expect(validatePresentation(restored).valid).toBe(true);
    expect(JSON.stringify(restored)).toContain(footer);
    const archive = await JSZip.loadAsync(bytes);
    const xml = await archive.file('ppt/slides/slide1.xml').async('string');
    const native = await page.evaluate(({xml,title,footer})=>{
      const document=new DOMParser().parseFromString(xml,'application/xml');
      const shapes=[...document.getElementsByTagName('p:sp')].filter(shape=>shape.getElementsByTagName('a:t').length);
      const text=(shape:Element)=>[...shape.getElementsByTagName('a:t')].map(node=>node.textContent).join('');
      const source=shapes.find(shape=>text(shape)===footer);
      const body=shapes.filter(shape=>shape!==source&&text(shape)!==title);
      const bounds=(shape:Element)=>{const transform=shape.getElementsByTagName('a:xfrm')[0];return {top:Number(transform.getElementsByTagName('a:off')[0].getAttribute('y')),height:Number(transform.getElementsByTagName('a:ext')[0].getAttribute('cy'))};};
      return {bodyLines:body.length,bodyBottom:Math.max(...body.map(shape=>{const box=bounds(shape);return box.top+box.height;})),footerTop:source?bounds(source).top:null};
    },{xml,title,footer});
    expect(native.bodyLines).toBeGreaterThan(1);
    expect(native.footerTop).not.toBeNull();
    expect(native.bodyBottom).toBeLessThanOrEqual(native.footerTop!);
  }
  expect(errors).toEqual([]);
});

const fixture = {
  name: "Browser adoption check",
  slides: [{ title: "An editable presentation", text: "Written in the browser." }],
};

test('shared navigation clears format errors and proposals from the previous deck', async ({page}) => {
  const href = (doc: unknown) => '/inspector#opf=' + gzipSync(JSON.stringify(doc)).toString('base64url');
  await page.goto(href({slides:[{title:'Original deck'}]}));
  const input = page.getByRole('textbox', {name:'Editor content'});
  await expect(input).toBeVisible();
  await page.locator('[data-schema-path="name"]').click();
  await expect(page.getByTestId('opf-ghost-proposal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('opf-ghost-proposal')).toHaveCount(0);
  await page.locator('[data-schema-path="name"]').click();
  await expect(page.getByTestId('opf-ghost-proposal')).toBeVisible();
  await page.goto(href(fixture));
  await expect(page.getByTestId('playground-gallery-rail')).toContainText(fixture.slides[0].title);
  await expect(page.getByTestId('opf-ghost-proposal')).toHaveCount(0);

  await input.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('{');
  await page.getByRole('tab', {name:'YAML', exact:true}).click();
  await expect(page.getByText('Format error', {exact:true})).toBeVisible();
  await page.goto(href({slides:[{title:'Clean replacement'}]}));
  await expect(page.getByTestId('playground-gallery-rail')).toContainText('Clean replacement');
  await expect(page.getByText('Format error', {exact:true})).toHaveCount(0);
  await expect(page.getByText('Schema clean', {exact:true})).toBeVisible();
});

async function downloadOpf(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "json", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.opf\.json$/);
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}

async function replaceBuffer(page: Page, document: unknown) {
  const input = page.getByRole("textbox", { name: "Editor content" });
  await input.focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.evaluate((text) => navigator.clipboard.writeText(text), JSON.stringify(document, null, 2));
  await page.keyboard.press("ControlOrMeta+v");
}

test("anonymous JSON authoring, preview, undo/redo, download and shared reimport", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/inspector");
  await expect(page.getByTestId("playground-pattern-b-shell")).toBeVisible();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await replaceBuffer(page, fixture);
  await expect(page.getByTestId("playground-gallery-rail")).toContainText(fixture.slides[0].title);
  await expect(await singleSlidePreview(page, fixture.slides[0].title)).toBeVisible();
  await expect(page.getByTestId("playground-status-bar")).toContainText("0 errors / 0 warnings");
  expect(await downloadOpf(page)).toEqual(fixture);

  // A single keyboard edit must be reflected in the authored buffer and undo history.
  const edited = { ...fixture, name: "Edited browser presentation" };
  await replaceBuffer(page, edited);
  await expect.poll(() => downloadOpf(page)).toEqual(edited);
  await page.getByRole("textbox", { name: "Editor content" }).focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => downloadOpf(page)).toEqual(fixture);
  await page.getByRole("textbox", { name: "Editor content" }).focus();
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(() => downloadOpf(page)).toEqual(edited);

  const encoded = gzipSync(JSON.stringify(edited)).toString("base64url");
  await page.goto(`/inspector#opf=${encoded}`);
  await expect(page.getByTestId("playground-pattern-b-shell")).toContainText(edited.name);
  expect(await downloadOpf(page)).toEqual(edited);
  await expect(page.getByTestId("playground-gallery-rail")).toContainText(fixture.slides[0].title);
  await expect(await singleSlidePreview(page, fixture.slides[0].title)).toBeVisible();
  const apiWrites: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') apiWrites.push(request.url()); });
  await page.context().setOffline(true);
  const pptxPending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'pptx', exact: true }).click();
  const pptx = await pptxPending;
  expect(await pptx.failure()).toBeNull();
  const bytes = await readFile((await pptx.path())!);
  const { fromPptx } = await import('@openpresentation/opf-pptx');
  const { validatePresentation } = await import('@openpresentation/opf');
  const converted = await fromPptx(bytes);
  expect(validatePresentation(converted).valid).toBe(true);
  expect(JSON.stringify(converted)).toContain(fixture.slides[0].title);
  expect(apiWrites).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("inspector.png"), fullPage: true });
});
