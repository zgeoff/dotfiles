#!/bin/sh

set -e

# these are mirrored in the root .env file
export DOTFILES_BIN_DIR="$HOME/bin"
export DOTFILES_LIBS_DIR="$HOME/libs"
export DOTFILES_SCRIPTS_DIR="$HOME/scripts"

# make sure we're in the home dir
cd "$HOME"

# ensure the user has a /bin directory, and add it to the path
if [ ! -d "$DOTFILES_BIN_DIR" ]; then
  mkdir "$DOTFILES_BIN_DIR"
fi

export PATH="$DOTFILES_BIN_DIR:$PATH"

# pull down `yadm` and symlink it into our user's /bin
yadm_dir="$DOTFILES_LIBS_DIR/yadm"

if [ ! -d "$yadm_dir" ]; then
  git clone https://github.com/thelocehiliosan/yadm.git "$yadm_dir" >/dev/null

  ln -fs "$yadm_dir/yadm" "$DOTFILES_BIN_DIR/yadm"
fi

# clone our system config and update origin to use SSL in the future
yadm clone -f https://github.com/zgeoff/dotfiles >/dev/null
yadm remote set-url origin "git@github.com:zgeoff/dotfiles.git"

# check out a specific commit if it's been specified e.g. CI pull request
if [ -n "$DOTFILES_CHECKOUT_SHA1" ]; then
  yadm checkout "$DOTFILES_CHECKOUT_SHA1"
fi
