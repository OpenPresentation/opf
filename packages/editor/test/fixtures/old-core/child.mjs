// Runs in a child of test/chart-table-data-old-core.mjs. Registers a loader that gives `@openpresentation/opf` the shim without core's RR-54
// exports (registered here, after any loader the environment added, so it answers first), then runs body.mjs.
import { register } from "node:module";

register("./loader.mjs", import.meta.url, { data: { shim: process.env.OPF_OLD_CORE_SHIM } });
await import("./body.mjs");
