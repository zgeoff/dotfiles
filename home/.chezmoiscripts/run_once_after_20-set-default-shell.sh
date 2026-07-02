#!/bin/sh

set -e

# macOS already defaults to zsh, and its users aren't in /etc/passwd anyway
[ "$(uname -s)" = "Darwin" ] && exit 0

if ! getent passwd "$(id -u -n)" | cut -d: -f7 | grep -q "zsh"; then
  zsh_bin="$(grep --max-count=1 zsh </etc/shells)"
  chsh -s "$zsh_bin"
fi
