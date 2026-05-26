# Contributing

This project is MIT-licensed and follows the OpenPresentation OSS boundary: local deterministic libraries only.

Before opening a pull request:

```sh
npm ci
npm run build
npm run validate
```

Dependency changes must preserve the runtime policy in `README.md`: no hosted service, no telemetry, no commercial SDK, and no required AI or LibreOffice dependency in the critical path.
