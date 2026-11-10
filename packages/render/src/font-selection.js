// Shared with the maintained manifest generator: match the registry's preferred-family namespace exactly.
export function selectionFamilyGroup(font, family) {
  return family && family.toLowerCase() !== font.familyName?.toLowerCase()
    ? family
    : (font.getName?.('preferredFamily', 'en') ?? family);
}
