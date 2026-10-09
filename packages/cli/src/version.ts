// The version of the core package the CLI runs on. Core is a regular dependency, not a bundled copy, so the version is read
// from the installed package: `opf --version` and the reports name the core whose Node engine the commands run.
import { createRequire } from "node:module";

export const OPF_VERSION: string = (createRequire(import.meta.url)("@openpresentation/opf/package.json") as { version: string }).version;
