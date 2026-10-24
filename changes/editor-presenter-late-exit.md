---
type: fixed
packages: [editor]
---
Presenter: a late full screen exit from an earlier presenter no longer ends a newer presentation. A presenter closed before the browser answered its full screen request exits full screen when that request resolves, which can be after the next presenter took full screen; the browser then ended that one too, and it read the event as the user leaving full screen and closed (`onExit` without anyone pressing a key). The "leaving" flag was one per presenter instance; the exits presenters ask for are now counted per document and any presenter reads the `fullscreenchange` that answers one of them as an exit it asked for, so the newer presentation carries on (as the overlay when it lost full screen). Case: `presenter-browser.mjs`, "an exit an earlier presenter asked for late does not end the next presentation".
