import { expect, test } from "@playwright/test";
import manifest from "../../package.json";

test("public toolkit shows the deployed package set with working render, edit and export proofs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/docs/opf-toolkit");
  await expect(page.getByRole("heading", { name: "OPF toolkit packages on pptx.dev" })).toBeVisible();
  for (const name of ["@openpresentation/opf-render", "@openpresentation/opf-editor", "@openpresentation/opf-pptx"] as const) {
    const card = page.locator(`[data-package-name="${name}"]`);
    await expect(card.getByText("@" + manifest.dependencies[name], { exact: true })).toBeVisible();
    await expect(card.getByText("ok", { exact: true })).toBeVisible();
  }
  const editor = page.locator('[data-package-name="@openpresentation/opf-editor"]');
  for (const key of ["validationValid", "undoRestoredTitle", "redoRestoredTitle"]) {
    await expect(editor.locator("dt").filter({ hasText: new RegExp(`^${key}$`) }).locator("..").locator("dd")).toHaveText("true");
  }
  const pptx = page.locator('[data-package-name="@openpresentation/opf-pptx"]');
  expect(Number(await pptx.locator("dt").filter({ hasText: /^pptxBytes$/ }).locator("..").locator("dd").innerText())).toBeGreaterThan(1000);
  expect(errors).toEqual([]);
});
