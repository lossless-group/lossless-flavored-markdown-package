/**
 * resolve-path — a general vault-path → site-route resolver.
 *
 * ## What this is, and what it deliberately is not
 *
 * `remark-lfm-wikilinks` owns wikilink *syntax*: the regex, the MDAST splice,
 * the shape of the emitted `link` node. It has always demanded that the
 * consumer supply a `resolver` function, because destinations are per-site and
 * baking one in would be wrong for every consumer except the one we picked.
 *
 * That split is still right. What it left unaddressed is that **almost every
 * consumer then writes the same resolver**, badly, from scratch — a chain of
 * `if (path.startsWith(…))` branches that handles the paths its author
 * happened to think of and silently drops the rest.
 *
 * This module is the missing half: a *policy* layer, expressed as data, that
 * produces the function the plugin wants. Three layers, three owners:
 *
 *   - the **plugin** owns syntax
 *   - **this module** owns resolution mechanics (normalisation, the index
 *     cascade, relative paths, template expansion, ambiguity reporting)
 *   - the **site** owns nothing but a config object
 *
 * It is opt-in in exactly the way `codeFences` and `ogFetch` are: omit it and
 * nothing changes. Supply it and `[[…]]` starts landing somewhere.
 *
 * ## Why it is not wikilink-specific
 *
 * The same "a human wrote a vault path, where does that live on the web?"
 * problem shows up for image `src` attributes, plain markdown link targets,
 * frontmatter cross-references, and `related:` arrays. So `resolve()` takes a
 * plain string and returns a plain result. `toWikilinkResolver()` is a thin
 * adapter, not the main interface.
 *
 * ## The measurements this design is built on
 *
 * Taken across the Lossless `content` vault (4,702 markdown files) and the
 * 13,846 wikilinks written against it, 2026-08-23:
 *
 * | Fact | Value | Consequence for the design |
 * |---|---|---|
 * | Wikilinks with **no folder at all** (`[[DevOps]]`) | 3,839 — **28%** | A prefix-matching resolver cannot see a quarter of the corpus. An **index** is not a nicety. |
 * | Basenames that are **globally unique** in the vault | 4,622 of 4,702 — **98.4%** | Basename resolution is safe far more often than it is dangerous. |
 * | Basenames that **collide** | 73 (153 files) | …but not always. Ambiguity must be **reported, never guessed**. |
 * | Pathed links hitting an **exact** vault path | 8,956 of 9,973 — **89.8%** | The common case is cheap; optimise the tail. |
 * | Case drift on the first segment | `Tooling` 3,591 vs `tooling` 38; `Vocabulary` 1,526 vs `vocabulary` 22 | Case-insensitive matching is the default, not an option. |
 * | Separator drift in directory names | `lost-in-public` 179 vs `Lost in Public` 8 | Space / hyphen / underscore must be **equivalent**, not merely trimmed. |
 * | Path depth | up to 5 segments deep | Site routes are flat; the template needs `{slug}` to mean "the part that survives". |
 * | Literal `../` or `./` links | **0** | Relative support is for *authoring futures*, not present pain — so it is supported but never assumed. |
 *
 * Applying the cascade below to that corpus resolves **~81%** of all wikilinks
 * — against a plugin whose stated operating principle is that *supporting 40%
 * of intended wikilinks is better than supporting none.*
 *
 * ## The resolution cascade
 *
 * Each tier is strictly more speculative than the last, and every result says
 * which tier answered it (`via`) so a site can trust exact hits and audit the
 * guesses:
 *
 *   1. `exact`    — the normalised path is a vault file, verbatim.
 *   2. `suffix`   — the path is a trailing run of segments of exactly one
 *                   vault file. Catches `[[Vocabulary/Build Systems]]` when
 *                   the file really lives at `content/vocabulary/Build
 *                   Systems.md`, and any link written before a reorganisation.
 *   3. `basename` — the final segment names exactly one vault file. This is
 *                   Obsidian's own shortest-unique-path behaviour, and the
 *                   only tier that can rescue the 28% of bare links.
 *   4. `route`    — no index, or the index knew nothing; fall through to
 *                   prefix rules on the path as written.
 *
 * A tier that matches **more than one** file does not fall through to the next
 * one. It stops and reports `ambiguous`, because a resolver that quietly picks
 * the first of three candidates produces a link that is wrong in a way nobody
 * will notice until a reader lands on the wrong page.
 *
 * @example The Lossless case — four vault folders, one public route
 * ```ts
 * import { createPathResolver } from '@lossless-group/lfm';
 *
 * const paths = createPathResolver({
 *   index: allVaultPaths,            // string[] of vault-relative paths
 *   routes: [
 *     // concepts, vocabulary, organizations and sources are four folders in
 *     // the vault and one index on the web.
 *     { match: ['concepts', 'vocabulary', 'organizations', 'sources'],
 *       to: 'https://www.lossless.group/more-about/{slug}' },
 *     { match: 'tooling',  to: '/tools/{slug}' },
 *     { match: 'essays',   to: '/essays/{slug}' },
 *     { match: '*',        to: null },   // everything else stays plain text
 *   ],
 * });
 *
 * // Then either use it directly…
 * paths.resolve('Tooling/Software Development/Programming Languages/Python');
 * //   → { url: '/tools/python', via: 'exact', isLocal: true, … }
 *
 * // …or hand it to the wikilink plugin.
 * parseMarkdown(md, { wikilinks: { paths } });
 * ```
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * Which part of the matched path becomes `{slug}`.
 *
 * - `basename` — the last segment. The right default: site routes are almost
 *   always flat even when vaults are deep.
 * - `tail` — everything after the matched prefix, slashes preserved. For sites
 *   that mirror vault structure.
 * - `full` — the whole normalised path.
 * - a function — anything else.
 */
export type SlugStrategy = 'basename' | 'tail' | 'full' | ((parts: PathParts) => string);

/** The decomposed path handed to a custom slug strategy or template. */
export interface PathParts {
  /** Full normalised path, no extension. `tooling/dev/Bazel` */
  path: string;
  /** Path segments. `['tooling', 'dev', 'Bazel']` */
  segments: string[];
  /** Final segment, original casing. `Bazel` */
  name: string;
  /** Everything but the final segment. `tooling/dev` */
  dir: string;
  /** Everything after the matched route prefix. `dev/Bazel` */
  tail: string;
  /** The route prefix that matched. `tooling` */
  prefix: string;
}

/**
 * One routing rule. Rules are evaluated in order; the first match wins.
 */
export interface PathRoute {
  /**
   * Vault path prefix, or prefixes, this rule claims. Matched
   * case-insensitively and separator-insensitively against the first
   * segment(s) of the path — so `'lost-in-public'` also claims
   * `Lost In Public/…`, which is exactly the drift the vault contains.
   *
   * `'*'` is a catch-all and should be last.
   */
  match: string | string[];
  /**
   * Destination template, or `null` to claim the path and deliberately
   * resolve it to nothing (renders as plain text).
   *
   * Tokens: `{slug}` `{name}` `{path}` `{tail}` `{dir}` `{prefix}`.
   * A `{slug}` is slugified; `{name}`, `{tail}`, `{dir}` and `{path}` are
   * URL-encoded but keep their shape.
   */
  to: string | null;
  /**
   * Same-site or not. Inferred when omitted: a `to` beginning with a scheme
   * or `//` is external, anything else is local.
   */
  isLocal?: boolean;
  /** Extra CSS classes, passed through to the wikilink resolution. */
  classes?: string[];
  /** Override the resolver-wide slug strategy for this route only. */
  slugFrom?: SlugStrategy;
}

/** A resolution failed, or succeeded speculatively. Sites log these. */
export interface PathDiagnostic {
  /** The path as written. */
  input: string;
  reason:
    | 'ambiguous'      // matched several vault files — refused to guess
    | 'not-in-index'   // an index exists and does not contain this
    | 'no-route'       // resolved to a file, but no route claims it
    | 'route-parked';  // a route claimed it and deliberately points nowhere
  /** Candidate vault files, when the reason is `ambiguous`. */
  candidates?: string[];
}

/** Which tier of the cascade produced a result. */
export type ResolutionTier = 'exact' | 'suffix' | 'basename' | 'route' | 'deferred';

/** A successful resolution. */
export interface ResolvedPath {
  /** Where it points — a path-only route or a fully-qualified URL. */
  url: string;
  /** True for same-site routes. */
  isLocal: boolean;
  /** Human-readable display text derived from the path. */
  display: string;
  /** Extra classes from the matched route. */
  classes?: string[];
  /** Which cascade tier answered. `exact` is trustworthy; `basename` is a
   *  well-founded guess. Sites that want to be strict can reject the latter. */
  via: ResolutionTier;
  /** The vault file this landed on, when an index was consulted. */
  file?: string;
  /** The `match` value of the route that claimed it. */
  route?: string;
}

/** Configuration for {@link createPathResolver}. */
export interface PathResolverConfig {
  /** Routing rules, in priority order. */
  routes: PathRoute[];
  /**
   * Every markdown path in the vault, vault-relative
   * (`tooling/Software Development/Bazel.md`). Optional — without it the
   * resolver still does routing, normalisation and relative resolution, but
   * cannot resolve bare `[[Page]]` links, which are 28% of the real corpus.
   *
   * Cheap to produce: a `fast-glob` / `readdir` sweep at build time.
   */
  index?: Iterable<string>;
  /**
   * Strip this leading directory from indexed paths before matching, so a
   * vault mounted at `src/generated-content/` routes as though it were at the
   * root. Accepts one prefix or several.
   */
  base?: string | string[];
  /** What `{slug}` means. Default `'basename'`. */
  slugFrom?: SlugStrategy;
  /** Override the slugifier. Default: lowercase, non-alphanumerics → `-`. */
  slugify?: (s: string) => string;
  /** Turn a path segment into display text. Default: strip extension,
   *  underscores/hyphens → spaces, original casing kept. */
  display?: (parts: PathParts) => string;
  /**
   * Treat ` `, `-` and `_` as the same character when matching. Default
   * `true` — the vault contains `lost-in-public` and `Lost in Public` as the
   * same directory, so this is load-bearing, not cosmetic.
   */
  looseSeparators?: boolean;
  /** Match paths case-sensitively. Default `false`. */
  caseSensitive?: boolean;
  /** Extensions stripped before matching. Default `['.md', '.mdx']`. */
  extensions?: string[];
  /**
   * Which index tiers to attempt, in order. Default
   * `['exact', 'suffix', 'basename']`.
   *
   * This is the main confidence dial, and it is a list rather than a
   * threshold because the tiers are not a single axis. A site may well trust
   * `basename` (Obsidian's own behaviour, and 98.4% unique in the measured
   * vault) while distrusting `suffix` (which can match a path that was never
   * written). `['exact', 'basename']` expresses that; a threshold cannot.
   *
   * `[]` disables index lookup entirely and routes on the path as written.
   */
  cascade?: ResolutionTier[];
  /**
   * What to do when a tier matches more than one vault file.
   *
   * - `'plain'` (default) — resolve to nothing, so the wikilink renders as
   *   plain text with no anchor. Safe: a link that is wrong in a way nobody
   *   notices is worse than no link.
   * - `'first'` — take the lexicographically first candidate. Deterministic
   *   across builds, but it *is* a guess.
   * - a function — your own disambiguation. Return one of `candidates`, or
   *   `null` to fall back to `'plain'`. Prefer-shortest-path and
   *   prefer-a-named-folder are the usual rules.
   *
   * Measured on the Lossless vault: 73 of 4,622 basenames collide, and only
   * 25 of 3,839 bare wikilinks (0.7%) actually land on one. This dial matters
   * for correctness, not for coverage.
   */
  onAmbiguous?: 'plain' | 'first' | ((input: string, candidates: string[]) => string | null);
  /**
   * When a wikilink carries an explicit `|Display`, use it verbatim rather
   * than the resolver's derived display. Default `true` — the author was
   * explicit, and overriding that is surprising.
   */
  preferAuthorDisplay?: boolean;
  /**
   * Extra `{token}` expansions for route templates, on top of the built-in
   * `{slug} {name} {path} {tail} {dir} {prefix}`.
   *
   * The escape hatch for routes that need something the built-ins do not
   * express — a locale segment, a collection id, a hashed shard. Values are
   * inserted verbatim, so encode them yourself if they need it.
   *
   * @example
   * ```ts
   * tokens: {
   *   // `sources/2026/Foo` → `/sources/2026/foo`
   *   year: (parts) => parts.segments[1] ?? 'undated',
   * }
   * ```
   */
  tokens?: Record<string, (parts: PathParts) => string>;
  /**
   * What to do with paths the index could not settle — the queue for
   * *later* resolution rather than a dead link now.
   *
   * The index cascade is not the slow part (measured: 5.3µs per link, 11ms to
   * build the index over a 4,702-file vault — it is Map lookups, not grep),
   * so deferral is NOT a performance workaround. It exists for the case the
   * index genuinely cannot answer: a destination that lives behind an API, in
   * a sibling site's route table, or in content that has not been built yet.
   *
   * `to` is a normal route template. Point it at an SSR route
   * (`/link-resolve?p={path}`) to resolve at request time, or at a stable
   * placeholder you rewrite in a post-build pass — `deferred()` hands you the
   * deduplicated worklist for exactly that.
   *
   * @example Resolve stragglers at request time
   * ```ts
   * deferred: { to: '/go/{path}', when: 'both' }
   * ```
   */
  deferred?: {
    /** Placeholder / SSR route template. Same tokens as a route `to`. */
    to: string;
    /** Which failures to queue. Default `'not-in-index'`. */
    when?: 'not-in-index' | 'ambiguous' | 'both';
    /** Mark the emitted link local. Default: inferred from `to`. */
    isLocal?: boolean;
    /** Extra classes, so a renderer can style a provisional link. */
    classes?: string[];
  };
  /** Called for every failed or parked resolution. Never throws upward. */
  onDiagnostic?: (d: PathDiagnostic) => void;
}

/** Optional context — where the link was written from. */
export interface ResolveContext {
  /** Vault-relative path of the document containing the link. Enables
   *  `./sibling` and `../aunt` resolution. */
  from?: string;
}

/** One entry in the post-build resolution queue. */
export interface DeferredEntry {
  /** The path as written in the source. */
  input: string;
  /** Why the index could not settle it. */
  reason: 'not-in-index' | 'ambiguous';
  /** The placeholder URL that was emitted, so a rewrite pass can find it. */
  url: string;
  /** Candidates, when the reason is `ambiguous`. */
  candidates?: string[];
  /** How many times this path appears across the corpus. */
  count: number;
}

/** The object returned by {@link createPathResolver}. */
export interface PathResolver {
  /** Resolve one vault-ish path. Returns `null` when nothing claims it. */
  resolve(path: string, context?: ResolveContext): ResolvedPath | null;
  /** Adapter for `wikilinks: { resolver }`. */
  toWikilinkResolver(): (input: {
    path: string;
    anchor: string | null;
    display: string | null;
    raw: string;
  }) => { url: string; isLocal: boolean; display: string; classes?: string[] } | null;
  /** Counts by tier and diagnostic reason. For build-time reporting. */
  stats(): Readonly<Record<string, number>>;
  /**
   * The deduplicated queue of paths that were deferred, most frequent first.
   *
   * Read it *after* the build has walked every document — it is a running
   * tally, not a snapshot. Feed it to a post-build rewrite pass, an SSR route
   * table, or an audit report.
   */
  deferred(): DeferredEntry[];
  /** Files in the index, after `base` stripping. Diagnostic aid. */
  readonly size: number;
}

/* ------------------------------------------------------------------ */
/* Normalisation — the part that actually earns its keep                */
/* ------------------------------------------------------------------ */

const DEFAULT_EXTENSIONS = ['.md', '.mdx'];

/**
 * The normalisation used for every comparison. Deliberately aggressive: it
 * exists to make `Tooling/Lost in Public/Foo_Bar.md` and
 * `tooling/lost-in-public/foo-bar` the same key, because the vault contains
 * both spellings of the same directory and neither is going to be corrected.
 */
function makeNormalizer(opts: {
  caseSensitive: boolean;
  looseSeparators: boolean;
  extensions: string[];
}) {
  return function normalize(raw: string): string {
    let s = String(raw).trim();
    // Windows separators and duplicate slashes.
    s = s.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    // Leading `./` and any leading/trailing slash.
    s = s.replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '');
    for (const ext of opts.extensions) {
      if (s.toLowerCase().endsWith(ext)) {
        s = s.slice(0, -ext.length);
        break;
      }
    }
    if (!opts.caseSensitive) s = s.toLowerCase();
    if (opts.looseSeparators) {
      s = s
        .split('/')
        .map((seg) => seg.replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, ''))
        .join('/');
    }
    return s;
  };
}

/** Default slugifier — matches the house convention used across the sites. */
export function slugifyPath(s: string): string {
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9/]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .replace(/\/-|-\//g, '/');
}

/** Default display text — the last segment, made human. */
function defaultDisplay(parts: PathParts): string {
  return parts.name.replace(/[_-]+/g, ' ').trim();
}

/**
 * Apply `./` and `../` against the directory of `from`. Returns the input
 * untouched when it is not relative, or when there is no context to resolve
 * against — a dangling `../` is a bad link, not a crash.
 */
function applyRelative(pathish: string, from?: string): string {
  if (!/^\.\.?\//.test(pathish)) return pathish;
  if (!from) return pathish.replace(/^\.\.?\//, '');
  const fromSegments = from.replace(/\\/g, '/').split('/');
  fromSegments.pop(); // drop the filename — we want its directory
  const out = fromSegments.slice();
  for (const seg of pathish.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

/* ------------------------------------------------------------------ */
/* The resolver                                                        */
/* ------------------------------------------------------------------ */

/**
 * Build a path resolver from declarative configuration.
 *
 * @param config routes, and optionally an index of the vault
 * @returns a resolver usable directly, or via `toWikilinkResolver()`
 */
export function createPathResolver(config: PathResolverConfig): PathResolver {
  const caseSensitive = config.caseSensitive ?? false;
  const looseSeparators = config.looseSeparators ?? true;
  const extensions = config.extensions ?? DEFAULT_EXTENSIONS;
  const slugify = config.slugify ?? slugifyPath;
  const display = config.display ?? defaultDisplay;
  const slugFrom = config.slugFrom ?? 'basename';
  const cascade = config.cascade ?? ['exact', 'suffix', 'basename'];
  const onAmbiguous = config.onAmbiguous ?? 'plain';
  const preferAuthorDisplay = config.preferAuthorDisplay ?? true;
  const customTokens = config.tokens ?? {};
  const deferCfg = config.deferred;
  const deferWhen = deferCfg?.when ?? 'not-in-index';
  const deferQueue = new Map<string, DeferredEntry>();
  const bases = (config.base === undefined ? [] : Array.isArray(config.base) ? config.base : [config.base])
    .map((b) => b.replace(/^\/+|\/+$/g, ''));

  const normalize = makeNormalizer({ caseSensitive, looseSeparators, extensions });

  // `route` is the fall-through, not an index tier — it is never listed in a
  // cascade, it is what happens when the cascade finds nothing.
  const activeTiers = new Set(cascade.filter((t) => t !== 'route'));

  const counts: Record<string, number> = Object.create(null);
  const bump = (k: string) => { counts[k] = (counts[k] ?? 0) + 1; };

  const diagnose = (d: PathDiagnostic) => {
    bump(`diag:${d.reason}`);
    if (config.onDiagnostic) {
      try { config.onDiagnostic(d); } catch { /* reporting must never break a build */ }
    }
  };

  /* ---- Index construction -------------------------------------- */
  // Three lookups, built once:
  //   byPath     normalised full path        → file(s)
  //   bySuffix   every trailing segment run  → file(s)
  //   byBase     normalised basename         → file(s)
  // Suffix is the expensive one (O(segments) entries per file) but the vault
  // is ~4,700 files averaging ~3 segments, so it is a five-figure map built
  // once per build. That is nothing next to the markdown parse it serves.
  const byPath = new Map<string, string[]>();
  const bySuffix = new Map<string, string[]>();
  const byBase = new Map<string, string[]>();
  let size = 0;

  const push = (m: Map<string, string[]>, k: string, v: string) => {
    if (!k) return;
    const list = m.get(k);
    if (list) { if (!list.includes(v)) list.push(v); }
    else m.set(k, [v]);
  };

  const stripBase = (p: string): string => {
    let s = p.replace(/\\/g, '/').replace(/^\/+/, '');
    for (const b of bases) {
      const nb = normalize(b);
      const ns = normalize(s);
      if (ns === nb) return '';
      if (ns.startsWith(nb + '/')) { s = s.slice(b.length).replace(/^\/+/, ''); break; }
    }
    return s;
  };

  if (config.index) {
    for (const raw of config.index) {
      if (typeof raw !== 'string' || !raw.trim()) continue;
      const rel = stripBase(raw);
      if (!rel) continue;
      size++;
      const norm = normalize(rel);
      const segs = norm.split('/').filter(Boolean);
      push(byPath, norm, rel);
      push(byBase, segs[segs.length - 1] ?? '', rel);
      // Every trailing run of 2..n segments. The 1-segment case is byBase.
      for (let i = segs.length - 2; i >= 0; i--) {
        push(bySuffix, segs.slice(i).join('/'), rel);
      }
    }
  }

  /* ---- Route matching ------------------------------------------ */
  const compiledRoutes = config.routes.map((r) => {
    const matches = (Array.isArray(r.match) ? r.match : [r.match]).map((m) => m.trim());
    return {
      route: r,
      label: matches.join('|'),
      isCatchAll: matches.includes('*'),
      // Normalised prefixes, longest first so `tooling/hardware` beats `tooling`.
      prefixes: matches
        .filter((m) => m !== '*')
        .map((m) => normalize(m))
        .sort((a, b) => b.length - a.length),
    };
  });

  function matchRoute(normPath: string) {
    for (const c of compiledRoutes) {
      for (const p of c.prefixes) {
        if (normPath === p || normPath.startsWith(p + '/')) {
          return { compiled: c, prefix: p };
        }
      }
      if (c.isCatchAll) return { compiled: c, prefix: '' };
    }
    return null;
  }

  /* ---- Template expansion --------------------------------------- */
  function buildParts(canonical: string, prefix: string): PathParts {
    // Display and `{name}` come from the path as it exists on disk (or as
    // written), NOT from the normalised form — normalisation destroys casing
    // and separators on purpose, and a reader should see `Build Systems`,
    // not `build-systems`.
    const clean = canonical.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const withoutExt = extensions.reduce(
      (s, ext) => (s.toLowerCase().endsWith(ext) ? s.slice(0, -ext.length) : s),
      clean,
    );
    const segments = withoutExt.split('/').filter(Boolean);
    const name = segments[segments.length - 1] ?? '';
    const dir = segments.slice(0, -1).join('/');
    // Count prefix segments off the normalised form, then slice the same
    // number off the real one — keeps `tail` in original casing.
    const prefixLen = prefix ? prefix.split('/').filter(Boolean).length : 0;
    const tail = segments.slice(prefixLen).join('/');
    return { path: withoutExt, segments, name, dir, tail: tail || name, prefix };
  }

  function resolveSlug(parts: PathParts, strategy: SlugStrategy): string {
    if (typeof strategy === 'function') return strategy(parts);
    switch (strategy) {
      case 'tail': return slugify(parts.tail);
      case 'full': return slugify(parts.path);
      case 'basename':
      default: return slugify(parts.name);
    }
  }

  function expand(template: string, parts: PathParts, strategy: SlugStrategy): string {
    return template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (whole, token: string) => {
      const custom = customTokens[token];
      if (custom) {
        try { return custom(parts); } catch { return ''; }
      }
      switch (token) {
        case 'slug': return resolveSlug(parts, strategy);
        case 'name': return encodeURIComponent(parts.name);
        case 'tail': return parts.tail.split('/').map(encodeURIComponent).join('/');
        case 'dir': return parts.dir.split('/').filter(Boolean).map(encodeURIComponent).join('/');
        case 'prefix': return parts.prefix;
        case 'path': return parts.path.split('/').map(encodeURIComponent).join('/');
        // An unrecognised token is left as written rather than blanked, so a
        // typo in a template is visible in the output instead of silent.
        default: return whole;
      }
    });
  }

  const inferLocal = (url: string) => !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url);

  /* ---- The cascade ---------------------------------------------- */
  /**
   * Resolve an ambiguous hit according to the configured policy. Returns the
   * chosen file, or `null` to mean "render as plain text".
   */
  function disambiguate(input: string, candidates: string[]): string | null {
    diagnose({ input, reason: 'ambiguous', candidates });
    if (onAmbiguous === 'first') return [...candidates].sort()[0] ?? null;
    if (typeof onAmbiguous === 'function') {
      try {
        const picked = onAmbiguous(input, [...candidates]);
        return picked && candidates.includes(picked) ? picked : null;
      } catch {
        return null; // a throwing policy hook must not break the build
      }
    }
    return null; // 'plain'
  }

  /**
   * Walk the configured cascade. Each tier is one Map lookup — the whole
   * index is built once per resolver, so this is O(tiers), not O(vault).
   *
   * A tier that matches several files does NOT fall through to the next one.
   * It hands off to the ambiguity policy and stops, because a link that is
   * confidently wrong is worse than a link that is absent.
   */
  let lastFailure: { reason: 'not-in-index' | 'ambiguous'; candidates?: string[] } | null = null;

  function lookup(
    normPath: string,
    input: string,
  ): { file: string; via: ResolutionTier } | null {
    lastFailure = null;
    if (size === 0 || activeTiers.size === 0) return null;

    const base = normPath.split('/').filter(Boolean).pop() ?? '';
    const tierSource: Record<string, () => string[] | undefined> = {
      exact: () => byPath.get(normPath),
      suffix: () => bySuffix.get(normPath),
      // The bare-name tier. `[[DevOps]]` with no folder is 28% of the real
      // corpus, and the basename map is a plain O(1) Map keyed on the last
      // segment with the extension already stripped.
      basename: () => byBase.get(base),
    };

    for (const tier of cascade) {
      if (tier === 'route') continue;
      const hits = tierSource[tier]?.();
      if (!hits || hits.length === 0) continue;
      if (hits.length === 1) return { file: hits[0]!, via: tier };
      const picked = disambiguate(input, hits);
      if (picked) return { file: picked, via: tier };
      lastFailure = { reason: 'ambiguous', candidates: [...hits] };
      return null;
    }

    diagnose({ input, reason: 'not-in-index' });
    lastFailure = { reason: 'not-in-index' };
    return null;
  }

  /**
   * Emit a placeholder link and record the path on the queue. Called only
   * when the index could not settle a path AND a `deferred` template exists.
   */
  function defer(
    input: string,
    raw: string,
    failure: { reason: 'not-in-index' | 'ambiguous'; candidates?: string[] },
  ): ResolvedPath | null {
    if (!deferCfg) return null;
    if (deferWhen !== 'both' && deferWhen !== failure.reason) return null;

    const parts = buildParts(raw, '');
    const url = expand(deferCfg.to, parts, slugFrom);
    const key = `${url}\u0000${input}`;
    const existing = deferQueue.get(key);
    if (existing) existing.count++;
    else {
      deferQueue.set(key, {
        input,
        reason: failure.reason,
        url,
        ...(failure.candidates ? { candidates: failure.candidates } : {}),
        count: 1,
      });
    }
    bump('via:deferred');
    return {
      url,
      isLocal: deferCfg.isLocal ?? inferLocal(url),
      display: display(parts),
      ...(deferCfg.classes?.length ? { classes: deferCfg.classes } : {}),
      via: 'deferred',
      route: 'deferred',
    };
  }

  function resolve(pathish: string, context?: ResolveContext): ResolvedPath | null {
    if (typeof pathish !== 'string' || !pathish.trim()) return null;

    // Strip wikilink brackets if a caller passes the raw form.
    let raw = pathish.trim().replace(/^\[\[/, '').replace(/\]\]$/, '');
    raw = raw.split('#')[0]!.split('|')[0]!.trim();
    if (!raw) return null;

    raw = applyRelative(raw, context?.from);
    const normPath = normalize(stripBase(raw));
    if (!normPath) return null;

    const hit = lookup(normPath, pathish);
    if (!hit && lastFailure && deferCfg) {
      const queued = defer(pathish, raw, lastFailure);
      if (queued) return queued;
    }
    // An ambiguous hit TERMINATES resolution — it does not fall through to
    // the route tier. The index positively identified this path; it just
    // could not pick between candidates. Falling through would let a
    // catch-all route emit a confidently-wrong link for precisely the case
    // where we know we don't know, which is the worst available outcome.
    if (!hit && lastFailure?.reason === 'ambiguous') return null;

    // `canonical` is the on-disk path when the index knew, else the path as
    // written — so routing behaves identically with and without an index,
    // just less accurately.
    const canonical = hit ? hit.file : raw;
    const via: ResolutionTier = hit ? hit.via : 'route';

    const canonicalNorm = normalize(stripBase(canonical));
    const matched = matchRoute(canonicalNorm);
    if (!matched) {
      diagnose({ input: pathish, reason: 'no-route' });
      return null;
    }

    const { route, label } = matched.compiled;
    if (route.to === null) {
      diagnose({ input: pathish, reason: 'route-parked' });
      return null;
    }

    const parts = buildParts(canonical, matched.prefix);
    const url = expand(route.to, parts, route.slugFrom ?? slugFrom);

    bump(`via:${via}`);
    return {
      url,
      isLocal: route.isLocal ?? inferLocal(url),
      display: display(parts),
      ...(route.classes?.length ? { classes: route.classes } : {}),
      via,
      ...(hit ? { file: hit.file } : {}),
      route: label,
    };
  }

  return {
    resolve,
    toWikilinkResolver() {
      return (input) => {
        const r = resolve(input.path);
        if (!r) return null;
        return {
          url: r.url,
          isLocal: r.isLocal,
          // An author-supplied `|Display` wins by default — they were
          // explicit. Set `preferAuthorDisplay: false` to let the resolver's
          // derived display win instead (useful when a vault has drifted
          // display text you want normalised away).
          display: (preferAuthorDisplay ? input.display ?? r.display : r.display) || r.display,
          ...(r.classes ? { classes: r.classes } : {}),
        };
      };
    },
    stats() {
      return { ...counts };
    },
    deferred() {
      return [...deferQueue.values()].sort((a, b) => b.count - a.count || a.input.localeCompare(b.input));
    },
    get size() {
      return size;
    },
  };
}
