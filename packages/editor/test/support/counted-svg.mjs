// Test-only instrumentation: every request still uses the real renderer.
import { toSvg as render } from '../../../render/src/svg.js';
export * from '../../../render/src/svg.js';

export function toSvg(document, selection, options) {
  globalThis.__opfThumbnailRenderCalls ??= [];
  globalThis.__opfThumbnailRenderCalls.push({
    selection: Array.isArray(selection) ? [...selection] : typeof selection === 'number' ? selection : null,
    slideCount: document.slides?.length ?? 0,
    dimensions: structuredClone(document.design?.dimensions ?? {}),
  });
  return render(document, selection, options);
}
