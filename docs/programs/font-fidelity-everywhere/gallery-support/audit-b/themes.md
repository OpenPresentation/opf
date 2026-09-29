# Themes: 4 values

Classification: **partial** 4

Schema-valid 4/4. Catalog id resolves in core 4/4.

## Top reasons

| count | reason |
|---|---|
| 4 | scheme slot colours written as literal srgbClr (..): .. |
| 3 | no bundled or substitute face: .. |
| 1 | preview needs office-pack substitution (..), Aptos->Carlito(..)); export with that registry writes Aptos Display/Aptos |

| id | valid | catalog | engine effect | reasons | class |
|---|---|---|---|---|---|
| minimal | true | true | bg preview 011842/export 011842 (expected 011842); fonts Aptos Display/Aptos; theme-only doc applies bundle: true | scheme slot colours written as literal srgbClr (2 uses): FFFFFF=light1; preview needs office-pack substitution (Aptos Display->Carlito(visual), Aptos->Carlito(visual)); export with that registry writes Aptos Display/Aptos | partial |
| classic | true | true | bg preview FFFFFF/export FFFFFF (expected FFFFFF); fonts Tenorite Display/Tenorite; theme-only doc applies bundle: true | scheme slot colours written as literal srgbClr (2 uses): 000000=dark1; no bundled or substitute face: strict preview throws font-unavailable (Tenorite Display); host-font preview is unmeasured fallback | partial |
| dark | true | true | bg preview 000000/export 000000 (expected 000000); fonts Seaford Display/Seaford; theme-only doc applies bundle: true | scheme slot colours written as literal srgbClr (2 uses): FFFFFF=light1; no bundled or substitute face: strict preview throws font-unavailable (Seaford Display); host-font preview is unmeasured fallback | partial |
| bold | true | true | bg preview FFFFFF/export FFFFFF (expected FFFFFF); fonts Impact/Grandview; theme-only doc applies bundle: true | scheme slot colours written as literal srgbClr (2 uses): 000000=dark1; no bundled or substitute face: strict preview throws font-unavailable (Impact); host-font preview is unmeasured fallback | partial |
