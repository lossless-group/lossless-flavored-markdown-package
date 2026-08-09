/**
 * JSON Schema fence format — renders a schema as a tree, the same way YANG
 * renders as an RFC 8340 diagram.
 *
 *   schema: Participant
 *     +-- handle           string
 *     +-- name             string
 *     +-- kauffman_class?  integer | null
 *     +-- current_stack?*  object
 *        +-- tool          string
 *
 * Zero dependencies — a schema is JSON, so parsing is `JSON.parse` and the
 * work is all in walking it.
 *
 * Local `$ref`s (`#/$defs/Foo`, `#/definitions/Foo`) are resolved and expanded
 * inline, with cycle detection. Remote refs are shown as a `$ref` marker,
 * since there is no file system or network at this layer.
 */

import type { FenceFormat } from '../types/index.js';

/** A node in the rendered schema tree. */
export interface SchemaTreeNode {
  name: string;
  /** Rendered type: `string`, `integer | null`, `array<object>`, `oneOf`… */
  type: string;
  /** `?` optional, `*` array items, `!` additionalProperties false. */
  marker?: string;
  /** enum values / const, rendered inline. */
  enumValues?: string;
  /** Description, first line only. */
  description?: string;
  children: SchemaTreeNode[];
}

export interface SchemaDoc {
  title: string;
  /** `$schema` dialect URI, when declared. */
  dialect?: string;
  /** Root type. */
  type: string;
  children: SchemaTreeNode[];
}

type Json = Record<string, any>;

/** Render a schema's type as a short string. */
function typeOf(node: Json): string {
  if (!node || typeof node !== 'object') return 'any';

  if (Array.isArray(node.type)) return node.type.join(' | ');
  if (node.const !== undefined) return `const ${JSON.stringify(node.const)}`;

  for (const key of ['oneOf', 'anyOf', 'allOf'] as const) {
    if (Array.isArray(node[key])) return `${key}(${node[key].length})`;
  }

  if (node.$ref) return `$ref ${String(node.$ref).split('/').pop()}`;
  if (node.type === 'array') {
    const items = node.items;
    return `array<${items ? typeOf(items) : 'any'}>`;
  }
  if (node.type) return String(node.type);
  if (node.properties) return 'object';
  if (node.enum) return 'enum';
  return 'any';
}

function firstLine(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined;
  const line = s.split('\n')[0]!.trim();
  return line.length ? line : undefined;
}

export function buildSchemaTree(root: Json): SchemaDoc {
  // Both drafts' definition containers, so either spelling resolves.
  const defs: Json = { ...(root.definitions ?? {}), ...(root.$defs ?? {}) };

  function resolve(node: Json, seen: Set<string>): { node: Json; seen: Set<string> } {
    const ref = node?.$ref;
    if (typeof ref !== 'string' || !ref.startsWith('#/')) return { node, seen };

    const name = ref.split('/').pop()!;
    // A schema referencing itself (a tree, a linked list) would recurse forever.
    if (seen.has(name) || !defs[name]) return { node, seen };
    return { node: { ...defs[name], ...(node.description ? { description: node.description } : {}) }, seen: new Set([...seen, name]) };
  }

  function walk(schema: Json, seen: Set<string>): SchemaTreeNode[] {
    if (!schema || typeof schema !== 'object') return [];

    const resolved = resolve(schema, seen);
    schema = resolved.node;
    seen = resolved.seen;

    // Arrays: descend into the item schema so `tags*` shows its shape.
    if (schema.type === 'array' && schema.items) {
      return walk(schema.items, seen);
    }

    // Composition keywords: show each branch as a child.
    for (const key of ['oneOf', 'anyOf', 'allOf'] as const) {
      if (Array.isArray(schema[key])) {
        return schema[key].map((branch: Json, idx: number) => {
          const r = resolve(branch, seen);
          return {
            name: `${key}[${idx}]`,
            type: typeOf(r.node),
            children: walk(r.node, r.seen),
          };
        });
      }
    }

    const props: Json = schema.properties ?? {};
    const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);

    return Object.entries(props).map(([name, raw]) => {
      const r = resolve(raw as Json, seen);
      const child = r.node;

      const node: SchemaTreeNode = {
        name,
        type: typeOf(raw as Json),
        children: [],
      };

      let marker = required.has(name) ? '' : '?';
      if (child.type === 'array') marker += '*';
      if (child.additionalProperties === false) marker += '!';
      if (marker) node.marker = marker;

      const values = child.enum ?? (child.const !== undefined ? [child.const] : undefined);
      if (Array.isArray(values) && values.length) {
        const shown = values.slice(0, 4).map((v) => JSON.stringify(v)).join(', ');
        node.enumValues = values.length > 4 ? `${shown}, …` : shown;
      }

      node.description = firstLine(child.description);
      node.children = walk(child, r.seen);
      return node;
    });
  }

  return {
    title: root.title ?? root.$id?.split('/').pop() ?? '(untitled)',
    dialect: typeof root.$schema === 'string' ? root.$schema : undefined,
    type: typeOf(root),
    children: walk(root, new Set()),
  };
}

/** Render the tree model as an ASCII diagram, aligned per subtree. */
export function renderSchemaTree(doc: SchemaDoc): string {
  const lines: string[] = [`schema: ${doc.title}${doc.type !== 'object' ? ` (${doc.type})` : ''}`];

  function emit(nodes: SchemaTreeNode[], prefix: string): void {
    const width = Math.max(0, ...nodes.map((n) => n.name.length + (n.marker?.length ?? 0)));

    nodes.forEach((node, idx) => {
      const last = idx === nodes.length - 1;
      const label = `${node.name}${node.marker ?? ''}`.padEnd(width);
      const enums = node.enumValues ? `  {${node.enumValues}}` : '';
      lines.push(`${prefix}+-- ${label}   ${node.type}${enums}`);
      if (node.children.length) emit(node.children, prefix + (last ? '    ' : '|   '));
    });
  }

  emit(doc.children, '  ');
  return lines.join('\n');
}

export interface JsonSchemaFenceResult {
  doc: SchemaDoc;
  /** Ready-to-display tree. */
  tree: string;
}

export function parseJsonSchema(src: string): JsonSchemaFenceResult {
  const raw = JSON.parse(src);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('A JSON Schema must be an object');
  }
  const doc = buildSchemaTree(raw);
  return { doc, tree: renderSchemaTree(doc) };
}

/**
 * The `json-schema` fence handler.
 *
 * ```ts
 * import { jsonSchema } from '@lossless-group/lfm/formats';
 * ```
 */
export const jsonSchema: FenceFormat<JsonSchemaFenceResult> = {
  name: 'json-schema',
  match: ['json-schema', 'jsonschema'],
  parse: parseJsonSchema,
};
