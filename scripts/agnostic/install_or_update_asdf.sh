#!/usr/bin/env bash

set -eu

install_or_update_asdf() {
  if ! command -v asdf; then
    echo "asdf: installing cli"

    if [ "$(uname -s)" = "Darwin" ]; then
      brew install asdf
    else
      git clone https://aur.archlinux.org/asdf-vm.git && cd asdf-vm && makepkg -si
    fi

    # generate completions
    mkdir -p "${ASDF_DATA_DIR:-$HOME/.asdf}/completions"

    asdf completion zsh > "${ASDF_DATA_DIR:-$HOME/.asdf}/completions/_asdf"
  else
    echo "asdf: updating cli"

    asdf update >/dev/null || true
  fi

  desired_plugins="golang lua nodejs python ruby"

  # add our version manager plugins
  for plugin in $desired_plugins; do
    if ! asdf list "$plugin" >/dev/null 2>&1; then
      echo "asdf: installing $plugin plugin"

      asdf plugin add "$plugin" >/dev/null
    else
      echo "asdf: updating $plugin plugin"

      asdf plugin update "$plugin" >/dev/null
    fi
  done
}

install_or_update_asdf "$@"
