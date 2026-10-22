---
type: fixed
---
RR-98: closing the presenter before the browser answered its full screen request no longer leaves the page in full screen behind a hidden presentation. A quick Esc or close, or F5 followed straight by Esc, ran `stop()` while the request was still pending, so there was no full screen to leave; the request then resolved and the page stayed full screen with nothing shown (and, in Chromium on macOS, the window stuck in a state where the page took no clicks until the next exit). The presenter now exits full screen as soon as a late request resolves for a presentation that was already closed, and returns focus to the opener afterwards.
