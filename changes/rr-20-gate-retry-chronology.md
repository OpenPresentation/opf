---
type: fixed
packages: [opf]
---

The shared PR gate recognizes a lower workflow-run ID's observed retry when its newly created check-run ID proves it follows an intervening cancellation. Initial attempts, unrelated workflows and cancelled retry suites cannot suppress that cancellation; genuine failures and required checks remain enforced. Because workflow attempt metadata can change on retained checks, an override also waits for the matching retry suite and attempt to complete successfully, even when only named required checks count.
