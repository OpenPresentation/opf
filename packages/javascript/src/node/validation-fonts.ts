// Font planning can reach the renderer's strict format boundary before a CLI/MCP source-aware report is made.
// Recognize only the loaded renderer's actual exception, directly or through prepareFonts' one known API wrapper.
import { OPFApiError } from "../api-errors.js";
import type { RenderModule } from "./peers.js";

export function isRendererValidationFailure(error: unknown, RenderError: RenderModule["OPFRenderError"]): boolean {
	if (typeof RenderError !== "function") return false;
	const boundary = error instanceof OPFApiError && error.code === "invalid-opf" ? error.cause : error;
	if (!(boundary instanceof RenderError) || boundary.code !== "invalid-opf") return false;
	const details = boundary.details;
	if (typeof details !== "object" || details === null) return false;
	const report = details.report;
	if (typeof report !== "object" || report === null) return false;
	const value = report as { valid?: unknown; findings?: unknown };
	return value.valid === false && Array.isArray(value.findings) && value.findings.some((finding: unknown) =>
		typeof finding === "object" && finding !== null && "category" in finding && finding.category === "format" && "severity" in finding && finding.severity === "error",
	);
}
