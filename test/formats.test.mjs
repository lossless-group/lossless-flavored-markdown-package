/**
 * The seven fence-format handlers.
 *
 * Imported through the same subpaths a consumer uses — `dist/formats/index.js`
 * is `@lossless-group/lfm/formats`, and `dist/formats/plantuml.js` is
 * `@lossless-group/lfm/formats/plantuml`. Those subpaths were unreachable on
 * JSR from 0.4.1 through 0.5.0 (see the export-parity suite); exercising them
 * the way a consumer would is deliberate.
 *
 * "Support a diagram language" means three different things here, and the
 * handlers divide along that line:
 *
 *   recognition only   mermaid, graphviz — a client renderer draws, so parsing
 *                      would be pretending. They claim the language and stop.
 *   parse to data      jsonCanvas, vegaLite — the source is JSON, so parsing
 *                      is free and gives the renderer a head start.
 *   parse to text      yang, jsonSchema — nobody draws these; the tree diagram
 *                      *is* the output.
 *   parse to a URL     plantuml — the drawing happens on a server.
 *
 * Every one of them must also fail without failing the build: a malformed
 * diagram records `fence.error` and the renderer falls back to source.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mermaid, graphviz, jsonCanvas, vegaLite, yang, jsonSchema,
  parseYang, parseJsonSchema,
} from '../dist/formats/index.js';
import { plantuml, createPlantUml, encodePlantUml } from '../dist/formats/plantuml.js';
import { parseMarkdown, ofType, md } from './helpers.mjs';

const ALL = [mermaid, graphviz, jsonCanvas, vegaLite, yang, jsonSchema, plantuml];

/** Run a fence through the real pipeline, the way a site would. */
async function fence(lang, body, formats) {
  const tree = await parseMarkdown('```' + lang + '\n' + body + '\n```\n', {
    codeFences: { formats },
  });
  return ofType(tree, 'code')[0];
}

// ─── shape every handler shares ─────────────────────────────────────────────

test('every handler is well-formed', () => {
  for (const f of ALL) {
    assert.equal(typeof f.name, 'string', 'name');
    assert.ok(f.match.length > 0, `${f.name} claims no language`);
    assert.ok(f.match.every((m) => typeof m === 'string'), `${f.name} match must be strings`);
    if (f.parse !== undefined) assert.equal(typeof f.parse, 'function', `${f.name} parse`);
  }
});

test('no two handlers claim the same language', () => {
  const seen = new Map();
  for (const f of ALL) {
    for (const lang of f.match) {
      assert.equal(seen.get(lang), undefined, `${lang} claimed by both ${seen.get(lang)} and ${f.name}`);
      seen.set(lang, f.name);
    }
  }
});

test('every handler routes through the plugin end to end', async () => {
  const bodies = {
    mermaid: 'graph TD; A-->B;',
    graphviz: 'digraph { a -> b }',
    jsoncanvas: '{"nodes":[],"edges":[]}',
    'vega-lite': '{"mark":"bar"}',
    yang: 'module m { namespace "urn:m"; prefix m; }',
    'json-schema': '{"type":"object"}',
    plantuml: 'a -> b: hi',
  };
  for (const f of ALL) {
    const node = await fence(f.match[0], bodies[f.match[0]], ALL);
    assert.equal(node.data?.fence?.format, f.name, `${f.name} did not claim ${f.match[0]}`);
    assert.equal(node.data.fence.error, undefined, `${f.name} errored: ${node.data.fence.error}`);
  }
});

// ─── recognition only ───────────────────────────────────────────────────────

test('mermaid claims the language and parses nothing', async () => {
  assert.equal(mermaid.parse, undefined, 'mermaid.js is a client renderer; parsing here would be pretending');
  const node = await fence('mermaid', 'graph TD;\n  A-->B;', [mermaid]);
  assert.equal(node.data.fence.format, 'mermaid');
  assert.equal(node.data.fence.parsed, undefined);
  assert.ok(node.value.includes('A-->B'), 'source is preserved for the renderer to hand to mermaid');
});

test('mermaid source is left byte-for-byte alone', async () => {
  // The older site implementation rewrote wikilinks out of diagram source and
  // minted ids with Math.random(). Both are someone else's job, and the second
  // makes the AST nondeterministic.
  const src = 'graph LR;\n  A[[Vocabulary/Polyrepo]] --> B;';
  const node = await fence('mermaid', src, [mermaid]);
  assert.equal(node.value, src);
});

test('graphviz claims both dot spellings', async () => {
  assert.deepEqual([...graphviz.match].sort(), ['dot', 'graphviz']);
  assert.equal(graphviz.parse, undefined, 'DOT\'s value is the layout, which we cannot do at parse time');
  for (const lang of graphviz.match) {
    const node = await fence(lang, 'digraph { a -> b }', [graphviz]);
    assert.equal(node.data.fence.format, 'graphviz');
  }
});

// ─── JSON Canvas ────────────────────────────────────────────────────────────

test('json canvas parses nodes and edges', async () => {
  const doc = {
    nodes: [{ id: 'a', type: 'text', text: 'Intake' }, { id: 'b', type: 'text', text: 'Filed' }],
    edges: [{ id: 'e1', fromNode: 'a', toNode: 'b' }],
  };
  const node = await fence('jsoncanvas', JSON.stringify(doc), [jsonCanvas]);
  const { parsed } = node.data.fence;
  assert.equal(parsed.nodes.length, 2);
  assert.equal(parsed.edges.length, 1);
  assert.equal(parsed.nodes[0].text, 'Intake');
});

test('json canvas normalizes missing arrays so renderers skip the guards', () => {
  assert.deepEqual(jsonCanvas.parse('{}'), { nodes: [], edges: [] });
  assert.deepEqual(jsonCanvas.parse('{"nodes":[{"id":"a"}]}').edges, []);
});

test('json canvas claims all three spellings', () => {
  assert.deepEqual([...jsonCanvas.match].sort(), ['canvas', 'json-canvas', 'jsoncanvas']);
});

test('malformed json canvas records an error rather than failing the build', async () => {
  const node = await fence('jsoncanvas', '{ not json', [jsonCanvas]);
  assert.equal(node.data.fence.format, 'jsoncanvas');
  assert.equal(node.data.fence.parsed, undefined);
  assert.ok(node.data.fence.error, 'the renderer needs something to fall back on');
  assert.ok(node.value.includes('not json'), 'source survives for the fallback');
});

test('a json canvas array is NOT rejected — an inconsistency, asserted as-is', () => {
  // `jsonCanvas` guards with `typeof doc !== 'object' || doc === null`, and
  // `typeof [] === 'object'`, so a top-level array slips through and yields a
  // silently-empty canvas. Its sibling in the same file guards properly:
  //
  //   vegaLite:   if (typeof spec !== 'object' || spec === null || Array.isArray(spec))
  //   jsonCanvas: if (typeof doc  !== 'object' || doc  === null)
  //
  // A top-level array is not a valid JSON Canvas document, and "confident,
  // empty, wrong" is exactly the failure mode the yang handler was fixed to
  // stop doing. Recording the current behaviour rather than the wished-for
  // one; the fix is adding `|| Array.isArray(doc)` and it wants its own
  // release rather than riding along with a test pass.
  assert.deepEqual(jsonCanvas.parse('[]'), { nodes: [], edges: [] });
  assert.throws(() => vegaLite.parse('[]'), /object/i, 'the sibling handler does guard');
});

// ─── Vega-Lite ──────────────────────────────────────────────────────────────

const chart = {
  title: 'Filings per quarter',
  data: { values: [{ q: 'Q1', n: 12 }, { q: 'Q2', n: 31 }, { q: 'Q3', n: 24 }] },
  mark: 'bar',
  encoding: {
    x: { field: 'q', type: 'ordinal' },
    y: { field: 'n', type: 'quantitative' },
    color: { field: 'q', type: 'nominal' },
  },
};

test('vega-lite summarizes a spec for previews and alt text', async () => {
  const node = await fence('vega-lite', JSON.stringify(chart), [vegaLite]);
  const { parsed } = node.data.fence;
  assert.equal(parsed.mark, 'bar');
  assert.deepEqual(parsed.channels, ['x', 'y', 'color']);
  assert.equal(parsed.title, 'Filings per quarter');
  assert.equal(parsed.data, '3 inline rows');
  assert.equal(parsed.spec.mark, 'bar', 'the whole spec is handed through for vega-embed');
});

test('vega-lite accepts the object form of mark', () => {
  assert.equal(vegaLite.parse('{"mark":{"type":"line","point":true}}').mark, 'line');
});

test('vega-lite describes each kind of data source', () => {
  assert.equal(vegaLite.parse(JSON.stringify({ data: { url: 'https://x.example/d.csv' } })).data, 'https://x.example/d.csv');
  assert.equal(vegaLite.parse(JSON.stringify({ data: { name: 'filings' } })).data, 'named: filings');
  assert.equal(vegaLite.parse('{}').data, undefined);
});

test('vega-lite claims all three spellings and rejects a bare array', () => {
  assert.deepEqual([...vegaLite.match].sort(), ['vega-lite', 'vegalite', 'vl']);
  assert.throws(() => vegaLite.parse('[]'), /object/i);
});

// ─── YANG ───────────────────────────────────────────────────────────────────

const YANG_SRC = md`
  module acme-system {
    namespace "urn:acme:system";
    prefix acme;
    revision 2026-08-17;
    container system {
      leaf hostname { type string; mandatory true; }
      leaf-list domain-search { type string; }
      container ntp { presence "enables ntp"; leaf enabled { type boolean; } }
      list interface {
        key "name";
        leaf name { type string; }
        leaf speed { type uint32; config false; }
      }
    }
  }
`;

test('yang parses the module header', async () => {
  const node = await fence('yang', YANG_SRC, [yang]);
  const { module } = node.data.fence.parsed;
  assert.equal(module.kind, 'module');
  assert.equal(module.name, 'acme-system');
  assert.equal(module.namespace, 'urn:acme:system');
  assert.equal(module.prefix, 'acme');
  assert.equal(module.revision, '2026-08-17');
});

test('yang renders an RFC 8340 tree with the real marker grammar', () => {
  const { tree } = parseYang(YANG_SRC);
  const lines = tree.split('\n');
  assert.equal(lines[0], 'module: acme-system');

  const line = (needle) => lines.find((l) => l.includes(needle));
  // mandatory suppresses the `?`
  assert.match(line('hostname'), /\+--rw hostname\s+string/);
  // leaf-list takes `*`
  assert.match(line('domain-search'), /domain-search\*/);
  // presence container takes `!`
  assert.match(line('ntp'), /ntp!/);
  // a list shows its keys
  assert.match(line('interface'), /interface\* \[name\]/);
  // config false propagates `ro` to the node
  assert.match(line('speed'), /\+--ro speed\?\s+uint32/);
  // everything else is rw
  assert.match(line('enabled'), /\+--rw enabled\?/);
});

test('an unterminated yang block fails loudly rather than parsing to nothing', async () => {
  // It used to "succeed" into a module with no children — a confident, empty,
  // wrong diagram. Failing honestly is the whole point.
  const node = await fence('yang', 'module broken {\n  container c {', [yang]);
  assert.equal(node.data.fence.format, 'yang');
  assert.equal(node.data.fence.parsed, undefined);
  assert.match(node.data.fence.error, /unterminated/i);
});

// ─── JSON Schema ────────────────────────────────────────────────────────────

const SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Portco Filing',
  type: 'object',
  required: ['id', 'status'],
  properties: {
    id: { type: 'string', description: 'Stable identifier' },
    status: { enum: ['pending', 'filed', 'failed'] },
    attachments: { type: 'array', items: { $ref: '#/$defs/attachment' } },
    reviewer: { type: ['string', 'null'] },
  },
  $defs: {
    attachment: {
      type: 'object',
      properties: { filename: { type: 'string' }, bytes: { type: 'integer' } },
    },
  },
};

test('json schema parses the document header', async () => {
  const node = await fence('json-schema', JSON.stringify(SCHEMA), [jsonSchema]);
  const { doc } = node.data.fence.parsed;
  assert.equal(doc.title, 'Portco Filing');
  assert.equal(doc.type, 'object');
  assert.equal(doc.dialect, 'https://json-schema.org/draft/2020-12/schema');
});

test('json schema renders a tree, expands $refs, and marks optionality', () => {
  const { tree } = parseJsonSchema(JSON.stringify(SCHEMA));
  const lines = tree.split('\n');
  const line = (needle) => lines.find((l) => l.includes(needle));

  assert.equal(lines[0], 'schema: Portco Filing');
  // required properties carry no `?`
  assert.match(line('+-- id'), /\+-- id\s+string/);
  // enums render inline
  assert.match(line('status'), /enum\s+\{"pending", "filed", "failed"\}/);
  // optional + array
  assert.match(line('attachments'), /attachments\?\*/);
  // $ref is expanded rather than left dangling
  assert.ok(line('filename'), 'the $ref target should be inlined');
  assert.match(line('filename'), /string/);
  // union types render as a union
  assert.match(line('reviewer'), /string \| null/);
});

test('json schema claims both spellings and rejects a non-object', () => {
  assert.deepEqual([...jsonSchema.match].sort(), ['json-schema', 'jsonschema']);
  assert.throws(() => parseJsonSchema('[]'), /object/i);
});

test('malformed json schema records an error', async () => {
  const node = await fence('json-schema', '{ nope', [jsonSchema]);
  assert.equal(node.data.fence.parsed, undefined);
  assert.ok(node.data.fence.error);
});

// ─── PlantUML ───────────────────────────────────────────────────────────────

test('plantuml encodes to server URLs', async () => {
  const node = await fence('plantuml', 'Alice -> Bob: Filing request\nBob --> Alice: Ack', [plantuml]);
  const { parsed } = node.data.fence;
  assert.ok(parsed.encoded.length > 0);
  assert.ok(parsed.svg.startsWith('https://www.plantuml.com/plantuml/svg/'));
  assert.ok(parsed.png.startsWith('https://www.plantuml.com/plantuml/png/'));
  assert.ok(parsed.editor.startsWith('https://www.plantuml.com/plantuml/uml/'));
  assert.ok(parsed.svg.endsWith(parsed.encoded), 'the URL is the encoding');
});

test('plantuml auto-wraps source that omits @startuml', () => {
  const bare = plantuml.parse('Alice -> Bob: hi');
  assert.equal(bare.wrapped, false, 'authors skip the wrapper when the fence already says plantuml');

  const explicit = plantuml.parse('@startuml\nAlice -> Bob: hi\n@enduml');
  assert.equal(explicit.wrapped, true);
  assert.equal(explicit.encoded, bare.encoded, 'both encode the same wrapped source');
});

test('plantuml guesses the diagram kind for alt text', () => {
  assert.equal(plantuml.parse('Alice -> Bob: Filing request').kind, 'sequence');
  assert.equal(plantuml.parse('class Filing {\n  +id: string\n}').kind, 'class');
  assert.equal(plantuml.parse('state Idle\nstate Filed').kind, 'state');
  assert.equal(plantuml.parse('nothing recognisable here').kind, undefined, 'a guess it cannot make is left undefined');
});

test('plantuml can be pointed at a self-hosted server', () => {
  // The default sends diagram source to the public plantuml.com instance as
  // part of the URL. Fine for public docs, wrong otherwise.
  const internal = createPlantUml({ server: 'https://uml.internal/' });
  const { svg } = internal.parse('a -> b: x');
  assert.ok(svg.startsWith('https://uml.internal/svg/'), svg);
  assert.ok(!svg.includes('plantuml.com'));
});

test('plantuml encoding is deterministic', () => {
  // Nondeterminism here would poison caching and make every build diff.
  assert.equal(encodePlantUml('@startuml\na -> b\n@enduml'), encodePlantUml('@startuml\na -> b\n@enduml'));
});

test('empty plantuml source records an error', async () => {
  const node = await fence('plantuml', '   ', [plantuml]);
  assert.equal(node.data.fence.parsed, undefined);
  assert.match(node.data.fence.error, /empty/i);
});

test('plantuml claims all three spellings', () => {
  assert.deepEqual([...plantuml.match].sort(), ['plantuml', 'puml', 'uml']);
});

// ─── the whole registry at once ─────────────────────────────────────────────

test('a document mixing every diagram language routes each correctly', async () => {
  const tree = await parseMarkdown([
    '```mermaid', 'graph TD; A-->B;', '```', '',
    '```dot', 'digraph { a -> b }', '```', '',
    '```canvas', '{"nodes":[],"edges":[]}', '```', '',
    '```vl', '{"mark":"line"}', '```', '',
    '```yang', 'module m { namespace "urn:m"; prefix m; }', '```', '',
    '```jsonschema', '{"type":"object"}', '```', '',
    '```puml', 'a -> b: x', '```', '',
    '```python', 'print(1)', '```', '',
  ].join('\n'), { codeFences: { formats: ALL } });

  assert.deepEqual(
    ofType(tree, 'code').map((n) => n.data?.fence?.format ?? null),
    ['mermaid', 'graphviz', 'jsoncanvas', 'vega-lite', 'yang', 'json-schema', 'plantuml', null],
  );
});
