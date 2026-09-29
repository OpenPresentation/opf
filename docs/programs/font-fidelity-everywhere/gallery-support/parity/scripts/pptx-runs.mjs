// Text-bearing run elements of a DrawingML paragraph (`<a:p>` inner XML). Both `a:r` (a plain run) and `a:fld` (a
// field such as `<a:fld id="{...}" type="slidenum">`, whose `a:t` holds the rendered value, for example "1") carry
// text. `a:fld` always has attributes, so the open tag is matched with `\b[^>]*>`: `<a:r>` and `<a:fld ...>` match;
// `<a:rPr ...>` does not (no word boundary after `r`), and a self-closed `<a:fld .../>` has no content to read.
// Returns [{tag: 'r' | 'fld', attrs: '<open tag attributes>', inner}] in document order.
export const RUN_ELEMENT = /<a:(r|fld)\b([^>]*?)(?<!\/)>(.*?)<\/a:\1>/gs;
export const runElements = paragraphXml => [...String(paragraphXml).matchAll(RUN_ELEMENT)].map(m => ({tag: m[1], attrs: m[2], inner: m[3]}));
