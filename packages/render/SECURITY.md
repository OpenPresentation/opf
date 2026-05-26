# Security Policy

Report security issues through GitHub Security Advisories for this repository when available. If advisories are unavailable, open a private report with the OpenPresentation maintainers.

Do not include secrets, credentials, private decks, or confidential customer data in public issues.

## Runtime Boundary

`@openpresentation/opf-render` is a local library. It must not require hosted services, telemetry, or commercial SDKs in the runtime critical path.
