import { fromPptx } from '@openpresentation/opf-pptx';

export async function readPptxFile(file) {
  const diagnostics = [];
  const presentation = await fromPptx(await file.arrayBuffer(), {
    fallbackName: file.name.replace(/\.pptx$/i, ''),
    onDiagnostic: issue => diagnostics.push(issue),
  });
  return { presentation, diagnostics };
}

export function showConversionDiagnostics(container, diagnostics) {
  container.replaceChildren(...diagnostics.map(issue => {
    const item = document.createElement('li');
    item.textContent = [issue.path, issue.message].filter(Boolean).join(': ');
    return item;
  }));
}
