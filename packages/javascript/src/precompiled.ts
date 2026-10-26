import { installSchemaEngine } from "./schema-engine.js";
import { schemaEngine } from "./schema-engine-precompiled.js";

/**
 * `import "@openpresentation/opf/precompiled"` (CE-01): makes `validate` use the validators generated at build time, which never
 * compile code at runtime. Needed only where the export conditions did not already choose them: the `workerd`, `worker` and
 * `edge-light` conditions do, and a host whose bundler resolves the `node` build for code that runs on a worker (Next.js on
 * OpenNext, for one) or a page under a Content-Security-Policy without `unsafe-eval` imports this once, before the first
 * `validate`. It exports nothing.
 */
installSchemaEngine(schemaEngine());
