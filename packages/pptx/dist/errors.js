export class OPFPptxError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OPFPptxError";
    this.code = code;
    this.details = details;
    if (details.findings) this.findings = details.findings;
    if (details.diagnostics) this.diagnostics = details.diagnostics;
    if (details.path) this.path = details.path;
  }
}
