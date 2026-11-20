// CE-01: validates one edge-corpus document with the package under test. It imports nothing, so the same function runs in Node
// (test/support/edge-run.mjs) and inside the Worker bundle (test/support/edge-worker.mjs). Not a test.
/**
 * `opf` is the module namespace of the browser build, imported by
 * the caller, so the same function runs in Node and inside a worker bundle. The deck's diagram types are loaded first, as a Worker that
 * validates diagrams does (an edge runtime loads each type on demand; Node has them all), so both sides check the same diagrams.
 */
export async function evaluate(opf, { filename, text }) {
	try {
		const input = filename.endsWith('.json') ? text : opf.parse(text, { filename });
		try { await opf.ensureDiagrams(typeof input === 'string' ? JSON.parse(input) : input); } catch {}
		return { report: opf.validate(input) };
	} catch (error) {
		return { error: `${error?.name ?? 'Error'}: ${error?.message ?? error}` };
	}
}
