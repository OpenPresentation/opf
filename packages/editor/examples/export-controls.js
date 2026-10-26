// RR-98: the playground's PowerPoint export. The Export menu itself is the editor's (`createOpfEditor` mounts it, `src/export-menu.js`); the
// converter lives in @openpresentation/opf-pptx, which the editor package does not import, so the host hands it over as `export.exportPptx`.
// It supplies the document, the one fonts handle the preview uses and the session's catalogs. Replaces the separate PowerPoint dialog (RR-27)
// and the PDF / PNG / SVG dialog (RR-23); the exports themselves are unchanged.
import { toPptx } from '@openpresentation/opf-pptx';
import { fontGate } from '../src/font-gate.js';

export function pptxExporter({ editor, fonts, measurementFor }) {
  return async (deck, { signal, onProgress }) => {
    const diagnostics = [];
    // Text is measured with the loaded faces, so the faces the deck needs load before conversion measures anything.
    const gate = fontGate(fonts);
    if (gate?.pending(deck, { catalogs: editor.catalogs }).length) {
      onProgress({ message: 'Loading fonts…' });
      await gate.ensure(deck, { signal, renderOptions: { catalogs: editor.catalogs } });
    }
    onProgress({ message: `Converting ${deck.slides.length} slides…` });
    // The same catalog list the preview resolves with (FA-23); the deck is embedded first, like a saved file.
    const bytes = await toPptx(deck, {
      catalogs: editor.catalogs,
      // A script-aware measurement for this deck (Japanese under Aptos measures with Noto Sans JP), when the host supplies one.
      fonts: measurementFor ? { textMeasurement: measurementFor(deck) } : fonts,
      strictAssets: true,
      onDiagnostic: issue => diagnostics.push(issue),
    });
    return { bytes, warnings: diagnostics };
  };
}
