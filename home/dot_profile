#!/bin/sh

# shellcheck source=.env
. "$HOME/.env"

# shellcheck source=.aliases
. "$HOME/.aliases"

if [ ! -s "$HOME/.config/mpd/pid" ] && command -v "mpd"; then
  mpd
fi
