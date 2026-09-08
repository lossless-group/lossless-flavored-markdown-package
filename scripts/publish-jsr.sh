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
set -euo pipefail

FLAGS=(
  publish
  --unstable-bare-node-builtins
  --unstable-sloppy-imports
  --unstable-byonm
  --no-check
)

if command -v deno >/dev/null 2>&1; then
  exec deno "${FLAGS[@]}" "$@"
elif command -v nix >/dev/null 2>&1; then
  # NixOS without deno installed globally — fetch it from nixpkgs on demand.
  exec nix run nixpkgs#deno -- "${FLAGS[@]}" "$@"
else
  # Non-Nix machine: the npm CLI's bundled binary is fine there.
  exec pnpx jsr publish "$@"
fi
