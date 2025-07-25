#!/bin/sh

set -eu

install_or_update_go_packages() {
  echo "go: installing packages"

  go install github.com/mattn/efm-langserver@latest
  go install golang.org/x/tools/gopls@latest
}

install_or_update_go_packages "$@"
