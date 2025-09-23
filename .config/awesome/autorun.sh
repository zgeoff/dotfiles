#!/bin/sh

run_unique() {
  process_name="$1"
  cmd="${2:-$1}"

  if command -v "$cmd" && [ -z "$(pgrep "$process_name")" ]; then
    "$cmd" &
  fi
}

start_xcape() {
  setxkbmap -option 'caps:ctrl_modifier'
  xcape -t 200 -e 'Caps_Lock=Escape;Control=Escape;Control_R=Escape'
}

run_unique bt-agent
run_unique compton
run_unique flashfocus
run_unique mpd
run_unique pulseaudio start-pulseaudio-x11
run_unique transmission-daemon
run_unique xcape start-xcape

