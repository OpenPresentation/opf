// The eager build of the diagram engine: the `default` condition of `#diagram-engine` (package.json "imports"). pele's full entry
// registers every diagram type when it loads, so Node, Bun and Deno lay out and draw any diagram synchronously and nothing is ever
// pending.
export { PeleError, detectType, parse, registered, render } from 'pele';

/** Load a diagram type: every type is already registered here. */
export const loadDiagramType = async (_type: string): Promise<boolean> => true;
