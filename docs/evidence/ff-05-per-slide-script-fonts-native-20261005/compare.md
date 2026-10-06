# FF-05 per-slide script fonts (opf-pptx#168): native read

- Every deck opens without a repair prompt and reads stage: done.
- Presentation.Fonts lists no empty name and nothing outside expect.fonts (the families the deck names); the accepted RR-05 reading is that PowerPoint may omit theme-only script families.
- after decks: on every slide the runs holding expect.script read expect.slot (NameFarEast or NameComplexScript) = expect.family, and the slide uses master expect.master (Designs order).
- before decks (a, a2): expected to FAIL the per-slide check from slide 2 on (they read slide 1's family): the opf-pptx#168 baseline.
- b-single-profile: before and after are byte-identical (same sha256) and read the same.

| Deck | Result | Problems | Read |
| --- | --- | --- | --- |
| a-three-profiles-before | BASELINE (expected fail) | slide 2: nameComplexScript reads "+mn-cs", expected "Traditional Arabic"<br>slide 3: nameComplexScript reads "+mn-cs", expected "Nirmala UI" | slide 2 notes ea/cs Meiryo/+mn-cs<br>fonts ["Meiryo"]<br>designs 1:Office Theme ea=Meiryo cs= |
| a-three-profiles-after | PASS |  | slide 2 notes ea/cs Meiryo/+mn-cs<br>fonts ["Meiryo"]<br>designs 1:Office Theme ea=Meiryo cs=; 2:1_Office Theme ea=Meiryo cs=Traditional Arabic; 3:2_Office Theme ea=Meiryo cs=Nirmala UI |
| a2-thai-repro-before | BASELINE (expected fail) | slide 2: nameComplexScript reads "Angsana New", expected "DilleniaUPC" | fonts ["Angsana New","DilleniaUPC"]<br>designs 1:Classic ea=Angsana New cs=Angsana New |
| a2-thai-repro-after | PASS |  | fonts ["Angsana New","DilleniaUPC"]<br>designs 1:Classic ea=Angsana New cs=Angsana New; 2:1_Classic ea=Angsana New cs=DilleniaUPC |
| b-single-profile-before | PASS |  | slide 1 notes ea/cs Meiryo/+mn-cs<br>fonts ["Aptos Display","Aptos","Georgia","Meiryo"]<br>designs 1:Office Theme ea=Meiryo cs= |
| b-single-profile-after | PASS |  | slide 1 notes ea/cs Meiryo/+mn-cs<br>fonts ["Aptos Display","Aptos","Georgia","Meiryo"]<br>designs 1:Office Theme ea=Meiryo cs= |
| b-single-profile before = after | PASS | byte-identical files (sha256 b09a366fd1e3); native reads equal | |
| c-mixed-default-after | PASS |  | slide 1 notes ea/cs Meiryo/+mn-cs<br>slide 3 notes ea/cs Meiryo/+mn-cs<br>fonts ["Aptos Display","Aptos","MS Mincho"]<br>designs 1:Office Theme ea=Meiryo cs=; 2:1_Office Theme ea=MS Mincho cs= |
