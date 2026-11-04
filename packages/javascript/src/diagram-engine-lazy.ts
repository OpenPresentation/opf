// The lazy build of the diagram engine: the `browser` condition of `#diagram-engine` (package.json "imports"). A page loads pele's
// core (about 15 KB gzipped) with core, and each diagram type (13 to 54 KB gzipped) the first time a deck draws one: pele's lazy
// entry imports the type's module, which a bundler splits into its own chunk. `ensureDiagrams` loads the types a deck uses; the
// renderer's browser fonts handle calls it from `ensure`, so every gate that waits for fonts waits for diagrams too.
export { PeleError, detectType, parse, registered, render, load as loadDiagramType } from 'pele/lazy';
