/**
 * remark-lfm-mdx: MDX as one more trigger syntax.
 *
 * `.mdx` files carry components as JSX — `<BarChart caption="…" items={[…]} />`
 * — with the component brought in by an `import` at the top of the file. Every
 * other LFM trigger (directives, callouts, code fences) names a component that
 * the site looks up in its own trigger map. MDX doesn't need that lookup: the
 * file already says which component it means, in its imports. So this plugin
 * normalizes each JSX element to the same `componentNode` shape every trigger
 * produces, and records where its component comes from. The renderer imports
 * that file and renders it; no registry, no name matching.
 *
 * Nothing is executed. Props are evaluated statically: strings, numbers,
 * booleans, null, and arrays and objects of those (the shapes authors actually
 * write). A prop that needs running code (a variable, a call, an arrow
 * function) is left out of `props` and listed in `dynamicProps`, with a
 * warning on the file, so the renderer can decide what to do with it.
 *
 * Produces, for each JSX element:
 *   { type: 'componentNode', triggerSyntax: 'mdx', name, props, attributes,
 *     import?: { source, name, resolved? }, inline, intrinsic, children }
 *
 *   name        'BarChart', 'Chart.Bar', or 'div' for a lowercase element
 *   props       statically evaluated props
 *   attributes  the string-valued props only, for consumers of the older shape
 *   import      from the file's own import: source as written, the export
 *               name ('default' for a default import), and `resolved`: the
 *               source joined against `filePath` when it is relative
 *   inline      true when the element sat inside a paragraph
 *   intrinsic   true for lowercase (HTML) elements, which have no import
 *
 * Also:
 *   - `import` / `export` blocks are removed from the tree; the imports are
 *     recorded on `tree.data.mdx.imports`.
 *   - `{expressions}` that evaluate statically become text; comments
 *     (`{/* … *\/}`) and anything dynamic are dropped.
 *   - `<>…</>` fragments are replaced by their children.
 *
 * Opt-in through `remarkLfm({ mdx: true })` or `{ mdx: { filePath } }`: MDX
 * syntax changes how `<` and `{` parse, so plain `.md` must not get it.
 */

import remarkMdx from 'remark-mdx';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import type { LfmComponentNode, LfmMdxImport, RemarkLfmMdxOptions } from '../types/index.js';

type AnyNode = { type: string; children?: AnyNode[]; [key: string]: any };

/** A value that could not be evaluated without running code. */
const DYNAMIC = Symbol('dynamic');
type Evaluated = unknown | typeof DYNAMIC;

/** Statically evaluate an estree expression. Returns DYNAMIC when it can't. */
function evaluate(node: any): Evaluated {
  if (!node) return DYNAMIC;
  switch (node.type) {
    case 'Literal':
      return node.regex || node.bigint !== undefined ? DYNAMIC : node.value;
    case 'TemplateLiteral':
      return node.expressions.length === 0 ? node.quasis.map((q: any) => q.value.cooked).join('') : DYNAMIC;
    case 'ArrayExpression': {
      const out: unknown[] = [];
      for (const el of node.elements) {
        if (!el) { out.push(undefined); continue; }
        if (el.type === 'SpreadElement') return DYNAMIC;
        const v = evaluate(el);
        if (v === DYNAMIC) return DYNAMIC;
        out.push(v);
      }
      return out;
    }
    case 'ObjectExpression': {
      const out: Record<string, unknown> = {};
      for (const prop of node.properties) {
        if (prop.type !== 'Property' || prop.computed || prop.kind !== 'init' || prop.method || prop.shorthand) return DYNAMIC;
        const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'Literal' ? String(prop.key.value) : null;
        if (key === null) return DYNAMIC;
        const v = evaluate(prop.value);
        if (v === DYNAMIC) return DYNAMIC;
        out[key] = v;
      }
      return out;
    }
    case 'UnaryExpression': {
      const v = evaluate(node.argument);
      if (v === DYNAMIC) return DYNAMIC;
      if (node.operator === '-') return -(v as number);
      if (node.operator === '+') return +(v as number);
      if (node.operator === '!') return !v;
      return DYNAMIC;
    }
    case 'Identifier':
      if (node.name === 'undefined') return undefined;
      if (node.name === 'NaN') return NaN;
      if (node.name === 'Infinity') return Infinity;
      return DYNAMIC;
    default:
      return DYNAMIC;
  }
}

/** The single expression inside an MDX `{…}`, or null for an empty/comment-only one. */
function expressionOf(node: AnyNode): any | null {
  const program = node.data?.estree;
  const statement = program?.body?.[0];
  return statement?.type === 'ExpressionStatement' ? statement.expression : null;
}

/** Join a relative import against the importing file. POSIX, no filesystem. */
function resolveSource(source: string, filePath?: string): string | undefined {
  if (!filePath || !(source.startsWith('./') || source.startsWith('../'))) return undefined;
  const parts = filePath.replace(/\\/g, '/').split('/');
  parts.pop();
  for (const seg of source.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') {
      if (parts.length && parts[parts.length - 1] !== '..' && parts[parts.length - 1] !== '') parts.pop();
      else parts.push('..');
    } else parts.push(seg);
  }
  return parts.join('/');
}

/** Read the import declarations out of an `mdxjsEsm` node. */
function importsOf(node: AnyNode, filePath?: string): LfmMdxImport[] {
  const out: LfmMdxImport[] = [];
  for (const decl of node.data?.estree?.body ?? []) {
    if (decl.type !== 'ImportDeclaration') continue;
    const source = String(decl.source.value);
    const resolved = resolveSource(source, filePath);
    for (const spec of decl.specifiers) {
      const name =
        spec.type === 'ImportDefaultSpecifier' ? 'default'
        : spec.type === 'ImportNamespaceSpecifier' ? '*'
        : spec.imported.type === 'Identifier' ? spec.imported.name : String(spec.imported.value);
      out.push({ local: spec.local.name, source, name, ...(resolved ? { resolved } : {}) });
    }
  }
  return out;
}

const isJsx = (n: AnyNode) => n.type === 'mdxJsxFlowElement' || n.type === 'mdxJsxTextElement';
const isExpression = (n: AnyNode) => n.type === 'mdxFlowExpression' || n.type === 'mdxTextExpression';

/**
 * Parse MDX syntax and normalize JSX elements to `componentNode`s whose
 * component is the one the file imports.
 */
export const remarkLfmMdx: Plugin<[RemarkLfmMdxOptions?], Root> = function (options = {}) {
  // Register the MDX micromark/mdast extensions on this processor.
  (remarkMdx as any).call(this);

  return function transformer(tree: Root, file: any) {
    const root = tree as unknown as AnyNode;
    const filePath = options.filePath ?? (typeof file?.path === 'string' ? file.path : undefined);

    // 1. Imports: record them, and drop the ESM blocks from the content.
    const imports: LfmMdxImport[] = [];
    root.children = (root.children ?? []).filter((child) => {
      if (child.type !== 'mdxjsEsm') return true;
      imports.push(...importsOf(child, filePath));
      return false;
    });
    const byLocal = new Map(imports.map((i) => [i.local, i]));

    // 2. JSX elements and expressions, depth first so children are converted
    //    before their parent copies them.
    const convert = (node: AnyNode): AnyNode[] => {
      if (Array.isArray(node.children)) {
        node.children = node.children.flatMap(convert);
      }

      if (isExpression(node)) {
        const expr = expressionOf(node);
        if (!expr) return []; // empty or comment-only: `{/* note */}`
        const v = evaluate(expr);
        if (v === DYNAMIC || v === undefined || v === null || typeof v === 'object') return [];
        return [{ type: 'text', value: String(v), position: node.position }];
      }

      if (!isJsx(node)) return [node];

      // `<>…</>`
      if (!node.name) return node.children ?? [];

      const props: Record<string, unknown> = {};
      const attributes: Record<string, string> = {};
      const dynamicProps: string[] = [];
      for (const attr of node.attributes ?? []) {
        if (attr.type === 'mdxJsxExpressionAttribute') {
          // `{...spread}`
          const program = attr.data?.estree;
          const spread = program?.body?.[0]?.expression?.properties?.[0]?.argument;
          const v = evaluate(spread);
          if (v === DYNAMIC || typeof v !== 'object' || v === null) dynamicProps.push(`{${attr.value}}`);
          else Object.assign(props, v);
          continue;
        }
        const name = attr.name as string;
        const value = attr.value;
        if (value === null || value === undefined) {
          props[name] = true; // `<Chart compact />`
        } else if (typeof value === 'string') {
          props[name] = value;
        } else {
          const v = evaluate(expressionOf(value));
          if (v === DYNAMIC) {
            dynamicProps.push(name);
            file?.message?.(`MDX prop \`${name}\` on <${node.name}> needs code to evaluate; left out of props`, node.position);
          } else props[name] = v;
        }
      }
      for (const [k, v] of Object.entries(props)) {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') attributes[k] = String(v);
      }

      const name = node.name as string;
      const intrinsic = /^[a-z]/.test(name) && !name.includes('.');
      // `<Chart.Bar>` resolves through its namespace import, `Chart`.
      const imported = intrinsic ? undefined : byLocal.get(name.split('.')[0]);
      if (!intrinsic && !imported) {
        file?.message?.(`<${name}> has no matching import in this file`, node.position);
      }

      const component: LfmComponentNode & AnyNode = {
        type: 'componentNode',
        name,
        triggerSyntax: 'mdx',
        attributes,
        props,
        inline: node.type === 'mdxJsxTextElement',
        intrinsic,
        ...(imported ? { import: imported } : {}),
        ...(dynamicProps.length ? { dynamicProps } : {}),
        children: node.children ?? [],
        position: node.position,
      };
      return [component];
    };
    root.children = root.children.flatMap(convert);

    root.data = { ...(root.data ?? {}), mdx: { imports } };
  };
};
