// RR-98: the playground's Export menu. A thin host for src/export-menu.js: it supplies the document, the one fonts handle the preview uses,
// the session's catalogs and the PowerPoint converter (@openpresentation/opf-pptx, which the editor package does not import).
// Replaces the separate PowerPoint dialog (RR-27) and the PDF / PNG / SVG dialog (RR-23); the exports themselves are unchanged.
import { toPptx } from '@openpresentation/opf-pptx';
import { createExportMenu } from '../src/export-menu.js';
import { fontGate } from '../src/font-gate.js';

export function installExportMenu({ editor, getCanvas, status, fonts, measurementFor, persistence, container }) {
  const compact = window.matchMedia('(max-width: 900px)');
  const menu = createExportMenu(container, {
    getDeck: () => editor.presentation,
    // Exporting commits an open canvas edit first; an edit that does not validate stops the export.
    beforeExport: () => !getCanvas() || getCanvas().commit(),
    fonts,
    catalogs: () => editor.catalogs,
    mode: compact.matches ? 'sheet' : 'menu',
    density: compact.matches ? 'touch' : 'comfortable',
    exportPptx: async (deck, { signal, onProgress }) => {
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
    },
    onExport: ({ format, fileName }) => {
      if (format === 'json') persistence()?.markSaved();
      status(`${fileName} downloaded · Save OPF to keep your original editable source`);
    },
    onStatus: ({ state, message }) => { if (state === 'error') status(message); },
  });
  compact.addEventListener('change', () => { menu.setMode(compact.matches ? 'sheet' : 'menu'); menu.setDensity(compact.matches ? 'touch' : 'comfortable'); });
  return menu;
}
