// RR-33: the playground's "List numbering" dialog. It mounts the numbering panel from the package
// (src/numbering-panel.js) over the playground's editor session: number a list, pick the style, start and
// suffix (per level if wanted), restart the count at the selected entry. Every change is one undoable edit.
import { createNumberingPanel } from '../src/numbering-panel.js';
import { numberingAvailable } from '../src/numbering.js';

export function installNumberingControls({ editor, getCanvas, getSlideIndex, getSelectedPath, status }) {
  if (!numberingAvailable()) return;
  const button = document.createElement('button');
  button.id = 'list-numbering';
  button.textContent = 'List numbering';
  button.className = 'quiet';
  button.title = 'Number the selected list, or any list on the slide';
  document.querySelector('.header-actions').prepend(button);
  const dialog = document.createElement('dialog');
  dialog.id = 'numbering-dialog';
  dialog.setAttribute('aria-labelledby', 'numbering-title');
  dialog.innerHTML = '<div class="dialog-header"><div><h2 id="numbering-title">List numbering</h2><p>Number a list instead of bulleting it. PowerPoint gets native numbers.</p></div><button id="numbering-close" aria-label="Close list numbering">×</button></div><div id="numbering-panel-host" class="numbering-inputs"></div>';
  document.body.append(dialog);
  const host = dialog.querySelector('#numbering-panel-host');
  let panel;

  button.addEventListener('click', () => {
    if (getCanvas() && !getCanvas().commit()) return;
    panel?.destroy();
    panel = createNumberingPanel(host, {
      editor,
      getSlideIndex,
      getTarget: getSelectedPath,
      onStatus: (message) => status(message),
    });
    dialog.showModal();
    dialog.querySelector('input,select,button')?.focus();
  });
  function close() {
    dialog.close();
    panel?.destroy();
    panel = undefined;
  }
  dialog.querySelector('#numbering-close').addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  return { open: () => button.click(), close };
}
