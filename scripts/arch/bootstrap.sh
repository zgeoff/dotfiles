#!/bin/sh

set -eu

scripts="
add_pacman_repo_keys.sh
refresh_package_databases.sh
update_pacman_mirrorlist.sh
refresh_package_databases.sh
install_yay.sh
install_build_deps.sh
"

bootstrap() {
  for script in $scripts; do
    "./$script" "$@"
  done
}

bootstrap "$@"
