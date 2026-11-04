# Governance

Status: **Proposed for Michael's approval** (2026-11-04). Nothing here is in force until it is approved. Until then the
process is the one in [CONTRIBUTING.md](../CONTRIBUTING.md) and the schema change issue template, which this document
writes down and extends.

This document covers the Open Presentation Format: the specification and schemas in `spec/`, the conformance suite in
`conformance/`, and the reference packages released from this repository. It changes by the same process as the spec.

## Stewardship

**Data Advantage stewards the format.** The steward maintains this repository, the reference packages and
openpresentation.org, and appoints the format lead. The format lead is Michael Grimm (`@michaeljgrimm`), who approves or
declines spec changes and appoints maintainers.

Stewardship is a duty, not ownership. The spec, the schemas and the packages are MIT-licensed; anyone may implement,
extend through `extensions`, or fork them. The steward's and the sponsors' own products follow the same spec and the same
change process as everyone else, and get no field or behavior the spec does not give every implementation.

Stewardship can move to a foundation or a standards body. Such a move is a change to this document, made in public by
the process below.

## Roles

| Role | Who | Does |
| --- | --- | --- |
| Format lead | Michael Grimm | Approves or declines spec changes; appoints and removes maintainers; approves changes to this document |
| Maintainers | Listed in [`.github/CODEOWNERS`](../.github/CODEOWNERS) | Review and merge pull requests, triage issues, run releases |
| Contributors | Anyone | Open issues, propose changes, send pull requests |

Everyone follows the [code of conduct](../CODE_OF_CONDUCT.md).

## How the spec changes

A spec change is any change to `spec/schemas/`, to the shape of catalog records, or to a documented rule that decides
whether a document is valid (and so to a conformance expectation). Bug fixes, docs and package code that keep the spec
as it is go straight to a pull request ([CONTRIBUTING.md](../CONTRIBUTING.md)).

1. **Propose.** Open an issue with the "Schema/catalog change proposal" template: the problem, the proposed JSON, whether
   it is additive or breaking, and the alternatives, including why `extensions` or a catalog record is not enough. Every
   proposer uses this path, the steward's and the sponsors' products included.
2. **Review.** Maintainers label the issue `schema-change` and additive or breaking. Anyone may comment. A breaking
   change stays open for comment for at least 14 days; an additive one for at least 7. A security fix may be shortened
   (see [Security](#security)).
3. **Decide.** The format lead approves or declines on the issue, with the reason. Only an approval on the issue counts;
   a discussion elsewhere is recorded there first.
4. **Ship.** One pull request carries the schema change, the reference docs, the examples, a `changes/` fragment, a note
   under `docs/migrations/` when it breaks documents, and conformance cases for any new rule. It merges when the
   `verify` check is green and is released with the next release.
5. **Record.** The issue and the changelog are the record of the decision.

## Versioning and stability

- **One version.** The seven packages share one semantic version. Before 1.0 (today 0.31.0) a minor release may break
  documents or APIs and a patch release never does. Every breaking change is in the changelog, with a migration note when
  documents must change.
- **Schema lines.** A schema `$id` such as `https://openpresentation.org/schema/opf/v1` names a line, not a release;
  see [schema versioning](schema-versioning.md).
- **Frozen schemas.** The schemas of every release are published unchanged at
  `https://openpresentation.org/schema/<name>/<version>` and never edited. Pin a version there, or the package version,
  to validate against a fixed contract.
- **Deprecation before 1.0.** None: a field is renamed or removed in a minor release, with a changelog entry and a
  migration note.
- **After 1.0.** `v1` changes only in ways that keep every valid `v1` document valid. A field to be retired is marked
  deprecated (documented, and a validator warning) for at least two minor releases and six months, stays valid for the
  whole `v1` line, and is removed only in a new line (`v2`) with a new `$id`. The previous line receives security fixes
  for at least 12 months after the next one is released.

## Implementations

openpresentation.org lists tools that read or write OPF in one neutral form: name, what it does with OPF (read, write,
validate, render, convert, edit, host), the OPF version it targets, the conformance levels it claims with a link to the
report, its license and a link. No entry gets a logo, badge, ranking or call to action that the others do not get. The
steward's and the sponsors' products are listed the same way.

To be listed, open an issue in this repository with those fields. A listing is corrected or removed when its link stops
working or a claim it makes is shown to be false and is not fixed within 30 days.

## Conformance

The [conformance suite](conformance.md) defines the levels a tool can claim: **Core Reader** and **Core Writer** today,
**Renderer** and **Converter** planned. Claims are self-assessed: a tool runs the unmodified suite of a release, publishes
the report, and names the level and the OPF version. The project does not certify tools.

## Security

Report a vulnerability privately as described in [SECURITY.md](../SECURITY.md) (a GitHub security advisory on this
repository), never in a public issue. Fixes ship in a patch release of the latest version, and the advisory is published
once the fix is out. When a spec rule itself is the problem, the format lead may approve the change without the comment
period and explains it on the issue after the release.

## Name and logo

- "Open Presentation Format" and "OPF" name the format; the logo in [`docs/brand/`](brand/) identifies it.
- You may say a tool reads, writes, supports or implements OPF, and use the name and logo to refer to the format, without
  asking.
- Claim conformance only with a level and a report from the unmodified suite.
- Do not use the name or logo for a fork, a different format or a modified spec, or in a way that suggests the project
  endorses or certifies a product. Forks are welcome under the MIT license under another name.

## Becoming a maintainer

Maintainers are contributors who have shown good judgment over time: several merged pull requests, reviews of others'
work, and help with issues. A maintainer nominates a contributor, or a contributor nominates themselves, in an issue; the
format lead decides. A maintainer inactive for 12 months becomes an emeritus maintainer and can return the same way.
The project aims to have maintainers from more than one organization.

## Sponsors

pptx.dev sponsors OPF. It runs a hosted API, AI and file services on the same open packages and is listed as an
implementation like any other. Sponsorship supports the work and buys no say in the spec: a sponsor's proposals follow
the same change process. Sponsors are named here, in one line of the openpresentation.org footer and in one factual note
on its homepage, and nowhere in the spec.
