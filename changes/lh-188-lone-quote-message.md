---
type: changed
packages: [opf]
---
LH-188 (output-changing for slides whose message is one quote): a one-message quote's body balances its lines as a heading does, so a growing quote no longer stops at the quote display size because its last line would be a stub ("help." alone); a quote of up to 12 characters ("Simple.") grows up to 115 px, as a short statement does. The one quote of a `quote` slide on a landscape canvas, with no subtitle, is its message under any title, so it grows to the ceiling its length allows (115, 86, 72 and 56 px up to 12, 30, 60 and 120 characters) instead of stopping at 56 px. Longer quotes and quotes among other blocks keep their sizes.
