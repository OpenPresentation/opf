# FF-05 per-slide script fonts (opf-pptx#168): native read

- Every deck opens without a repair prompt and reads stage: done.
- Presentation.Fonts lists no empty name and nothing outside expect.fonts (the families the deck names); the accepted RR-05 reading is that PowerPoint may omit theme-only script families.
- after decks: on every slide the runs holding expect.script read expect.slot (NameFarEast or NameComplexScript) = expect.family, and the slide uses master expect.master (Designs order).
- b-single-profile: one script profile, so one master; no before file exists in this pass (the 0.12 before = after byte-identity check is not repeated).

| Deck | Result | Problems | Read |
| --- | --- | --- | --- |
| a-three-profiles-after | PASS |  | slide 2 notes ea/cs Meiryo/+mn-cs<br>fonts ["Meiryo"]<br>designs 1:Office Theme ea=Meiryo cs=; 2:1_Office Theme ea=Meiryo cs=Traditional Arabic; 3:2_Office Theme ea=Meiryo cs=Nirmala UI |
| a2-thai-repro-after | PASS |  | fonts ["Angsana New","DilleniaUPC"]<br>designs 1:Classic ea=Angsana New cs=Angsana New; 2:1_Classic ea=Angsana New cs=DilleniaUPC |
| b-single-profile-after | PASS |  | slide 1 notes ea/cs Meiryo/+mn-cs<br>fonts ["Aptos Display","Aptos","Georgia","Meiryo"]<br>designs 1:Office Theme ea=Meiryo cs= |
| c-mixed-default-after | PASS |  | slide 1 notes ea/cs Meiryo/+mn-cs<br>slide 3 notes ea/cs Meiryo/+mn-cs<br>fonts ["Aptos Display","Aptos","MS Mincho"]<br>designs 1:Office Theme ea=Meiryo cs=; 2:1_Office Theme ea=MS Mincho cs= |
