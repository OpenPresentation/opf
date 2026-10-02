// RR-29: the playground's Review tab. It mounts the Review panel from the package (src/review-panel.js) over the
// playground's editor session: go-to selects the slide and the content on the canvas, the alt-text fix is typed in
// the panel, and the panel re-audits whenever the playground has redrawn (so fonts are loaded and the audit uses
// the same text measurement as the preview).
import { createReviewPanel } from '../src/review-panel.js';
import { auditAvailable } from '../src/review.js';

export function installReviewControls({ editor, getSlideIndex, goTo, openProperties, focusContentField, status, measurementFor }) {
  const tab = document.getElementById('tab-review');
  const host = document.getElementById('review-controls');
  if (!tab || !host) return undefined;
  if (!auditAvailable()) {
    tab.hidden = true;
    return undefined;
  }
  const panel = createReviewPanel(host, {
    editor,
    getSlideIndex,
    // The audit measures text with the playground's fonts, script-aware per slide, exactly as the preview does.
    getAuditOptions: (deck) => ({ textMeasurement: (index) => measurementFor(deck, index) }),
    // The playground redraws (after its fonts are loaded) and then calls refresh(); auditing earlier would measure unloaded faces.
    autoRefresh: false,
    onGoTo: ({ finding, target }) => {
      if (target.slide === null) openProperties(target.pointer);
      else goTo(target.slide, target.path);
      status(`${finding.message}`);
    },
    onFocusField: ({ fix, target }) => {
      if (target.slide === null || fix.focus?.field === 'language') openProperties(fix.focus?.path ?? target.pointer);
      else focusContentField();
    },
    onStatus: (message) => status(message),
    onChange: ({ total, unavailable }) => {
      tab.textContent = !unavailable && total ? `Review (${total})` : 'Review';
      tab.setAttribute('aria-label', !unavailable && total ? `Review, ${total} finding${total === 1 ? '' : 's'}` : 'Review');
    },
  });
  return panel;
}
