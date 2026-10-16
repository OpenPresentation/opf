// The maintained audit runs current packages and retained historical published sets.
// Pick the old API only when the current export is absent; a real draw failure is never retried.
export function auditSvg(render, document, options) {
  if (typeof render.toSvg === 'function') return render.toSvg(document, options);
  if (typeof render.renderSvg === 'function') return render.renderSvg(document, options);
  throw new TypeError('Renderer exposes neither toSvg nor historical renderSvg');
}

export function previewOutcome(render, document) {
  const pdiag = [];
  try {
    const resolved = render.resolvePresentation(structuredClone(document), {});
    const svgs = auditSvg(render, structuredClone(document), {trace: true, onDiagnostic: diagnostic => pdiag.push(diagnostic.code)});
    return {resolved, svgs, pdiag};
  } catch (error) {
    return {fatal: `preview threw ${error.code ?? error.name}`, message: String(error.message).slice(0, 200)};
  }
}
