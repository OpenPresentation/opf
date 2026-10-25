---
type: fixed
packages: [editor]
---
The presenter no longer loses full screen, or reads the user's Esc as its own exit, when a presentation is closed and opened again quickly: a closed presenter whose full screen request is answered after a newer one asked no longer requests an exit that would end the newer full screen (a refused newer request gives the screen back instead), the exits the presenters asked for are matched to their `fullscreenchange` by order instead of a 500 ms timer so an Esc right after is the user's, and focus returns to the opener even when the browser refuses the exit or reports the end of full screen after the exit settled.
