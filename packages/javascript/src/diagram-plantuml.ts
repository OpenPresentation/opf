// SH-13: PlantUML diagrams. OPF reads PlantUML itself (no PlantUML code ships: PlantUML is GPL) and writes each diagram as the pele
// diagram that draws it, so a PlantUML diagram is laid out, sized, painted and exported exactly as that Mermaid family is: sequence
// diagrams as pele's sequence, class diagrams as its class diagram, state diagrams as its state diagram, activity diagrams (the current
// syntax) and component and deployment diagrams as its flowchart, use case diagrams as its use case diagram, mind maps as its mind map and
// gantt charts as its gantt. Every other PlantUML diagram (timing, object, network, salt, JSON, YAML, WBS, the legacy activity syntax,
// ...) and the preprocessor (`!include`, `!define`, variables) are refused with the position of what stops them, never approximated.
// PlantUML's styling (skinparam, colors, fonts, themes) is ignored: the deck decides colors and fonts.

/** Why a PlantUML source cannot be drawn, with its 1-based position. */
export interface PlantumlIssue {
  code: 'diagram-syntax' | 'diagram-unsupported' | 'diagram-limit';
  message: string;
  line?: number;
  column?: number;
}

/** The PlantUML diagram types OPF draws (diagram.ts PLANTUML_DIAGRAMS names the pele family of each). */
export type PlantumlDiagram = 'sequence' | 'class' | 'state' | 'activity' | 'usecase' | 'component' | 'mindmap' | 'gantt';

/** A PlantUML diagram as the pele source that draws it. */
export interface PlantumlTranslation {
  /** The PlantUML diagram type (a key of PLANTUML_DIAGRAMS). */
  diagram: PlantumlDiagram;
  /** Mermaid source pele draws. */
  mermaid: string;
}

class PlantumlError extends Error {
  constructor(readonly issue: PlantumlIssue) { super(issue.message); }
}

/** A source line: its text without comments, trimmed; its 1-based number; its indentation (a tab counts two). */
interface Line { text: string; line: number; indent: number }

const fail = (code: PlantumlIssue['code'], message: string, line?: number, column?: number): never => {
  throw new PlantumlError({ code, message, ...(line !== undefined ? { line, column: column ?? 1 } : {}) });
};

// The @start tags of diagram kinds OPF does not draw, named as a reader would.
const OTHER_KINDS: Readonly<Record<string, string>> = {
  wbs: 'work breakdown structure', json: 'JSON', yaml: 'YAML', salt: 'Salt wireframe', ditaa: 'ditaa', dot: 'Graphviz DOT (write it with syntax "dot")', math: 'math',
  latex: 'LaTeX', creole: 'Creole', board: 'board', chen: 'Chen entity relationship', ebnf: 'EBNF', regex: 'regular expression', files: 'files', chronology: 'chronology',
  nwdiag: 'network', archimate: 'ArchiMate', jcckit: 'JCCKit', flow: 'flow', git: 'git', project: 'project',
};

/** Source lines between @start and @end, without comments; the @start kind. */
function readLines(source: string): { kind: string; lines: Line[] } {
  const raw = source.split(/\r?\n/);
  let kind = '', start = -1, end = raw.length;
  for (let index = 0; index < raw.length; index++) {
    const match = /^\s*@start(\w+)/i.exec(raw[index]!);
    if (match) { kind = match[1]!.toLowerCase(); start = index; break; }
    if (raw[index]!.trim() && !/^\s*'/.test(raw[index]!)) break;
  }
  if (start < 0) fail('diagram-syntax', 'A PlantUML source starts with @startuml (or @startmindmap, @startgantt).', 1, 1);
  for (let index = start + 1; index < raw.length; index++) {
    if (/^\s*@end\w*/i.test(raw[index]!)) { end = index; break; }
    if (/^\s*@start\w*/i.test(raw[index]!)) fail('diagram-unsupported', 'A PlantUML source holds one diagram: draw each @start ... @end block as its own diagram.', index + 1, 1);
  }
  if (end === raw.length) fail('diagram-syntax', `The diagram is not closed with @end${kind}.`, raw.length, 1);
  for (let index = end + 1; index < raw.length; index++) {
    if (raw[index]!.trim() && !/^\s*'/.test(raw[index]!)) fail('diagram-unsupported', 'A PlantUML source holds one diagram: draw each @start ... @end block as its own diagram.', index + 1, 1);
  }
  const lines: Line[] = [];
  let comment = false;
  for (let index = start + 1; index < end; index++) {
    let text = raw[index]!;
    if (comment) {
      const close = text.indexOf("'/");
      if (close < 0) continue;
      text = text.slice(close + 2);
      comment = false;
    }
    // Block comments /' ... '/ (possibly several on one line), then a ' line comment.
    for (;;) {
      const open = text.indexOf("/'");
      if (open < 0) break;
      const close = text.indexOf("'/", open + 2);
      if (close < 0) { text = text.slice(0, open); comment = true; break; }
      text = text.slice(0, open) + text.slice(close + 2);
    }
    if (/^\s*'/.test(text)) continue;
    lines.push({ text: text.trim(), line: index + 1, indent: (/^[ \t]*/.exec(text)![0]).replace(/\t/g, '  ').length });
  }
  return { kind, lines };
}

// Statements every kind ignores: styling, visibility and page furniture the deck draws itself.
const STYLING = /^(skinparam\b|hide\b|show\b|scale\b|!theme\b|!pragma\b|allowmixing\b|set\s+namespaceseparator\b|header\b|footer\b|caption\b|newpage\b|left\s+to\s+right\s+direction\b|top\s+to\s+bottom\s+direction\b|autoactivate\b|<style>|mainframe\b)/i;

/** Remove styling statements (with their blocks) and refuse the preprocessor; returns the title and the direction if given. */
function strip(lines: Line[]): { lines: Line[]; title?: string; direction?: 'LR' | 'TB' } {
  const kept: Line[] = [];
  let title: string | undefined, direction: 'LR' | 'TB' | undefined;
  for (let index = 0; index < lines.length; index++) {
    const { text, line } = lines[index]!;
    if (!text) continue;
    if (/^!(include|includeurl|includesub|import|define|definelong|undef|function|procedure|unquoted|if|ifdef|ifndef|else|endif|while|foreach|log|dump|assert|startsub|endsub|\$)/i.test(text) || /^\$\w+\s*=/.test(text)) {
      fail('diagram-unsupported', `OPF does not run PlantUML's preprocessor (${text.split(/\s/)[0]}); write the diagram out in full.`, line, 1);
    }
    if (/^left\s+to\s+right\s+direction\b/i.test(text)) direction = 'LR';
    else if (/^top\s+to\s+bottom\s+direction\b/i.test(text)) direction = 'TB';
    if (/^<style>/i.test(text)) { while (index < lines.length && !/<\/style>/i.test(lines[index]!.text)) index++; continue; }
    if (/^(skinparam\b.*\{|legend\b|title\s*$)/i.test(text) && !/^title\s*$/i.test(text) || /^legend\b/i.test(text)) {
      // A block: skinparam x { ... }, legend ... endlegend.
      const closing = /^legend\b/i.test(text) ? /^end\s*legend\b/i : /^\}/;
      while (index < lines.length && !closing.test(lines[index]!.text)) index++;
      continue;
    }
    if (/^title\s*$/i.test(text)) {
      const body: string[] = [];
      while (++index < lines.length && !/^end\s*title\b/i.test(lines[index]!.text)) body.push(lines[index]!.text);
      title = body.join(' ').trim();
      continue;
    }
    const titled = /^title\s+(.+)$/i.exec(text);
    if (titled) { title = plainText(titled[1]!); continue; }
    if (/^(header|footer|caption)\s*$/i.test(text)) {
      const closing = new RegExp(`^end\\s*${text.toLowerCase()}\\b`, 'i');
      while (index < lines.length && !closing.test(lines[index]!.text)) index++;
      continue;
    }
    if (STYLING.test(text)) continue;
    kept.push(lines[index]!);
  }
  return { lines: kept, ...(title ? { title } : {}), ...(direction ? { direction } : {}) };
}

/** PlantUML text with its markup read: \n breaks a line, creole bold and italics and HTML-like tags are text. */
function plainText(text: string): string {
  return text.replace(/\\n/g, '\n').replace(/\\t/g, ' ').replace(/<\/?(b|i|u|s|font|color|size|back|strike|del|sup|sub|w|plain)\b[^>]*>/gi, '')
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\/\/(.+?)\/\//g, '$1').replace(/""(.+?)""/g, '$1').replace(/__(.+?)__/g, '$1').replace(/~~(.+?)~~/g, '$1').trim();
}

const unquote = (text: string) => /^".*"$/.test(text.trim()) ? text.trim().slice(1, -1) : text.trim();

/** Text in a Mermaid label in double quotes. */
function quoted(text: string): string {
  return text.replace(/[#"<>&\\]/g, char => ({ '#': '#35;', '"': '#quot;', '<': '#lt;', '>': '#gt;', '&': '#amp;', '\\': '#92;' })[char]!).split('\n').join('<br>');
}
/** Text in a Mermaid label without quotes (sequence messages and notes, class members): what pele would read as syntax as entities. */
function bare(text: string): string {
  return text.replace(/[#;<>&\\"]/g, char => ({ '#': '#35;', ';': '#59;', '<': '#lt;', '>': '#gt;', '&': '#amp;', '\\': '#92;', '"': '#quot;' })[char]!).split('\n').join('<br>');
}
const yamlQuoted = (text: string) => `'${text.replace(/\s*\n\s*/g, ' ').replace(/'/g, "''")}'`;
const titled = (title: string | undefined, header: string) => title ? `---\ntitle: ${yamlQuoted(title)}\n---\n${header}` : header;

/** Mermaid identifiers for PlantUML names. */
class Ids {
  private readonly ids = new Map<string, string>();
  private readonly used = new Set<string>();
  constructor(private readonly prefix = 'n') {}
  of(name: string): string {
    let id = this.ids.get(name);
    if (id) return id;
    if (/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(name) && !RESERVED.has(name.toLowerCase()) && !this.used.has(name)) id = name;
    else { let index = this.ids.size; while (this.used.has(`${this.prefix}${index}`)) index++; id = `${this.prefix}${index}`; }
    this.used.add(id);
    this.ids.set(name, id);
    return id;
  }
  has(name: string): boolean { return this.ids.has(name); }
}
const RESERVED = new Set(['end', 'graph', 'flowchart', 'subgraph', 'style', 'classdef', 'class', 'click', 'linkstyle', 'direction', 'call', 'href', 'default', 'interpolate', 'acctitle', 'accdescr', 'callback', 'td', 'tb', 'bt', 'rl', 'lr', 'note', 'state', 'participant', 'actor', 'as', 'loop', 'alt', 'else', 'opt', 'par', 'and', 'rect', 'critical', 'break', 'box', 'activate', 'deactivate', 'create', 'destroy', 'autonumber', 'title', 'section', 'namespace', 'over', 'left', 'right', 'of', 'for', 'systemboundary', 'usecase', 'root', 'option']);

// ---- Kind detection (PlantUML's own rule is a search of the source for each kind's statements; this is the same search).

function detect(kind: string, lines: Line[]): PlantumlDiagram {
  if (kind === 'mindmap') return 'mindmap';
  if (kind === 'gantt') return 'gantt';
  if (kind !== 'uml') fail('diagram-unsupported', `OPF does not draw PlantUML ${OTHER_KINDS[kind] ?? `@start${kind}`} diagrams; it draws sequence, class, state, activity, use case, component and deployment diagrams, mind maps and gantt charts.`, 1, 1);
  const texts = lines.map(line => line.text);
  const any = (pattern: RegExp) => texts.some(text => pattern.test(text));
  const refuse = (what: string, pattern: RegExp) => {
    const at = lines.find(line => pattern.test(line.text));
    if (at) fail('diagram-unsupported', `OPF does not draw PlantUML ${what}; it draws sequence, class, state, activity, use case, component and deployment diagrams, mind maps and gantt charts.`, at.line, 1);
  };
  refuse('timing diagrams', /^(robust|concise|clock|binary|analog)\s/i);
  refuse('object diagrams', /^(object|map)\s+("[^"]*"|\w+)(\s+as\s+\w+)?\s*(\{|$)/i);
  refuse('network diagrams', /^nwdiag\b/i);
  refuse('ArchiMate diagrams', /^archimate\b/i);
  refuse('entity relationship diagrams (write them in Mermaid)', /^entity\s+("[^"]*"|\w+)(\s+as\s+\w+)?\s*\{/i);
  if (any(/^\(\*\)/) || any(/-->\s*\(\*\)/)) refuse('legacy activity diagrams (write the activity with start, :action; and stop)', /\(\*\)/);
  if (any(/^(start|stop|kill|detach)$/i) || any(/^:[^:]*$/) || any(/^:[\s\S]*;$/) || any(/^(if\s*\(.*\)\s*(is\s*\(.*\)\s*)?then\b|while\s*\(|repeat\s*$|fork\s*$|partition\s)/i) || any(/^\|[^|]+\|$/)) return 'activity';
  const component = any(/^\[[^\]*]+\]/) || any(/^(component|node|cloud|artifact|folder|frame|storage|card|file|agent|stack|port|portin|portout|hexagon)\s/i) || any(/^\(\)\s/);
  const classes = any(/^(abstract\s+class|abstract|class|enum|annotation|struct|exception|protocol|record|metaclass|stereotype|dataclass)\s+/i) || any(/^interface\s+\S+\s*\{/i);
  const cases = any(/^usecase\s/i) || any(/(^|\s|-)\([^()*]+\)(\s|$|-)/) || any(/^(actor\s+)?:[^:]+:/);
  if (classes && !component) return 'class';
  if (cases && !component) return 'usecase';
  if (any(/\[\*\]/) || any(/^state\s+/i)) return 'state';
  if (component) return 'component';
  if (any(/(<\|--|--\|>|\*--|--\*|o--|--o|<\|\.\.|\.\.\|>)/) && !any(/^(participant|actor|boundary|control|entity|database|collections|queue)\s/i)) return 'class';
  if (any(/^(participant|actor|boundary|control|entity|database|collections|queue)\s/i) || any(/^("[^"]+"|[\w.]+)\s*(<?-{1,2}(>{1,2}|\\{1,2}|\/{1,2}|x|o)?|<{1,2}-{1,2})\s*("[^"]+"|[\w.]+)\s*(\+\+|--|\*\*|!!)?\s*(:|$)/) || any(/^(activate|deactivate|autonumber|alt|loop|opt|par|group)\b/i)) {
    // An actor in a rectangle with links and no messages is a use case diagram.
    if (any(/^actor\b/i) && any(/^(rectangle|package)\b[^{]*\{/i) && !any(/^(participant|boundary|control|collections|queue)\b/i)) return 'usecase';
    return 'sequence';
  }
  if (any(/^(interface|database|queue|package|rectangle)\s/i)) return 'component';
  return fail('diagram-unsupported', 'OPF could not tell which PlantUML diagram this is; it draws sequence, class, state, activity, use case, component and deployment diagrams, mind maps and gantt charts.', lines[0]?.line ?? 1, 1);
}

// ---- Links: PlantUML's arrow, read once for class, state, use case and component diagrams.

interface Link {
  from: string; to: string;
  /** Head decorations at the left and right end (`<|`, `*`, `o`, `>`, `x`, `#`, `+`, `^`, `{`, `}`, `(`, `)`). */
  left: string; right: string;
  /** The line: solid, dotted (`..`), bold (`==`), or hidden. */
  line: 'solid' | 'dotted' | 'bold' | 'hidden';
  length: number;
  label?: string;
  leftLabel?: string; rightLabel?: string;
}

const NAME = String.raw`(?:"[^"]+"|\[[^\]]+\]|\(\)\s*"?[^"\s]+"?|\([^)]+\)|:[^:]+:|[\w.$\u0080-\uFFFF]+|\[\*\])`;
const ARROW = String.raw`(<\|?|<<|\*|o|#|x|\}|\{|\+|\^|\(0?|0?\))?([-.=~]+)(?:\[([^\]]*)\])?(up|down|left|right|u|d|l|r)?([-.=~]*)(\|>|>>|>|\*|o|#|x|\{|\}|\+|\^|\)0?|0?\()?`;
const LINK = new RegExp(String.raw`^(${NAME})\s*(?:"([^"]*)"\s*)?${ARROW}\s*(?:"([^"]*)"\s*)?(${NAME})\s*(?::\s*(.*))?$`, 'u');

function readLink(text: string): Link | undefined {
  const match = LINK.exec(text);
  if (!match) return undefined;
  const [, from, leftLabel, left = '', body1 = '', style = '', , body2 = '', right = '', rightLabel, to, label] = match;
  const body = body1 + body2;
  if (!/[-.=~]/.test(body)) return undefined;
  const line = /hidden/i.test(style) ? 'hidden' : body.includes('.') || /dashed|dotted/i.test(style) ? 'dotted' : body.includes('=') || /bold|thickness=[2-9]/i.test(style) ? 'bold' : 'solid';
  return {
    from: from!, to: to!, left, right, line, length: Math.max(1, body.replace(/[^-.=~]/g, '').length - 1),
    ...(label?.trim() ? { label: plainText(label.replace(/\s+[<>]$|^[<>]\s+/g, '')) } : {}),
    ...(leftLabel ? { leftLabel: plainText(leftLabel) } : {}), ...(rightLabel ? { rightLabel: plainText(rightLabel) } : {}),
  };
}

/** A block of lines from an opening line to its closing `}` (or a matching end keyword), for containers. */
function blockEnd(lines: Line[], from: number, closing: RegExp, opening: RegExp): number {
  let depth = 1;
  for (let index = from + 1; index < lines.length; index++) {
    if (closing.test(lines[index]!.text)) { if (--depth === 0) return index; }
    else if (opening.test(lines[index]!.text)) depth++;
  }
  return fail('diagram-syntax', 'A block opened here is not closed.', lines[from]!.line, 1);
}

const unknown = (line: Line, what: string): never => fail('diagram-syntax', `OPF cannot read this line of a PlantUML ${what} diagram: ${JSON.stringify(line.text.length > 60 ? `${line.text.slice(0, 57)}...` : line.text)}.`, line.line, 1);

/** Note blocks (`note ... end note`) as one line of text; `lines` from `index`; returns the text and the last index. */
function noteBlock(lines: Line[], index: number, first: string): { text: string; end: number } {
  const body: string[] = first ? [first] : [];
  let at = index;
  while (++at < lines.length && !/^end\s*(note|hnote|rnote)\b/i.test(lines[at]!.text)) body.push(lines[at]!.text);
  if (at >= lines.length) fail('diagram-syntax', 'A note is not closed with end note.', lines[index]!.line, 1);
  return { text: plainText(body.join('\n')), end: at };
}

// ---- Sequence diagrams -> pele sequence.

const PARTICIPANT = /^(participant|actor|boundary|control|entity|database|collections|queue)\s+(?:"([^"]+)"\s+as\s+([\w.]+)|([\w.]+)\s+as\s+"([^"]+)"|([\w.]+)\s+as\s+([\w.]+)|"([^"]+)"|([\w.\u0080-\uFFFF]+))\s*(<<[^>]*>>)?\s*(#\S+)?\s*(order\s+-?\d+)?\s*$/iu;
const MESSAGE = /^(\[|"[^"]+"|[\w.\u0080-\uFFFF]+)?\s*(\[?)([xo]?<{1,2}|x|o)?(-{1,2})(\[[^\]]*\])?((?:>{1,2}|\\{1,2}|\/{1,2})[xo]?|x|o)?(\]?)\s*(\]|"[^"]+"|[\w.\u0080-\uFFFF]+)?\s*(\+\+|--|\*\*|!!)?\s*(?::\s*(.*))?$/u;

function sequence(lines: Line[], title: string | undefined, maxEdges: number): string {
  const out: string[] = [];
  const ids = new Ids('p');
  const declared = new Set<string>();
  const order: string[] = [];
  const declare = (name: string, kind = 'participant', alias?: string) => {
    const id = ids.of(name);
    if (declared.has(id)) return id;
    declared.add(id);
    order.push(id);
    const label = alias ?? name;
    const meta: string[] = [];
    if (kind !== 'participant' && kind !== 'actor') meta.push(`"type": "${kind}"`);
    if (label !== id) meta.push(`"alias": ${JSON.stringify(bare(label))}`);
    out.push(`  ${kind === 'actor' ? 'actor' : 'participant'} ${id}${meta.length ? `@{ ${meta.join(', ')} }` : ''}`);
    return id;
  };
  const frames: string[] = [];
  let messages = 0, last: { from: string; to: string } | undefined, groupLabel: string | undefined;
  const callStack: Array<{ from: string; to: string }> = [];
  for (let index = 0; index < lines.length; index++) {
    const current = lines[index]!;
    const { text } = current;
    let match: RegExpExecArray | null;
    match = PARTICIPANT.exec(text);
    if (match) {
      const kind = match[1]!.toLowerCase();
      const name = match[3] ?? match[4] ?? match[6] ?? match[8] ?? match[9]!;
      const label = match[2] ?? match[5] ?? match[7] ?? match[8] ?? undefined;
      declare(name, kind, label && label !== name ? plainText(label) : undefined);
      continue;
    }
    if (/^autonumber\b/i.test(text)) { out.push('  autonumber'); continue; }
    match = /^(activate|deactivate|destroy)\s+("[^"]+"|[\w.]+)/i.exec(text);
    if (match) { out.push(`  ${match[1]!.toLowerCase()} ${declare(unquote(match[2]!))}`); continue; }
    match = /^create\s+(?:(participant|actor|boundary|control|entity|database|collections|queue)\s+)?("[^"]+"|[\w.]+)/i.exec(text);
    if (match) {
      const name = unquote(match[2]!);
      out.push(`  create ${match[1]?.toLowerCase() === 'actor' ? 'actor' : 'participant'} ${ids.of(name)}`);
      declared.add(ids.of(name));
      order.push(ids.of(name));
      continue;
    }
    match = /^box\b\s*("[^"]*"|[^#]*)?/i.exec(text);
    if (match) { out.push(`  box ${bare(plainText(unquote(match[1] ?? '')) || ' ')}`); frames.push('box'); continue; }
    if (/^end\s*box\b/i.test(text)) { out.push('  end'); frames.pop(); continue; }
    match = /^(alt|opt|loop|par|break|critical|group)\b\s*(.*)$/i.exec(text);
    if (match) {
      const kind = match[1]!.toLowerCase(), label = plainText(match[2]!.replace(/^#\S+\s*/, '').replace(/\[([^\]]*)\]/, '$1'));
      // pele has no labeled group: a group is a box whose label is a note over the first message in it.
      if (kind === 'group') { out.push('  rect'); groupLabel = label || undefined; }
      else out.push(`  ${kind}${label ? ` ${bare(label)}` : ''}`);
      frames.push(kind);
      continue;
    }
    match = /^else\b\s*(.*)$/i.exec(text);
    if (match) {
      const frame = frames.at(-1);
      if (!frame || !['alt', 'par', 'critical'].includes(frame)) unknown(current, 'sequence');
      out.push(`  ${frame === 'par' ? 'and' : frame === 'critical' ? 'option' : 'else'}${match[1]!.trim() ? ` ${bare(plainText(match[1]!.replace(/^#\S+\s*/, '')))}` : ''}`);
      continue;
    }
    if (/^end$/i.test(text)) {
      if (!frames.length) unknown(current, 'sequence');
      frames.pop();
      out.push('  end');
      continue;
    }
    match = /^(note|hnote|rnote)\s+(left|right|over)(?:\s+of)?\s*([^:]*?)\s*(#\S+)?\s*(?::\s*(.*))?$/i.exec(text);
    if (match) {
      const side = match[2]!.toLowerCase();
      let body = match[5];
      if (body === undefined) { const block = noteBlock(lines, index, ''); body = block.text; index = block.end; }
      const names = match[3]!.split(',').map(name => unquote(name)).filter(Boolean);
      const targets = names.length ? names.map(name => declare(name)) : last ? [last.to] : order.slice(0, 1);
      if (!targets.length) unknown(current, 'sequence');
      out.push(`  Note ${side === 'over' ? 'over' : `${side} of`} ${(side === 'over' ? targets.slice(0, 2) : targets.slice(0, 1)).join(',')}: ${bare(plainText(body!)) || ' '}`);
      continue;
    }
    match = /^ref\s+over\s+([^:]+?)\s*(?::\s*(.*))?$/i.exec(text);
    if (match) {
      let body = match[2];
      if (body === undefined) { const block = noteBlock(lines.map(line => ({ ...line, text: line.text.replace(/^end\s*ref\b/i, 'end note') })), index, ''); body = block.text; index = block.end; }
      const targets = match[1]!.split(',').map(name => declare(unquote(name)));
      out.push(`  Note over ${targets.slice(0, 2).join(',')}: ref ${bare(plainText(body!))}`);
      continue;
    }
    match = /^={2,}\s*(.*?)\s*={2,}$/.exec(text);
    if (match) {
      // A divider: a note over every participant so far.
      if (order.length) out.push(`  Note over ${order.length > 1 ? `${order[0]},${order.at(-1)}` : order[0]}: ${bare(plainText(match[1]!)) || ' '}`);
      continue;
    }
    if (/^(\.{3}.*\.{3}|\.{3}|\|{3}|\|\|\d+\|\|)$/.test(text)) continue;
    match = /^return\b\s*(.*)$/i.exec(text);
    if (match) {
      const call = callStack.pop() ?? last;
      if (!call) unknown(current, 'sequence');
      out.push(`  ${call!.to}-->>-${call!.from}: ${bare(plainText(match[1]!)) || ' '}`);
      continue;
    }
    match = MESSAGE.exec(text);
    if (match && match[4] && (match[1] || match[8])) {
      const [, rawFrom, openLeft, leftHead = '', dashes = '', , rightHead = '', openRight, rawTo, activation, label] = match;
      if (rawFrom === '[' || rawTo === ']' || openLeft || openRight) fail('diagram-unsupported', 'A message from or to outside the diagram ([-> or ->]) is not drawn; name the participant it comes from or goes to.', current.line, 1);
      if (!rawFrom || !rawTo) unknown(current, 'sequence');
      let from = declare(unquote(rawFrom!)), to = declare(unquote(rawTo!));
      // A left head (A <- B) is the message from B to A.
      let head = rightHead, dashed = dashes.length > 1 || /dashed|dotted/i.test(match[5] ?? '');
      if (leftHead && !rightHead) { [from, to] = [to, from]; head = leftHead.includes('x') ? 'x' : leftHead.replace(/[xo]/g, '').length > 1 ? '>>' : '>'; }
      const both = !!leftHead && !!rightHead;
      const arrow = both ? (dashed ? '<<-->>' : '<<->>') : head.includes('x') ? (dashed ? '--x' : '-x') : head === '>>' || head.startsWith('\\') || head.startsWith('/') ? (dashed ? '--)' : '-)') : (dashed ? '-->>' : '->>');
      const act = activation === '++' ? '+' : activation === '--' ? '-' : '';
      if (groupLabel !== undefined) { out.push(`  Note over ${from === to ? from : `${from},${to}`}: ${bare(groupLabel)}`); groupLabel = undefined; }
      out.push(`  ${from}${arrow}${act}${to}: ${bare(plainText(label ?? '')) || ' '}`);
      if (activation === '**') out.push(`  create participant ${to}`);
      if (activation === '!!') out.push(`  destroy ${to}`);
      if (activation === '++') callStack.push({ from, to });
      last = { from, to };
      if (++messages > maxEdges) fail('diagram-limit', `The diagram has more than ${maxEdges} messages.`);
      continue;
    }
    unknown(current, 'sequence');
  }
  if (frames.length) fail('diagram-syntax', `A ${frames.at(-1)} block is not closed with end.`);
  if (!order.length) fail('diagram-syntax', 'The sequence diagram has no participants.');
  return `${titled(undefined, 'sequenceDiagram')}\n${title ? `  title ${bare(title)}\n` : ''}${out.join('\n')}`;
}

// ---- Class diagrams -> pele class diagram.

const CLASS_DECLARATION = /^(abstract\s+class|abstract|class|interface|enum|annotation|struct|exception|protocol|record|metaclass|stereotype|dataclass|entity|circle|diamond)\s+("[^"]+"|[\w.$\u0080-\uFFFF]+)(?:\s+as\s+("[^"]+"|[\w.$]+))?\s*(<[^<>]*(?:<[^<>]*>[^<>]*)*>)?\s*(<<[^>]*>>)?\s*(#\S+)?\s*(?:extends\s+([\w.,\s]+?))?\s*(?:implements\s+([\w.,\s]+?))?\s*(\{.*)?$/iu;

function classDiagram(lines: Line[], title: string | undefined, maxEdges: number): string {
  const out: string[] = [];
  const ids = new Ids('c');
  const declared = new Set<string>();
  let relations = 0;
  const name = (raw: string) => ids.of(unquote(raw).replace(/^\[|\]$/g, ''));
  const declare = (raw: string, label?: string, indent = '  ') => {
    const id = name(raw);
    if (!declared.has(id)) {
      declared.add(id);
      const shown = label ?? unquote(raw);
      out.push(`${indent}class ${id}${shown !== id ? `["${quoted(shown)}"]` : ''}`);
    }
    return id;
  };
  const member = (text: string): string => {
    let line = text.replace(/\{(static|classifier)\}\s*/i, '').replace(/\{abstract\}\s*/i, '');
    const isStatic = /\{(static|classifier)\}/i.test(text), isAbstract = /\{abstract\}/i.test(text);
    // A method `name(args) : Ret` is pele's `name(args) Ret`.
    line = line.replace(/^([+\-#~]?\s*[^():]+\([^)]*\))\s*:\s*(.+)$/, '$1 $2');
    return plainText(line).replace(/[<>]/g, '~').replace(/[&"]/g, char => (char === '&' ? '#amp;' : '#quot;')).replace(/\n/g, ' ') + (isStatic ? '$' : isAbstract ? '*' : '');
  };
  const stack: Array<{ kind: 'namespace' | 'class'; id?: string; start?: number }> = [];
  for (let index = 0; index < lines.length; index++) {
    const current = lines[index]!;
    const { text } = current;
    let match: RegExpExecArray | null;
    const inClass = stack.at(-1)?.kind === 'class' ? stack.at(-1)!.id : undefined;
    if (inClass) {
      if (/^\}$/.test(text)) { stack.pop(); out.push(`${'  '.repeat(stack.length + 1)}}`); continue; }
      if (/^(--|\.\.|==|__)(.*?)(--|\.\.|==|__)?$/.test(text)) continue;
      out.push(`${'  '.repeat(stack.length + 1)}${member(text)}`);
      continue;
    }
    match = /^(package|namespace|together)\b\s*("[^"]+"|[\w.$]+)?[^{]*\{\s*$/i.exec(text);
    if (match) {
      if (match[1]!.toLowerCase() === 'together' || stack.some(entry => entry.kind === 'namespace')) { stack.push({ kind: 'namespace' }); out.push(''); continue; }
      stack.push({ kind: 'namespace', id: 'ns', start: out.length });
      out.push(`  namespace ${(unquote(match[2] ?? 'Package').replace(/[^\w]/g, '_') || 'Package')} {`);
      continue;
    }
    if (/^\}$/.test(text)) {
      const top = stack.pop();
      if (!top) unknown(current, 'class');
      if (top!.id === 'ns') { if (out.length - 1 === top!.start) out.pop(); else out.push('  }'); }
      continue;
    }
    match = CLASS_DECLARATION.exec(text);
    if (match) {
      const kind = match[1]!.toLowerCase().replace(/\s+/g, ' ');
      let raw = match[2]!, label: string | undefined;
      if (match[3]) { label = unquote(raw); raw = match[3]; }
      const generic = match[4] ? `~${match[4].slice(1, -1).replace(/[<>]/g, '~')}~` : '';
      const indent = stack.length ? '    ' : '  ';
      const id = name(raw);
      if (!declared.has(id)) {
        declared.add(id);
        const shown = label ?? unquote(raw);
        out.push(`${indent}class ${id}${generic}${shown !== id ? `["${quoted(shown)}"]` : ''}${match[9] ? ' {' : ''}`);
      } else if (match[9]) out.push(`${indent}class ${id} {`);
      const stereotype = match[5] ? match[5].slice(2, -2) : kind === 'interface' ? 'interface' : kind === 'enum' ? 'enumeration' : kind.startsWith('abstract') ? 'abstract' : kind === 'annotation' ? 'annotation' : undefined;
      if (stereotype) {
        if (match[9]) out.push(`${indent}  <<${bare(stereotype)}>>`);
        else out.push(`${indent}<<${bare(stereotype)}>> ${id}`);
      }
      for (const parent of (match[7] ?? '').split(',').map(entry => entry.trim()).filter(Boolean)) { out.push(`  ${declare(parent)} <|-- ${id}`); relations++; }
      for (const parent of (match[8] ?? '').split(',').map(entry => entry.trim()).filter(Boolean)) { out.push(`  ${declare(parent)} <|.. ${id}`); relations++; }
      if (match[9]) {
        const rest = match[9].slice(1).trim();
        if (rest.endsWith('}')) { for (const entry of rest.slice(0, -1).split(';').map(part => part.trim()).filter(Boolean)) out.push(`${indent}  ${member(entry)}`); out.push(`${indent}}`); }
        else { stack.push({ kind: 'class', id }); if (rest) out.push(`${indent}  ${member(rest)}`); }
      }
      continue;
    }
    match = /^note\s+(?:(left|right|top|bottom)\s+of\s+("[^"]+"|[\w.$]+)|"([^"]+)"\s+as\s+\w+|as\s+\w+)\s*(#\S+)?\s*(?::\s*(.*))?$/i.exec(text);
    if (match) {
      let body = match[5] ?? match[3];
      if (body === undefined) { const block = noteBlock(lines, index, ''); body = block.text; index = block.end; }
      out.push(match[2] ? `  note for ${declare(match[2])} "${quoted(plainText(body))}"` : `  note "${quoted(plainText(body))}"`);
      continue;
    }
    match = /^note\s+(?:on\s+)?link\b/i.exec(text);
    if (match) {
      if (!/:/.test(text)) { const block = noteBlock(lines, index, ''); index = block.end; }
      continue;
    }
    // A member added outside the body: `Name : +field`.
    match = /^("[^"]+"|[\w.$]+)\s*:\s*(.+)$/u.exec(text);
    if (match && !readLink(text)) { out.push(`  ${declare(match[1]!)} : ${member(match[2]!)}`); continue; }
    const link = readLink(text);
    if (link) {
      const from = declare(link.from), to = declare(link.to);
      const head = (end: string, side: 'left' | 'right') => {
        if (end === '<|' || end === '|>' || end === '^') return side === 'left' ? '<|' : '|>';
        if (end === '*') return '*';
        if (end === 'o') return 'o';
        if (end === '<' || end === '>' || end === '<<' || end === '>>') return side === 'left' ? '<' : '>';
        return '';
      };
      const line = link.line === 'dotted' ? '..' : '--';
      const arrow = `${head(link.left, 'left')}${line}${head(link.right, 'right')}`;
      out.push(`  ${from}${link.leftLabel ? ` "${quoted(link.leftLabel)}"` : ''} ${arrow}${link.rightLabel ? ` "${quoted(link.rightLabel)}"` : ''} ${to}${link.label ? ` : ${bare(link.label)}` : ''}`);
      if (++relations > maxEdges) fail('diagram-limit', `The diagram has more than ${maxEdges} relations.`);
      continue;
    }
    unknown(current, 'class');
  }
  if (stack.length) fail('diagram-syntax', 'A { block is not closed with }.');
  if (!declared.size) fail('diagram-syntax', 'The class diagram has no classes.');
  return `${titled(title, 'classDiagram')}\n${out.filter(line => line !== '').join('\n')}`;
}

// ---- State diagrams -> pele state diagram.

function stateDiagram(lines: Line[], title: string | undefined, direction: string | undefined, maxEdges: number): string {
  const out: string[] = [];
  const ids = new Ids('s');
  let depth = 1, transitions = 0;
  const state = (raw: string) => {
    const name = unquote(raw);
    if (name === '[*]') return '[*]';
    if (/^\[H\*?\]$/.test(name) || /\[H\*?\]$/.test(name)) fail('diagram-unsupported', 'History states ([H] and [H*]) are not drawn; point the transition at the state it resumes.');
    return ids.of(name);
  };
  for (let index = 0; index < lines.length; index++) {
    const current = lines[index]!;
    const text = current.text.replace(/\s+#\S+(\s|$)/g, ' ').replace(/\s+##\S*/g, '').trim();
    const indent = '  '.repeat(depth);
    let match: RegExpExecArray | null;
    match = /^state\s+("[^"]+"|[\w.]+)(?:\s+as\s+([\w.]+))?\s*(<<\s*(\w+)\s*>>)?\s*(\{)?\s*(?::\s*(.*))?$/i.exec(text);
    if (match) {
      let raw = match[1]!, label: string | undefined;
      if (match[2]) { label = unquote(raw); raw = match[2]; }
      const id = state(raw);
      const stereotype = match[4]?.toLowerCase();
      if (stereotype && ['choice', 'fork', 'join'].includes(stereotype)) out.push(`${indent}state ${id} <<${stereotype}>>`);
      else if (stereotype === 'end') out.push(`${indent}state ${id}`);
      else if (label && label !== id) out.push(`${indent}state "${bare(label)}" as ${id}`);
      if (match[6]) out.push(`${indent}${id} : ${bare(plainText(match[6]))}`);
      if (match[5]) { out.push(`${indent}state ${id} {`); depth++; }
      else if (!stereotype && !label && !match[6]) out.push(`${indent}${id}`);
      continue;
    }
    if (/^\}$/.test(text)) {
      if (depth <= 1) unknown(current, 'state');
      depth--;
      out.push(`${'  '.repeat(depth)}}`);
      continue;
    }
    if (/^(--+|\|\|+)$/.test(text)) { out.push(`${indent}--`); continue; }
    match = /^note\s+(left|right|top|bottom)\s+of\s+("[^"]+"|[\w.]+)\s*(?::\s*(.*))?$/i.exec(text);
    if (match) {
      let body = match[3];
      if (body === undefined) { const block = noteBlock(lines, index, ''); body = block.text; index = block.end; }
      const side = match[1]!.toLowerCase() === 'left' ? 'left' : 'right';
      out.push(`${indent}note ${side} of ${state(match[2]!)} : ${bare(plainText(body))}`);
      continue;
    }
    if (/^note\s+(on\s+)?link\b/i.test(text) || /^note\s+"/i.test(text) || /^note\s+as\b/i.test(text)) {
      if (!/:|"/.test(text)) { const block = noteBlock(lines, index, ''); index = block.end; }
      continue;
    }
    const link = readLink(text);
    if (link) {
      out.push(`${indent}${state(link.from)} --> ${state(link.to)}${link.label ? ` : ${bare(link.label)}` : ''}`);
      if (++transitions > maxEdges) fail('diagram-limit', `The diagram has more than ${maxEdges} transitions.`);
      continue;
    }
    match = /^("[^"]+"|[\w.]+)\s*:\s*(.*)$/.exec(text);
    if (match) { out.push(`${indent}${state(match[1]!)} : ${bare(plainText(match[2]!))}`); continue; }
    match = /^("[^"]+"|[\w.]+)$/.exec(text);
    if (match) { out.push(`${indent}${state(match[1]!)}`); continue; }
    unknown(current, 'state');
  }
  if (depth > 1) fail('diagram-syntax', 'A state block is not closed with }.');
  return `${titled(title, 'stateDiagram-v2')}\n${direction ? `  direction ${direction}\n` : ''}${out.join('\n')}`;
}

// ---- Activity diagrams (the current syntax) -> pele flowchart.

interface Tail { id: string; label?: string }

function activity(lines: Line[], title: string | undefined, maxEdges: number): string {
  const nodes: string[] = [], edges: string[] = [];
  const groups: Array<{ id: string; label: string; nodes: string[]; parent?: number }> = [];
  let count = 0, tails: Tail[] = [], pending: string | undefined, group: number | undefined, lane: number | undefined;
  const lanes = new Map<string, number>();
  const node = (shape: string, label: string): string => {
    const id = `a${count++}`;
    nodes.push(`${id}@{ shape: ${shape}, label: "${label ? quoted(label) : ' '}" }`);
    const owner = group ?? lane;
    if (owner !== undefined) groups[owner]!.nodes.push(id);
    else groups.length && void 0;
    return id;
  };
  const link = (from: string, to: string, label?: string, dotted = false) => {
    edges.push(`  ${from} ${dotted ? '-.->' : '-->'}${label ? `|"${quoted(label)}"|` : ''} ${to}`);
    if (edges.length > maxEdges) fail('diagram-limit', `The diagram has more than ${maxEdges} arrows.`);
  };
  const enter = (id: string) => {
    for (const tail of tails) link(tail.id, id, tail.label ?? pending);
    pending = undefined;
    tails = [{ id }];
    for (const frame of frames) if (frame.kind === 'repeat' && frame.first === undefined) frame.first = id;
  };
  type Frame =
    | { kind: 'if'; diamond: string; ends: Tail[]; hasElse: boolean; line: number }
    | { kind: 'switch'; diamond: string; ends: Tail[]; line: number; started: boolean }
    | { kind: 'while'; diamond: string; line: number }
    | { kind: 'repeat'; first?: string; line: number }
    | { kind: 'fork'; bar: string; ends: Tail[]; line: number }
    | { kind: 'split'; start: Tail[]; ends: Tail[]; line: number }
    | { kind: 'group'; previous: number | undefined; line: number };
  const frames: Frame[] = [];
  const top = <K extends Frame['kind']>(kinds: K[], current: Line): Extract<Frame, { kind: K }> => {
    const frame = frames.at(-1);
    if (!frame || !(kinds as string[]).includes(frame.kind)) unknown(current, 'activity');
    return frame as Extract<Frame, { kind: K }>;
  };
  const label = (text: string | undefined) => (text ?? '').trim() ? plainText(text!.trim()) : undefined;
  for (let index = 0; index < lines.length; index++) {
    const current = lines[index]!;
    const { text } = current;
    let match: RegExpExecArray | null;
    if (/^start$/i.test(text)) { enter(node('sm-circ', '')); continue; }
    if (/^(stop|end)$/i.test(text)) { enter(node('fr-circ', '')); tails = []; continue; }
    if (/^(kill|detach)$/i.test(text)) { tails = []; continue; }
    match = /^(#\S+)?:([\s\S]*)$/.exec(text);
    if (match) {
      // An action: :text; possibly over several lines, ended by ; (or an SDL ending | < > / ] }).
      let body = match[2]!;
      while (!/[;|<>/\]}]$/.test(body) && index + 1 < lines.length) body += `\n${lines[++index]!.text}`;
      if (!/[;|<>/\]}]$/.test(body)) fail('diagram-syntax', 'An action (:...) is not ended with ;.', current.line, 1);
      const ending = body.at(-1)!;
      const shape = ending === '|' ? 'fr-rect' : ending === '<' || ending === '>' ? 'flag' : ending === '/' ? 'lean-r' : ending === ']' ? 'rect' : ending === '}' ? 'st-rect' : 'rounded';
      enter(node(shape, plainText(body.slice(0, -1))));
      continue;
    }
    match = /^-+(\[[^\]]*\])?>\s*(.*?);?$/.exec(text);
    if (match) { pending = label(match[2]); continue; }
    match = /^if\s*\((.*?)\)\s*(?:is\s*\((.*?)\)\s*)?then\s*(?:\((.*)\))?$/i.exec(text);
    if (match) {
      const diamond = node('diam', plainText(match[1]! + (match[2] ? ` ${match[2]}` : '')));
      enter(diamond);
      tails = [{ id: diamond, ...(label(match[3]) ? { label: label(match[3]) } : {}) }];
      frames.push({ kind: 'if', diamond, ends: [], hasElse: false, line: current.line });
      continue;
    }
    match = /^(?:elseif|else\s+if)\s*\((.*?)\)\s*(?:is\s*\((.*?)\)\s*)?then\s*(?:\((.*)\))?$/i.exec(text);
    if (match) {
      const frame = top(['if'], current);
      frame.ends.push(...tails);
      const diamond = node('diam', plainText(match[1]! + (match[2] ? ` ${match[2]}` : '')));
      link(frame.diamond, diamond);
      frame.diamond = diamond;
      tails = [{ id: diamond, ...(label(match[3]) ? { label: label(match[3]) } : {}) }];
      continue;
    }
    match = /^else\s*(?:\((.*)\))?$/i.exec(text);
    if (match) {
      const frame = top(['if'], current);
      frame.ends.push(...tails);
      frame.hasElse = true;
      tails = [{ id: frame.diamond, ...(label(match[1]) ? { label: label(match[1]) } : {}) }];
      continue;
    }
    if (/^end\s*if$/i.test(text)) {
      const frame = top(['if'], current);
      frames.pop();
      tails = [...frame.ends, ...tails, ...(frame.hasElse ? [] : [{ id: frame.diamond }])];
      continue;
    }
    match = /^switch\s*\((.*)\)$/i.exec(text);
    if (match) {
      const diamond = node('diam', plainText(match[1]!));
      enter(diamond);
      tails = [];
      frames.push({ kind: 'switch', diamond, ends: [], line: current.line, started: false });
      continue;
    }
    match = /^case\s*\((.*)\)$/i.exec(text);
    if (match) {
      const frame = top(['switch'], current);
      if (frame.started) frame.ends.push(...tails);
      frame.started = true;
      tails = [{ id: frame.diamond, ...(label(match[1]) ? { label: label(match[1]) } : {}) }];
      continue;
    }
    if (/^end\s*switch$/i.test(text)) {
      const frame = top(['switch'], current);
      frames.pop();
      tails = [...frame.ends, ...tails];
      continue;
    }
    match = /^while\s*\((.*?)\)\s*(?:is\s*\((.*)\))?$/i.exec(text);
    if (match) {
      const diamond = node('diam', plainText(match[1]!));
      enter(diamond);
      tails = [{ id: diamond, ...(label(match[2]) ? { label: label(match[2]) } : {}) }];
      frames.push({ kind: 'while', diamond, line: current.line });
      continue;
    }
    match = /^end\s*while\s*(?:\((.*)\))?$/i.exec(text);
    if (match) {
      const frame = top(['while'], current);
      frames.pop();
      for (const tail of tails) link(tail.id, frame.diamond, tail.label ?? pending);
      pending = undefined;
      tails = [{ id: frame.diamond, ...(label(match[1]) ? { label: label(match[1]) } : {}) }];
      continue;
    }
    if (/^repeat$/i.test(text) || /^repeat\s*:/.test(text)) {
      frames.push({ kind: 'repeat', line: current.line });
      if (/^repeat\s*:/.test(text)) { lines[index] = { ...current, text: text.replace(/^repeat\s*/, '') }; index--; }
      continue;
    }
    match = /^repeat\s*while\s*\((.*?)\)\s*(?:is\s*\((.*?)\))?\s*(?:not\s*\((.*?)\))?$/i.exec(text);
    if (match) {
      const frame = top(['repeat'], current);
      frames.pop();
      const diamond = node('diam', plainText(match[1]!));
      enter(diamond);
      link(diamond, frame.first ?? diamond, label(match[2]));
      tails = [{ id: diamond, ...(label(match[3]) ? { label: label(match[3]) } : {}) }];
      continue;
    }
    match = /^backward\s*:([\s\S]*);$/.exec(text);
    if (match) continue;
    if (/^fork$/i.test(text)) {
      const bar = node('fork', '');
      enter(bar);
      frames.push({ kind: 'fork', bar, ends: [], line: current.line });
      continue;
    }
    if (/^fork\s+again$/i.test(text)) {
      const frame = top(['fork'], current);
      frame.ends.push(...tails);
      tails = [{ id: frame.bar }];
      continue;
    }
    if (/^end\s*(fork|merge)\b.*$/i.test(text)) {
      const frame = top(['fork'], current);
      frames.pop();
      const ends = [...frame.ends, ...tails];
      tails = ends;
      enter(node(/merge/i.test(text) ? 'diam' : 'fork', ''));
      continue;
    }
    if (/^split$/i.test(text)) { frames.push({ kind: 'split', start: tails, ends: [], line: current.line }); continue; }
    if (/^split\s+again$/i.test(text)) {
      const frame = top(['split'], current);
      frame.ends.push(...tails);
      tails = [...frame.start];
      continue;
    }
    if (/^end\s*split$/i.test(text)) {
      const frame = top(['split'], current);
      frames.pop();
      tails = [...frame.ends, ...tails];
      continue;
    }
    match = /^(partition|group|package|rectangle|card)\s+("[^"]+"|[^{]+?)\s*(#\S+)?\s*\{?$/i.exec(text);
    if (match) {
      groups.push({ id: `g${groups.length}`, label: plainText(unquote(match[2]!)), nodes: [], ...(group !== undefined ? { parent: group } : lane !== undefined ? { parent: lane } : {}) });
      frames.push({ kind: 'group', previous: group, line: current.line });
      group = groups.length - 1;
      if (!text.endsWith('{')) { /* `end group` closes it */ }
      continue;
    }
    if (/^\}$/.test(text) || /^end\s*(group|partition)$/i.test(text)) {
      const frame = top(['group'], current);
      frames.pop();
      group = frame.previous;
      continue;
    }
    match = /^\|(?:#[^|]*\|)?([^|]+)\|$/.exec(text);
    if (match) {
      const name = match[1]!.trim();
      let at = lanes.get(name);
      if (at === undefined) { groups.push({ id: `g${groups.length}`, label: plainText(name), nodes: [] }); at = groups.length - 1; lanes.set(name, at); }
      lane = at;
      continue;
    }
    match = /^(floating\s+)?note\s+(left|right)?\s*(?::\s*(.*))?$/i.exec(text);
    if (match) {
      let body = match[3];
      if (body === undefined) { const block = noteBlock(lines, index, ''); body = block.text; index = block.end; }
      const anchor = tails[0]?.id;
      const note = node('notch-rect', plainText(body));
      if (anchor) edges.push(`  ${anchor} -.- ${note}`);
      continue;
    }
    match = /^\((\w)\)$/.exec(text);
    if (match) { enter(node('circle', match[1]!)); continue; }
    if (/^(label|goto)\s/i.test(text)) fail('diagram-unsupported', 'label and goto are not drawn; write the flow with if, while or repeat.', current.line, 1);
    unknown(current, 'activity');
  }
  if (frames.length) fail('diagram-syntax', `A ${frames.at(-1)!.kind} block opened here is not closed.`, frames.at(-1)!.line, 1);
  if (!count) fail('diagram-syntax', 'The activity diagram has no actions.');
  const out: string[] = [titled(title, 'flowchart TB')];
  const inGroup = new Set(groups.flatMap(entry => entry.nodes));
  for (const line of nodes) if (!inGroup.has(line.slice(0, line.indexOf('@')))) out.push(`  ${line}`);
  const write = (at: number, indent: string) => {
    const entry = groups[at]!;
    out.push(`${indent}subgraph ${entry.id}["${quoted(entry.label)}"]`);
    for (const id of entry.nodes) out.push(`${indent}  ${nodes.find(line => line.startsWith(`${id}@`))!}`);
    groups.forEach((child, index) => { if (child.parent === at) write(index, `${indent}  `); });
    out.push(`${indent}end`);
  };
  groups.forEach((entry, index) => { if (entry.parent === undefined) write(index, '  '); });
  out.push(...edges);
  return out.join('\n');
}

// ---- Use case diagrams -> pele use case diagram.

function usecase(lines: Line[], title: string | undefined, direction: string | undefined, maxEdges: number): string {
  const ids = new Ids('u');
  const actors = new Map<string, string>(), cases = new Map<string, string>();
  const actorLines: string[] = [], caseLines: Array<{ line: string; boundary?: number }> = [], relationLines: string[] = [];
  const boundaries: Array<{ label: string; package: boolean }> = [];
  const stack: number[] = [];
  // A name in a use case diagram: (Name) is a use case, :Name: an actor, a bare name the actor PlantUML makes of it unless declared.
  const element = (raw: string, forced?: 'actor' | 'usecase', alias?: string): string => {
    let name = raw.trim(), kind = forced;
    if (/^:.*:$/.test(name)) { name = name.slice(1, -1); kind = 'actor'; }
    else if (/^\(.*\)$/.test(name)) { name = name.slice(1, -1); kind = 'usecase'; }
    else name = unquote(name);
    const label = name;
    if (alias) name = alias;
    const known = actors.get(name) ?? cases.get(name);
    if (known) return known;
    const id = ids.of(name);
    if ((kind ?? 'actor') === 'actor') {
      actors.set(name, id);
      actorLines.push(`  actor ${id}${label !== id ? `("${quoted(plainText(label))}")` : ''}`);
    } else {
      cases.set(name, id);
      caseLines.push({ line: `${id}("${quoted(plainText(label))}")`, ...(stack.length ? { boundary: stack.at(-1)! } : {}) });
    }
    return id;
  };
  // `actor "Long" as A`, `actor A as "Long"`, `usecase (Long) as U`: the quoted or bracketed form is the label, the other the name.
  const declared = (first: string, firstQuoted: boolean, second: string | undefined, kind: 'actor' | 'usecase') => {
    if (!second) return element(firstQuoted && kind === 'usecase' ? `(${first})` : first, kind);
    return firstQuoted ? element(first, kind, second) : element(second, kind, first);
  };
  for (let index = 0; index < lines.length; index++) {
    const current = lines[index]!;
    const plain = current.text.replace(/\s+#\S+$/, '');
    const text = readLink(plain) ? plain : plain.replace(/\s*<<[^>]*>>\s*$/, '');
    let match: RegExpExecArray | null;
    match = /^actor\s+(?::([^:]+):|"([^"]+)"|([\w.\u0080-\uFFFF]+))(?:\s+as\s+(?::([^:]+):|"([^"]+)"|([\w.]+)))?$/iu.exec(text);
    if (match) {
      const quotedFirst = match[1] !== undefined || match[2] !== undefined;
      const second = match[4] ?? match[5] ?? match[6];
      if (second !== undefined && (match[4] !== undefined || match[5] !== undefined)) element(match[4] ?? match[5]!, 'actor', match[1] ?? match[2] ?? match[3]);
      else declared(match[1] ?? match[2] ?? match[3]!, quotedFirst, second, 'actor');
      continue;
    }
    match = /^:([^:]+):(?:\s+as\s+([\w.]+))?$/.exec(text);
    if (match) { element(match[1]!, 'actor', match[2]); continue; }
    match = /^usecase\s+(?:\(([^)]+)\)|"([^"]+)"|([\w.]+))(?:\s+as\s+(?:\(([^)]+)\)|"([^"]+)"|([\w.]+)))?$/i.exec(text);
    if (match) {
      const quotedFirst = match[1] !== undefined || match[2] !== undefined;
      const second = match[4] ?? match[5] ?? match[6];
      if (second !== undefined && (match[4] !== undefined || match[5] !== undefined)) element(match[4] ?? match[5]!, 'usecase', match[1] ?? match[2] ?? match[3]);
      else declared(match[1] ?? match[2] ?? match[3]!, quotedFirst, second, 'usecase');
      continue;
    }
    match = /^\(([^)]+)\)(?:\s+as\s+([\w.]+))?$/.exec(text);
    if (match) { element(match[1]!, 'usecase', match[2]); continue; }
    match = /^(rectangle|package|frame|node|folder|cloud)\s+("[^"]+"|[\w.]+)(?:\s+as\s+[\w.]+)?\s*\{$/i.exec(text);
    if (match) {
      boundaries.push({ label: plainText(unquote(match[2]!)), package: match[1]!.toLowerCase() !== 'rectangle' });
      stack.push(boundaries.length - 1);
      continue;
    }
    if (/^\}$/.test(text)) { if (!stack.length) unknown(current, 'use case'); stack.pop(); continue; }
    match = /^note\s+(?:left|right|top|bottom)\s+of\s+("[^"]+"|\([^)]+\)|:[^:]+:|[\w.]+)\s*(?::\s*(.*))?$/i.exec(text);
    if (match) {
      let body = match[2];
      if (body === undefined) { const block = noteBlock(lines, index, ''); body = block.text; index = block.end; }
      relationLines.push(`  note for ${element(match[1]!)} "${quoted(plainText(body))}"`);
      continue;
    }
    if (/^note\b/i.test(text)) { if (!/:|"/.test(text)) { const block = noteBlock(lines, index, ''); index = block.end; } continue; }
    const link = readLink(text);
    if (link) {
      const from = element(link.from), to = element(link.to);
      const label = link.label?.replace(/^<+\s*|\s*>+$/g, '').trim();
      if (link.line === 'dotted' && /^(include|extend)s?$/i.test(label ?? '')) relationLines.push(`  ${from} ..> : ${/^include/i.test(label!) ? 'include' : 'extend'} ${to}`);
      else if (link.left === '<|') relationLines.push(`  ${to} --|> ${from}`);
      else if (link.right === '|>') relationLines.push(`  ${from} --|> ${to}`);
      else if (label) relationLines.push(link.left && !link.right ? `  ${to} -- ${bare(label)} --> ${from}` : `  ${from} -- ${bare(label)} --> ${to}`);
      else relationLines.push(`  ${from} ${link.right ? '-->' : link.left ? '<--' : '---'} ${to}`);
      if (relationLines.length > maxEdges) fail('diagram-limit', `The diagram has more than ${maxEdges} relations.`);
      continue;
    }
    unknown(current, 'use case');
  }
  if (stack.length) fail('diagram-syntax', 'A rectangle or package block is not closed with }.');
  if (!actors.size && !cases.size) fail('diagram-syntax', 'The use case diagram has no actors or use cases.');
  // pele draws one level of system boundaries: a nested rectangle is drawn beside its parent.
  const out: string[] = [titled(title, 'usecase-beta')];
  if (direction) out.push(`  direction ${direction}`);
  out.push(...actorLines, ...caseLines.filter(entry => entry.boundary === undefined).map(entry => `  ${entry.line}`));
  boundaries.forEach((boundary, at) => {
    const members = caseLines.filter(entry => entry.boundary === at);
    if (!members.length) return;
    out.push(`  systemBoundary "${quoted(boundary.label)}"${boundary.package ? '@{ type: package }' : ''}`, ...members.map(entry => `    ${entry.line}`), '  end');
  });
  out.push(...relationLines);
  return out.join('\n');
}

// ---- Component and deployment diagrams -> pele flowchart.

const ELEMENT_SHAPES: Readonly<Record<string, string>> = {
  component: 'rect', interface: 'circle', database: 'cyl', node: 'st-rect', cloud: 'cloud', artifact: 'doc', file: 'doc', folder: 'folder', frame: 'rect',
  package: 'folder', queue: 'h-cyl', storage: 'stadium', actor: 'person', person: 'person', card: 'rect', agent: 'rect', collections: 'st-rect', stack: 'st-rect',
  hexagon: 'hex', label: 'text', boundary: 'circle', control: 'circle', entity: 'circle', rectangle: 'rect', usecase: 'stadium', port: 'sm-circ', portin: 'sm-circ', portout: 'sm-circ',
};

function component(lines: Line[], title: string | undefined, direction: string | undefined, maxEdges: number): string {
  const ids = new Ids('k');
  const nodes = new Map<string, { line: string; group?: number }>();
  const groups: Array<{ id: string; label: string; parent?: number }> = [];
  const edges: string[] = [];
  const stack: number[] = [];
  const element = (raw: string, kind?: string, alias?: string): string => {
    let name = raw.trim(), label: string, shape = kind ? ELEMENT_SHAPES[kind] ?? 'rect' : 'rect';
    if (/^\[.*\]$/.test(name)) { name = name.slice(1, -1); shape = kind ? shape : 'rect'; }
    else if (/^\(\)\s*/.test(name)) { name = unquote(name.replace(/^\(\)\s*/, '')); shape = 'circle'; }
    else if (/^\(.*\)$/.test(name)) { name = name.slice(1, -1); shape = 'stadium'; }
    else if (/^:.*:$/.test(name)) { name = name.slice(1, -1); shape = 'person'; }
    else name = unquote(name);
    label = name;
    if (alias) name = alias;
    const id = ids.of(name);
    if (!nodes.has(id)) nodes.set(id, { line: `${id}@{ shape: ${shape}, label: "${quoted(plainText(label))}" }`, ...(stack.length ? { group: stack.at(-1)! } : {}) });
    return id;
  };
  for (let index = 0; index < lines.length; index++) {
    const current = lines[index]!;
    const text = current.text.replace(/\s+#\S+(\s*\{)?$/, '$1').replace(/\s*<<[^>]*>>/g, '').trim();
    let match: RegExpExecArray | null;
    match = /^(component|interface|database|node|cloud|artifact|file|folder|frame|package|queue|storage|actor|person|card|agent|collections|stack|hexagon|label|boundary|control|entity|rectangle|usecase|port|portin|portout)\s+("[^"]+"|\[[^\]]+\]|\([^)]+\)|:[^:]+:|[\w.\u0080-\uFFFF]+)(?:\s+as\s+("[^"]+"|[\w.]+))?\s*(\{)?$/iu.exec(text);
    if (match) {
      const kind = match[1]!.toLowerCase();
      let raw = match[2]!, alias = match[3] ? unquote(match[3]) : undefined;
      if (alias && /^"/.test(match[3]!)) { [raw, alias] = [match[3]!, unquote(match[2]!)]; }
      if (match[4]) {
        groups.push({ id: `g${groups.length}`, label: plainText(unquote(raw).replace(/^\[|\]$/g, '')), ...(stack.length ? { parent: stack.at(-1)! } : {}) });
        stack.push(groups.length - 1);
        if (alias) ids.of(alias);
        continue;
      }
      element(raw, kind, alias);
      continue;
    }
    match = /^(\[[^\]]+\]|\(\)\s*("[^"]+"|[\w.]+))(?:\s+as\s+([\w.]+))?$/.exec(text);
    if (match) { element(match[1]!, undefined, match[3]); continue; }
    if (/^\}$/.test(text)) { if (!stack.length) unknown(current, 'component'); stack.pop(); continue; }
    match = /^note\s+(?:left|right|top|bottom)\s+of\s+("[^"]+"|\[[^\]]+\]|[\w.]+)\s*(?::\s*(.*))?$/i.exec(text);
    if (match) {
      let body = match[2];
      if (body === undefined) { const block = noteBlock(lines, index, ''); body = block.text; index = block.end; }
      const target = element(match[1]!);
      const note = ids.of(`note ${index}`);
      nodes.set(note, { line: `${note}@{ shape: notch-rect, label: "${quoted(plainText(body))}" }` });
      edges.push(`  ${target} -.- ${note}`);
      continue;
    }
    if (/^note\b/i.test(text)) { if (!/:|"/.test(text)) { const block = noteBlock(lines, index, ''); index = block.end; } continue; }
    const link = readLink(text);
    if (link) {
      const from = element(link.from), to = element(link.to);
      const tip = (end: string) => /^(>|>>|\|>|\^)$/.test(end) ? '>' : /^(\*|#|x)$/.test(end) ? 'x' : end === 'o' || /^[()]0?$|^0?[()]$/.test(end) ? 'o' : end === '<' || end === '<<' || end === '<|' ? '<' : '';
      let left = tip(link.left), right = tip(link.right);
      if (left === '>') left = '<';
      if (right === '<') right = '>';
      if (left && !right) { right = left === '<' ? '>' : left; left = ''; edges.push(`  ${edgeLine(to, from, link, '', right)}`); }
      else edges.push(`  ${edgeLine(from, to, link, left && right ? (right === '>' ? '<' : right) : '', right)}`);
      if (edges.length > maxEdges) fail('diagram-limit', `The diagram has more than ${maxEdges} links.`);
      continue;
    }
    unknown(current, 'component');
  }
  if (stack.length) fail('diagram-syntax', 'A { block is not closed with }.');
  if (!nodes.size) fail('diagram-syntax', 'The component diagram has no elements.');
  const out: string[] = [titled(title, `flowchart ${direction ?? 'TB'}`)];
  for (const [, entry] of nodes) if (entry.group === undefined) out.push(`  ${entry.line}`);
  const write = (at: number, indent: string) => {
    out.push(`${indent}subgraph ${groups[at]!.id}["${quoted(groups[at]!.label)}"]`);
    for (const [, entry] of nodes) if (entry.group === at) out.push(`${indent}  ${entry.line}`);
    groups.forEach((child, index) => { if (child.parent === at) write(index, `${indent}  `); });
    out.push(`${indent}end`);
  };
  groups.forEach((entry, index) => { if (entry.parent === undefined) write(index, '  '); });
  out.push(...edges);
  return out.join('\n');
}

function edgeLine(from: string, to: string, link: Link, start: string, tip: string): string {
  if (link.line === 'hidden') return `${from} ~~~ ${to}`;
  const extra = Math.min(7, link.length - 1);
  const body = link.line === 'dotted' ? `-${'.'.repeat(1 + Math.max(0, extra))}-` : link.line === 'bold' ? (tip ? '='.repeat(2 + Math.max(0, extra)) : '='.repeat(3 + Math.max(0, extra))) : (tip ? '-'.repeat(2 + Math.max(0, extra)) : '-'.repeat(3 + Math.max(0, extra)));
  const label = link.label ? `|"${quoted(link.label)}"|` : '';
  return `${from} ${start}${body}${tip}${label} ${to}`;
}

// ---- Mind maps -> pele mind map.

function mindmap(lines: Line[]): string {
  const out: string[] = ['mindmap'];
  let roots = 0, count = 0;
  // Two ways of writing depth: the count of * (or + and - for the right and left sides), or Markdown's one * indented per level.
  const indented = lines.some(line => line.indent > 0 && /^[*+-][\s[_:]/.test(line.text));
  const levels = [...new Set(lines.filter(line => /^[*+-][\s[_:]/.test(line.text)).map(line => line.indent))].sort((a, b) => a - b);
  for (let index = 0; index < lines.length; index++) {
    const current = lines[index]!;
    const match = /^([*+-]+)(\[#[^\]]*\])?(_)?\s*(.*)$/.exec(current.text);
    if (!match) unknown(current, 'mind map');
    const depth = indented && match![1]!.length === 1 ? levels.indexOf(current.indent) + 1 : match![1]!.length;
    let text = match![4]!;
    if (/^:/.test(text)) {
      text = text.slice(1);
      while (!/;$/.test(text) && index + 1 < lines.length) text += `\n${lines[++index]!.text}`;
      text = text.replace(/;$/, '');
    }
    if (depth === 1 && ++roots > 1) fail('diagram-unsupported', 'A mind map has one root; draw the second tree as its own diagram.', current.line, 1);
    if (depth > 1 && !count) fail('diagram-syntax', 'A mind map starts with its root (*).', current.line, 1);
    const label = plainText(text);
    // A node is a rounded box, a boxless node (*_) a square one: pele's mind map has no node without an outline that takes any text.
    out.push(`${'  '.repeat(depth)}m${count++}${match![3] ? `["${quoted(label)}"]` : `("${quoted(label)}")`}`);
  }
  if (!count) fail('diagram-syntax', 'The mind map has no nodes.');
  return out.join('\n');
}

// ---- Gantt charts -> pele gantt (OPF schedules the tasks; pele draws the dates).

const DAY = 86400000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function gantt(lines: Line[], title: string | undefined): string {
  let projectStart: number | undefined;
  const closed = new Set<number>(), closedDates = new Set<number>();
  interface Task { name: string; id: string; start?: number; end?: number; duration?: number; startRef?: { task: string; at: 'start' | 'end'; offset: number }; endRef?: { task: string; at: 'start' | 'end'; offset: number }; milestone: boolean; section?: string; complete?: number; line: number }
  const tasks = new Map<string, Task>(), aliases = new Map<string, string>(), order: Task[] = [];
  let section: string | undefined, previous: Task | undefined;
  const date = (text: string, line: number) => {
    const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text.trim());
    if (!match) fail('diagram-syntax', `A date is written YYYY-MM-DD: ${text}.`, line, 1);
    return Date.UTC(Number(match![1]), Number(match![2]) - 1, Number(match![3]));
  };
  const task = (raw: string, line: number): Task => {
    const name = aliases.get(raw) ?? raw;
    let entry = tasks.get(name);
    if (!entry) { entry = { name, id: `t${tasks.size}`, milestone: false, ...(section ? { section } : {}), line }; tasks.set(name, entry); order.push(entry); }
    return entry;
  };
  const amount = (count: string, unit: string) => Number(count) * (/^week/i.test(unit) ? 7 : 1);
  for (const current of lines) {
    const text = current.text.replace(/\s+and\s+(is\s+colored|is\s+displayed|on\s+\{).*$/i, '');
    let match: RegExpExecArray | null;
    match = /^project\s+starts?\s+(?:the\s+|on\s+)?(\d{4}[-/]\d{1,2}[-/]\d{1,2})$/i.exec(text);
    if (match) { projectStart = date(match[1]!, current.line); continue; }
    match = /^(saturday|sunday|monday|tuesday|wednesday|thursday|friday)s?\s+(?:are|is)\s+closed$/i.exec(text);
    if (match) { closed.add(WEEKDAYS.indexOf(match[1]!.toLowerCase())); continue; }
    match = /^(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s+(?:is|are)\s+closed$/i.exec(text);
    if (match) { closedDates.add(date(match[1]!, current.line)); continue; }
    match = /^--\s*(.*?)\s*--$/.exec(text);
    if (match) { section = plainText(match[1]!); continue; }
    if (/^(printscale|projectscale|language|today|hide\s+ressources|hide\s+footbox|<style>|\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+is\s+(colored|named)|\[[^\]]+\]\s+is\s+colored|\[[^\]]+\]\s+is\s+displayed|separator\b|\{[^}]*\}\s+is\s+off)/i.test(text)) continue;
    let rest = text;
    let subject: Task | undefined;
    match = /^then\s+(\[[^\]]+\].*)$/i.exec(rest);
    if (match) {
      rest = match[1]!;
      const name = /^\[([^\]]+)\]/.exec(rest)![1]!;
      subject = task(name, current.line);
      if (previous) subject.startRef = { task: previous.name, at: 'end', offset: 0 };
    }
    match = /^\[([^\]]+)\]\s+as\s+\[([^\]]+)\]\s*(.*)$/i.exec(rest);
    if (match) { aliases.set(match[2]!, match[1]!); task(match[1]!, current.line); rest = `[${match[1]}] ${match[3]}`.trim(); if (!match[3]) { previous = task(match[1]!, current.line); continue; } }
    match = /^\[([^\]]+)\]\s*(.*)$/.exec(rest);
    if (!match) unknown(current, 'gantt');
    subject = task(match![1]!, current.line);
    previous = subject;
    for (const clause of match![2]!.split(/\s+and\s+/i).map(part => part.trim()).filter(Boolean)) {
      let part: RegExpExecArray | null;
      part = /^(?:lasts|requires)\s+(\d+)\s+(days?|weeks?)(?:\s+and\s+(\d+)\s+days?)?$/i.exec(clause);
      if (part) { subject.duration = amount(part[1]!, part[2]!) + Number(part[3] ?? 0); continue; }
      part = /^starts?\s+(?:on\s+|the\s+)?(\d{4}[-/]\d{1,2}[-/]\d{1,2})$/i.exec(clause);
      if (part) { subject.start = date(part[1]!, current.line); continue; }
      part = /^ends?\s+(?:on\s+|the\s+)?(\d{4}[-/]\d{1,2}[-/]\d{1,2})$/i.exec(clause);
      if (part) { subject.end = date(part[1]!, current.line); continue; }
      part = /^(starts?|ends?)\s+(?:(\d+)\s+(days?|weeks?)\s+(after|before)\s+)?(?:at\s+)?\[([^\]]+)\]'s\s+(start|end)$/i.exec(clause);
      if (part) {
        const offset = part[2] ? amount(part[2], part[3]!) * (part[4]!.toLowerCase() === 'before' ? -1 : 1) : 0;
        const ref = { task: aliases.get(part[5]!) ?? part[5]!, at: part[6]!.toLowerCase() as 'start' | 'end', offset };
        if (/^start/i.test(part[1]!)) subject.startRef = ref; else subject.endRef = ref;
        continue;
      }
      part = /^happens\s+(?:at\s+)?\[([^\]]+)\]'s\s+(start|end)$/i.exec(clause);
      if (part) { subject.milestone = true; subject.startRef = { task: aliases.get(part[1]!) ?? part[1]!, at: part[2]!.toLowerCase() as 'start' | 'end', offset: 0 }; subject.duration = 0; continue; }
      part = /^happens\s+(?:on\s+|the\s+)?(\d{4}[-/]\d{1,2}[-/]\d{1,2})$/i.exec(clause);
      if (part) { subject.milestone = true; subject.start = date(part[1]!, current.line); subject.duration = 0; continue; }
      part = /^is\s+(\d+)%\s+complete(?:d)?$/i.exec(clause);
      if (part) { subject.complete = Number(part[1]); continue; }
      if (/^(is\s+colored\b|is\s+displayed\b|on\s+\{|is\s+deleted|pauses\b|links\s+to\b)/i.test(clause)) continue;
      fail('diagram-syntax', `OPF cannot read this part of a PlantUML gantt chart: ${JSON.stringify(clause)}.`, current.line, 1);
    }
  }
  if (!order.length) fail('diagram-syntax', 'The gantt chart has no tasks.');
  // OPF schedules the tasks in working days (closed weekdays and dates are skipped), from the project start or, without one, from day 1.
  const relative = projectStart === undefined;
  const origin = projectStart ?? Date.UTC(2001, 0, 1);
  const open = (day: number) => !closed.has(new Date(day).getUTCDay()) && !closedDates.has(day);
  const forward = (day: number, count: number) => { let at = day; for (let step = 0; step < count; at += DAY) if (open(at)) step++; return at; };
  const firstOpen = (day: number) => { let at = day; while (!open(at)) at += DAY; return at; };
  const resolved = new Map<string, { start: number; end: number }>();
  const resolve = (entry: Task, depth = 0): { start: number; end: number } => {
    const done = resolved.get(entry.name);
    if (done) return done;
    if (depth > 200) fail('diagram-syntax', `The tasks refer to each other in a circle (${entry.name}).`, entry.line, 1);
    const point = (ref: NonNullable<Task['startRef']>) => {
      const other = tasks.get(ref.task);
      if (!other) fail('diagram-syntax', `No task is named [${ref.task}].`, entry.line, 1);
      const span = resolve(other!, depth + 1);
      return (ref.at === 'end' ? span.end : span.start) + ref.offset * DAY;
    };
    const duration = entry.duration ?? (entry.milestone ? 0 : undefined);
    let start = entry.start ?? (entry.startRef ? point(entry.startRef) : undefined);
    let end = entry.end !== undefined ? entry.end + DAY : entry.endRef ? point(entry.endRef) : undefined;
    if (start === undefined && end !== undefined && duration !== undefined) { start = end; for (let step = 0; step < duration; ) { start -= DAY; if (open(start)) step++; } }
    if (start === undefined) start = origin;
    start = duration === 0 ? start : firstOpen(start);
    if (end === undefined) end = duration === undefined ? forward(start, 1) : forward(start, duration);
    const span = { start, end: Math.max(start, end) };
    resolved.set(entry.name, span);
    return span;
  };
  const iso = (day: number) => new Date(day).toISOString().slice(0, 10);
  const out: string[] = [titled(undefined, 'gantt'), '  dateFormat YYYY-MM-DD'];
  if (title) out.push(`  title ${bare(title)}`);
  if (relative) out.push('  axisFormat %-j');
  const excluded = [...closed].sort().map(day => WEEKDAYS[day]);
  if (excluded.length || closedDates.size) out.push(`  excludes ${[...excluded, ...[...closedDates].sort().map(iso)].join(', ')}`);
  let currentSection: string | undefined = '\u0000';
  for (const entry of order) {
    const span = resolve(entry);
    if (entry.section !== currentSection) { currentSection = entry.section; if (entry.section !== undefined) out.push(`  section ${bare(entry.section)}`); }
    const tags = [entry.milestone ? 'milestone' : '', entry.complete === 100 ? 'done' : entry.complete ? 'active' : ''].filter(Boolean);
    const days = entry.milestone ? 0 : Math.max(1, Math.round((span.end - span.start) / DAY) - [...Array(Math.max(0, Math.round((span.end - span.start) / DAY))).keys()].filter(step => !open(span.start + step * DAY)).length);
    out.push(`  ${bare(plainText(entry.name)).replace(/:/g, '#58;')} :${[...tags, entry.id, iso(span.start), `${days}d`].join(', ')}`);
  }
  return out.join('\n');
}

// ---- Entry.

function translate(source: string, maxEdges: number): PlantumlTranslation {
  const { kind, lines: all } = readLines(source);
  const { lines, title, direction } = strip(all);
  if (!lines.length) fail('diagram-syntax', 'The diagram is empty.');
  const diagram = detect(kind, lines);
  const mermaid =
    diagram === 'sequence' ? sequence(lines, title, maxEdges)
    : diagram === 'class' ? classDiagram(lines, title, maxEdges)
    : diagram === 'state' ? stateDiagram(lines, title, direction, maxEdges)
    : diagram === 'activity' ? activity(lines, title, maxEdges)
    : diagram === 'usecase' ? usecase(lines, title, direction, maxEdges)
    : diagram === 'component' ? component(lines, title, direction, maxEdges)
    : diagram === 'mindmap' ? mindmap(lines)
    : gantt(lines, title);
  return { diagram, mermaid };
}

const translations = new Map<string, PlantumlTranslation | PlantumlIssue>();

/**
 * A PlantUML source as the pele source that draws it, or the issue that stops it (with its line and column in the PlantUML source).
 * Results are cached by source.
 */
export function plantumlToMermaid(source: string, options: { maxEdges: number }): { ok: true; translation: PlantumlTranslation } | { ok: false; issue: PlantumlIssue } {
  const key = `${options.maxEdges}\u0000${source}`;
  let result = translations.get(key);
  if (!result) {
    try {
      result = translate(source, options.maxEdges);
    } catch (error) {
      if (!(error instanceof PlantumlError)) throw error;
      result = error.issue;
    }
    if (translations.size >= 500) translations.clear();
    translations.set(key, result);
  }
  return 'mermaid' in result ? { ok: true, translation: result } : { ok: false, issue: result };
}
