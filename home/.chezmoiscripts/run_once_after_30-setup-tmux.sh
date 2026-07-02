#!/bin/sh

set -eu

# self-contained clone-or-pull (avoids depending on ~/.local/bin being on PATH mid-apply)
clone_or_update() {
  if [ -d "$2/.git" ]; then
    git -C "$2" pull --quiet
  else
    git clone --quiet "$1" "$2"
  fi
}

echo "tmux: installing plugins"

clone_or_update https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
clone_or_update https://github.com/tmux-plugins/tmux-sensible ~/.tmux/plugins/tmux-sensible
clone_or_update https://github.com/tmux-plugins/tmux-pain-control ~/.tmux/plugins/tmux-pain-control
clone_or_update https://github.com/christoomey/vim-tmux-navigator ~/.tmux/plugins/vim-tmux-navigator
clone_or_update https://github.com/tmux-plugins/tmux-open ~/.tmux/plugins/tmux-open
clone_or_update https://github.com/tmux-plugins/tmux-yank ~/.tmux/plugins/tmux-yank
clone_or_update https://github.com/tmux-plugins/tmux-resurrect ~/.tmux/plugins/tmux-resurrect
clone_or_update https://github.com/tmux-plugins/tmux-continuum ~/.tmux/plugins/tmux-continuum
clone_or_update https://github.com/wfxr/tmux-fzf-url ~/.tmux/plugins/tmux-fzf-url
