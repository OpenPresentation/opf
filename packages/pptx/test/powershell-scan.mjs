// A single left-to-right PowerShell lexer for offline source-policy scans.
// It blanks comments and literal string text to spaces (keeping CR/LF and every code-unit offset), so a regex over the
// result sees only code. Constructs this lexer does not model are reported as issues so callers can fail closed.

// Windows PowerShell 5.1 also accepts the typographic quote characters as string delimiters.
const SINGLE_QUOTES = new Set(["'", '\u2018', '\u2019', '\u201A', '\u201B']);
const DOUBLE_QUOTES = new Set(['"', '\u201C', '\u201D', '\u201E']);
// A '#' after one of these starts a comment unambiguously; after anything else PowerShell may read it as part of a
// bare-word argument (for example `Write-Output a#b`), so it is reported rather than guessed.
const COMMENT_BOUNDARY = /[\s;,(){}|&]/;

export function scanPowerShellSource(sourceText) {
  const text = String(sourceText);
  const out = Array.from({length: text.length}, (_, index) => text[index]);
  const issues = [];
  const issue = (kind, index) => issues.push({kind, index});
  const blank = (from, to) => { for (let index = from; index < to && index < text.length; index++) if (out[index] !== '\r' && out[index] !== '\n') out[index] = ' '; };
  const atLineStart = index => index === 0 || text[index - 1] === '\n';

  // Scans code from `start`. Nested (a `$(...)` inside an expandable string) stops at the unmatched ')' and returns its index.
  function scanCode(start, nested) {
    let index = start, depth = 0;
    while (index < text.length) {
      const char = text[index], next = text[index + 1];
      if (char === '`') {
        // Only a line continuation is modeled; an escaped character in code (i`ex) changes what PowerShell reads.
        if (next !== '\n' && next !== '\r') issue('backtick-escape-in-code', index);
        index += 2; continue;
      }
      if (char === '<' && next === '#') {
        if (index > 0 && !COMMENT_BOUNDARY.test(text[index - 1])) issue('ambiguous-comment-start', index);
        index = scanBlockComment(index); continue;
      }
      if (char === '#') {
        if (index > 0 && !COMMENT_BOUNDARY.test(text[index - 1])) issue('ambiguous-comment-start', index);
        index = scanLineComment(index); continue;
      }
      if (char === '@' && (SINGLE_QUOTES.has(next) || DOUBLE_QUOTES.has(next))) {
        const end = scanHereString(index, DOUBLE_QUOTES.has(next));
        if (end !== null) { index = end; continue; }
        index += 1; continue;
      }
      if (SINGLE_QUOTES.has(char)) { index = scanSingleQuoted(index); continue; }
      if (DOUBLE_QUOTES.has(char)) { index = scanDoubleQuoted(index); continue; }
      if (char === '$' && next === '{') { index = scanBracedVariable(index); continue; }
      if (nested && char === '(') depth++;
      if (nested && char === ')') { if (depth === 0) return index; depth--; }
      index++;
    }
    if (nested) issue('unterminated-subexpression', start);
    return index;
  }

  function scanLineComment(start) {
    let index = start;
    while (index < text.length && text[index] !== '\r' && text[index] !== '\n') index++;
    blank(start, index);
    return index;
  }

  function scanBlockComment(start) {
    const close = text.indexOf('#>', start + 2);
    const end = close === -1 ? text.length : close + 2;
    if (close === -1) issue('unterminated-block-comment', start);
    blank(start, end);
    return end;
  }

  // '...' with '' as the only escape; delimiters are kept, the text between them is blanked.
  function scanSingleQuoted(start) {
    let index = start + 1;
    while (index < text.length) {
      if (SINGLE_QUOTES.has(text[index])) {
        if (SINGLE_QUOTES.has(text[index + 1])) { index += 2; continue; }
        blank(start + 1, index);
        return index + 1;
      }
      index++;
    }
    issue('unterminated-string', start);
    blank(start + 1, text.length);
    return text.length;
  }

  // "..." with backtick escapes and "" doubling; $(...) subexpressions are code and stay visible.
  function scanDoubleQuoted(start) {
    let index = start + 1, literalStart = index;
    while (index < text.length) {
      const char = text[index];
      if (char === '`') { index += 2; continue; }
      if (DOUBLE_QUOTES.has(char)) {
        if (DOUBLE_QUOTES.has(text[index + 1])) { index += 2; continue; }
        blank(literalStart, index);
        return index + 1;
      }
      if (char === '$' && text[index + 1] === '(') {
        blank(literalStart, index);
        index = scanCode(index + 2, true) + 1;
        literalStart = index;
        continue;
      }
      // ${name} may contain quotes; it is a variable name, never a string terminator.
      if (char === '$' && text[index + 1] === '{') { index = scanBracedVariable(index); continue; }
      index++;
    }
    issue('unterminated-string', start);
    blank(literalStart, text.length);
    return text.length;
  }

  // @'...'@ and @"..."@: the header must end its line and the terminator must start a line. Returns null when the
  // opener is not a valid here-string header so the caller rescans it as ordinary code.
  function scanHereString(start, expandable) {
    let index = start + 2;
    while (text[index] === ' ' || text[index] === '\t') index++;
    if (text[index] === '\r' && text[index + 1] === '\n') index += 2;
    else if (text[index] === '\n') index += 1;
    else { issue('here-string-header', start); return null; }
    const quotes = expandable ? DOUBLE_QUOTES : SINGLE_QUOTES;
    let literalStart = start + 2;
    while (index < text.length) {
      if (atLineStart(index) && quotes.has(text[index]) && text[index + 1] === '@') {
        blank(literalStart, index);
        return index + 2;
      }
      if (expandable && text[index] === '`') { index += 2; continue; }
      if (expandable && text[index] === '$' && text[index + 1] === '(') {
        blank(literalStart, index);
        index = scanCode(index + 2, true) + 1;
        literalStart = index;
        continue;
      }
      if (expandable && text[index] === '$' && text[index + 1] === '{') { index = scanBracedVariable(index); continue; }
      index++;
    }
    issue('unterminated-here-string', start);
    blank(literalStart, text.length);
    return text.length;
  }

  // ${name} may contain quotes or '#'; it is a variable reference, so it stays visible but is never tokenized.
  function scanBracedVariable(start) {
    let index = start + 2;
    while (index < text.length && text[index] !== '}') index += text[index] === '`' ? 2 : 1;
    if (index >= text.length) { issue('unterminated-braced-variable', start); return text.length; }
    return index + 1;
  }

  // PowerShell also ends a line at a lone CR, which would move here-string terminators and comment ends; not modeled.
  for (const match of text.matchAll(/\r(?!\n)/g)) issue('lone-carriage-return', match.index);
  scanCode(0, false);
  return {code: out.join(''), issues};
}

export function stripPowerShellLiteralsForScan(sourceText) {
  return scanPowerShellSource(sourceText).code;
}

const OPENERS = {')': '(', ']': '[', '}': '{'};
const ASSIGNMENT_AHEAD = String.raw`(?=\s*(?:[-+*/%]?=(?!=)|\+\+|--))`;
const QUOTE_CLASS = `['"\u2018-\u201E]`;

// Walks back from `end` (exclusive) over a member/index/invocation chain to its root variable.
function chainRoot(code, end) {
  let pos = end;
  while (pos > 0) {
    const char = code[pos - 1];
    if (OPENERS[char]) {
      let depth = 0, index = pos - 1;
      for (; index >= 0; index--) {
        if (OPENERS[code[index]]) depth++;
        else if (Object.values(OPENERS).includes(code[index]) && --depth === 0) break;
      }
      if (index < 0) return null;
      if (char === '}' && code[index - 1] === '$') return {root: code.slice(index + 1, pos - 1).replace(/^(?:script|global|local|private|using):/i, ''), start: index - 1};
      pos = index;
      continue;
    }
    if (char === '.') { pos--; continue; }
    if (/\w/.test(char)) {
      let start = pos;
      while (start > 0 && /[\w:]/.test(code[start - 1])) start--;
      const token = code.slice(start, pos);
      if (code[start - 1] === '$' && !token.startsWith(':')) return {root: token.replace(/^(?:script|global|local|private|using):/i, ''), start: start - 1};
      if (code[start - 1] === '.' && !token.includes(':')) { pos = start - 1; continue; }
      return null;
    }
    return null;
  }
  return null;
}

// Every assignment (=, op=, ++, --) whose target is a member or index expression, in code only.
// `root` is the variable the chain starts from (scope prefix removed) or null when it is not a plain variable.
export function memberAssignments(sourceText) {
  const {code} = scanPowerShellSource(sourceText);
  const found = [];
  const targets = new RegExp(String.raw`(?:\.|::)\s*([A-Za-z_]\w*)${ASSIGNMENT_AHEAD}|\]${ASSIGNMENT_AHEAD}`, 'g');
  for (const match of code.matchAll(targets)) {
    const end = match.index + match[0].length;
    const isIndex = match[0] === ']';
    const origin = match[0].startsWith('::') ? null : chainRoot(code, isIndex ? end : match.index);
    found.push({index: match.index, root: origin?.root ?? null, path: origin ? code.slice(origin.start, end).replace(/\s+/g, '') : code.slice(match.index, end).replace(/\s+/g, ''), member: isIndex ? null : match[1]});
  }
  for (const match of code.matchAll(/(?:\+\+|--)\s*(\$\{[^}]*\}|\$[\w:]+)((?:\.\w+|\[[^\]]*\])+)/g)) {
    const root = match[1].startsWith('${') ? match[1].slice(2, -1) : match[1].slice(1);
    found.push({index: match.index, root: root.replace(/^(?:script|global|local|private|using):/i, ''), path: (match[1] + match[2]).replace(/\s+/g, ''), member: /\.(\w+)$/.exec(match[2])?.[1] ?? null});
  }
  return found.sort((left, right) => left.index - right.index);
}

// Member assignments outside the allowed local roots and exact single-level COM setters (for example 'wholeFont.Name'),
// plus every set_X(...) setter-method invocation. Comparisons are case-insensitive, as PowerShell's are.
export function disallowedMemberAssignments(sourceText, {localRoots = [], comSetters = []} = {}) {
  const locals = new Set(localRoots.map(name => name.toLowerCase()));
  const setters = new Set(comSetters.map(name => `$${name}`.toLowerCase()));
  const rejected = memberAssignments(sourceText).filter(item => {
    if (item.root !== null && locals.has(item.root.toLowerCase())) return false;
    return !setters.has(item.path.replace(/^\$(?:script|global|local|private|using):/i, '$').toLowerCase());
  }).map(item => item.path);
  const code = stripPowerShellLiteralsForScan(sourceText);
  for (const match of code.matchAll(/\.\s*(set_\w+)\s*\(/gi)) rejected.push(`.${match[1]}()`);
  return rejected;
}

// Extent of `function NAME { ... }` in lexed code, or null.
export function functionExtent(code, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...code.matchAll(new RegExp(String.raw`(?<![\w-])function\s+${escaped}(?![\w-])[^{]*\{`, 'gi'))];
  if (matches.length !== 1) return null;
  let depth = 0;
  for (let index = matches[0].index + matches[0][0].length - 1; index < code.length; index++) {
    if (code[index] === '{') depth++;
    else if (code[index] === '}' && --depth === 0) return {start: matches[0].index, end: index + 1};
  }
  return null;
}

// Every `function NAME {...}` extent in lexed code.
function functionExtents(code) {
  const extents = [];
  for (const match of code.matchAll(/(?<![\w-])function\s+([\w-]+)[^{]*\{/gi)) {
    let depth = 0;
    for (let index = match.index + match[0].length - 1; index < code.length; index++) {
      if (code[index] === '{') depth++;
      else if (code[index] === '}' && --depth === 0) { extents.push({name: match[1], start: match.index, end: index + 1}); break; }
    }
  }
  return extents;
}

// Name of the innermost function containing `index`, or null at script level.
function enclosingFunction(extents, index) {
  let owner = null;
  for (const extent of extents) if (index > extent.start && index < extent.end && (owner === null || extent.start > owner.start)) owner = extent;
  return owner?.name ?? null;
}

const SCOPE_PREFIX = String.raw`(?:(?:script|global|local|private):)?`;

// Dynamic code, all forbidden except the listed exemptions:
// - Invoke-Expression, iex, Add-Type, Invoke-Command, icm (optionally module-qualified). Only exact `exemptInvocations`
//   inside the one `exemptFunction` body are allowed, so a pure-regression helper may re-evaluate its own definitions.
// - `& 'name'` string-named commands and `$x.'Member'()` string-named member calls.
// - [scriptblock]::Create, .InvokeScript(, .NewScriptBlock( and any $ExecutionContext reference.
// - `& <expression>` and `. <expression>` whose target is not a literal: allowed only for an exact `invocationSites`
//   entry {function (null = script level), operator ('&' or '.'), variable}, for example the COM wrapper's `& $Operation`.
export function dynamicCodeInvocations(sourceText, {exemptFunction = null, exemptInvocations = [], invocationSites = []} = {}) {
  const code = stripPowerShellLiteralsForScan(sourceText);
  const extent = exemptFunction ? functionExtent(code, exemptFunction) : null;
  const extents = functionExtents(code);
  const found = [];
  for (const match of code.matchAll(/(?<![\w$.\\-])(?:[\w.]+\\)?(Invoke-Expression|iex|Add-Type|Invoke-Command|icm)(?![\w-])/gi)) {
    const line = code.slice(match.index, code.indexOf('\n', match.index) === -1 ? code.length : code.indexOf('\n', match.index)).trimEnd();
    const exempt = extent !== null && match.index > extent.start && match.index < extent.end && match[0] === 'Invoke-Expression' && exemptInvocations.some(text => line === text);
    if (!exempt) found.push(match[0]);
  }
  for (const match of code.matchAll(new RegExp(String.raw`(?:^|[^\w$\])])&\s*${QUOTE_CLASS}`, 'gm'))) found.push(`string-named command at ${match.index}`);
  for (const match of code.matchAll(new RegExp(String.raw`\.\s*${QUOTE_CLASS}[^\r\n]*?${QUOTE_CLASS}\s*\(`, 'g'))) found.push(`string-named member at ${match.index}`);
  for (const match of code.matchAll(/\[\s*(?:System\.Management\.Automation\.)?ScriptBlock\s*\]\s*::\s*Create\s*\(/gi)) found.push(`[scriptblock]::Create at ${match.index}`);
  for (const match of code.matchAll(/\.\s*(InvokeScript|NewScriptBlock)\s*\(/gi)) found.push(`.${match[1]}() at ${match.index}`);
  for (const match of code.matchAll(/\.\$(?:\{[^}]*\}|\w+|\()[^\s=]*?\(/g)) found.push(`dynamic member name at ${match.index}`);
  for (const match of code.matchAll(/\$\{?\s*(?:\w+:)?ExecutionContext(?!\w)/gi)) found.push(`$ExecutionContext at ${match.index}`);
  // `&` (not part of a word, `&&` or a redirection such as 2>&1) with a variable, expression or string target; and every
  // `.` dot-source, which is a `.` not glued to a value and followed by whitespace, whatever its target.
  const invocations = [
    ...[...code.matchAll(new RegExp(String.raw`(?<![\w$\])}>&])&(?!&)\s*(?=[$(]|${QUOTE_CLASS})`, 'g'))].map(match => ({operator: '&', match})),
    ...[...code.matchAll(new RegExp(String.raw`(?<![\w$\])}.]|${QUOTE_CLASS})\.(?!\.)\s+`, 'g'))].map(match => ({operator: '.', match})),
  ];
  for (const {operator, match} of invocations) {
    const rest = code.slice(match.index + match[0].length);
    const variable = new RegExp(String.raw`^\$${SCOPE_PREFIX}(\w+)(?![\w.\[(:])`, 'i').exec(rest)?.[1] ?? null;
    const owner = enclosingFunction(extents, match.index);
    const allowed = variable !== null && invocationSites.some(site => (site.function ?? null) === owner && site.operator === operator && site.variable === variable);
    if (!allowed) found.push(`dynamic ${operator} invocation${variable ? ` of $${variable}` : ''} in ${owner ?? 'script scope'} at ${match.index}`);
  }
  return found;
}

// ---------------------------------------------------------------------------------------------------------------------
// Allowlist model. Every bareword (command name or bare argument), invoked instance member, static type access and type
// literal in the lexed code must be on the harness's reviewed allowlist; anything else fails. Each harness's PowerShell
// AST check enforces the same lists ($script:<Prefix>Policy*), and the controls assert that the two copies are equal, so
// neither layer depends on recognizing a particular dangerous construct.
//
// A policy has the same keys as the PowerShell lists, with 'a|b' pairs where PowerShell uses them:
//   commands          commands allowed anywhere (functions declared in the file are allowed too)
//   scoped            'Command|Function' - a command allowed only inside the named function(s)
//   forms             'Command|^regex$' - the command's full text must match one reviewed form
//   instance          invoked instance member names
//   statics           'Type::Member' static invocations; properties: 'Type::Member' static property reads
//   types             type literals: casts, constraints, attributes and static-access targets
//   sites             'Function|&|variable' or 'Function|.|variable' ('' = script scope) non-literal invocations
//   pipelines         'Function|exact text' ForEach-Object / Where-Object calls without a single script block
//   roots, setters    local assignment roots and exact 'variable.Member' COM setters
//   rootSources       'root|exact source' non-literal values a local root may be bound to
//   bareArguments     reviewed bare argument words (UTF8, Directory, ...), checked by both layers
//   exactForms        'Command|text': file-system writes and native helper calls must match a reviewed text exactly
//   exactApis         'Type::Member|text' and exactMembers 'Member|.Member(args)': the same for static and COM path writes
//   pinned            invocation-site and owned-path variables whose every binding must be a reviewed pinnedBindings entry
//   pinnedBindings    'name|=|source', 'name|foreach|condition' or 'name|param|Function|Type'
// Node-only keys: dynamicMemberSites
// ('Function|root' where $root.$name or $root.(expr) member access is allowed), exemptFunction and exemptInvocations
// (the pure regression's exact Invoke-Expression lines).

const KEYWORDS = new Set(['begin', 'break', 'catch', 'class', 'continue', 'data', 'do', 'dynamicparam', 'else', 'elseif', 'end', 'enum', 'exit', 'filter', 'finally', 'for', 'foreach', 'function', 'if', 'in', 'param', 'process', 'return', 'switch', 'throw', 'trap', 'try', 'until', 'while']);
const QUOTE_CHARS = new Set(["'", '"', ...[0x2018, 0x2019, 0x201A, 0x201B, 0x201C, 0x201D, 0x201E].map(code => String.fromCharCode(code))]);
const PARAMETER_BOUNDARY = /[\s(,{;=|![]/;
// Scope qualifiers and $env: are the only variable prefixes the harnesses use; any other drive (variable:, function:,
// alias:) reaches runtime state or redefines functions.
const ALLOWED_VARIABLE_PREFIXES = /^(?:script|global|local|private|using|env)$/i;

// Splits lexed code into the tokens the allowlist policy checks. Offsets refer to the original source.
export function tokenizeHarnessCode(sourceText) {
  const code = stripPowerShellLiteralsForScan(sourceText);
  const result = {barewords: [], declared: new Set(), members: [], statics: [], types: [], dynamicMembers: [], problems: []};
  const stack = [];
  let index = 0, last = 'start', lastWord = null, afterPipe = false;
  const problem = (kind, at) => result.problems.push(`${kind} at ${at}`);
  while (index < code.length) {
    const char = code[index], next = code[index + 1];
    if (/\s/.test(char)) { index++; continue; }
    const glued = index > 0 && !/\s/.test(code[index - 1]);
    const pipe = afterPipe; afterPipe = false;
    if (char === '$') {
      if (next === '{') {
        const end = code.indexOf('}', index);
        const drive = /^\$\{\s*(\w+):(?!:)/.exec(code.slice(index));
        if (drive && !ALLOWED_VARIABLE_PREFIXES.test(drive[1])) problem(`drive-qualified variable ${drive[0]}}`, index);
        index = end < 0 ? code.length : end + 1; last = 'value'; continue;
      }
      if (next === '(') { stack.push('('); index += 2; last = 'open'; continue; }
      const drive = /^\$(\w+):(?!:)/.exec(code.slice(index));
      if (drive && !ALLOWED_VARIABLE_PREFIXES.test(drive[1])) problem(`drive-qualified variable ${drive[0]}`, index);
      const variable = /^\$(?:(?:script|global|local|private|using|env):)?\w+|^\$[$?^]/i.exec(code.slice(index));
      index += variable ? variable[0].length : 1; last = 'value';
      if (code.startsWith('::', index)) problem('static access on a variable', index);
      continue;
    }
    if (char === '@' && /\w/.test(next ?? '')) problem('splatted arguments', index);
    if (char === '>') problem('redirection', index);
    if (char === '@' && (next === '(' || next === '{')) { stack.push(next === '{' ? 'hash' : '('); index += 2; last = 'open'; continue; }
    if (QUOTE_CHARS.has(char)) { index++; last = 'value'; continue; }
    if (char === '[') {
      if (glued && last === 'value') { stack.push('['); index++; last = 'open'; continue; }
      const typeIndex = index;
      let depth = 0, end = index;
      for (; end < code.length; end++) { if (code[end] === '[') depth++; else if (code[end] === ']' && --depth === 0) break; }
      const content = code.slice(index + 1, end).replace(/\s+/g, '');
      const attribute = /^([\w.]+)\(/.exec(content);
      const typeName = attribute ? attribute[1] : content;
      result.types.push({name: typeName, index});
      index = end + 1; last = 'type';
      if (code.startsWith('::', index)) {
        const member = /^::(\w+)/.exec(code.slice(index));
        if (!member) { problem('static access without a member name', index); index += 2; continue; }
        result.statics.push({type: typeName, name: member[1], index, typeIndex, invoked: code[index + member[0].length] === '('});
        index += member[0].length; last = 'value';
      }
      continue;
    }
    if (char === ':' && next === ':') { problem('static access on an expression', index); index += 2; continue; }
    if (char === '.') {
      if (next === '.') { index += 2; last = 'op'; continue; }
      if (glued && (last === 'value' || last === 'type')) {
        const member = /^\.(\w+)/.exec(code.slice(index));
        if (member) { result.members.push({name: member[1], index, invoked: code[index + member[0].length] === '('}); index += member[0].length; last = 'value'; continue; }
        result.dynamicMembers.push({index}); index++; continue;
      }
      index++; last = 'op'; continue;
    }
    if (char === '-' && /[A-Za-z]/.test(next ?? '') && (index === 0 || PARAMETER_BOUNDARY.test(code[index - 1]))) {
      const parameter = /^-[A-Za-z]\w*/.exec(code.slice(index)); index += parameter[0].length; last = 'op'; continue;
    }
    if (/\d/.test(char)) { const number = /^\d[\w.]*/.exec(code.slice(index)); index += number[0].length; last = 'value'; continue; }
    if (/[A-Za-z_]/.test(char)) {
      const word = /^[A-Za-z_][\w.\\-]*/.exec(code.slice(index))[0].replace(/[.-]+$/, '');
      const start = index; index += word.length;
      const lower = word.toLowerCase();
      if (lastWord === 'function' || lastWord === 'filter') {
        if (result.declared.has(lower)) problem(`function ${word} defined more than once`, start);
        result.declared.add(lower); lastWord = null; last = 'value'; continue;
      }
      lastWord = lower;
      if (stack.at(-1) === 'hash' && /^\s*=(?!=)/.test(code.slice(index))) { last = 'op'; continue; }
      if (KEYWORDS.has(lower) && !pipe) { last = 'op'; continue; }
      result.barewords.push({name: word, index: start, afterPipe: pipe});
      last = 'value'; continue;
    }
    lastWord = null;
    if (char === '{' || char === '(') { stack.push(char); last = 'open'; }
    else if (char === '}' || char === ')' || char === ']') { stack.pop(); last = 'value'; }
    else {
      if (pipe && (char === '%' || char === '?')) problem('pipeline alias', index);
      last = 'op'; if (char === '|') afterPipe = true;
    }
    index++;
  }
  return result;
}

const lowerSet = values => new Set((values ?? []).map(value => value.toLowerCase()));
const pairs = values => (values ?? []).map(value => { const at = value.indexOf('|'); return [value.slice(0, at), value.slice(at + 1)]; });
const COMMAND_END = '(?=[ \\t]*(?:[)};|\\r\\n]|$))';

// Allowlist findings for lexed harness code; see the policy keys above.
export function allowlistViolations(sourceText, policy) {
  const text = String(sourceText);
  const code = stripPowerShellLiteralsForScan(text);
  const tokens = tokenizeHarnessCode(text);
  const extents = functionExtents(code);
  const commands = lowerSet(policy.commands), bare = lowerSet(policy.bareArguments);
  const scoped = new Map(); for (const [name, fn] of pairs(policy.scoped)) scoped.set(name.toLowerCase(), [...(scoped.get(name.toLowerCase()) ?? []), fn]);
  const forms = new Map(); for (const [name, pattern] of pairs(policy.forms)) forms.set(name.toLowerCase(), [...(forms.get(name.toLowerCase()) ?? []), new RegExp(pattern.replace(/\$$/, '') + COMMAND_END)]);
  const pipelines = pairs(policy.pipelines);
  const found = {command: [], member: [], static: [], type: [], structure: [...tokens.problems]};
  for (const word of tokens.barewords) {
    const lower = word.name.toLowerCase(), owner = enclosingFunction(extents, word.index) ?? '';
    if (scoped.has(lower)) { if (!scoped.get(lower).includes(owner)) found.command.push(`${word.name} in ${owner || 'script scope'}`); continue; }
    if (!(commands.has(lower) || tokens.declared.has(lower) || (!word.afterPipe && bare.has(lower)))) { found.command.push(word.name); continue; }
    if (forms.has(lower) && !forms.get(lower).some(pattern => pattern.test(text.slice(word.index)))) found.command.push(`${word.name} (unreviewed form)`);
    if (lower === 'foreach-object' || lower === 'where-object') {
      const rest = text.slice(word.index);
      const exempt = pipelines.some(([fn, exact]) => fn === owner && new RegExp('^' + exact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + COMMAND_END).test(rest));
      if (!/^[\w-]+[ \t]*\{/.test(rest) && !exempt) found.command.push(`${word.name} without a single script block`);
    }
  }
  const dynamicSites = pairs(policy.dynamicMemberSites);
  for (const {index} of tokens.dynamicMembers) {
    const owner = enclosingFunction(extents, index) ?? '', root = chainRoot(code, index)?.root ?? null;
    if (!dynamicSites.some(([fn, name]) => fn === owner && name === root)) found.structure.push(`dynamic member access at ${index}`);
  }
  const members = lowerSet(policy.instance);
  for (const member of tokens.members) if (member.invoked && !members.has(member.name.toLowerCase())) found.member.push(member.name);
  const statics = lowerSet(policy.statics), properties = lowerSet(policy.properties);
  for (const item of tokens.statics) {
    const pair = `${item.type}::${item.name}`;
    if (!(item.invoked ? statics : properties).has(pair.toLowerCase())) found.static.push(pair + (item.invoked ? '()' : ''));
  }
  const types = lowerSet(policy.types);
  for (const type of tokens.types) if (!types.has(type.name.toLowerCase())) found.type.push(type.name);
  return found;
}

// Shared static harness policy: unmodeled syntax fails closed; dynamic code is forbidden outside the exempt
// pure-regression lines and the listed invocation sites; member assignments are limited to local report roots and the
// documented COM setters; and every command, bare word, invoked member, static access and type must be allowlisted.
export function auditHarnessSourcePolicy(sourceText, {label, ...policy}) {
  const failures = [];
  const add = (code, message, values) => { if (values.length) failures.push({code, message: `${label} ${message}: ${[...new Set(values)].join(', ')}`}); };
  add('source-scan-unsupported', 'has PowerShell syntax the source-policy lexer does not model', scanPowerShellSource(sourceText).issues.map(item => `${item.kind}@${item.index}`));
  const invocationSites = pairs(policy.sites).map(([fn, rest]) => { const [operator, variable] = rest.split('|'); return {function: fn || null, operator, variable}; });
  add('dynamic-code', 'must not use dynamic code (Invoke-Expression, iex, Add-Type, Invoke-Command, [scriptblock]::Create, InvokeScript, $ExecutionContext, string-named or non-literal & / . invocations) outside its listed exemptions', dynamicCodeInvocations(sourceText, {exemptFunction: policy.exemptFunction ?? null, exemptInvocations: policy.exemptInvocations ?? [], invocationSites}));
  add('com-property-assignment', 'assigns members outside its local report roots and documented COM setters', disallowedMemberAssignments(sourceText, {localRoots: policy.roots ?? [], comSetters: policy.setters ?? []}));
  add('local-root-binding', 'may bind a local report root only to a literal or a reviewed source', localRootBindings(sourceText, {roots: policy.roots ?? [], rootSources: policy.rootSources ?? []}));
  add('pinned-binding', 'may bind pinned invocation-site and owned-path variables only to their reviewed sources', pinnedBindingViolations(sourceText, {pinned: policy.pinned ?? [], pinnedBindings: policy.pinnedBindings ?? []}));
  add('unreviewed-form', 'calls file-system writes, native helpers or COM path writes in forms outside its reviewed allowlist', exactFormViolations(sourceText, {exactForms: policy.exactForms ?? [], exactApis: policy.exactApis ?? [], exactMembers: policy.exactMembers ?? []}));
  const found = allowlistViolations(sourceText, policy);
  add('forbidden-command', 'uses commands or bare words outside its reviewed allowlist', found.command);
  add('forbidden-member', 'invokes members outside its reviewed allowlist', found.member);
  add('forbidden-static', 'uses static members outside its reviewed allowlist', found.static);
  add('forbidden-type', 'uses types outside its reviewed allowlist', found.type);
  add('dynamic-code', 'uses unsupported dynamic access', found.structure);
  return failures;
}

// The $script:<Prefix>Policy* lists a harness defines, parsed from its source, for Node/PowerShell parity controls.
export function readPowerShellPolicyLists(sourceText, prefix) {
  const lists = {};
  const keys = {Commands: 'commands', ScopedCommands: 'scoped', CommandForms: 'forms', InstanceMembers: 'instance', StaticMembers: 'statics', StaticProperties: 'properties', Types: 'types', InvocationSites: 'sites', PipelineExceptions: 'pipelines', AssignmentRoots: 'roots', ComSetters: 'setters', RootSources: 'rootSources', BareArguments: 'bareArguments', ExactForms: 'exactForms', ExactApis: 'exactApis', ExactMembers: 'exactMembers', Pinned: 'pinned', PinnedBindings: 'pinnedBindings'};
  for (const [suffix, key] of Object.entries(keys)) {
    const match = new RegExp(String.raw`^\$script:${prefix}Policy${suffix}=@\((.*)\)\s*$`, 'm').exec(String(sourceText));
    lists[key] = match ? [...match[1].matchAll(/'((?:[^']|'')*)'/g)].map(item => item[1].replace(/''/g, "'")) : null;
  }
  return lists;
}

// Ways a local report root could alias a COM object, which would let root-based member assignments reach it: binding
// the root to anything but a hashtable literal or a reviewed exact source ('root|source' in rootSources), a multiple
// assignment, a parameter, a foreach variable, or a variable-binding common parameter (-OutVariable, -PipelineVariable,
// -ErrorVariable, -WarningVariable, -InformationVariable and their aliases or prefixes).
export function localRootBindings(sourceText, {roots = [], rootSources = []} = {}) {
  const text = String(sourceText), code = stripPowerShellLiteralsForScan(text);
  const rootSet = new Set(roots), sources = pairs(rootSources), found = [];
  const name = variable => variable.replace(/^\$/, '').replace(/^(?:script|global|local|private):/i, '');
  for (const match of code.matchAll(/\$[\w:]+(?:\s*,\s*\$[\w:]+)+\s*=(?!=)/g)) {
    for (const variable of match[0].match(/\$[\w:]+/g)) if (rootSet.has(name(variable))) found.push(`multiple assignment of $${name(variable)} at ${match.index}`);
  }
  for (const match of code.matchAll(new RegExp(String.raw`\$${SCOPE_PREFIX}(\w+)\s*([-+*/%]?=)(?!=)`, 'gi'))) {
    if (!rootSet.has(match[1]) || /,\s*$/.test(code.slice(0, match.index))) continue;
    let start = match.index + match[0].length;
    while (/[ \t]/.test(code[start] ?? '')) start++;
    const literal = match[2] === '=' && /^(?:\[\s*(?:ordered|pscustomobject)\s*\]\s*)?@\{/i.test(code.slice(start));
    const reviewed = sources.some(([root, source]) => root === match[1] && text.startsWith(source, start) && /^[ \t]*(?:;|\r?\n|\}|$)/.test(text.slice(start + source.length)));
    if (!literal && !reviewed) found.push(`$${match[1]} bound to an unreviewed source at ${match.index}`);
  }
  for (const match of code.matchAll(new RegExp(String.raw`\bforeach\s*\(\s*\$${SCOPE_PREFIX}(\w+)\s+in\b`, 'gi'))) if (rootSet.has(match[1])) found.push(`foreach variable $${match[1]} at ${match.index}`);
  for (const match of code.matchAll(/(?:\bparam|\bfunction\s+[\w-]+)\s*\(/gi)) {
    let depth = 0, end = match.index + match[0].length - 1;
    for (; end < code.length; end++) { if (code[end] === '(') depth++; else if (code[end] === ')' && --depth === 0) break; }
    for (const variable of code.slice(match.index, end).matchAll(new RegExp(String.raw`\$${SCOPE_PREFIX}(\w+)`, 'gi'))) if (rootSet.has(variable[1])) found.push(`parameter $${variable[1]} at ${match.index}`);
  }
  for (const match of code.matchAll(/(?<=[\s(])-(?:ov|pv|ev|wv|iv|outv[a-z]*|errorv[a-z]*|warningv[a-z]*|informationv[a-z]*|pipelinev[a-z]*|pi|pip|pipe|pipel|pipeli|pipelin|pipeline)(?![\w-])/gi)) found.push(`variable-binding parameter ${match[0]} at ${match.index}`);
  return found;
}

// Whitespace-flexible regex for one reviewed exact form (whitespace-normalized text), anchored at the start and
// followed by the end of the command or expression.
function exactFormRegex(text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp(`^${escaped}(?=[ \\t]*(?:[)};|,\\r\\n]|$))`);
}
const normalizeSpace = text => text.replace(/\s+/g, ' ').trim();

// Reviewed exact forms: every call of a command in exactForms, every static call in exactApis and every instance call
// in exactMembers must match one reviewed whitespace-normalized text ('Name|text' pairs).
export function exactFormViolations(sourceText, {exactForms = [], exactApis = [], exactMembers = []} = {}) {
  const text = String(sourceText), tokens = tokenizeHarnessCode(text), found = [];
  const group = entries => { const map = new Map(); for (const [key, form] of pairs(entries)) map.set(key.toLowerCase(), [...(map.get(key.toLowerCase()) ?? []), exactFormRegex(form)]); return map; };
  const forms = group(exactForms), apis = group(exactApis), members = group(exactMembers);
  for (const word of tokens.barewords) {
    const patterns = forms.get(word.name.toLowerCase());
    if (patterns && !patterns.some(pattern => pattern.test(text.slice(word.index)))) found.push(`${word.name} at ${word.index}`);
  }
  for (const item of tokens.statics) {
    const patterns = apis.get(`${item.type}::${item.name}`.toLowerCase());
    if (patterns && !patterns.some(pattern => pattern.test(text.slice(item.typeIndex)))) found.push(`${item.type}::${item.name} at ${item.typeIndex}`);
  }
  for (const member of tokens.members) {
    const patterns = members.get(member.name.toLowerCase());
    if (member.invoked && patterns && !patterns.some(pattern => pattern.test(text.slice(member.index)))) found.push(`.${member.name} at ${member.index}`);
  }
  return found;
}

// PowerShell's ParameterAst.StaticType.Name for the type constraints the harnesses use.
const PARAMETER_TYPES = {'': 'Object', string: 'String', 'string[]': 'String[]', int: 'Int32', long: 'Int64', double: 'Double', bool: 'Boolean', switch: 'SwitchParameter', scriptblock: 'ScriptBlock', hashtable: 'Hashtable'};

// Every binding of a pinned variable (invocation-site variables and owned paths): assignments (any scope prefix or
// braced form), foreach variables, parameters and increments must be one of the reviewed 'name|=|source',
// 'name|foreach|condition' or 'name|param|Function|Type' entries.
export function pinnedBindingViolations(sourceText, {pinned = [], pinnedBindings = []} = {}) {
  const text = String(sourceText), code = stripPowerShellLiteralsForScan(text);
  const names = new Set(pinned.map(name => name.toLowerCase())), found = [];
  const reviewed = new Set(pinnedBindings);
  const sources = new Map();
  for (const binding of pinnedBindings) {
    const [name, kind, ...rest] = binding.split('|');
    if (kind === '=') sources.set(name, [...(sources.get(name) ?? []), exactFormRegex(rest.join('|'))]);
  }
  const extents = functionExtents(code);
  for (const match of code.matchAll(/\$[\w:{}]+(?:\s*,\s*\$[\w:{}]+)+\s*=(?!=)/g)) {
    for (const variable of match[0].match(/\$[\w:{}]+/g)) {
      const name = variable.replace(/^\$\{?/, '').replace(/\}$/, '').replace(/^(?:script|global|local|private):/i, '').toLowerCase();
      if (names.has(name)) found.push(`multiple assignment of $${name} at ${match.index}`);
    }
  }
  for (const match of code.matchAll(new RegExp(String.raw`(?<![\w$.\]])\$\{?${SCOPE_PREFIX}(\w+)\}?\s*([-+*/%]?=)(?!=)`, 'gi'))) {
    const name = match[1].toLowerCase();
    if (!names.has(name) || /,\s*$/.test(code.slice(0, match.index))) continue;
    let start = match.index + match[0].length;
    while (/\s/.test(text[start] ?? '')) start++;
    if (match[2] !== '=' || !(sources.get(name) ?? []).some(pattern => pattern.test(text.slice(start)))) found.push(`$${name} bound to an unreviewed source at ${match.index}`);
  }
  for (const match of code.matchAll(new RegExp(String.raw`\bforeach\s*\(\s*\$${SCOPE_PREFIX}(\w+)\s+in\s+`, 'gi'))) {
    const name = match[1].toLowerCase();
    if (!names.has(name)) continue;
    let depth = 1, end = match.index + match[0].length;
    for (; end < code.length; end++) { if (code[end] === '(') depth++; else if (code[end] === ')' && --depth === 0) break; }
    if (!reviewed.has(`${name}|foreach|${normalizeSpace(text.slice(match.index + match[0].length, end))}`)) found.push(`foreach variable $${name} at ${match.index}`);
  }
  for (const match of code.matchAll(/(?:\bparam|\bfunction\s+([\w-]+))\s*\(/gi)) {
    const owner = match[1] ?? enclosingFunction(extents, match.index) ?? '';
    let depth = 0, end = match.index + match[0].length - 1;
    for (; end < code.length; end++) { if (code[end] === '(') depth++; else if (code[end] === ')' && --depth === 0) break; }
    const list = code.slice(match.index + match[0].length, end);
    const parameters = [];
    let current = '', level = 0;
    for (const char of list) { if ('([{'.includes(char)) level++; if (')]}'.includes(char)) level--; if (char === ',' && level === 0) { parameters.push(current); current = ''; } else current += char; }
    parameters.push(current);
    for (const parameter of parameters) {
      const variable = new RegExp(String.raw`\$${SCOPE_PREFIX}(\w+)`, 'i').exec(parameter);
      if (!variable || !names.has(variable[1].toLowerCase())) continue;
      const constraints = [];
      const prefix = parameter.slice(0, variable.index);
      for (let at = prefix.indexOf('['); at >= 0; at = prefix.indexOf('[', at)) {
        let level = 0, close = at;
        for (; close < prefix.length; close++) { if (prefix[close] === '[') level++; else if (prefix[close] === ']' && --level === 0) break; }
        const content = prefix.slice(at + 1, close).replace(/\s+/g, '').toLowerCase();
        if (!content.includes('(')) constraints.push(content);
        at = close + 1;
      }
      const typeName = PARAMETER_TYPES[constraints.at(-1) ?? ''] ?? constraints.at(-1);
      const name = variable[1].toLowerCase();
      if (!reviewed.has(`${name}|param|${owner}|${typeName}`)) found.push(`parameter $${name} of ${owner || 'script'} typed ${typeName} at ${match.index}`);
    }
  }
  for (const match of code.matchAll(new RegExp(String.raw`(?:\+\+|--)\s*\$\{?${SCOPE_PREFIX}(\w+)|\$\{?${SCOPE_PREFIX}(\w+)\}?\s*(?:\+\+|--)`, 'gi'))) {
    const name = (match[1] ?? match[2]).toLowerCase();
    if (names.has(name)) found.push(`increment of $${name} at ${match.index}`);
  }
  return found;
}
