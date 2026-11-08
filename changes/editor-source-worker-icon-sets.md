---
type: fixed
packages: [editor]
---
The source pane's Web Worker works for a host that registers the gallery's icon sets (`catalogs: [gallery, galleryIconSets]`). The catalogs were posted as they are, and their icon-set loader functions made `postMessage` throw a `DataCloneError`, so every text check fell back to the main thread and `onError` was called. The worker now receives the catalogs as cloneable data (a loader function is replaced by the set's id, which is all the format and catalog-reference checks use), and its answers equal the main thread's.
