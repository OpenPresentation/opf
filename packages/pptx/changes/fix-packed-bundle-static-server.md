---
type: fixed
---
Tests: the static server of `test/packed-bundle-browser.mjs` answers a missing file (such as the browser's automatic `/favicon.ico`) with one 404, and `/favicon.ico` with 204, instead of writing headers twice and crashing with `ERR_HTTP_HEADERS_SENT` on Windows (#220). The test now requests a missing file so the case stays covered on every OS.
