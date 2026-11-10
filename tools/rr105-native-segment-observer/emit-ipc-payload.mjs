import {asciiJson}from'./profile.mjs';
export const payload={arabic:'\u0644\u063a\u0629 \u0639\u0631\u0628\u064a\u0629',french:'Fran\u00e7ais caf\u00e9 cafe\u0301',indic:'\u0661\u0662\u0663 \u06f1\u06f2\u06f3',astral:'\ud83d\ude80 \ud834\udd1e',breaks:'line1\nline2\r\nline3\t\u2028\u2029',literal:'\\u0644',nul:'\u0000',unpaired:'\ud800\udfff'};
console.log(asciiJson(payload));
