# RR-05 native comparison

Manifest: `manifest.json` of the rr-05b-native set; native dir: `native-run4-cjk`; bands (reported, not gated): {"closeInkIoU":0.65,"reviewInkIoU":0.4,"closeContentSsim":0.75,"reviewContentSsim":0.5}

| Deck | Tier | Opened | Fonts | Direction | Charts | Fields | Notes | Pres.Fonts | Theme | Images (close/review/far) | Align | Bullets |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lang-hi | 1 | yes | pass | pass | pass | pass | pass | pass | pass | 1/0/6 | 32/32 | 32/32 |
| lang-ja-meiryo | 1 | yes | pass | pass | pass | pass | pass | FAIL | pass | 1/0/6 | 32/32 | 32/32 |
| lang-ko | 1 | yes | pass | pass | pass | pass | pass | pass | pass | 1/0/6 | 32/32 | 32/32 |
| lang-th | 1 | yes | pass | pass | pass | pass | pass | pass | pass | 1/0/6 | 33/33 | 33/33 |
| lang-zh-hans | 1 | yes | pass | pass | pass | pass | pass | pass | pass | 1/4/2 | 32/32 | 32/32 |
| scripts-inside-latin | 1 | yes | pass | pass | pass | pass | pass | pass | pass | 1/0/4 | 33/33 | 33/33 |
| lang-ja | 2 | yes | pass | pass | pass | pass | pass | pass | pass | 1/0/6 | 32/32 | 32/32 |
| lang-zh-hant | 2 | yes | pass | pass | pass | pass | pass | pass | pass | 1/1/5 | 32/32 | 32/32 |
| size-4x3-japanese | 3 | yes | pass | pass | pass | pass | pass | pass | pass | 0/0/2 | 10/10 | 10/10 |

## Mismatches (first 12 per deck)

### lang-ja-meiryo
- slide - presentation-fonts-extra : {"extras":["Aptos"]}
