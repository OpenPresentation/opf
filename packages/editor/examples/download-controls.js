// RR-23: the playground's "PDF / PNG / SVG" download dialog, next to the PowerPoint export. The dialog is a thin view over
// src/export.js: it collects the options, runs `exportDeck` with progress and a Cancel, shows what the converter noted
// (substituted fonts, missing glyphs, elements drawn as images) and offers the finished file for download.
import { EXPORT_FORMATS, MAX_PNG_SCALE, exportDeck, exportFileName, slidesToExport } from '../src/export.js';

const FORMAT_HELP = {
  pdf: 'Pages the size of the slides. Text stays selectable and searchable; fonts are embedded from the editor’s open font files.',
  png: 'One image per slide, drawn exactly as the preview. All slides arrive as a ZIP.',
  svg: 'Scalable slides with their fonts embedded, one file per slide. All slides arrive as a ZIP.',
};

export function installDownloadControls({ editor, getCanvas, getSlideIndex, status, fonts, convert }) {
  const header = document.querySelector('.header-actions');
  if (!header) return;
  const button = document.createElement('button');
  button.id = 'export-files';
  button.className = 'secondary';
  button.textContent = 'PDF · PNG · SVG';
  button.title = 'Download the presentation as PDF, PNG or SVG';
  button.setAttribute('aria-haspopup', 'dialog');
  (document.getElementById('export-pptx') ?? header.lastElementChild)?.after(button);
  if (!button.isConnected) header.append(button);

  const dialog = document.createElement('dialog');
  dialog.id = 'download-dialog';
  dialog.setAttribute('aria-labelledby', 'download-title');
  dialog.innerHTML = `<div class="dialog-header"><div><h2 id="download-title">Download as PDF, PNG or SVG</h2><p>Made on this device from the same drawing as the preview.</p></div><button id="download-close" aria-label="Close download dialog">×</button></div>
<div class="download-body">
<fieldset class="download-group" id="download-format"><legend>Format</legend>
<label class="download-choice"><input type="radio" name="download-format" value="pdf" checked> <span>PDF</span></label>
<label class="download-choice"><input type="radio" name="download-format" value="png"> <span>PNG images</span></label>
<label class="download-choice"><input type="radio" name="download-format" value="svg"> <span>SVG</span></label>
<p class="field-help" id="download-format-help"></p></fieldset>
<fieldset class="download-group" id="download-slides"><legend>Slides</legend>
<label class="download-choice"><input type="radio" name="download-slides" value="current"> <span id="download-current-label">Current slide</span></label>
<label class="download-choice"><input type="radio" name="download-slides" value="all" checked> <span id="download-all-label">All slides</span></label>
<label class="download-choice" id="download-hidden-row" hidden><input type="checkbox" id="download-hidden"> <span>Include hidden slides</span></label></fieldset>
<fieldset class="download-group" id="download-pdf-options"><legend>PDF type</legend>
<label class="download-choice"><input type="radio" name="download-pdf-mode" value="vector" checked> <span>Selectable text and vector shapes</span></label>
<label class="download-choice"><input type="radio" name="download-pdf-mode" value="raster"> <span>An image of each slide (larger, text not selectable)</span></label></fieldset>
<div class="download-group" id="download-png-options"><label for="download-scale">Image size</label><select id="download-scale" aria-describedby="download-scale-help"></select><p class="field-help" id="download-scale-help"></p></div>
<div class="download-progress" id="download-progress-row" hidden><progress id="download-progress" max="1" value="0" aria-labelledby="download-progress-label"></progress><span id="download-progress-label"></span><button id="download-cancel" class="quiet">Cancel</button></div>
<p id="download-summary" role="status" aria-live="polite"></p>
<ul id="download-diagnostics" aria-label="Download notes"></ul>
<details id="download-fonts" hidden><summary id="download-fonts-summary"></summary><ul id="download-font-list"></ul></details>
<p id="download-error" role="alert"></p>
</div>
<div class="dialog-footer"><span>No account or paid service. Nothing leaves this device.</span><div><button id="download-create" class="secondary">Create file</button><button id="download-save" class="primary" disabled>Download</button></div></div>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const value = name => dialog.querySelector(`input[name="${name}"]:checked`).value;
  let controller, result, token = 0;

  function slideWidth() {
    const svg = document.querySelector('#preview svg');
    return { width: Number(svg?.getAttribute('width')) || 1280, height: Number(svg?.getAttribute('height')) || 720 };
  }
  function labelOptions() {
    const deck = editor.presentation, current = getSlideIndex();
    $('#download-current-label').textContent = `Current slide (${current + 1} of ${deck.slides.length})`;
    const all = slidesToExport(deck, { slides: 'all', includeHidden: $('#download-hidden').checked }).length;
    $('#download-all-label').textContent = `All slides (${all})`;
    $('#download-hidden-row').hidden = !deck.slides.some(slide => slide.hidden === true);
    const format = value('download-format');
    $('#download-format-help').textContent = FORMAT_HELP[format];
    $('#download-pdf-options').hidden = format !== 'pdf';
    $('#download-png-options').hidden = format !== 'png';
    const { width, height } = slideWidth(), select = $('#download-scale'), chosen = select.value || '2';
    select.replaceChildren(...[1, 2, 3, MAX_PNG_SCALE].map(scale => { const option = document.createElement('option'); option.value = String(scale); option.textContent = `${scale}× · ${Math.round(width * scale)} × ${Math.round(height * scale)} pixels`; return option; }));
    select.value = chosen;
    $('#download-scale-help').textContent = 'Larger images are sharper and take longer to make.';
    $('#download-create').textContent = format === 'pdf' ? 'Create PDF' : format === 'png' ? 'Create PNG' : 'Create SVG';
  }
  function reset() {
    token++;
    result = undefined;
    $('#download-save').disabled = true;
    $('#download-save').textContent = 'Download';
    $('#download-summary').textContent = '';
    $('#download-error').textContent = '';
    $('#download-diagnostics').replaceChildren();
    $('#download-fonts').hidden = true;
    labelOptions();
  }
  function running(on) {
    $('#download-progress-row').hidden = !on;
    $('#download-create').disabled = on;
    for (const input of dialog.querySelectorAll('input,select')) input.disabled = on;
  }
  function showDiagnostics(diagnostics) {
    const notes = diagnostics.filter(item => item.severity !== 'info'), info = diagnostics.filter(item => item.severity === 'info');
    $('#download-diagnostics').replaceChildren(...notes.map(item => {
      const li = document.createElement('li');
      li.dataset.code = item.code;
      li.textContent = `${item.slide === undefined ? '' : `Slide ${item.slide + 1}: `}${item.message}`;
      return li;
    }));
    $('#download-fonts').hidden = !info.length;
    $('#download-fonts-summary').textContent = `${info.length} font ${info.length === 1 ? 'file' : 'files'} embedded`;
    $('#download-font-list').replaceChildren(...info.map(item => { const li = document.createElement('li'); li.textContent = item.message; return li; }));
  }

  async function create() {
    if (getCanvas() && !getCanvas().commit()) return;
    reset();
    const id = token;
    const deck = structuredClone(editor.presentation);
    const format = value('download-format');
    controller = new AbortController();
    running(true);
    $('#download-progress').removeAttribute('value');
    $('#download-progress-label').textContent = 'Preparing…';
    $('#download-cancel').focus();
    try {
      // RR-63: the renderer's export-browser entry imports no pdf-lib. The page imports it, only for a raster PDF.
      const pdfMode = format === 'pdf' ? value('download-pdf-mode') : undefined;
      const pdfLib = pdfMode === 'raster' && !convert ? await import('pdf-lib') : undefined;
      const made = await exportDeck(deck, {
        format,
        slides: value('download-slides'),
        slideIndex: Math.min(getSlideIndex(), deck.slides.length - 1),
        includeHidden: $('#download-hidden').checked,
        pdfMode, pdfLib,
        scale: Number($('#download-scale').value),
        fonts, convert,
        catalogs: editor.catalogs,
        signal: controller.signal,
        onProgress: ({ stage, done, total, message }) => {
          if (id !== token) return;
          const bar = $('#download-progress');
          if (stage === 'convert' && total > 1) { bar.max = total; bar.value = done; } else bar.removeAttribute('value');
          $('#download-progress-label').textContent = stage === 'convert' && total > 1 ? `${message} · ${done} of ${total}` : message ?? '';
        },
      });
      if (id !== token || !dialog.open) return;
      result = made;
      const warnings = made.diagnostics.filter(item => item.severity === 'warning').length;
      const size = made.download.bytes.length;
      $('#download-summary').textContent = `${made.download.name} · ${made.slides.length} ${made.slides.length === 1 ? 'slide' : 'slides'} · ${size < 1048576 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1048576).toFixed(1)} MB`} · ${warnings} ${warnings === 1 ? 'note' : 'notes'} to review`;
      showDiagnostics(made.diagnostics);
      $('#download-save').disabled = false;
      $('#download-save').textContent = `Download ${EXPORT_FORMATS[format].label}${made.files.length > 1 ? ' (ZIP)' : ''}`;
      status(`${EXPORT_FORMATS[format].label} ready`);
    } catch (error) {
      if (id !== token || !dialog.open) return;
      if (error.code === 'export-aborted') $('#download-summary').textContent = 'Export cancelled.';
      else { $('#download-summary').textContent = 'The export needs attention'; $('#download-error').textContent = error.message; }
    } finally {
      if (id === token) { running(false); controller = undefined; (result ? $('#download-save') : $('#download-create')).focus(); }
    }
  }
  function save() {
    if (!result) return;
    const { name, type, bytes } = result.download;
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status(`${name} downloaded · Save OPF to keep your original editable source`);
  }
  function close() {
    controller?.abort();
    token++;
    dialog.close();
  }
  button.addEventListener('click', () => {
    if (getCanvas() && !getCanvas().commit()) return;
    dialog.querySelector('input[name="download-slides"][value="all"]').checked = true;
    reset();
    running(false);
    dialog.showModal();
    $('#download-create').focus();
  });
  for (const input of dialog.querySelectorAll('input,select')) input.addEventListener('change', () => { if (!controller) reset(); });
  $('#download-create').addEventListener('click', create);
  $('#download-save').addEventListener('click', save);
  $('#download-cancel').addEventListener('click', () => controller?.abort());
  $('#download-close').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  return { open: () => button.click(), close, exportFileName };
}
