# RR-105: require the Gallery consumer identity

Root review found that the first driver validator required only four engines. Both installed reports and proofs could omit Gallery and still compare, despite the matrix consuming its catalog. Make all five package identities mandatory and add removal controls for each, including symmetric removal from both hosts and Gallery-only omission from both driver proofs.

This is a normal follow-up to active/unfolded PR1239, based on3723f497ec4002e33c749a0ac486caaea3d95b9d. The original bf0096079 full033 run, raw evidence and earlier heads remain unchanged. The actual published set already contains all five packages. The executed matrix driver and list factory Git blobs remain exactbf; no57-deck rerun occurs. Affected provenance tests and the maintained scoped check remain pending. Original15PASS/5RED local aggregate is preserved; no hydration or global Git configuration change is authorized.
