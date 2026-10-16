---
type: fixed
---
Serialize concurrent Node fonts-handle `ensure` calls so a script face is loaded once. Each call retains its own options, result and error, and a failed call does not block later preparation.
