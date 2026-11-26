---
type: fixed
packages: [opf]
---

The generated table of month and weekday names records the Node major it was read on (`DATE_NAME_SOURCE.node`, beside `icu` and `cldr`), and its test compares the table with the running `Intl` only on that runtime. Node 26.13 carries the same ICU and CLDR versions as Node 24.20 and still disagrees on some of this data, which failed the Node 26 leg of the nightly checks and would have stopped a release at its gate. On another runtime the test now reports which language and which list differ. The names the engines draw are unchanged.
