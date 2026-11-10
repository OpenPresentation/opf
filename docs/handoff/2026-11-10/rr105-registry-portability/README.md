# RR-105 registry fixture portability

Isolated fresh-main worktree C:/opf-work/registry-win, branch codex/rr-105-registry-portability, reviewed repair baseline45564d256b3b89018259e55e9cf37d396d7780c6. The three actual Windows failures are preserved before changes: two newline mismatches, invalid /C:/ cwd from URL.pathname, and file-symlink EPERM.

Only three test files change. The archive fixtures set core.autocrlf=false and core.eol=lf in their OWN temporary Git repositories; the user's/global/repository settings and production archive function remain unchanged. Original exact LF assertions remain, plus an intentional CRLF fixture proves archive bytes are preserved rather than normalized. The registry-plan test uses Node fileURLToPath for its real checkout cwd.

At the same exact-source, browser and main final containment guards, Windows uses an outside-directory junction at the fixture entry path. POSIX keeps its original outside FILE symlinks. Windows also traverses each junction to an existing actual index.js file, verifies its realpath/isFile and requires the production registryFile boundary to reject it. All original outside-consumer assertions remain. A .js directory junction is a containment probe, not full file-target equivalence or application import acceptance. No whole-package junction, skipped negative case, privilege/Developer Mode change or production guard relaxation is used.

The genuine three-file focused run passes9/9 on pinned Node24 after the retained baseline RED. Required normal mapped qualification is pending. Pinned offline installation passed; expected missing generated-bin warnings remain until the normal build. Source review and final combined/platform CI remain separate.

Vetoable decision: repair owned fixture setup and path conversion, preserve strict bytes and boundary errors, and retain platform-specific file/directory-link scope honestly. No runtime/package/schema/lock, golden, Office, deploy or release change.
