---
type: changed
packages: [opf, editor]
---
RR-117: the editor's review reuses slide composition when only the selected slide, an unreferenced presentation name or an unrelated slide changed, while still running every validation rule; the review panel adds `whenIdle()`, and a failed resource preparation clears the reused data.
