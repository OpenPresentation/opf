# RR-117 settled browser comparison

Actual formal child70527 exited0. The once-only fixed8-case matrix completed72 primary edits,36 exact complete-report phase pairs and204 exact emitted-SVG byte pairs. Both20-edit/4mount-destroy observations completed. Sourced8116ee38e363d2a933d4a70ce50b0e88efa59de, bundle2003813a3533b8bb09192630d4c5ec4a01de8c24dd69197ff72bc295cc45ccc8; no retry, source edit or deadline change occurred.

Three-round medians for each fixed mode/cell follow. Negative change means the cached control was lower.

| Slides / CPU throttle | Edit | Settled cold → cached | Change | Core validate cold → cached | Change |
| --- | --- | ---: | ---: | ---: | ---: |
| 16 / 1× | local-title0 | 1167 → 1161ms | -0.5% | 744 → 757ms | +1.7% |
| 16 / 1× | shared-datum | 1346 → 1159ms | -13.9% | 744 → 532ms | -28.5% |
| 16 / 1× | global-name | 1378 → 1419ms | +3.0% | 752 → 781ms | +3.9% |
| 16 / 4× | local-title0 | 4426 → 4529ms | +2.3% | 3666 → 3701ms | +1.0% |
| 16 / 4× | shared-datum | 5537 → 4354ms | -21.4% | 3657 → 2548ms | -30.3% |
| 16 / 4× | global-name | 5689 → 5824ms | +2.4% | 3626 → 3768ms | +3.9% |
| 36 / 1× | local-title0 | 2008 → 1982ms | -1.3% | 1545 → 1524ms | -1.4% |
| 36 / 1× | shared-datum | 2432 → 1991ms | -18.1% | 1545 → 1104ms | -28.5% |
| 36 / 1× | global-name | 2507 → 2508ms | +0.1% | 1532 → 1538ms | +0.4% |
| 36 / 4× | local-title0 | 8741 → 8750ms | +0.1% | 7553 → 7863ms | +4.1% |
| 36 / 4× | shared-datum | 11054 → 8540ms | -22.7% | 7550 → 5107ms | -32.4% |
| 36 / 4× | global-name | 11507 → 11302ms | -1.8% | 7744 → 7603ms | -1.8% |

The local title at slide0 and global name are deliberate conservative misses, rather than favorable hit-only edits. Cold control calls public panel.invalidate and constructs fresh cache snapshots; it is not historical plain validate or an absolute v0.33 baseline. Public cold-oracle work outside each interval primes shared font/renderer work symmetrically. Forwarder/observer/timeline overhead is present in both modes. The summary JSON retains browser task/script counters and primary-overlap long tasks separately.

| Retention mode | Post-warm/dispose GC baseline | After20 edits | After4th destroy | Final minus baseline |
| --- | ---: | ---: | ---: | ---: |
| cold | 26.87MiB | 34.45MiB | 30.14MiB | 3.27MiB |
| cached | 26.90MiB | 34.38MiB | 30.04MiB | 3.14MiB |

Every sampled logical cache remains within64 entries/8MiB; observed maxima are34 entries/3177762 logical bytes. Every destroyed captured cache has0 entries/bytes, workspace DOM is removed and prepared face counts stay fixed. During-edit heap includes intentional undo and text/font caches. These are post-GC V8 heap observations, not process RSS, and the short20/4 soak is not leak qualification.

This is a bounded fixed-desktop same-candidate comparison, one fresh process per mode/cell and three edit rounds, with no physical-mobile, cloud, universal-speed or release/native acceptance claim. All eight original cases, traces, screenshots, exact input identities, raw stdout/stderr and actual exit must remain sealed; no unsuccessful formal case was discarded. Root owns coherent mapper/CI and acceptance.
