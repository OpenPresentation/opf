# SH20 offline fixture path spelling

SOURCE ONLY; execution UNRUN. Base `464e70586c617f2c03b1b2d96aab1aa9907bcdd0`.

Preserve the actual e210 FullCI Windows PPTX3/3 failure in job130893933455 (`/tmp/opf-e210-final-ci01/job-130893933455.log`): Node24.22.2, `sh20-witness-offline.mjs:45`, observed Open path under `runneradmin`, expected path under `RUNNER~1`. The earlier fixture change used ordinary `realpathSync`; its local Windows pass used a natural long TEMP path and did not qualify an8.3 alias. No production path/Open defect follows from this fixture mismatch.

The test has only two existing canonicalization calls. Both now use `realpathSync.native`, with no weaker fallback. Nodev24.22.2 ordinary `realpathSync` walks lstat/readlink and preserves non-symlink component spelling; native delegates to the OS binding. Its bundled Windows libuv opens the existing path and obtains its normalized DOS path through `GetFinalPathNameByHandleW`. This is the appropriate existing-file canonicalization boundary for the test-owned producer root, without rewriting the observed Open result.

The lexical and canonical seed paths must resolve to the exact same canonical string and have equal BigInt device/file identities. The existing seed hash remains strict; the same Open path, System.String, readOnly/untitled/window flags, seven-input/ten-tree plan, no-output/no-Office boundary, source immutability and every existing-evidence/missing-input refusal remain unchanged. A small names-only console fact records whether the lexical root spelling actually differed. A pass with no spelling difference must not be relabelled actual8.3 qualification.

Only this fixture and dated progress/note change. Production SH20/SH21 scripts, native helpers, path/IO guards, workers, dependencies and all budgets remain exact. Mac merely takes the existing Windows-only skip; actual Windows alias-host execution remains required. No new package test, fake short-path fixture, path-string replacement, case folding or production normalization is introduced.

Primary source references: [Node24.22.2 fs implementation](https://raw.githubusercontent.com/nodejs/node/v24.22.2/lib/fs.js), [bundled Windows libuv](https://raw.githubusercontent.com/nodejs/node/v24.22.2/deps/uv/src/win/fs.c), [supported native API](https://nodejs.org/docs/latest-v24.x/api/fs.html#fsrealpathsyncnativepath-options), [normalized Windows handle path](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew).
