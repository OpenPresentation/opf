import type {ComposedFlow, Composition} from '@openpresentation/opf/composition';
import type {JsonPatchOperation} from './index.js';
/** Resize adjacent tracks. Fractions clamp to 5–95%; automatic flows become explicit grids. */
export declare function prepareTrackResize(document:unknown,flow:ComposedFlow,boundary:number,fraction:number):{
  document:unknown;patches:JsonPatchOperation[];composition:Composition;fraction:number;
};

export {prepareBlockMove,listBlockContainers,prepareBlockInsert,prepareBlockDuplicate,prepareBlockRemove,createContentBlock} from './blocks.js';

export type {PreparedBlockChange,ContentBlockKind} from './blocks.js';
