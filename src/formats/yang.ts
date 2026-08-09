/**
 * YANG fence format — parses RFC 7950 modules and renders the RFC 8340
 * "tree diagram" that is YANG's canonical visual form.
 *
 *   module: acme-system
 *     +--rw system
 *        +--rw host-name?   string
 *        +--rw interface* [name]
 *           +--rw name    string
 *
 * Zero dependencies. YANG's grammar is unusually regular —
 *
 *     statement = keyword [argument] ( ";" | "{" *statement "}" )
 *
 * — so a tokenizer plus recursive descent gets the whole statement tree in
 * about a hundred lines, which is cheaper than putting a YANG toolchain on the
 * install graph of every site that will never write a `yang` fence.
 *
 * Scope: renders what a self-contained module declares. `uses` of a grouping
 * defined in the same module is expanded; imports across modules are not
 * resolved (there is no file system here), and appear as a `uses` marker.
 * That covers documentation examples, which is what a fence is for.
 */

import type { FenceFormat } from '../types/index.js';

// ─── Statement tree ─────────────────────────────────────────────────────────

/** A raw YANG statement: keyword, optional argument, optional substatements. */
export interface YangStatement {
  keyword: string;
  argument?: string;
  children: YangStatement[];
}

const WS = new Set([' ', '\t', '\r', '\n']);

/** Tokenize + parse a YANG module into its statement tree. */
export function parseYangStatements(src: string): YangStatement[] {
  let i = 0;

  function skipTrivia(): void {
    for (;;) {
      while (i < src.length && WS.has(src[i]!)) i++;
      if (src.startsWith('//', i)) {
        while (i < src.length && src[i] !== '\n') i++;
        continue;
      }
      if (src.startsWith('/*', i)) {
        const end = src.indexOf('*/', i + 2);
        i = end === -1 ? src.length : end + 2;
        continue;
      }
      return;
    }
  }

  function readQuoted(quote: string): string {
    i++; // opening quote
    let out = '';
    while (i < src.length && src[i] !== quote) {
      // Escapes are only meaningful inside double quotes per RFC 7950 §6.1.3.
      if (quote === '"' && src[i] === '\\' && i + 1 < src.length) {
        const next = src[++i]!;
        out += next === 'n' ? '\n' : next === 't' ? '\t' : next;
      } else {
        out += src[i];
      }
      i++;
    }
    i++; // closing quote
    return out;
  }

  /** An argument may be quoted, unquoted, or several quoted parts joined by `+`. */
  function readArgument(): string | undefined {
    skipTrivia();
    if (i >= src.length || src[i] === '{' || src[i] === ';') return undefined;

    let out = '';
    for (;;) {
      skipTrivia();
      const ch = src[i];
      if (ch === '"' || ch === "'") {
        out += readQuoted(ch);
      } else {
        let tok = '';
        while (i < src.length && !WS.has(src[i]!) && src[i] !== '{' && src[i] !== ';' && src[i] !== '+') {
          tok += src[i++];
        }
        out += tok;
        if (!tok) break;
      }
      // String concatenation: "a" + "b"
      const save = i;
      skipTrivia();
      if (src[i] === '+') { i++; continue; }
      i = save;
      break;
    }
    return out.length ? out : undefined;
  }

  function parseStatements(): YangStatement[] {
    const out: YangStatement[] = [];
    for (;;) {
      skipTrivia();
      if (i >= src.length || src[i] === '}') return out;

      let keyword = '';
      while (i < src.length && !WS.has(src[i]!) && src[i] !== '{' && src[i] !== ';') keyword += src[i++];
      if (!keyword) { i++; continue; }

      const argument = readArgument();
      skipTrivia();

      const stmt: YangStatement = { keyword, argument, children: [] };
      if (src[i] === '{') {
        const openedAt = i;
        i++;
        stmt.children = parseStatements();
        if (src[i] !== '}') {
          // Run to EOF with a block still open. Without this the parser
          // silently returns a module with no children, and the reader gets a
          // confident, empty, wrong diagram — worse than an honest failure.
          const line = src.slice(0, openedAt).split('\n').length;
          throw new Error(
            `Unterminated '${keyword}${argument ? ' ' + argument : ''}' block opened on line ${line}`,
          );
        }
        i++;
      } else if (src[i] === ';') {
        i++;
      }
      out.push(stmt);
    }
  }

  return parseStatements();
}

// ─── Tree model (RFC 8340) ──────────────────────────────────────────────────

/** A node in the rendered tree diagram. */
export interface YangTreeNode {
  name: string;
  /** container | list | leaf | leaf-list | choice | case | rpc | notification | uses */
  kind: string;
  /** 'rw' (config), 'ro' (state), 'x' (rpc), 'n' (notification), or '' */
  flag: string;
  /** Resolved type name, for leaf / leaf-list. */
  type?: string;
  /** `?` optional, `*` multiple, `!` presence container. */
  marker?: string;
  /** List keys, rendered as `[a b]`. */
  keys?: string;
  children: YangTreeNode[];
}

export interface YangModule {
  /** `module` or `submodule`. */
  kind: string;
  name: string;
  namespace?: string;
  prefix?: string;
  revision?: string;
  children: YangTreeNode[];
}

const DATA_NODES = new Set(['container', 'list', 'leaf', 'leaf-list', 'choice', 'case', 'uses', 'anyxml', 'anydata']);

const find = (s: YangStatement, kw: string) => s.children.find((c) => c.keyword === kw);
const findAll = (s: YangStatement, kw: string) => s.children.filter((c) => c.keyword === kw);

/** Build the RFC 8340 tree model from a parsed module. */
export function buildYangTree(statements: YangStatement[]): YangModule {
  const root =
    statements.find((s) => s.keyword === 'module' || s.keyword === 'submodule') ?? statements[0];
  if (!root) throw new Error('No module or submodule statement found');

  // Top-level groupings, so `uses` can be expanded within this module.
  const groupings = new Map<string, YangStatement>();
  for (const g of findAll(root, 'grouping')) {
    if (g.argument) groupings.set(g.argument, g);
  }

  function walk(stmt: YangStatement, inheritedFlag: string, seen: Set<string>): YangTreeNode[] {
    const out: YangTreeNode[] = [];

    for (const child of stmt.children) {
      if (!DATA_NODES.has(child.keyword)) continue;

      // `config false` is inherited by everything beneath it (RFC 7950 §7.21.1).
      const configStmt = find(child, 'config');
      const flag = configStmt?.argument === 'false' ? 'ro' : inheritedFlag;

      if (child.keyword === 'uses') {
        const target = child.argument ? groupings.get(child.argument) : undefined;
        if (target && !seen.has(child.argument!)) {
          // Expand in place — that is what a tree diagram shows.
          out.push(...walk(target, flag, new Set([...seen, child.argument!])));
        } else {
          out.push({ name: child.argument ?? '?', kind: 'uses', flag, children: [] });
        }
        continue;
      }

      const node: YangTreeNode = {
        name: child.argument ?? '?',
        kind: child.keyword,
        flag,
        children: [],
      };

      if (child.keyword === 'leaf') {
        node.type = find(child, 'type')?.argument;
        const mandatory = find(child, 'mandatory')?.argument === 'true';
        if (!mandatory) node.marker = '?';
      } else if (child.keyword === 'leaf-list') {
        node.type = find(child, 'type')?.argument;
        node.marker = '*';
      } else if (child.keyword === 'list') {
        node.marker = '*';
        const key = find(child, 'key')?.argument;
        if (key) node.keys = key.trim().split(/\s+/).join(' ');
        node.children = walk(child, flag, seen);
      } else if (child.keyword === 'container') {
        if (find(child, 'presence')) node.marker = '!';
        node.children = walk(child, flag, seen);
      } else if (child.keyword === 'choice' || child.keyword === 'case') {
        node.children = walk(child, flag, seen);
        if (child.keyword === 'choice' && find(child, 'mandatory')?.argument !== 'true') {
          node.marker = '?';
        }
      }

      out.push(node);
    }

    return out;
  }

  const children = walk(root, 'rw', new Set());

  // rpcs and notifications hang off the module, with their own flags.
  for (const rpc of findAll(root, 'rpc')) {
    const node: YangTreeNode = { name: rpc.argument ?? '?', kind: 'rpc', flag: 'x', children: [] };
    for (const section of ['input', 'output'] as const) {
      const sec = find(rpc, section);
      if (sec) {
        node.children.push({
          name: section,
          kind: section,
          flag: section === 'input' ? 'w' : 'ro',
          children: walk(sec, section === 'input' ? 'w' : 'ro', new Set()),
        });
      }
    }
    children.push(node);
  }
  for (const n of findAll(root, 'notification')) {
    children.push({
      name: n.argument ?? '?',
      kind: 'notification',
      flag: 'n',
      children: walk(n, 'ro', new Set()),
    });
  }

  return {
    kind: root.keyword,
    name: root.argument ?? '?',
    namespace: find(root, 'namespace')?.argument,
    prefix: find(root, 'prefix')?.argument,
    revision: findAll(root, 'revision')[0]?.argument,
    children,
  };
}

/** Render the tree model as an RFC 8340 ASCII diagram. */
export function renderYangTree(mod: YangModule): string {
  const lines: string[] = [`${mod.kind}: ${mod.name}`];

  // Column-align type names the way pyang does, per subtree level.
  function emit(nodes: YangTreeNode[], prefix: string): void {
    const width = Math.max(
      0,
      ...nodes.filter((n) => n.type).map((n) => n.name.length + (n.marker ? 1 : 0)),
    );

    nodes.forEach((node, idx) => {
      const last = idx === nodes.length - 1;
      const branch = last ? '+--' : '+--';
      const flag = node.flag ? `${node.flag} ` : '';
      let label = `${node.name}${node.marker ?? ''}`;

      if (node.type) {
        label = label.padEnd(width) + `   ${node.type}`;
      } else if (node.keys) {
        label += ` [${node.keys}]`;
      } else if (node.kind === 'uses') {
        label = `uses ${node.name}`;
      }

      lines.push(`${prefix}${branch}${flag}${label}`);
      if (node.children.length) {
        emit(node.children, prefix + (last ? '   ' : '|  '));
      }
    });
  }

  emit(mod.children, '  ');
  return lines.join('\n');
}

/** Everything a renderer needs for one `yang` fence. */
export interface YangFenceResult {
  module: YangModule;
  /** Ready-to-display RFC 8340 diagram. */
  tree: string;
}

/** Parse a YANG module and produce its tree diagram. */
export function parseYang(src: string): YangFenceResult {
  const module = buildYangTree(parseYangStatements(src));
  return { module, tree: renderYangTree(module) };
}

/**
 * The `yang` fence handler.
 *
 * ```ts
 * import { remarkCodeFences } from '@lossless-group/lfm';
 * import { yang } from '@lossless-group/lfm/formats/yang';
 * unified().use(remarkParse).use(remarkCodeFences, { formats: [yang] });
 * ```
 */
export const yang: FenceFormat<YangFenceResult> = {
  name: 'yang',
  match: ['yang'],
  parse: parseYang,
};
