#!/usr/bin/env node
// MR-10 (monorepo plan, section 1 "Guards"): one Playwright, in the container image and in the manifests.
//
// Browser goldens are only stable inside one pinned image, and the Playwright package must match the browsers in it. This
// check reads every `mcr.microsoft.com/playwright:vX.Y.Z-<distro>@sha256:<digest>` in .github/ (workflows and actions) and fails when
//   - an image reference has no digest (a tag moves; the digest is the pin);
//   - two references differ (version, distro or digest): all of them are one string;
//   - the package version of `playwright`, `playwright-core` or `@playwright/test` (an exact pin in the root or a workspace
//     member manifest, or the `playwright` entry of a pnpm-workspace.yaml catalog) differs from the image version.
// A Playwright bump therefore fails here until the image string is edited in every workflow, which is intended: Dependabot
// updates the package, a person or agent updates the digest.
//
// Usage: node scripts/check-playwright-pin.mjs [root]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadWorkspace } from './workspace-packages.mjs';

const IMAGE = /mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)(?:-([a-z]+))?(@sha256:[0-9a-f]{64})?/g;
const PACKAGES = ['playwright', 'playwright-core', '@playwright/test'];
const EXACT = /^\d+\.\d+\.\d+$/;

/** Findings. images: [{file, text, version, digest}], pinned: [{where, version}]. */
export function checkPlaywrightPin(images, pinned) {
  const problems = [];
  for (const image of images) {
    if (!image.digest) problems.push(`${image.file}: ${image.text} has no @sha256 digest`);
  }
  const strings = new Map();
  for (const image of images) strings.set(image.text, [...(strings.get(image.text) ?? []), image.file]);
  if (strings.size > 1) {
    problems.push(`the Playwright image must be one string everywhere, found ${strings.size}: ${[...strings].map(([text, files]) => `${text} (${[...new Set(files)].join(', ')})`).join('; ')}`);
  }
  const versions = new Set(images.map((image) => image.version));
  for (const { where, version } of pinned) {
    for (const imageVersion of versions) {
      if (version !== imageVersion) problems.push(`${where} pins Playwright ${version} but the container image is v${imageVersion}`);
    }
  }
  return problems;
}

function workflowFiles(root) {
  const files = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.ya?ml$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(root, '.github'));
  return files.sort();
}

export function collect(root) {
  const images = [];
  for (const file of workflowFiles(root)) {
    for (const match of readFileSync(file, 'utf8').matchAll(IMAGE)) {
      images.push({ file: path.relative(root, file).split(path.sep).join('/'), text: match[0], version: match[1], digest: match[3] });
    }
  }
  const pinned = [];
  const { members } = loadWorkspace(root);
  const manifests = [{ dir: '.', manifest: JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) }, ...members];
  for (const { dir, manifest } of manifests) {
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const name of PACKAGES) {
        if (EXACT.test(manifest[field]?.[name] ?? '')) pinned.push({ where: `${dir}/package.json ${field} ${name}`, version: manifest[field][name] });
      }
    }
  }
  const workspaceFile = path.join(root, 'pnpm-workspace.yaml');
  if (existsSync(workspaceFile)) {
    for (const match of readFileSync(workspaceFile, 'utf8').matchAll(/^\s+["']?(playwright|playwright-core|@playwright\/test)["']?:\s*["']?(\d+\.\d+\.\d+)["']?\s*$/gm)) {
      pinned.push({ where: `pnpm-workspace.yaml catalog ${match[1]}`, version: match[2] });
    }
  }
  return { images, pinned };
}

function main() {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const { images, pinned } = collect(root);
  const problems = checkPlaywrightPin(images, pinned);
  if (problems.length) {
    console.error(`check:playwright-pin FAILED (${problems.length})\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  console.log(`check:playwright-pin ok: ${images.length} image references, ${pinned.length} package pins`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
