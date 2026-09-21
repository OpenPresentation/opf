# Published guide API smoke

Run from the OPF repository root on Node 24 against the retained fresh registry consumer:

```sh
fnm exec --using=24 node docs/evidence/issue88-followup-20260921/docs-guide-smoke.mjs /private/tmp/opf-registry-20260921/consumer > docs/evidence/issue88-followup-20260921/docs-guide-smoke.json
```

The retained script repeats the earlier inline Node smoke and adds explicit package pins, installed-path guards, CLI-help assertions and hashes. The JSON file is its stdout log and result. The consumer was freshly installed for the [shipped-train acceptance](../shipped-train-20260921/installed/acceptance-summary.json); it is not a sibling-source import or build.

Checks cover data import/re-export, rich range helpers, metric/furniture/composition algorithms, content-card inset and selected text floor. CLI help confirms published data import and pagination without an explain/repair command. These support current claims in `data-import.md`, `dynamic-composition.md` and `rich-text.md`. Native, font, full browser and automatic-repair gates remain separate.
