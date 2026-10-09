// The one import engine: a PowerPoint file to an OPF presentation through opf-pptx `fromPptx` (the optional peer, see
// peers.ts). `convert` and `open` of `@openpresentation/opf/node` and `opf import` all run `runImport`.
// Import is a conversion, not a lossless round trip for arbitrary decks: what it cannot keep is reported as diagnostics.
// The same file gives the same presentation: nothing is fetched and no clock is read.
import type { Diagnostic, Peer, PptxModule } from "./peers.js";
import { loadPptx } from "./peers.js";
import { type Reporter, reportThrown } from "./reporter.js";

export interface ImportRun {
	/** The imported presentation, undefined when `fromPptx` threw (the reporter then holds the error finding). */
	presentation?: Record<string, unknown>;
	/** With `signals`: the raw per-shape layout and style signals of the file. */
	signals?: { version?: number };
	failure?: { code: string; message: string };
	pptx: Peer<PptxModule>;
}

/** Read a PowerPoint file. Diagnostics (and the error finding of a failure) are added to `reporter`. Throws an `OPFApiError` when opf-pptx is missing or too old. */
export async function runImport(bytes: Uint8Array, options: { signals?: boolean }, reporter: Reporter, loaded?: Peer<PptxModule>): Promise<ImportRun> {
	const pptx = loaded ?? (await loadPptx());
	try {
		const onDiagnostic = (diagnostic: Diagnostic) => reporter.add("import", diagnostic);
		if (options.signals) {
			const result = (await pptx.module.fromPptx(bytes, { onDiagnostic, signals: true })) as unknown as { presentation: Record<string, unknown>; signals: { version?: number } };
			return { presentation: result.presentation, signals: result.signals, pptx };
		}
		return { presentation: await pptx.module.fromPptx(bytes, { onDiagnostic }), pptx };
	} catch (error) {
		reportThrown(reporter, "import", error);
		const failure = error as { code?: unknown; message?: string };
		return { pptx, failure: { code: typeof failure?.code === "string" ? failure.code : "failed", message: failure?.message ?? String(error) } };
	}
}
