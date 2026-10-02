// RR-25: the playground's Find and replace. It mounts the package's find panel (src/find-panel.js) over the playground's
// editor session and canvas, adds a Find button next to Undo and wires Ctrl/Cmd+F and Ctrl/Cmd+H. A match in speaker notes
// or the presentation name has no canvas target, so going to it focuses and selects the text in the inspector instead.
import { createFindPanel, installFindShortcuts } from '../src/find-panel.js';

export function installFindControls({ editor, getCanvas, getSlideIndex, goToSlide, status, showPanel }) {
  const host = document.createElement('div');
  host.className = 'find-host';
  host.id = 'find-host';
  document.querySelector('.canvas-toolbar').after(host);
  const button = document.createElement('button');
  button.id = 'find-open';
  button.className = 'secondary';
  button.type = 'button';
  button.textContent = 'Find';
  button.title = 'Find and replace · Ctrl/Cmd F, Ctrl/Cmd H';
  button.setAttribute('aria-keyshortcuts', 'Control+F Meta+F Control+H');
  button.setAttribute('aria-controls', 'find-host');
  button.setAttribute('aria-expanded', 'false');
  document.getElementById('undo').before(button);

  const panel = createFindPanel(host, {
    editor,
    canvas: () => getCanvas(),
    getSlideIndex,
    goToSlide,
    getSelectionText() {
      const active = document.activeElement;
      if (active && /^(TEXTAREA|INPUT)$/.test(active.tagName) && active.selectionStart !== active.selectionEnd && !host.contains(active)) return active.value.slice(active.selectionStart, active.selectionEnd);
      const text = window.getSelection?.().toString();
      return text || undefined;
    },
    onGoTo(match, selected, { via }) {
      if (selected) return;
      // Nothing on the canvas to select: put the text where it lives.
      if (match.kind === 'notes') {
        showPanel?.('content');
        const notes = document.getElementById('notes');
        if (via === 'list') notes.focus();
        notes.setSelectionRange(match.start, match.end);
        notes.scrollIntoView({ block: 'nearest' });
      } else if (match.slideIndex < 0 && match.path === 'name') {
        const name = document.getElementById('document-name');
        if (via === 'list') name.focus();
        name.setSelectionRange(match.start, match.end);
      }
    },
    onStatus: (message, { error } = {}) => status(error ? message : message),
    onClose() { button.setAttribute('aria-expanded', 'false'); host.hidden = true; },
  });
  host.hidden = true;
  const open = (options) => {
    host.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    panel.open(options);
  };
  button.addEventListener('click', () => (panel.isOpen ? panel.close() : open({})));
  installFindShortcuts({ open, element: panel.element, get isOpen() { return panel.isOpen; } });
  return { panel, open, close: () => panel.close() };
}

// The panel sits under the canvas toolbar; a phone shows it as a sheet (see mobile-controls.js).
const style = document.createElement('style');
style.textContent = '.find-host{padding:8px 12px 0}.find-host[hidden]{display:none}.find-host .opf-find{max-width:none}';
document.head.append(style);
