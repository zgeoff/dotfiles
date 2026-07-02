#!/bin/sh

set -e

if ! grep "$(id -u -n)" </etc/passwd | grep -q "zsh"; then
  zsh_bin="$(grep --max-count=1 zsh </etc/shells)"
  chsh -s "$zsh_bin"
fi
