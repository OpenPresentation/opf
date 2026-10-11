# Candidate golden graph replay

The workflow change was replayed locally in fresh isolated checkouts; no golden generation, promotion or dispatch occurred. The pinned CI image remains the only environment authorized to commit golden hashes.

Inputs: core `7c0bf9ef7476563dbd4872634d3dab7051a8d9b7`, renderer `2377a136aebfb68559ef202dcb8f75d3fad6d0ad`, gallery `e0a7eee2dfe996e680b34a907cabfe41905e6d99`. Node 24.21.0, pnpm 10.33.2. Each had its own locked dependency installation. This replay verifies package setup, not native rendering or raster parity.

Commands, in order:

```sh
pnpm --dir opf install --frozen-lockfile
npm ci --prefix opf-render-branch
npm ci --prefix gallery-candidate
npm run build --prefix gallery-candidate
node tools/scripts/core-golden.mjs link-gallery --workspace "$PWD" --gallery-ref e0a7eee2dfe996e680b34a907cabfe41905e6d99
(cd opf && node scripts/materialize-gallery-catalog.mjs)
pnpm --dir opf build
npm run build --prefix opf-render-branch
```

All commands passed. The gallery build used its unmodified locked core 0.18.1 before any link. The core installation initially materialized gallery1 with 278 layout index entries. The candidate materializer replaced the tree with exactly 28 gallery2 layout records plus index.json; zero `*-1x.json` files remained. Every materialized catalog JSON matched the exact gallery candidate semantically (zero mismatches). Both isolated main guard package sentinel trees remained unchanged. Candidate links resolved to the selected checkout.

Main-based workflow validation: 21 core-golden regression tests, required changed checks, full core package 2,261 tests/one existing skip plus six standalone scripts, CLI 169 tests/95 command checks/77 drawing checks, and all 34 root checks passed. The existing CLI script reported its historical 0.14 SVG digest comparison skipped against installed 0.18 packages; this is not final v2 visual proof. No baseline file or lock metadata was changed.
