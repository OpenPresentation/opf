# Complete source integration sequence; isolated default authorization patch is insufficient

Recommendation: PARK the proposed push/nightly authorization patch. Do not redesign ecosystem resolution merely to make the brief source-integration interval green. Existing procedure supports green required PR/merge-group gates, then strict Gallery bootstrap/publication, genuine registry adoption, and official rolling to the final merged graph. Record transitional default failures and fix forward; never count them as successful or use them to authorize an engine release.

## Concrete selection facts

- `.github/actions/ecosystem-refs/action.yml:3–13` reads core action commit's ecosystem lock; push, dispatch, schedule use lock only.
- `scripts/ecosystem-lock.mjs:270–284`: only PR/merge-group events provide PR identity; absent it Depends-On overrides are empty. `resolveRefs:376–387` uses locked SHAs except own consumer checkout.
- Current lock still selects core85089/render7980/PPTX6bb/editorac258. New renderer/editor default runs therefore consume the old core/Gallery2. The new core golden path may also be absent from locked core85089.
- Consequently candidate-gallery authorization alone cannot select the intended graph, and may not even execute: selected old core has no unresolved configuration. Postmerge authentication without dependency resolution is not a complete fix.
- Official roller dispatch (`ecosystem-roll.mjs:132`) supplies only ref, whereas configured candidate core workflow_dispatch requires exact candidate-gallery-ref. Thus an ordinary official roll before Gallery registry adoption would also refuse; do not silently inject authorization or misrepresent a green final roll.

## Existing rules and lawful minimal sequence

1. Required engine PR and merge-group runs use existing DIRECT Depends-On plus exact Gallery146e trailer; all checks must genuinely pass at exact reviewed heads. Fix real failures such as editor's unconditional registry-only packed step before integration. Keep source/packed/published-control claims separate.
2. Merge engine SOURCE through canonical required queue gates. Respect contract/source ordering where practical (ecosystem-development.md:113), with exact dependent-source PR refs for coordinated changes. Gallery CONTRIBUTING.md:120–123 explicitly says merge candidate engine PRs before merged-source bootstrap. It does not require engine npm publication or a preliminary rolled lock. No engine tag/publication is authorized in this unresolved state.
3. Default push/nightly checks may fail during this transition against old lock/config. Preserve their actual results; do not disable jobs, relax assertions, claim program done or call main fully green. `ecosystem-development.md:112` explicitly describes red nightly issue tracking and requires fix forward or revert. Release-readiness README:71–74 defines all-main cross-platform green as completion; README:238–243 requires release gates before publication. Neither text requires all transient source-integration commits to be instantly green in lock-only event lanes. This is a fix-forward sequence, not a release waiver.
4. Extend Gallery3 bootstrap's supported contract while retaining STRICT merged-default ancestor pins, then set actual merged core/render SHAs. Run full Gallery bootstrap/verify/tests/previews/stability/package gates. Merge Gallery only when this merged-mode configuration is valid, and require its main/tag gates to pass. A separate PR-only provisional mode can qualify Gallery draft sooner but is not needed to authorize this final merged-mode procedure.
5. Trusted-publish Gallery3 and independently verify its actual artifact/provenance. This is the dependency-free Gallery lane, not an engine publication. Do not use unmerged engine refs at publishing.
6. Genuine Gallery3 registry-adoption PRs remove temporary candidate declarations/config and generate authentic dependency locks. They use direct Depends-On for the coordinated current source graph until all four adopted source mains are merged. Current source own versions are not release-ready merely because source checks pass.
7. NOW run the official roller: only actual merged mains, official generated lock, unchanged strict full source/packed/browser/OS/Node gates. Merge the roller only after actual green results. Refresh/rerun applicable default source lanes against the new canonical lock and document closure of transitional failures.
8. Canonical next-minor release prep, floor changes, release-commit gates and trusted publication proceed only on that genuine registry-adopted, rolled, green graph. No deployment or native acceptance is inferred.

## Head-repository question

The isolated helper's wording “same-repository PR” means the PR BASE belongs to the authenticated repository/default branch. It intentionally permits a fork-origin PR that was actually merged by that repository: immutable default ancestry + exact merge_commit_sha + live matching candidate trailer authenticate it equally. It does not check head.repo equality. If policy intends to exclude forks, add an explicit head.repo check and negative test; that is an additional restriction, not needed to authenticate a maintainer-approved merged source. Current four source PRs are same-origin anyway. No ambiguity should remain in public review text.

No new tests, API calls, canonical edits or mutation for this follow-up. The isolated patch remains unintegrated and is not necessary for the recommended minimal sequence.
