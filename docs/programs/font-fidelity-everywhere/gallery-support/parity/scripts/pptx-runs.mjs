// Text-bearing run elements of a DrawingML paragraph (`<a:p>` inner XML). Both `a:r` (a plain run) and `a:fld` (a
// field such as `<a:fld id="{...}" type="slidenum">`, whose `a:t` holds the rendered value, for example "1") carry
// text. `a:fld` always has attributes, so the open tag is matched with `\b[^>]*>`: `<a:r>` and `<a:fld ...>` match;
// `<a:rPr ...>` does not (no word boundary after `r`), and a self-closed `<a:fld .../>` has no content to read.
// Returns [{tag: 'r' | 'fld', attrs: '<open tag attributes>', inner}] in document order.
export const RUN_ELEMENT = /<a:(r|fld)\b([^>]*?)(?<!\/)>(.*?)<\/a:\1>/gs;
export const runElements = paragraphXml => [...String(paragraphXml).matchAll(RUN_ELEMENT)].map(m => ({tag: m[1], attrs: m[2], inner: m[3]}));

// Owner default 2026-09-30: a native slide-number field plus its adjacent literal text runs counts as one run when the
// combined text equals the preview text (for example "{current} / {total}" is `<a:fld>2</a:fld><a:r> / 2</a:r>`: PowerPoint
// keeps a field's text out of a plain run, so the preview's single "2 / 2" line is two elements). The caller has already required
// the combined line text to be equal, and compares every character's style, so only the run count is folded here: a run that is a
// slide-number field and the runs directly before and after it form one logical run. `runs` are [{field: boolean}] in document order (a date field is not folded).
export const logicalRunCount = runs => {
  let count = 0;
  runs.forEach((run, i) => {
    const glued = i > 0 && (run.field || runs[i - 1].field);
    if (!glued) count++;
  });
  return count;
};
