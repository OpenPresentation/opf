# RR20 CodeMirror fixture directory links

Fresh main9545016583ccfa151077cda4d51043ac6505a140 has the exact same duplicate-CodeMirror fixture bytes as the approved034integration (SHA25682dd8377fec7c11739b1eac46424d761c8bcbcf7e93767b2b11ab2c2642e6412). The unchanged actual Windows Node24test fails at the first directory symlink with EPERM; its raw failure is preserved.

Vetoable decision: these four dependencies are directories, so request a junction on win32 and keep the existing dir symlink on other platforms. Assert that each target is a directory and that each created link resolves to that exact shared dependency. The real second view copy, all foreign-plugin/isolation/once-per-page assertions and temporary cleanup remain; there is no skip, privilege fallback, dependency, production code or generic link helper change.

Focused actual Windows test and the required mapped check are recorded in receipt.json after completion. Cross-platform full-ci belongs to the assembled034OS-specific wave, with no additional source watcher while the three-site observer4057 is active.

Verification: the actual corrected Windows test passes, and the required changed-scope run takes 79.2 seconds: eight steps pass, typecheck is intentionally unselected, and two checks initially fail on omitted sparse inputs. Seven exact Git blobs restore those inputs; text then passes. Gallery controls pass 17/18, preserving the strict freshness failure. An unchanged-main burndown control produces byte-identical expected tracker output and the same drift in this sparse checkout, proving this fixture/notes change did not cause it. No tracker is regenerated and stale policy is never overridden. Complete before/after, selected logs and immutable identities are in receipt.json.
