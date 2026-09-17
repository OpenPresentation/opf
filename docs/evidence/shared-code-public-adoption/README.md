# Public shared-code adoption — September 10, 2026

[summary.json](summary.json) binds all three merged Git trees, preview/production deployments, exact dependencies, test sources and evidence hashes. The public sites consume core 0.9.0, renderer/PPTX 0.7.0, editor 0.6.0 and CLI 0.7.0 where applicable. No existing package was republished.

Use fresh GitHub checkouts at the summary's merge commits. Run locked installs and production builds with Node 24.20.0, pnpm 10.33.2 for the website/gallery, and pnpm 11.1.3 for pptx.dev. Preserve pptx.dev's own workspace configuration. If the gallery is nested beneath another pnpm workspace, pass `--ignore-workspace`.

The committed Playwright tests run against a local production build by default. For the public deployments, set these environment variables in PowerShell in the corresponding checkout:

```powershell
# Data-Advantage/openpresentation-site
$env:OPF_SITE_URL = 'https://www.openpresentation.org'
pnpm verify:registry
pnpm test:e2e

# Data-Advantage/pptx-gallery
$env:GALLERY_BASE = 'https://www.pptx.gallery'
pnpm verify:deployed-editor
pnpm test:e2e

# Data-Advantage/pptx-dev
$env:OPF_APP_URL = 'https://www.pptx.dev'
pnpm exec playwright test --output=artifacts/public-e2e
```

Windows uses real Edge; CI uses the pinned Playwright Chromium image, with a separate Windows job for pptx.dev. Protected previews require a temporary authorized browser storage state; protection was kept enabled. Do not commit those cookies. Each of the 21 workflows passed once against its preview and again against public production, with no failures, retries or skipped cases. These are 21 distinct workflows, not 42 different journeys.

The website checks the actual install command `npx @openpresentation/cli@latest skills install`, all 737 raw skill-file hashes, published UTC dates, links, copied reference titles/Markdown and hash-matched downloads. Gallery checks all eight immutable editor assets plus authoring, readable code selection, exact source whitespace, pagination, undo/redo and editable export/reimport. pptx.dev checks anonymous Author/Inspector, code/table/quote workflows, offline workers and YAML/Markdown, hostile SVG boundaries and live toolkit proofs. Local validation also passed 106 gallery tests, 598 pptx.dev tests and all three production builds.

For exact deployed fonts, use core's committed `scripts/verify-deployed-browser-fonts.mjs` with a freshly verified registry consumer and `https://www.pptx.dev`. All 33 faces and license texts matched installed renderer 0.7.0. The asset reports record Next.js script fingerprints without equating minified bundles to unbundled npm files.

The public Author test saves `author-export.pptx` in its test output. On Windows with PowerPoint, run pptx.dev's `scripts/test-native-author.ps1 -InputFile <downloaded-file>` followed by `node scripts/verify-native-author.mjs <downloaded-file>`. The test edits only its generated presentation, saves/reopens it and closes only its own files. It does not quit the user's PowerPoint application. The actual run preserved editable native text and a table and passed controlled reimport; its raster was inspected. This supplements the separate complete-set registry code/quote matrices and does not establish arbitrary formatting recovery or pixel equivalence.

The 540px gallery test exposed unnamed toolbar controls. The host example fix is pinned to editor PR #10's reviewed `fa4acf1c2108fd831d10ceb803fd708e908a4e17`, tree-identical to merged `1b05f8ba97f9617b25b1a9d18ac05648419318c9`. It changes no published runtime. Broader repair/Auto arrange, other payload internals, multilingual font compatibility and native macOS PowerPoint/Keynote evidence remain separate work.
