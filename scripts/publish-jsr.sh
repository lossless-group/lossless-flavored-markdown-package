#!/usr/bin/env bash
#
# publish-jsr.sh — publish to JSR on a machine where the `jsr` npm CLI cannot run.
#
# `pnpx jsr publish` downloads a generic-linux `deno` binary and executes it.
# On NixOS that binary cannot start — there is no /lib64 loader at the path it
# was linked against — so it dies with exit 127 and the message "Could not start
# dynamically linked executable". Same class of problem as Playwright's bundled
# Chromium, which is why the browser drives point at the Nix-provided Brave.
#
# The fix is to run `deno publish` directly with the flags the jsr CLI would
# have passed, using a deno that actually runs on this machine.
#
# Auth: `deno publish` opens a browser to authorize and NEEDS A TTY. Run it from
# an interactive shell, or pass a token from https://jsr.io/account/tokens:
#
#     pnpm lfm:jsr                      # interactive, browser auth
#     pnpm lfm:jsr -- --token "$JSR_TOKEN"
#
# JSR shows only the README, so the published one carries the docs-v guides.
# build-jsr-readme.mjs swaps it in for the publish, and the trap restores the
# short one. That needs --allow-dirty, so the clean-tree check moves here.
#
set -euo pipefail

if [[ " $* " != *" --allow-dirty "* ]] && [[ -n "$(git status --porcelain)" ]]; then
  echo "publish-jsr: uncommitted changes. Commit them, or pass --allow-dirty." >&2
  exit 1
fi

README_BACKUP="$(mktemp)"
cp README.md "$README_BACKUP"
trap 'cp "$README_BACKUP" README.md; rm -f "$README_BACKUP"' EXIT
node scripts/build-jsr-readme.mjs README.md

FLAGS=(
  publish
  --unstable-bare-node-builtins
  --unstable-sloppy-imports
  --unstable-byonm
  --no-check
  --allow-dirty
)

if command -v deno >/dev/null 2>&1; then
  deno "${FLAGS[@]}" "$@"
elif command -v nix >/dev/null 2>&1; then
  # NixOS without deno installed globally — fetch it from nixpkgs on demand.
  nix run nixpkgs#deno -- "${FLAGS[@]}" "$@"
else
  # Non-Nix machine: the npm CLI's bundled binary is fine there.
  pnpx jsr publish --allow-dirty "$@"
fi
