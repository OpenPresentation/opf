# RR-83 conversion input

Saved from opf#577 (RR-79) before the owner decision of 2026-10-10 ("Don't worry about migration of layouts"):
0.19 breaks layouts with no migration path, so none of this ships. RR-83 uses it as input for a throwaway script that
converts core's 103 examples, the docs, the skills and the site content to the 0.19 layouts.

- `layout-migration.json`: the 278 removed 0.18 default ids, each with its 0.19 built-in, the design settings that
  reproduce the variant (written only where the old value differs from the new layout's or the engine default;
  contentDirection only when vertical), and the content rewrite (`groups`: the old record's body placeholders, to wrap
  the slide's blocks into content groups; `placement`: the n-th image's band; `dropLayout` for `blank`).
- `build-layout-migration.mjs`: the generator. It reads the 0.18 records (`spec/catalogs/layouts`), the design doc's
  mapping table and the 28 templates fixture, and checks every row against the table (216 rows with settings, 16
  groups, 6 placements, 1 dropped layout). Paths in it point at C:/opf-work/rr79.
- `layout-migration.ts`: the removed core module (migrate, migrateSlide with settings and hoisting, content groups,
  placements, convertLayoutRecord for embedded 0.18 records with region pins). Reuse its logic in the script.
- `layout-migration.test.mjs`: its tests, as examples of the expected rewrites.

## Handover note (2026-10-10)

- Committed on the draft RR-83 branch so the next team can find it.
- The code files carry a `.txt` suffix so lint, typecheck and test discovery skip them. Rename them back to `.mjs`/`.ts` when you build the throwaway conversion script.
- The script lives outside `spec/` and `src/` and is deleted after the conversion.
- Paths inside `build-layout-migration.mjs` point at `C:/opf-work/rr79`; adjust them to this checkout.
