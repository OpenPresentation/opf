// A pointer at the physical middle of a divider's gap maps to the first
// logical track's share, including when that first track is on the right.
export function trackPairBounds(track, next) {
  const reverse = next.start < track.start;
  const edge = reverse ? track.start : track.start + track.length;
  const other = reverse ? next.start + next.length : next.start;
  const gap = Math.abs(other - edge);
  return {
    at: (edge + other) / 2,
    pairStart: reverse ? track.start + track.length - gap / 2 : track.start + gap / 2,
    pairLength: (reverse ? -1 : 1) * (track.length + next.length),
  };
}
