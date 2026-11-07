// SH-12: Graphviz DOT diagrams. OPF reads the DOT language itself (no Graphviz code ships: Graphviz is EPL-2.0) and hands the graph to
// pele's layered layout as a flowchart, so a DOT graph is drawn, sized, painted and exported exactly as a Mermaid flowchart is: the same
// layout, the deck's colors and fonts, and native shapes in PowerPoint (SH-07). The reader keeps what a slide shows (nodes and their
// shapes, edges with their style, arrowheads, direction and labels, `subgraph cluster_*` groups, the rank direction and the graph's label)
// and ignores what the deck decides (colors, fonts, sizes, positions). A graph that names a layout engine OPF does not draw (neato, fdp,
// sfdp, circo, twopi, osage, patchwork) is refused with its position, never approximated by the layered layout.
//
// The grammar is Graphviz's (https://graphviz.org/doc/info/lang.html): `[strict] (graph | digraph) [ID] { stmt_list }`, with node, edge,
// attribute and `ID = ID` statements, subgraphs (named, anonymous or `{ ... }`) as statements and as edge ends, ports, the four kinds of
// ID (names, numerals, double-quoted strings joined with `+`, and HTML strings), `//`, `/* */` and `#` line comments.

/** Why a DOT source cannot be drawn, with its 1-based position. */
export interface DotIssue {
  code: 'diagram-syntax' | 'diagram-unsupported' | 'diagram-limit';
  message: string;
  line?: number;
  column?: number;
}

/** A DOT graph as pele flowchart source, with what the reader kept. */
export interface DotTranslation {
  /** Mermaid flowchart source pele lays out with its layered layout. */
  mermaid: string;
  directed: boolean;
}

/** The DOT layout engines: `dot` is the one OPF draws (pele's layered layout); the rest are refused. */
export const DOT_LAYOUT_ENGINES = ['dot', 'neato', 'fdp', 'sfdp', 'circo', 'twopi', 'osage', 'patchwork', 'nop', 'nop1', 'nop2'] as const;

class DotError extends Error {
  constructor(readonly issue: DotIssue) { super(issue.message); }
}

type TokenKind = 'id' | 'html' | 'punct' | 'edgeop' | 'eof';
interface Token { kind: TokenKind; value: string; quoted: boolean; line: number; column: number }

const KEYWORDS = new Set(['node', 'edge', 'graph', 'digraph', 'subgraph', 'strict']);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0, line = 1, lineStart = 0;
  const fail = (message: string, at = index): never => { throw new DotError({ code: 'diagram-syntax', message, line, column: at - lineStart + 1 }); };
  const advanceLines = (from: number, to: number) => {
    for (let at = from; at < to; at++) if (source[at] === '\n') { line++; lineStart = at + 1; }
  };
  while (index < source.length) {
    const char = source[index]!;
    if (char === '\n') { line++; index++; lineStart = index; continue; }
    if (/\s/.test(char)) { index++; continue; }
    // A line starting with # is a preprocessor line (Graphviz ignores it).
    if (char === '#' && source.slice(lineStart, index).trim() === '') {
      while (index < source.length && source[index] !== '\n') index++;
      continue;
    }
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index++;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      if (end < 0) fail('A /* comment is not closed.');
      advanceLines(index, end + 2);
      index = end + 2;
      continue;
    }
    const startLine = line, startColumn = index - lineStart + 1;
    const push = (kind: TokenKind, value: string, quoted = false) => tokens.push({ kind, value, quoted, line: startLine, column: startColumn });
    if (char === '-' && (source[index + 1] === '>' || source[index + 1] === '-')) {
      push('edgeop', source.slice(index, index + 2));
      index += 2;
      continue;
    }
    if ('{}[]=;,:'.includes(char)) { push('punct', char); index++; continue; }
    if (char === '"') {
      // A double-quoted string; `\"` is a quote and every other backslash stays for the label escapes (\n, \l, \N, ...). Strings joined
      // with `+` are one ID.
      let value = '';
      for (;;) {
        let at = index + 1;
        for (;;) {
          if (at >= source.length) { index = at; fail('A quoted string is not closed.', source.length); }
          const next = source[at]!;
          if (next === '\\' && source[at + 1] === '"') { value += '"'; at += 2; continue; }
          if (next === '\\' && source[at + 1] === '\n') { at += 2; continue; }
          if (next === '"') break;
          value += next;
          at++;
        }
        advanceLines(index, at + 1);
        index = at + 1;
        let look = index;
        while (look < source.length && /\s/.test(source[look]!)) look++;
        if (source[look] !== '+') break;
        look++;
        while (look < source.length && /\s/.test(source[look]!)) look++;
        if (source[look] !== '"') break;
        advanceLines(index, look);
        index = look;
      }
      push('id', value, true);
      continue;
    }
    if (char === '<') {
      // An HTML string: balanced angle brackets.
      let depth = 0, at = index;
      for (; at < source.length; at++) {
        if (source[at] === '<') depth++;
        else if (source[at] === '>') { depth--; if (depth === 0) break; }
      }
      if (depth !== 0) fail('An HTML label (<...>) is not closed.');
      const value = source.slice(index + 1, at);
      advanceLines(index, at + 1);
      index = at + 1;
      push('html', value, true);
      continue;
    }
    const numeral = /^-?(?:\.\d+|\d+(?:\.\d*)?)/.exec(source.slice(index, index + 64));
    if (numeral) { push('id', numeral[0]); index += numeral[0].length; continue; }
    const name = /^[A-Za-z_\u0080-￿][\w\u0080-￿]*/u.exec(source.slice(index, index + 4096));
    if (name) { push('id', name[0]); index += name[0].length; continue; }
    fail(`Unexpected character ${JSON.stringify(char)}.`);
  }
  tokens.push({ kind: 'eof', value: '', quoted: false, line, column: index - lineStart + 1 });
  return tokens;
}

type Attributes = Map<string, { value: string; html: boolean; token: Token }>;

interface NodeRecord { id: string; attributes: Attributes; cluster: Cluster | undefined; order: number }
interface Cluster { name: string; attributes: Attributes; parent: Cluster | undefined; children: Cluster[]; order: number }
interface EdgeRecord { tail: string; head: string; attributes: Attributes; order: number }
interface Scope { node: Attributes; edge: Attributes; graph: Attributes; cluster: Cluster | undefined }

/** One parsed DOT graph: its nodes, edges, clusters and graph attributes. */
interface DotGraph {
  strict: boolean;
  directed: boolean;
  name: string;
  attributes: Attributes;
  nodes: Map<string, NodeRecord>;
  edges: EdgeRecord[];
  clusters: Cluster[];
}

function parseDot(source: string, maxEdges: number): DotGraph {
  const tokens = tokenize(source);
  let position = 0;
  const peek = (offset = 0) => tokens[Math.min(position + offset, tokens.length - 1)]!;
  const next = () => tokens[Math.min(position++, tokens.length - 1)]!;
  const fail = (message: string, token = peek()): never => { throw new DotError({ code: 'diagram-syntax', message, line: token.line, column: token.column }); };
  const isKeyword = (token: Token, word: string) => token.kind === 'id' && !token.quoted && token.value.toLowerCase() === word;
  const isPunct = (token: Token, value: string) => token.kind === 'punct' && token.value === value;
  const describe = (token: Token) => token.kind === 'eof' ? 'the end of the source' : JSON.stringify(token.value);
  const expectPunct = (value: string) => {
    const token = next();
    if (!isPunct(token, value)) fail(`Expected "${value}" but found ${describe(token)}.`, token);
    return token;
  };
  const readId = (what: string): Token => {
    const token = next();
    if (token.kind === 'id' && !(token.quoted === false && KEYWORDS.has(token.value.toLowerCase()))) return token;
    if (token.kind === 'html') return token;
    return fail(`Expected ${what} but found ${describe(token)}.`, token);
  };

  let strict = false;
  if (isKeyword(peek(), 'strict')) { next(); strict = true; }
  const head = next();
  if (!isKeyword(head, 'graph') && !isKeyword(head, 'digraph')) fail('A DOT source starts with "graph" or "digraph" (optionally after "strict").', head);
  const directed = isKeyword(head, 'digraph');
  let name = '';
  if (!isPunct(peek(), '{')) name = readId('the graph name or "{"').value;
  expectPunct('{');

  const graph: DotGraph = { strict, directed, name, attributes: new Map(), nodes: new Map(), edges: [], clusters: [] };
  let order = 0, clusterOrder = 0;
  const ancestorOf = (outer: Cluster | undefined, inner: Cluster | undefined) => {
    for (let at = inner; at; at = at.parent) if (at === outer) return true;
    return outer === undefined;
  };
  const touch = (id: string, scope: Scope, own?: Attributes): NodeRecord => {
    let record = graph.nodes.get(id);
    if (!record) {
      record = { id, attributes: new Map(scope.node), cluster: scope.cluster, order: order++ };
      graph.nodes.set(id, record);
    } else if (scope.cluster && scope.cluster !== record.cluster && ancestorOf(record.cluster, scope.cluster)) {
      // A node mentioned again inside a cluster nested in its own moves into it (Graphviz draws a node in its innermost cluster).
      record.cluster = scope.cluster;
    }
    if (own) for (const [key, value] of own) record.attributes.set(key, value);
    return record;
  };

  const readAttributeList = (into: Attributes) => {
    while (isPunct(peek(), '[')) {
      next();
      while (!isPunct(peek(), ']')) {
        if (peek().kind === 'eof') fail('An attribute list ("[") is not closed.');
        const key = readId('an attribute name');
        let value: Token = { ...key, value: 'true', quoted: false };
        if (isPunct(peek(), '=')) { next(); value = readId(`a value for ${key.value}`); }
        into.set(key.value.toLowerCase(), { value: value.value, html: value.kind === 'html', token: key });
        if (isPunct(peek(), ',') || isPunct(peek(), ';')) next();
      }
      next();
    }
  };

  // A node ID with an optional port (`a:p`, `a:p:n`, `a:n`): the port is a place on the node's outline, which the layered layout
  // decides, so it is read and not kept.
  const readNodeId = (): Token => {
    const token = readId('a node ID');
    if (token.kind === 'html') fail('A node ID cannot be an HTML string.', token);
    while (isPunct(peek(), ':')) { next(); readId('a port'); }
    return token;
  };

  // A statement list; returns the nodes it mentions (for a subgraph used as an edge end).
  const statements = (scope: Scope, depth: number): string[] => {
    if (depth > 64) fail('The subgraphs are nested too deeply.');
    const mentioned: string[] = [];
    const mention = (id: string) => { if (!mentioned.includes(id)) mentioned.push(id); };
    for (;;) {
      const token = peek();
      if (isPunct(token, '}')) { next(); return mentioned; }
      if (token.kind === 'eof') fail('A "{" is not closed with "}".', token);
      if (isPunct(token, ';') || isPunct(token, ',')) { next(); continue; }
      // Attribute statements: graph [..], node [..], edge [..].
      if ((isKeyword(token, 'graph') || isKeyword(token, 'node') || isKeyword(token, 'edge')) && isPunct(peek(1), '[')) {
        next();
        const own: Attributes = new Map();
        readAttributeList(own);
        const target = token.value.toLowerCase() === 'graph' ? scope.graph : token.value.toLowerCase() === 'node' ? scope.node : scope.edge;
        for (const [key, value] of own) target.set(key, value);
        continue;
      }
      // ID = ID: a graph attribute.
      if ((token.kind === 'id' || token.kind === 'html') && isPunct(peek(1), '=')) {
        const key = readId('an attribute name');
        next();
        const value = readId(`a value for ${key.value}`);
        scope.graph.set(key.value.toLowerCase(), { value: value.value, html: value.kind === 'html', token: key });
        continue;
      }
      // A node statement, an edge statement or a subgraph (alone or as the first end of an edge).
      let ends = endpoint(scope, depth);
      for (const id of ends) mention(id);
      if (peek().kind !== 'edgeop') {
        if (ends.length === 1 && ends.single) {
          const own: Attributes = new Map();
          readAttributeList(own);
          touch(ends[0]!, scope, own);
        }
        continue;
      }
      const chain: string[][] = [ends];
      while (peek().kind === 'edgeop') {
        const op = next();
        if (op.value === '->' && !directed) fail('An undirected graph joins nodes with "--", not "->".', op);
        if (op.value === '--' && directed) fail('A digraph joins nodes with "->", not "--".', op);
        ends = endpoint(scope, depth);
        for (const id of ends) mention(id);
        chain.push(ends);
      }
      const own: Attributes = new Map(scope.edge);
      readAttributeList(own);
      for (let link = 0; link + 1 < chain.length; link++) {
        for (const tail of chain[link]!) for (const head of chain[link + 1]!) {
          graph.edges.push({ tail, head, attributes: own, order: graph.edges.length });
          if (graph.edges.length > maxEdges) throw new DotError({ code: 'diagram-limit', message: `The graph has more than ${maxEdges} edges.` });
        }
      }
    }
  };

  // One edge end: a node ID (single) or a subgraph (every node it mentions).
  const endpoint = (scope: Scope, depth: number): string[] & { single?: boolean } => {
    const token = peek();
    if (isKeyword(token, 'subgraph') || isPunct(token, '{')) return subgraph(scope, depth);
    const id = readNodeId();
    touch(id.value, scope);
    return Object.assign([id.value], { single: true });
  };

  const subgraph = (scope: Scope, depth: number): string[] => {
    let name = '';
    if (isKeyword(peek(), 'subgraph')) {
      next();
      if (!isPunct(peek(), '{')) name = readId('the subgraph name or "{"').value;
    }
    expectPunct('{');
    const graphAttributes: Attributes = new Map();
    // A cluster is a subgraph whose name starts with "cluster" (Graphviz's rule); `cluster=true` makes any subgraph one.
    const child: Scope = { node: new Map(scope.node), edge: new Map(scope.edge), graph: graphAttributes, cluster: scope.cluster };
    let cluster: Cluster | undefined;
    if (/^cluster/i.test(name)) cluster = { name, attributes: graphAttributes, parent: scope.cluster, children: [], order: clusterOrder++ };
    if (cluster) child.cluster = cluster;
    const mentioned = statements(child, depth + 1);
    if (!cluster && /^true$/i.test(graphAttributes.get('cluster')?.value ?? '')) {
      cluster = { name, attributes: graphAttributes, parent: scope.cluster, children: [], order: clusterOrder++ };
      for (const id of mentioned) { const record = graph.nodes.get(id)!; if (ancestorOf(record.cluster, cluster)) record.cluster = cluster; }
    }
    if (cluster) (cluster.parent ? cluster.parent.children : graph.clusters).push(cluster);
    const layout = graphAttributes.get('layout');
    if (layout) checkLayout(layout);
    return mentioned;
  };

  const checkLayout = (entry: { value: string; token: Token }) => {
    const engine = entry.value.trim().toLowerCase();
    if (engine === 'dot' || engine === '') return;
    throw new DotError({
      code: 'diagram-unsupported',
      message: `OPF draws DOT graphs with a layered layout, as Graphviz's dot engine does; the ${entry.value} layout is not drawn. Remove layout=${entry.value} (or write layout=dot) to draw the graph layered, or write the diagram in Mermaid.`,
      line: entry.token.line, column: entry.token.column,
    });
  };

  const root: Scope = { node: new Map(), edge: new Map(), graph: graph.attributes, cluster: undefined };
  statements(root, 0);
  const trailing = peek();
  if (trailing.kind !== 'eof') fail(`Unexpected ${describe(trailing)} after the graph's closing "}"; a DOT source holds one graph.`, trailing);
  const layout = graph.attributes.get('layout');
  if (layout) checkLayout(layout);
  return graph;
}

// ---- Translation to pele's flowchart.

const MERMAID_RESERVED = new Set(['end', 'graph', 'flowchart', 'subgraph', 'style', 'classdef', 'class', 'click', 'linkstyle', 'direction', 'call', 'href', 'default', 'interpolate', 'acctitle', 'accdescr', 'callback', 'td', 'tb', 'bt', 'rl', 'lr']);

/**
 * DOT node shapes and the pele shape each is drawn as (pele's names; the PPTX export writes the DrawingML preset where pele's outline is
 * exactly one). DOT's default, the ellipse, is drawn as a stadium: a rounded box that holds its label as an ellipse does.
 */
export const DOT_SHAPES: Readonly<Record<string, string>> = Object.freeze({
  box: 'rect', rect: 'rect', rectangle: 'rect', square: 'rect', msquare: 'rect', record: 'rect', mrecord: 'rounded',
  ellipse: 'stadium', oval: 'stadium', egg: 'stadium',
  circle: 'circle', mcircle: 'circle', doublecircle: 'dbl-circ', point: 'f-circ',
  diamond: 'diam', mdiamond: 'diam',
  hexagon: 'hex', octagon: 'hex', doubleoctagon: 'hex', tripleoctagon: 'hex', septagon: 'hex',
  parallelogram: 'lean-r', trapezium: 'trap-b', invtrapezium: 'trap-t', triangle: 'tri', invtriangle: 'flip-tri',
  cylinder: 'cyl', note: 'notch-rect', tab: 'folder', folder: 'folder', box3d: 'st-rect', component: 'fr-rect',
  plaintext: 'text', plain: 'text', none: 'text', underline: 'text',
});

/** Text for a Mermaid label in double quotes: entities for what Mermaid or pele would read as syntax or markup, <br> for line breaks. */
function quoted(text: string): string {
  const escaped = text.replace(/[#"<>&\\]/g, char => ({ '#': '#35;', '"': '#quot;', '<': '#lt;', '>': '#gt;', '&': '#amp;', '\\': '#92;' })[char]!);
  return escaped.split('\n').join('<br>');
}

/** A YAML single-quoted scalar (the flowchart title in front matter). */
const yamlQuoted = (text: string) => `'${text.replace(/\s*\n\s*/g, ' ').replace(/'/g, "''")}'`;

const HTML_ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X' ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return Number.isFinite(code) && code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : whole;
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

interface LabelContext { node?: string; graph: string; tail?: string; head?: string; directed: boolean }

/** A DOT label as plain text with line breaks: escapes expanded (\n, \l, \r, \N, \G, \E, \T, \H), HTML-like labels read as text. */
function labelText(entry: { value: string; html: boolean; token: Token } | undefined, context: LabelContext, record = false): string | undefined {
  if (!entry) return undefined;
  if (entry.html) {
    if (/<\s*table\b/i.test(entry.value)) {
      throw new DotError({ code: 'diagram-unsupported', message: 'An HTML-like table label is not drawn; write the label as text (a record\'s fields become lines).', line: entry.token.line, column: entry.token.column });
    }
    return decodeEntities(entry.value.replace(/<\s*br\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, '')).replace(/[ \t]*\n[ \t]*/g, '\n').trim();
  }
  let value = entry.value;
  if (record) {
    // A record's fields ({a|b|<port> c}) become lines: ports and braces are structure, the fields the text.
    value = value.replace(/\\([{}|<> ])/g, (_, char: string) => `\u0000${char.charCodeAt(0)}\u0000`)
      .replace(/<[^>]*>/g, '').replace(/[{}]/g, '').split('|').map(field => field.trim()).filter(Boolean).join('\\n')
      .replace(/\u0000(\d+)\u0000/g, (_, code: string) => String.fromCharCode(Number(code)));
  }
  const edgeName = context.tail !== undefined ? `${context.tail}${context.directed ? '->' : '--'}${context.head}` : '';
  return value.replace(/\\(.)/gs, (_, char: string) => {
    switch (char) {
      case 'n': case 'l': case 'r': return '\n';
      case 'N': return context.node ?? '';
      case 'G': return context.graph;
      case 'E': return edgeName;
      case 'T': return context.tail ?? '';
      case 'H': return context.head ?? '';
      case 'L': return '';
      case '\n': return '';
      default: return char;
    }
  }).replace(/\n+$/, '');
}

const styleWords = (attributes: Attributes) => new Set((attributes.get('style')?.value ?? '').toLowerCase().split(/[\s,()]+/).filter(Boolean));

type Head = 'arrow' | 'circle' | 'cross' | 'none';
/** A DOT arrow type (https://graphviz.org/docs/attr-types/arrowType/) as the end marker pele draws. */
function headOf(value: string | undefined, fallback: Head): Head {
  if (value === undefined) return fallback;
  const name = value.trim().toLowerCase();
  if (!name || name === 'none') return 'none';
  // The first shape of a multi-shape arrow (`dotodot`, `invdot`) decides; the l/r and o modifiers do not change which marker.
  const shape = name.replace(/^[lro]+(?=[a-z])/, '');
  if (/^(dot|invdot|invodot|odot)/.test(shape)) return 'circle';
  if (/^(tee|box|obox)/.test(shape)) return 'cross';
  return 'arrow';
}

const MARK = { arrow: ['<', '>'], circle: ['o', 'o'], cross: ['x', 'x'], none: ['', ''] } as const;

/**
 * The pele link for an edge: its line (normal, dotted, thick, invisible), its length in ranks and its end markers. pele draws a marker at
 * the head, or the same one at both ends, so an edge with a marker only at its tail (dir=back) is `reverse`: written from its head to its
 * tail, which the layered layout then ranks that way.
 */
function linkOf(attributes: Attributes, directed: boolean): { link: string; reverse: boolean } {
  const style = styleWords(attributes);
  if (style.has('invis')) return { link: '~~~', reverse: false };
  const dir = (attributes.get('dir')?.value ?? (directed ? 'forward' : 'none')).toLowerCase();
  let start: Head = 'none', end: Head = 'none';
  if (dir === 'forward' || dir === 'both') end = headOf(attributes.get('arrowhead')?.value, 'arrow');
  if (dir === 'back' || dir === 'both') start = headOf(attributes.get('arrowtail')?.value, 'arrow');
  // pele draws the same marker at both ends of a two-headed link; a pair of different markers is drawn with the head's.
  if (start !== 'none' && end !== 'none' && start !== end) start = end;
  const thick = style.has('bold') || Number(attributes.get('penwidth')?.value) >= 2;
  const dotted = style.has('dashed') || style.has('dotted');
  const minlen = Math.max(1, Math.min(8, Math.round(Number(attributes.get('minlen')?.value ?? 1)) || 1));
  const extra = minlen - 1;
  const reverse = start !== 'none' && end === 'none';
  if (reverse) { end = start; start = 'none'; }
  const tip = MARK[end][1], tail = start === 'none' ? '' : MARK[start][0];
  if (dotted) return { link: `${tail}-${'.'.repeat(1 + extra)}-${tip}`, reverse };
  if (thick) return { link: `${tail}${tip ? '=='.padEnd(2 + extra, '=') : '==='.padEnd(3 + extra, '=')}${tip}`, reverse };
  return { link: `${tail}${tip ? '--'.padEnd(2 + extra, '-') : '---'.padEnd(3 + extra, '-')}${tip}`, reverse };
}

/**
 * Translate DOT source to the pele flowchart that draws it. Throws a DotError with the position of what stops it: a syntax error, a
 * layout engine other than dot, an HTML table label, or more than `maxEdges` edges.
 */
function translate(source: string, maxEdges: number): DotTranslation {
  const graph = parseDot(source, maxEdges);
  if (!graph.nodes.size) throw new DotError({ code: 'diagram-syntax', message: 'The graph has no nodes.' });
  const rankdir = (graph.attributes.get('rankdir')?.value ?? 'TB').toUpperCase();
  const direction = ['TB', 'LR', 'BT', 'RL'].includes(rankdir) ? rankdir : 'TB';
  const used = new Set<string>(), ids = new Map<string, string>();
  const idOf = (name: string) => {
    let id = ids.get(name);
    if (id) return id;
    if (/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(name) && !MERMAID_RESERVED.has(name.toLowerCase()) && !used.has(name)) id = name;
    else { let index = ids.size; while (used.has(`n${index}`) || graph.nodes.has(`n${index}`)) index++; id = `n${index}`; }
    used.add(id);
    ids.set(name, id);
    return id;
  };
  const hidden = new Set<string>();
  const nodeLines = new Map<Cluster | undefined, string[]>();
  const styles: string[] = [];
  for (const node of [...graph.nodes.values()].sort((a, b) => a.order - b.order)) {
    const style = styleWords(node.attributes);
    if (style.has('invis')) { hidden.add(node.id); continue; }
    const id = idOf(node.id);
    const shapeName = (node.attributes.get('shape')?.value ?? 'ellipse').toLowerCase();
    let shape = DOT_SHAPES[shapeName] ?? 'rect';
    if (shape === 'rect' && style.has('rounded')) shape = 'rounded';
    const record = shapeName === 'record' || shapeName === 'mrecord';
    const authored = node.attributes.get('label');
    const label = shape === 'f-circ' ? '' : authored ? labelText(authored, { node: node.id, graph: graph.name, directed: graph.directed }, record)! : node.id;
    const lines = nodeLines.get(node.cluster) ?? [];
    lines.push(`${id}@{ shape: ${shape}, label: "${label ? quoted(label) : ' '}" }`);
    nodeLines.set(node.cluster, lines);
    const declarations: string[] = [];
    if (style.has('dashed')) declarations.push('stroke-dasharray: 6 4');
    else if (style.has('dotted')) declarations.push('stroke-dasharray: 2 3');
    if (style.has('bold')) declarations.push('stroke-width: 2px');
    if (declarations.length) styles.push(`  style ${id} ${declarations.join(',')}`);
  }
  const out: string[] = [];
  const title = labelText(graph.attributes.get('label'), { graph: graph.name, directed: graph.directed });
  if (title) out.push('---', `title: ${yamlQuoted(title)}`, '---');
  out.push(`flowchart ${direction}`);
  let clusterIndex = 0;
  const writeCluster = (cluster: Cluster, indent: string) => {
    const label = labelText(cluster.attributes.get('label'), { graph: graph.name, directed: graph.directed }) ?? '';
    out.push(`${indent}subgraph c${clusterIndex++}["${label ? quoted(label) : ' '}"]`);
    for (const line of nodeLines.get(cluster) ?? []) out.push(`${indent}  ${line}`);
    for (const child of cluster.children) writeCluster(child, `${indent}  `);
    out.push(`${indent}end`);
  };
  for (const line of nodeLines.get(undefined) ?? []) out.push(`  ${line}`);
  for (const cluster of graph.clusters) writeCluster(cluster, '  ');
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    if (hidden.has(edge.tail) || hidden.has(edge.head)) continue;
    if (graph.strict) {
      const key = graph.directed || edge.tail <= edge.head ? `${edge.tail}\u0000${edge.head}` : `${edge.head}\u0000${edge.tail}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    const { link, reverse } = linkOf(edge.attributes, graph.directed);
    const label = link === '~~~' ? undefined : labelText(edge.attributes.get('label') ?? edge.attributes.get('xlabel'), { graph: graph.name, tail: edge.tail, head: edge.head, directed: graph.directed });
    const [from, to] = reverse ? [edge.head, edge.tail] : [edge.tail, edge.head];
    out.push(`  ${idOf(from)} ${link}${label ? `|"${quoted(label)}"|` : ''} ${idOf(to)}`);
  }
  out.push(...styles);
  return { mermaid: out.join('\n'), directed: graph.directed };
}

const translations = new Map<string, DotTranslation | DotIssue>();

/**
 * A DOT source as the pele flowchart that draws it, or the issue that stops it (with its line and column in the DOT source). Results are
 * cached by source.
 */
export function dotToMermaid(source: string, options: { maxEdges: number }): { ok: true; translation: DotTranslation } | { ok: false; issue: DotIssue } {
  const key = `${options.maxEdges}\u0000${source}`;
  let result = translations.get(key);
  if (!result) {
    try {
      result = translate(source, options.maxEdges);
    } catch (error) {
      if (!(error instanceof DotError)) throw error;
      result = error.issue;
    }
    if (translations.size >= 500) translations.clear();
    translations.set(key, result);
  }
  return 'mermaid' in result ? { ok: true, translation: result } : { ok: false, issue: result };
}
