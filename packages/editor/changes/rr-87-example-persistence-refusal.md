---
type: fixed
---
RR-87: the example playground forwards a refused canvas commit to autosave, so an invalid active draft reports a persistence error and still warns before leaving even when the stored document is unchanged. This changes the example host integration only; library APIs and npm payloads are unchanged.
