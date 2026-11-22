#!/usr/bin/env bash
#
# publish-npm.sh — publish to the public npm registry (registry.npmjs.org).
#
# npm is the registry the CDNs mirror: jsDelivr, unpkg and esm.sh serve every
# version published here, which is what lets a page with no build step (a
# Claude artifact, a CodePen) import `@lossless-group/lfm/browser` by URL.
# GitHub Packages and JSR don't feed those CDNs.
#
# Skips when this version is already on npm, like `pnpm lfm:gh`, so re-running
# a release is safe. Extra arguments go to `npm publish`:
#
#     pnpm lfm:npm                          # from a machine logged in to npmjs.com
#     pnpm lfm:npm --dry-run                # see what would be published
#     bash scripts/publish-npm.sh --provenance   # CI (publish-npm.yml)
#
# Auth: locally, `npm login` (an npmjs.com account with write access to the
# @lossless-group org). In CI, npm trusted publishing (OIDC) once the package
# has a trusted publisher on npmjs.com, else the NPM_TOKEN secret.
#
# publishConfig in package.json points at GitHub Packages for `lfm:gh`, and a
# user's .npmrc may map the @lossless-group scope there too, so both the
# registry and the scope's registry are set explicitly here.
#
set -euo pipefail

REGISTRY="https://registry.npmjs.org"
NAME="$(node -p "require('./package.json').name")"
VERSION="$(node -p "require('./package.json').version")"
TARGET=(--registry="$REGISTRY" "--@lossless-group:registry=$REGISTRY")

pnpm build

if npm view "$NAME@$VERSION" version "${TARGET[@]}" >/dev/null 2>&1; then
  echo "npm: $NAME@$VERSION is already published, skipping"
  exit 0
fi

npm publish --access public "${TARGET[@]}" "$@"
