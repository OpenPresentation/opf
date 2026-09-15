# Renderer 0.8.0 release checkpoint — 2026-09-15

The release branch consumes published core 0.10.0 from npm. Its lockfile was refreshed after core publication, and a clean `npm ci` succeeded on macOS with Node 24.21.0. The full package test command, typecheck, validation and isolated packed installation passed. The packed check verified 17 shipped files byte-for-byte, registry signatures and available provenance attestations.

The local `npm run test:browser` failed at the JPEG orientation-7 crop comparison; the exact output is preserved in [macos-browser-failure.log](macos-browser-failure.log). The existing aggregate pixel-error criteria remain unchanged. The subsequent code-browser command was not run because the command chain stopped on this failure.

This is a release gate to investigate, not native Office acceptance. The release stays draft until browser acceptance and the exact dependency graph are verified. Furniture and prepared-font shaping are separate draft branches and are not in this candidate.
