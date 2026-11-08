# RR-105: separate Roboto Mono qualification profile

The mixed-code qualification inputs in PR #1203 request Roboto Mono. The
coordinator's fresh Windows GDI+ probe found it absent. This branch prepares a
separate bounded profile; it has not installed fonts or run Office.

Vetoable decision: keep the existing seven-face Roboto profile and helper
unchanged, and add only the two renderer-pinned Roboto Mono upright faces from
`@expo-google-fonts/roboto-mono` 0.4.2. This avoids changing the exact helper
identity needed to clean up the coordinator's existing owned Roboto profile.
The source manifest and literal profile pins agree on family, weight, style,
file bytes, OFL-1.1 notice and license hash. No arbitrary font selector exists.

The profile ID is `opf-native-roboto-mono-0.4.2-400-700-v1`. The generator seals
the exact new setup helper and existing read-only probe SHA-256 values. Setup,
Check and Cleanup bind those exact tool identities; the coordinator must retain
the reviewed helper and probe until cleanup. A new private state directory
under the current user's LocalApplicationData owns the two copied files and
distinct `OPF Native Mono` registry values. The existing per-user font mutex
serializes this helper with the old Roboto helper.

Setup refuses an already installed Roboto Mono identity, including style/case
variants. Existing Roboto and other families are permitted. Every write is
journaled first. Check verifies owned bytes, registry paths, exact suite/tool
identity and fresh-process family availability. Cleanup checks every owned
file and registry value before removing anything, refuses changed state, and
preserves the journal, unrelated files/values and any pre-existing shared key.
There is no Office automation, elevation, machine registry, font-directory
mutation, arbitrary process termination or modification of the sealed seven
mixed-code PPTX inputs.

Coordinator procedure after independent review:

```powershell
node scripts/native-acceptance/roboto-mono-fonts.mjs --out C:/opf-work/mono-profile-final
$monoState = Join-Path $env:LOCALAPPDATA 'OPF/qualification-mono-01'
powershell.exe -NoProfile -NonInteractive -File scripts/native-acceptance/setup-roboto-mono-windows.ps1 -Action Setup -SuiteDirectory C:/opf-work/mono-profile-final -StateDirectory $monoState
powershell.exe -NoProfile -NonInteractive -File scripts/native-acceptance/setup-roboto-mono-windows.ps1 -Action Check -SuiteDirectory C:/opf-work/mono-profile-final -StateDirectory $monoState
# Only the coordinator runs the separately reviewed native mixed-code batch.
powershell.exe -NoProfile -NonInteractive -File scripts/native-acceptance/setup-roboto-mono-windows.ps1 -Action Cleanup -StateDirectory $monoState
```

Use the unchanged old helper and its original receipt for eventual cleanup of
the seven-face Roboto profile. This helper cannot clean another profile.

The first focused run passed all 20 tests: literal pin/refusal/generator tests,
the actual Windows PowerShell mocked lifecycle, and unchanged Roboto controls
including a fresh read-only family probe. The mock lifecycle covers altered
package/version/license/family/style/hash/tool/profile, changed input bytes,
traversal, duplicate faces, pre-existing Mono refusal, existing Roboto
coexistence, changed ownership refusal and exact owned/idempotent cleanup.
Its mutation APIs and registry objects are mocks; this is not native font
installation or PowerPoint acceptance. Required mapped checks and final sealed
input/tool hashes will be recorded before the final push.
