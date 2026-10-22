# Canonical mixed-table source

`source.pptx` is the exact existing source fixture from the accepted
[core109 evidence](https://github.com/OpenPresentation/opf/blob/b2711549eba48a52f036afd02ee52b761fa0a5f9/docs/evidence/windows-native-mixed-table-20260921/native-run/inputs/table-fixture/source.pptx).
Its SHA-256 is
`f92c5d5565afa1d03fc6df0cdc8d482771d5ebd5a5403f7a888f75e2ad020a51`.
It contains no embedded font programs.

Offline directory controls use this file to exercise the real source-hash gate
without requiring a separate core checkout or accepting a synthetic hash.
Synthetic reports used by those controls are test data, not a new Office run.
The historical native content/style and outer-geometry observations retain
their original scope; this copy does not establish edit/save/reopen or preview
fidelity.
