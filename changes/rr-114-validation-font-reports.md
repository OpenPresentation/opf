---
type: fixed
packages: [opf, cli, mcp]
---

RR-114: keep CLI and Node MCP invalid-document validation as ordinary located reports when demand font planning reaches the renderer's strict format boundary first. Recover only the actual loaded renderer's structured format exception for these validation callers; preserve all other font failures, generic export/pagination refusals and the caller's catalog context.
