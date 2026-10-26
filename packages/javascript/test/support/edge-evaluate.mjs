// CE-01: validates one edge-corpus document with the package under test. It imports nothing, so the same function runs in Node
// (test/support/edge-run.mjs) and inside the Worker bundle (test/support/edge-worker.mjs). Not a test.
/**
 * `opf` is the module namespace of the browser build, imported by
 * the caller, so the same function runs in Node and inside a worker bundle.
 */
export function evaluate(opf, { filename, text }) {
	try {
		const input = filename.endsWith('.json') ? text : opf.parse(text, { filename });
		return { report: opf.validate(input) };
	} catch (error) {
		return { error: `${error?.name ?? 'Error'}: ${error?.message ?? error}` };
	}
}
