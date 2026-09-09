import { fromPptx, toPptx } from '@openpresentation/opf-pptx';

export async function readPptxFile(file) {
  const diagnostics = [];
  const document = await fromPptx(await file.arrayBuffer(), {
    fallbackName: file.name.replace(/\.pptx$/i, ''),
    onDiagnostic: issue => diagnostics.push(issue),
  });
  return { document, diagnostics };
}

export function showConversionDiagnostics(container, diagnostics) {
  container.replaceChildren(...diagnostics.map(issue => {
    const item = document.createElement('li');
    item.textContent = [issue.path, issue.message].filter(Boolean).join(': ');
    return item;
  }));
}

export function installPptxExport({ editor, getCanvas, renderOptions, status }) {
  const $ = id => document.getElementById(id);
  const dialog = $('export-dialog');
  let request = 0, bytes, filename;
  const cancel = () => { request++; bytes = undefined; };
  dialog.addEventListener('cancel', cancel);
  $('close-export').onclick = () => { cancel(); dialog.close(); };
  $('export-pptx').onclick = async () => {
    if (getCanvas() && !getCanvas().commit()) return;
    const id = ++request;
    // Export this committed snapshot, even if the host changes during conversion.
    const deck = structuredClone(editor.document);
    bytes = undefined;
    $('download-pptx').disabled = true;
    $('export-error').textContent = '';
    $('export-diagnostics').replaceChildren();
    $('export-summary').textContent = `Preparing ${deck.slides.length} slides…`;
    dialog.showModal();
    const diagnostics = [];
    try {
      const result = await toPptx(deck, {
        textMeasurement: renderOptions.textMeasurement,
        strictAssets: true,
        onDiagnostic: issue => diagnostics.push(issue),
      });
      if (id !== request || !dialog.open) return;
      bytes = result;
      filename = `${(deck.name ?? 'presentation').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'presentation'}.pptx`;
      showConversionDiagnostics($('export-diagnostics'), diagnostics);
      $('export-summary').textContent = `${deck.slides.length} slides · ${result.length.toLocaleString()} bytes · ${diagnostics.length} conversion notes`;
      $('download-pptx').disabled = false;
    } catch (cause) {
      if (id !== request || !dialog.open) return;
      showConversionDiagnostics($('export-diagnostics'), diagnostics);
      $('export-summary').textContent = 'PowerPoint export needs attention';
      $('export-error').textContent = cause.message;
    }
  };
  $('download-pptx').onclick = () => {
    if (!bytes) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('PowerPoint downloaded · Save OPF to keep your original editable source');
  };
}
