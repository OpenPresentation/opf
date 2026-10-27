---
type: fixed
packages: [editor]
---
Every method of the `createOpfEditor` handle now works before the editor has mounted (#912). `setDensity` rebuilt the slide row while the slide chunk (`workspace-parts.js`, loaded on demand since 0.29.0) was still loading and threw `createSlideNavigator is not a function`, which crashed a React host whose `density` prop settled in the first effects (the Playground on a phone); the density, export mode, view, read-only state and file name chosen before the mount were also overwritten by the options when the parts mounted. Settings made before the mount are now kept and used by it, and calls that act on a part (`select`, `goTo`, `showPanel`, `focus`, `openFind`, `present`, and the Studio's `setLayout`, `setZoom`, `fit`, `openLayout` and `commands.register`) are queued and run once the editor is mounted.
