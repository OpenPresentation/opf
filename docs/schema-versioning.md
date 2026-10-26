# Schema versioning

The OPF schemas carry a `v1` (and the layout record schema a `v2`) in their `$id`, such as `https://openpresentation.org/schema/opf/v1`. Before OPF 1.0 that number names the **pre-1.0 line**, not a frozen contract.

- **`v1` may change in any 0.x minor release.** A 0.x minor bump is a breaking-change bump (a patch release is never breaking). Fields are renamed, removed and tightened before 1.0 without deprecation aliases, so the same `$id` can describe different documents in 0.26 and 0.27.
- **The release that produced a schema copy is the package version.** The `@openpresentation/opf` package ships `spec/schemas/` unchanged, so a schema copy belongs to the version of the package it came from. Each schema carries the same statement in its `$comment`.
- **The `$id` is a name, not a version pin.** `$schema: "https://openpresentation.org/schema/opf/v1"` in a document says which line it is written for; it does not say which 0.x release.

## Find the version

```sh
opf --version      # { "cli": "0.27.0", "opf": "0.27.0", "schema": "https://openpresentation.org/schema/opf/v1" }
opf schemas        # [{ "name": "presentation", "file": "schemas/opf.schema.json", "id": ".../v1", "version": "0.27.0" }, ...]
opf schema         # the whole presentation schema; its $comment ends "This copy is from @openpresentation/opf 0.27.0."
```

`opf schemas` and `opf --version` read the version of the `@openpresentation/opf` package the CLI runs on, so the schema you read through the CLI is the one `opf validate` checks with. A part of a schema printed with a JSON Pointer (`opf schema presentation '/$defs/Chart'`) is printed exactly as it is, without the added sentence. In a source checkout, `spec/schemas/` is the schema of the checked-out commit and `packages/javascript/package.json` has its version.

## Pin it

- Read and validate with the schema of the package version you target: install `@openpresentation/opf@<version>` (and `@openpresentation/cli@<version>` with it) and use its `opf schema`, or `schemaEntries` from the package.
- A schema fetched from the web (`https://openpresentation.org/schema/opf/v1`) is the latest release's copy. Use it for editor completion, not as a contract for an older document. Versioned URLs on the website are a separate piece of work.
- Check a document against the version it was written for before you migrate it; OPF ships no migration tooling before 1.0, so a breaking change is listed in the [changelog](../CHANGELOG.md) and the examples and docs are converted with it.

At 1.0 the line becomes a contract: `v1` then changes only in ways that keep every valid `v1` document valid.
