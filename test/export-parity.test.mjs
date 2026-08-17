/**
 * The two export maps must agree.
 *
 * This package declares its public surface twice — `package.json` for npm and
 * GitHub Packages, `deno.json` for JSR — and JSR enforces its map strictly.
 * When they drift, the result is a subpath that resolves on one registry and
 * throws on the other, and nothing in the build notices.
 *
 * That is not hypothetical. `deno.json` shipped from 0.4.1 through 0.5.0
 * without the four `./formats*` entries, so the entire code-fence registry was
 * published-but-unimportable for every consumer installing from JSR — which is
 * all nine of them. It went unnoticed for two releases because no site had
 * imported a format handler yet.
 *
 * See context-v/issues/JSR-Export-Map-Omits-the-Formats-Subpaths.md.
 *
 * Keys only. The values legitimately differ: JSR publishes TypeScript source
 * and resolves to `src/*.ts`, npm publishes built output and resolves to
 * `dist/*.js`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(readFileSync(join(root, name), 'utf8'));

const pkg = read('package.json');
const deno = read('deno.json');

const npmKeys = Object.keys(pkg.exports ?? {}).sort();
const jsrKeys = Object.keys(deno.exports ?? {}).sort();

test('every npm subpath is also exported to JSR', () => {
  const missing = npmKeys.filter((k) => !jsrKeys.includes(k));
  assert.deepEqual(
    missing,
    [],
    `deno.json is missing ${missing.join(', ')} — JSR consumers cannot import ${missing.length === 1 ? 'it' : 'them'}, ` +
      'even though publish.include ships the files',
  );
});

test('every JSR subpath is also exported to npm', () => {
  const missing = jsrKeys.filter((k) => !npmKeys.includes(k));
  assert.deepEqual(
    missing,
    [],
    `package.json is missing ${missing.join(', ')} — the drift runs both ways`,
  );
});

test('the maps are identical, key for key', () => {
  // Stated as one assertion too, so a failure prints both lists side by side
  // rather than only the delta.
  assert.deepEqual(jsrKeys, npmKeys);
});

test('every JSR export points at a file that exists', () => {
  // A typo here fails at publish time, on someone else's machine, after the
  // tag is already pushed.
  for (const [subpath, target] of Object.entries(deno.exports ?? {})) {
    assert.equal(typeof target, 'string', `${subpath} should map to a source path`);
    assert.ok(
      existsSync(join(root, target)),
      `${subpath} -> ${target} does not exist`,
    );
    assert.ok(target.endsWith('.ts'), `${subpath} -> ${target} should be TypeScript source; JSR publishes source`);
  }
});

test('every npm export points at built output that the build produces', () => {
  for (const [subpath, entry] of Object.entries(pkg.exports ?? {})) {
    const target = typeof entry === 'string' ? entry : entry.import ?? entry.default;
    assert.ok(target, `${subpath} has no import/default target`);
    assert.ok(
      target.startsWith('./dist/'),
      `${subpath} -> ${target} should resolve into dist/; npm publishes built output`,
    );
    // dist/ is gitignored, so only assert presence when a build has run.
    if (existsSync(join(root, 'dist'))) {
      assert.ok(existsSync(join(root, target)), `${subpath} -> ${target} is not in dist/ — is it in tsup.config.ts?`);
    }
  }
});

test('the two manifests agree on the version', () => {
  // Divergence here means npm and JSR publish different numbers from one tag,
  // which happened once already (0.5.0 was briefly cut as 0.4.1).
  assert.equal(deno.version, pkg.version, 'deno.json and package.json disagree');
});

test('the package name matches on both registries', () => {
  assert.equal(deno.name, pkg.name);
});
