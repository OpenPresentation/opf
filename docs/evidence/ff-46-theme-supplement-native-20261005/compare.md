# FF-46 theme script supplement (opf#375): native read

- Every deck opens without a repair prompt and reads stage: done.
- Presentation.Fonts lists no empty name and nothing outside expect.fonts (the families the deck chose). The accepted RR-05 reading is that PowerPoint may omit theme-only script families.
- after decks: the runs holding the script sample read expect.family in Name; the theme file names expect.themeScript for the script entry (file fact).
- before decks marked changed: expected to FAIL (BASELINE): Presentation.Fonts lists the language default (Nyala or Sylfaen) beside the chosen family. This is the opf#375 defect kept as evidence.
- control decks (changed: false): before and after are byte-identical (same sha256) and read the same.

| Deck | Result | Problems | Read |
| --- | --- | --- | --- |
| ethi-amharic-ebrima-before | BASELINE (expected fail) | Presentation.Fonts lists "Nyala" outside the deck's fonts | fonts ["Ebrima","Nyala"]<br>file Ethi entry major/minor Nyala/Nyala |
| ethi-amharic-ebrima-after | PASS |  | fonts ["Ebrima"]<br>file Ethi entry major/minor Ebrima/Ebrima |
| ethi-amharic-ebrima-inline-before | BASELINE (expected fail) | Presentation.Fonts lists "Nyala" outside the deck's fonts | fonts ["Ebrima","Nyala"]<br>file Ethi entry major/minor Nyala/Nyala |
| ethi-amharic-ebrima-inline-after | PASS |  | fonts ["Ebrima"]<br>file Ethi entry major/minor Ebrima/Ebrima |
| jpan-japanese-msgothic-inline-before | PASS |  | fonts ["MS Gothic"]<br>file Jpan entry major/minor MS Gothic/MS Gothic |
| jpan-japanese-msgothic-inline-after | PASS |  | fonts ["MS Gothic"]<br>file Jpan entry major/minor MS Gothic/MS Gothic |
| jpan-japanese-msgothic-inline before = after | PASS | byte-identical files (sha256 74d38fb6bff1); native reads equal | |
| ethi-amharic-noto-before | BASELINE (expected fail) | Presentation.Fonts lists "Nyala" outside the deck's fonts | fonts ["Noto Sans Ethiopic","Nyala"]<br>file Ethi entry major/minor Nyala/Nyala |
| ethi-amharic-noto-after | PASS |  | fonts ["Noto Sans Ethiopic"]<br>file Ethi entry major/minor Noto Sans Ethiopic/Noto Sans Ethiopic |
| armn-armenian-noto-before | BASELINE (expected fail) | Presentation.Fonts lists "Sylfaen" outside the deck's fonts | fonts ["Noto Sans Armenian","Sylfaen"]<br>file Armn entry major/minor Sylfaen/Sylfaen |
| armn-armenian-noto-after | PASS |  | fonts ["Noto Sans Armenian"]<br>file Armn entry major/minor Noto Sans Armenian/Noto Sans Armenian |
| geor-georgian-noto-before | BASELINE (expected fail) | Presentation.Fonts lists "Sylfaen" outside the deck's fonts | fonts ["Noto Sans Georgian","Sylfaen"]<br>file Geor entry major/minor Sylfaen/Sylfaen |
| geor-georgian-noto-after | PASS |  | fonts ["Noto Sans Georgian"]<br>file Geor entry major/minor Noto Sans Georgian/Noto Sans Georgian |
| ethi-amharic-default-before | PASS |  | fonts ["Aptos Display","Nyala","Aptos"]<br>file Ethi entry major/minor Nyala/Nyala |
| ethi-amharic-default-after | PASS |  | fonts ["Aptos Display","Nyala","Aptos"]<br>file Ethi entry major/minor Nyala/Nyala |
| ethi-amharic-default before = after | PASS | byte-identical files (sha256 b911096de178); native reads equal | |
| ethi-amharic-nyala-before | PASS |  | fonts ["Nyala"]<br>file Ethi entry major/minor Nyala/Nyala |
| ethi-amharic-nyala-after | PASS |  | fonts ["Nyala"]<br>file Ethi entry major/minor Nyala/Nyala |
| ethi-amharic-nyala before = after | PASS | byte-identical files (sha256 2c3be78d23c0); native reads equal | |
| armn-armenian-sylfaen-before | PASS |  | fonts ["Sylfaen"]<br>file Armn entry major/minor Sylfaen/Sylfaen |
| armn-armenian-sylfaen-after | PASS |  | fonts ["Sylfaen"]<br>file Armn entry major/minor Sylfaen/Sylfaen |
| armn-armenian-sylfaen before = after | PASS | byte-identical files (sha256 2957883a7dc1); native reads equal | |
| geor-georgian-sylfaen-before | PASS |  | fonts ["Sylfaen"]<br>file Geor entry major/minor Sylfaen/Sylfaen |
| geor-georgian-sylfaen-after | PASS |  | fonts ["Sylfaen"]<br>file Geor entry major/minor Sylfaen/Sylfaen |
| geor-georgian-sylfaen before = after | PASS | byte-identical files (sha256 c6d9c709b300); native reads equal | |
| latin-english-control-before | PASS |  | fonts ["Aptos Display","Aptos"]<br>file Ethi entry major/minor Nyala/Nyala |
| latin-english-control-after | PASS |  | fonts ["Aptos Display","Aptos"]<br>file Ethi entry major/minor Nyala/Nyala |
| latin-english-control before = after | PASS | byte-identical files (sha256 c08348e6702b); native reads equal | |
