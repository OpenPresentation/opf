# Mac candidate workflow evidence

These records cover unpublished local tarballs using core parent `e882f357cd7860b3e0905fdf0b2fb3ff8c2464d8`, renderer font preparation `91fe43e25dca9e4f04a2a18b1c6ee74e7e3d2863`, editor `6e0b7d2f1b4369fc0a228391cf36e913e05188f8` and PPTX product source `c92209f7168a83aa941ecd5960b55aa492138800`. PPTX's subsequent `24e7b2f12462df246e35a8a714a47923ecbd2bfe` changes only the native verifier/docs. No registry package was published or public site deployed.

The Node 20/24 packed logs preserve complete successful installs and checks. Browser reports record seven passing suites, 230 assertions, eight trusted interaction scenarios, zero page errors and zero blocked remote requests. Font workflow records preserve three-page editor/SVG/PPTX agreement and six-page Office-substitution checks; native PowerPoint itself was not used on the Mac.

Two initial test failures are retained. The new font workflow incorrectly read `fromPptx` as a result wrapper; the API returns the document directly. Fixing the test made heading reimport pass. The preexisting installed browser harness used `Control+End` to collapse selected rich text. On Mac Chromium that keystroke leaves the complete selection intact, so typing replaces it. The direct textarea probe demonstrates the selection behavior; the failure screenshot shows the resulting `!`. The platform shortcut and a caret assertion fix the test while preserving the same typing, formatting and undo requirements.

Reproduce with locked source dependencies and the coordinated sibling layout:

```sh
pnpm build
node scripts/link-ecosystem.mjs --packages-only
pnpm test:fonts
pnpm pack:ecosystem
pnpm test:packed-ecosystem
pnpm test:packed-browser
```

Repeat from a fresh candidate consumer under Node 20 and 24. The build manifest binds browser assets to the installed tarballs, lockfile and generated build ID. These temporary candidate versions are not release versions. The [owner handoff](../../handoff-mac-owner-2026-09-10.md) records open font/layout/native gates and the required release sequence.
