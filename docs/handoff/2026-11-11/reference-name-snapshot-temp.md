# Reference Name snapshot test-owned temp paths

SOURCE ONLY; prospective test repair UNRUN. Base `79cdb85d6ab8a58dde5d474e254cffa027735c51`.

Preserve Windows witness43157898641/job130982004362: browser36.839sPASS, Office-free Node9tests8PASS/1FAIL/0skip. The first private adapter positive throws `Canonical local postflight path required` at reference-name-snapshot-check.ps1:75; no complete32 result exists. Original failure evidence remains `/tmp/opf-worker-flight-windows-review01/payload`. This is not native Office acceptance.

The test-owned temp root was created under the actual `C:\Users\RUNNER~1\...` TEMP spelling and passed through ordinary fs.realpathSync. Retained completion.request.output has that spelling; five of eight adapter admission file records also carry it (the other three are controller files). No control characters, forward slashes or UNC prefixes occur in those paths. Read-FurniturePostflightEvidence first applies the unchanged strict canonical guard to AdmissionFile, before identity/readiness/observer IO. It rejects when .NET Framework Path.GetFullPath differs from its input. Microsoft reference source explicitly expands short-name components; this supports the cause, but exact normalization of this retained path was not executed/probed here.

Use fs.realpathSync.native only for this newly created test-owned temp root. Leave the separate repository ROOT calculation unchanged. The lexical and native-canonical completion.json spellings must have equal BigInt device/file identities. Record only lexicalSpellingDiffers/sameOwnedFixture facts; no fake8.3 path or claim from an ordinary long-TEMP pass. TEMP/TMP/cwd and every PowerShell/default/worker/kernel/path guard stay unchanged.

All original fixture archives/action modes, source/raw/public-model assertions, three managed rosters, hashes,15-second child deadline, observer/query-count checks and noOffice claims remain exact. Only this test and dated note/progress change; no production normalization/fallback, archive bytes or failed result is rewritten. Actual Windows validation-only9Node/32managed qualification remains owed; the already passed browser witness must not be repeated. Mac skips cannot qualify this boundary.

Primary source: [Microsoft .NET Framework Path normalization](https://github.com/microsoft/referencesource/blob/main/mscorlib/system/io/path.cs) (GetFullPathInternal and TryExpandShortFileName); [documented GetFullPath short-name expansion](https://learn.microsoft.com/en-us/dotnet/api/system.io.path.getfullpath).
