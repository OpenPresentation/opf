---
type: fixed
---
RR-20: the playground batches missing slide thumbnails through one whole-deck renderer resolution, so applying a long deck avoids composing it once per thumbnail. Cache invalidation includes inherited deck metadata and registered catalogs; hidden slides and individual preview errors keep their existing behavior. This changes the example app only, not the editor library.
