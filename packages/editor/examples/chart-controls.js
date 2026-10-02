// RR-35: the playground's chart options panel. It mounts under the selection controls and shows axis titles, the
// legend position and data labels for the selected chart; each control is one undoable edit.
import { createChartOptionsPanel } from '../src/chart-options-panel.js';
import { chartOptionsAvailable } from '../src/chart-options.js';

export function installChartControls({ editor, getSelectedPath, status }) {
  if (!chartOptionsAvailable()) return;
  const anchor = document.getElementById('selection-controls');
  if (!anchor) return;
  const host = document.createElement('div');
  host.id = 'chart-controls';
  anchor.after(host);
  const panel = createChartOptionsPanel(host, { editor, getSelectedPath, onStatus: (message) => status(message) });
  // The selection moves through the playground's own `select()`, which rewrites the source-location path.
  const path = document.getElementById('path');
  if (path) new MutationObserver(() => panel.refresh()).observe(path, { childList: true, characterData: true, subtree: true });
  return panel;
}
