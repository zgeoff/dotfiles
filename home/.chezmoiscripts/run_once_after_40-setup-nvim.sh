#!/bin/sh

set -eu

mkdir -p "$HOME/.vim/files/backup" "$HOME/.vim/files/swap" "$HOME/.vim/files/undo"

# nvim reuses the vim config: ~/.vim is the config dir, ~/.vimrc its init
ln -fs "$HOME/.vimrc" "$HOME/.vim/init.vim"
ln -fns "$HOME/.vim" "$HOME/.config/nvim"
