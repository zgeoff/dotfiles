#!/bin/sh

set -eu

install_build_deps() {
  if [ ! -x "$(command -v lspci)" ]; then
    yay -S --noconfirm "pciutils" >/dev/null
  fi

  yay -S --noconfirm \
    "libyaml" \ # needed for ruby
    >/dev/null
}

install_build_deps "$@"

