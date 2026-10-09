// The browser-safe build of `@openpresentation/opf` (RR-70): what the `browser`, `worker`, `workerd` and `default` export
// conditions resolve to. It exports the same names as the Node build (./index.ts) and shares its one type surface
// (dist/index.d.ts). `open`, `save` and `convert` read and write files and load the drawing engines, so here they reject with
// `OPFApiError` code `node-only`, whose message names the browser-safe alternative. Everything else is core itself.
//
// scripts/check-browser-safe.mjs proves this entry imports no Node builtin, no optional peer and no Node engine module, and
// bundles the package root for the browser and worker conditions to check that they reach this file.
import { OPFApiError } from "./api-errors.js";
import type * as NodeBuild from "./index.js";

export * from "./core.js";

const nodeOnly = (name: "open" | "save" | "convert", message: string) =>
	new OPFApiError(`\`${name}\` ${message}`, "node-only", { details: { function: name, build: "browser" } });

const PARSE = "In a browser or a worker, read the text yourself and call parse(text, { filename }).";
const STRINGIFY = "In a browser or a worker, call stringify(deck, { filename }) and store or download the text.";
const CONVERT =
	"In a browser or a worker, change deck forms with parse and stringify (YAML, Markdown, JSON), and draw slides with @openpresentation/opf-render's /export-browser entry.";

/** Node only. In this build it rejects with `OPFApiError` `node-only`. */
export const open: typeof NodeBuild.open = async () => {
	throw nodeOnly("open", `reads files and needs Node. ${PARSE}`);
};

/** Node only. In this build it rejects with `OPFApiError` `node-only`. */
export const save: typeof NodeBuild.save = async () => {
	throw nodeOnly("save", `writes files and needs Node. ${STRINGIFY}`);
};

/**
 * Node only. In this build it rejects with `OPFApiError` `node-only`, for a file path and for the in-memory form
 * `convert(deck, { format })` alike: in 0.18 every conversion runs the Node engine. A later item adds a browser implementation
 * of the in-memory form through opf-render's `/export-browser`.
 */
export const convert: typeof NodeBuild.convert = (async (_input: unknown, output: unknown) => {
	const inMemory = output !== null && typeof output === "object";
	throw nodeOnly("convert", inMemory ? `needs Node in OPF 0.18, also for the in-memory convert(deck, { format }). ${CONVERT}` : `reads and writes files and needs Node. ${CONVERT}`);
}) as typeof NodeBuild.convert;
