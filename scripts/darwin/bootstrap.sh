#!/bin/sh

set -eu

scripts="
install_or_update_homebrew.sh
install_mas.sh
install_utils.sh
"

bootstrap() {
  for script in $scripts; do
    "./$script" "$@"
  done
}

bootstrap "$@"
