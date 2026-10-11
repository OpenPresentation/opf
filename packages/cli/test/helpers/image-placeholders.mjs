// The exported panel is the semantic placeholder; group, text and icon names share its prefix.
export const imagePlaceholderCount = xml => (xml.match(/\bname="OPF image placeholder \d+"/g) ?? []).length;
