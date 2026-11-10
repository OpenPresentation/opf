import {fileURLToPath} from 'node:url';
export const RUNTIMES = Object.freeze({
  control: {root:'C:/opf-work/replay-control',head:'276f339a68069dc11970d649092d6181c9feba38',runtime:'d2edd18ced67ea8370ae2d03f5f954d91ff9cb6e'},
  candidate: {root:'C:/opf-work/replay-values',head:'b7bd3e8fe070f50160823479c2182d6d99fba1cc',runtime:'de1015ba743dae7561652c9329bfd001c3bdc0d0'},
});
export const INPUT_ROOT=fileURLToPath(new URL('./inputs/',import.meta.url));
export const ORDER=Object.freeze([[16,'control'],[16,'candidate'],[36,'control'],[36,'candidate'],[48,'control'],[48,'candidate'],[48,'candidate'],[48,'control'],[36,'candidate'],[36,'control'],[16,'candidate'],[16,'control']]);
export const CHILD_TIMEOUT_MS=60000;
export const FACE_KEYS=Object.freeze(['Intos/400/false','Intos/700/false','Intos Display/700/false'].sort());
export const COPY_NAMES=['fonts-node.js','font-demand.js','font-registry.js','font-selection.js','font-selection-metadata.js','font-manifest.js','script-fonts.js','script-font-pack.js','lazy-font-list.js','lazy-fonts.js','svg.js','index.js','hb-shape.js','font-subset.js'];
export const CANDIDATE_COPY_NAMES=['font-preparation-context.js','font-preparation-replay.js'];
export const REPLAY_DELTA=Object.freeze(['packages/render/src/font-demand.js','packages/render/src/font-preparation-context.js','packages/render/src/font-preparation-replay.js','packages/render/src/lazy-fonts.js'].sort());
