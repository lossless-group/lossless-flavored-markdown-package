/**
 * Zero-dependency fence handlers.
 *
 * Every handler here is either pure data or a parse function built on JS
 * built-ins. Anything needing a third-party parser or a client-side renderer
 * belongs in a companion package, not here — that is the line that keeps a
 * splash page from paying for a diagram type it never uses.
 *
 * None are registered by default. Name the ones you want:
 *
 *   import { remarkCodeFences } from '@lossless-group/lfm';
 *   import { mermaid, jsonCanvas } from '@lossless-group/lfm/formats';
 *
 *   unified().use(remarkParse).use(remarkCodeFences, { formats: [mermaid, jsonCanvas] });
 */

import type { FenceFormat } from '../types/index.js';

/**
 * Mermaid diagrams. Recognition only — mermaid.js is a client-side renderer
 * and has no business in a markdown parser. The renderer reads
 * `data.fence.format === 'mermaid'` and hands `node.value` to mermaid.
 *
 * Note for anyone porting the older site implementation: that one rewrote
 * Obsidian wikilinks out of the diagram source and minted element ids with
 * Math.random(). Wikilink handling belongs to remarkLosslessWikilinks, and
 * random ids make the AST nondeterministic — derive ids at render time.
 */
export const mermaid: FenceFormat<never> = {
  name: 'mermaid',
  match: ['mermaid'],
};

/** Parsed JSON Canvas — https://jsoncanvas.org (an open spec, JSON on disk). */
export interface JsonCanvasDoc {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
}

/**
 * JSON Canvas. Parsing is `JSON.parse` plus a shape check, so it costs
 * nothing; drawing it is the renderer's job.
 */
export const jsonCanvas: FenceFormat<JsonCanvasDoc> = {
  name: 'jsoncanvas',
  match: ['jsoncanvas', 'json-canvas', 'canvas'],
  parse(raw) {
    const doc = JSON.parse(raw) as Partial<JsonCanvasDoc>;
    if (typeof doc !== 'object' || doc === null) {
      throw new Error('JSON Canvas must be an object');
    }
    // Both are optional in the spec; normalize so renderers can skip guards.
    return {
      nodes: Array.isArray(doc.nodes) ? doc.nodes : [],
      edges: Array.isArray(doc.edges) ? doc.edges : [],
    };
  },
};

/**
 * Graphviz DOT. Recognition only — `@viz-js/viz` is a WASM renderer that runs
 * in the browser with no server, so the site ships it and reads
 * `data.fence.format === 'graphviz'`. Kept here rather than parsed because DOT's
 * value is the *layout*, which is exactly the part we can't do at parse time.
 */
export const graphviz: FenceFormat<never> = {
  name: 'graphviz',
  match: ['graphviz', 'dot'],
};

/** The useful bits of a Vega-Lite spec, pulled out for previews and alt text. */
export interface VegaLiteSummary {
  /** The spec itself, handed to vega-embed by the renderer. */
  spec: Record<string, unknown>;
  /** Mark type — `bar`, `line`, `point`… */
  mark?: string;
  /** Encoding channels in use — `x`, `y`, `color`… */
  channels: string[];
  /** Inline row count, or a named/remote data source. */
  data?: string;
  title?: string;
}

/**
 * Vega-Lite charts. The spec is JSON, so parsing is free and gives a renderer
 * everything it needs plus a text summary for fallback and accessibility —
 * a chart that renders as nothing when JS is off should at least say what it
 * was going to draw.
 */
export const vegaLite: FenceFormat<VegaLiteSummary> = {
  name: 'vega-lite',
  match: ['vega-lite', 'vegalite', 'vl'],
  parse(raw) {
    const spec = JSON.parse(raw) as Record<string, any>;
    if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) {
      throw new Error('A Vega-Lite spec must be an object');
    }

    const mark = typeof spec.mark === 'string' ? spec.mark : spec.mark?.type;
    const encoding = (spec.encoding ?? {}) as Record<string, unknown>;

    let data: string | undefined;
    if (Array.isArray(spec.data?.values)) data = `${spec.data.values.length} inline rows`;
    else if (spec.data?.url) data = String(spec.data.url);
    else if (spec.data?.name) data = `named: ${spec.data.name}`;

    return {
      spec,
      mark,
      channels: Object.keys(encoding),
      data,
      title: typeof spec.title === 'string' ? spec.title : undefined,
    };
  },
};

export { yang, parseYang, parseYangStatements, buildYangTree, renderYangTree } from './yang.js';
export type { YangModule, YangTreeNode, YangStatement, YangFenceResult } from './yang.js';

export { jsonSchema, parseJsonSchema, buildSchemaTree, renderSchemaTree } from './json-schema.js';
export type { SchemaDoc, SchemaTreeNode, JsonSchemaFenceResult } from './json-schema.js';

// NOTE: plantuml is intentionally NOT re-exported here. It imports `node:zlib`,
// and pulling a node builtin into this barrel would make it unusable in a
// browser context. Import it by subpath: `@lossless-group/lfm/formats/plantuml`.
