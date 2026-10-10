// render#199: the files the Node entries read from disk (harfbuzzjs's .wasm, the installed `@expo-google-fonts/*` packages and this
// package's vendored `fonts/` directory) are located at run time, by Node's own resolution from this file, in a form bundlers leave
// alone. A bundler (Next.js Turbopack, webpack) treats `require.resolve` on `createRequire(import.meta.url)` as a module import: a
// literal .wasm specifier is compiled as a WebAssembly module (which fails `next build`), a computed one (`${name}/package.json`)
// becomes a stub that always throws, and `new URL(`../${dir}/`, import.meta.url)` becomes the URL of an unrelated emitted asset.
// Here `createRequire` is reached through the module namespace and the specifier is a variable behind the bundlers' ignore comments,
// so neither is traced, and the package root is computed from this file's path. Plain Node resolves exactly as before.
import * as nodeModule from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** This package's root directory (the parent of `dist/`). */
export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requireHere = nodeModule.createRequire(import.meta.url);

/**
 * The absolute path of an installed file (`harfbuzzjs/dist/harfbuzz.wasm`, `@expo-google-fonts/roboto/package.json`), resolved as
 * `require.resolve` resolves it from this package, or from `directory` when given. Throws `MODULE_NOT_FOUND` like `require.resolve`.
 */
export function resolveInstalled(specifier, directory) {
  const resolver = directory === undefined ? requireHere : nodeModule.createRequire(path.join(directory, "package.json"));
  return resolver.resolve(/* webpackIgnore: true */ /* turbopackIgnore: true */ specifier);
}
