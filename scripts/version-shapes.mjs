// MR-41: the shapes of the workspace's own versions and ranges, for tests and checks that read them. The published packages
// carry ONE version, `X.Y.Z` or a prerelease `X.Y.Z-rc.N` (scripts/release.mjs prepare), and core's peer ranges and the CLI's
// are `^<that version>`. A test that asserts `/^\^\d+\.\d+\.\d+$/` on them passes on a stable tree and fails on the release
// candidate's tree, so they share these instead (scripts/prerelease-tree.test.mjs prepares prerelease trees and checks them).

/** An exact version, stable or prerelease (`0.26.0`, `0.26.0-rc.0`). */
export const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
/** A caret range on one (`^0.26.0`, `^0.26.0-rc.0`). */
export const CARET_RANGE = /^\^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * An installed prerelease version that `range` (`^X.Y.Z` or `^X.Y.Z-pre`) refuses: any prerelease of X.Y.Z against a stable range;
 * against a prerelease range the lowest prerelease of X.Y.Z, `X.Y.Z-0`, which sorts below every named identifier.
 */
export function prereleaseOutside(range) {
  const version = range.replace(/^\^/, '');
  return version.includes('-') ? `${version.split('-')[0]}-0` : `${version}-next.0`;
}
