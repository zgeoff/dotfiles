#!/bin/sh

set -eu

scripts="
install_or_update_homebrew.sh
set_system_defaults.sh
"

bootstrap() {
  for script in $scripts; do
    "./$script" "$@"
  done
}

bootstrap "$@"
