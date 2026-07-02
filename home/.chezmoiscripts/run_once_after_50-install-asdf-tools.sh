#!/bin/sh

set -eu

if ! command -v asdf >/dev/null; then
  echo "asdf: not installed (Yayfile/Brewfile provide it), skipping tool install" >&2
  exit 0
fi

for plugin in nodejs golang python ruby lua; do
  asdf plugin list 2>/dev/null | grep -qx "$plugin" || asdf plugin add "$plugin"
done

# install everything pinned in ~/.tool-versions
cd "$HOME" && asdf install
