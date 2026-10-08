// The version of the core package the CLI runs on. Core is a regular dependency, not a bundled copy, so the version is read
// from the installed package: `opf --version` and the reports name the core that `@openpresentation/cli/api` shares with the app.
import { createRequire } from "node:module";

export const OPF_VERSION: string = (createRequire(import.meta.url)("@openpresentation/opf/package.json") as { version: string }).version;
