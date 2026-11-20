// The lazy build of the diagram engine: the `browser`, `workerd`, `worker` and `edge-light` conditions of `#diagram-engine`
// (package.json "imports"). A page or a Worker loads pele's core (about 15 KB gzipped) with core, and each diagram type (13 to 54 KB
// gzipped) the first time a deck draws one: pele's lazy entry imports the type's module, which a bundler splits into a chunk of its own,
// or leaves out of a Worker that never calls ensureDiagrams, so a host that draws no diagram does not carry the diagram types.
// `ensureDiagrams` loads the types a deck uses; the renderer's browser fonts handle calls it from `ensure` and opf-pptx's `toPptx` before
// it composes.
export { PeleError, detectType, parse, registered, render, load as loadDiagramType } from 'pele/lazy';

// SH-13: OPF's PlantUML reader (about 10 KB gzipped) is a module of its own that a bundler splits into a chunk, loaded the first time a
// deck draws a PlantUML diagram: `ensureDiagrams` loads it, then the pele type the diagram is drawn as. Until then such a diagram is
// loading, as an unloaded pele type is.
import type { plantumlToMermaid } from './diagram-plantuml.js';

let reader: typeof plantumlToMermaid | undefined;
let loading: Promise<boolean> | undefined;

/** The PlantUML reader, or undefined until `loadPlantumlReader` has resolved. */
export const plantumlReader = (): typeof plantumlToMermaid | undefined => reader;

/** Load the PlantUML reader once; later calls return the same promise. */
export function loadPlantumlReader(): Promise<boolean> {
  loading ??= import('./diagram-plantuml.js').then((module) => { reader = module.plantumlToMermaid; return true; });
  return loading;
}
