# Changelog

## 0.5.0

- Bundle all six OPF agent skills and add `skills install`, `skills update` and read-only `skills status`, with project, personal and explicit-directory targets.
- Preserve local modifications and unmanaged folders through all-skill preflight checks; keep recoverable backups when updating managed skills. Windows installation uses copies and needs no symlink privileges.
- Suggest `npx @openpresentation/cli@latest skills install` in help and document-creation reports. Skill installation works offline after downloading the standalone CLI and requires no hosted provider.
- Continue bundling OPF 0.7.0; this release does not republish or change the core package.

## 0.1.1

- Bundle OPF 0.4.1, including the corrected embedded PNG example.
- Preserve the standalone local executable and its existing commands; no hosted service or AI account is required.

## 0.1.0

- Initial standalone agent CLI for creating, validating, inspecting, editing, importing data and paginating OPF presentations.
