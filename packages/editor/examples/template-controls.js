// RR-32: the playground's "Fill template" dialog. It mounts the Fill template panel from the package
// (src/template-panel.js) over the playground's editor session, draws the live preview through the
// playground's fonts handle, and fills the deck as one undoable edit.
import { toSvg } from '@openpresentation/opf-render/svg';
import { whenFontsReady } from '../src/font-gate.js';
import { createTemplatePanel } from '../src/template-panel.js';
import { hasTemplateVariables, previewTemplate } from '../src/templates.js';

export function installTemplateControls({ editor, getCanvas, getSlideIndex, getSelectedPath, setSlideIndex, status, fonts }) {
  const button = document.createElement('button');
  button.id = 'fill-template';
  button.textContent = 'Fill template';
  button.className = 'quiet';
  button.title = 'Fill the presentation\'s variables with your own content';
  document.querySelector('.header-actions').prepend(button);
  const dialog = document.createElement('dialog');
  dialog.id = 'template-dialog';
  dialog.setAttribute('aria-labelledby', 'template-title');
  dialog.innerHTML = `<div class="dialog-header"><div><h2 id="template-title">Fill template</h2><p>Type values for the variables, check the preview, then fill the presentation. One undo restores the template.</p></div><button id="template-close" aria-label="Close fill template">×</button></div><div class="template-split"><div id="template-panel-host" class="template-inputs"></div></div>`;
  document.body.append(dialog);
  const host = dialog.querySelector('#template-panel-host');
  let panel;
  let previewRun = 0;

  // The preview draws the template with the typed values; fonts for the filled text load first.
  function renderPreview({ presentation: source, variables, slideIndex }) {
    const run = ++previewRun;
    return new Promise((resolve, reject) => {
      const filled = previewTemplate(source, variables).presentation;
      const draw = () => resolve(toSvg(source, slideIndex + 1, { catalogs: editor.catalogs, fonts, text: 'system', variables, trace: false }));
      whenFontsReady(fonts, filled, { renderOptions: { catalogs: editor.catalogs }, isCurrent: () => run === previewRun, loading() {}, ready: draw, failed: reject });
    });
  }

  function selectionTarget() {
    const path = getSelectedPath();
    if (!path) return undefined;
    const field = document.getElementById('value');
    const value = editor.get(path);
    // The inspector's text box holds the selected field; its selection is where a token goes.
    if (typeof value === 'string' && field && document.getElementById('path')?.textContent === path) return { path, start: field.selectionStart ?? undefined, end: field.selectionEnd ?? undefined };
    return { path };
  }

  button.addEventListener('click', () => {
    if (getCanvas() && !getCanvas().commit()) return;
    panel?.destroy();
    panel = createTemplatePanel(host, {
      editor,
      renderPreview,
      getSlideIndex,
      getTarget: selectionTarget,
      onStatus: (message) => status(message),
      onApply: () => status('Filled the presentation. Undo restores the template.'),
    });
    dialog.showModal();
    dialog.querySelector('input,textarea,select,button')?.focus();
  });
  function close() {
    dialog.close();
    panel?.destroy();
    panel = undefined;
  }
  dialog.querySelector('#template-close').addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  // A template deserves a visible entry point: mark the button when the deck has variables to fill.
  const mark = () => button.toggleAttribute('data-has-variables', hasTemplateVariables(editor.presentation));
  editor.subscribe(mark);
  mark();
  return { open: () => button.click(), close };
}
