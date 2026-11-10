---
type: fixed
packages: []
---
RR-105: native reference-chart qualification now records a separate, fixed five-second read-only process-exit observation after a verified completed owned Quit. It preserves the initial process sample and fails closed on new processes, query/clock faults and deadline expiry, without changing the worker budget, retrying Office or performing cleanup.
