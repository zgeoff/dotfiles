# dotfiles

personal config for Arch & macOS, managed with [chezmoi](https://chezmoi.io).

- modern unix utils
- neovim
- zellij

## Layout

- `home/` — chezmoi source state
- `home/packages/` — `Yayfile` (Arch) and `Brewfile` (macOS)

## Setup on a new machine

```sh
sh -c "$(curl -fsLS get.chezmoi.io)" -- -b ~/.local/bin
chezmoi init --apply --source ~/projects/dotfiles https://github.com/zgeoff/dotfiles.git
```

`chezmoi init` prompts for machine data (email, GUI, personal, work) on first run;
answers are remembered. Re-run `chezmoi init` to change them.

Keys, fonts on WSL and the rest: [new machine guide](./docs/guides/new-machine.md).

## Daily use

```sh
chezmoi update            # pull + apply changes from other machines
chezmoi edit ~/.zshrc     # edit a managed file (source state, incl. templates)
chezmoi apply             # render source state into $HOME
chezmoi diff              # preview what apply would change
chezmoi re-add            # capture direct edits to live files back into source
chezmoi cd                # subshell in this repo
```

Changed source files are auto-staged (`git.autoAdd`); commit and push by hand.

## Secrets

Encrypted files (e.g. `.ssh/config`, commercial fonts under `.local/share/fonts`)
use [age](https://github.com/FiloSottile/age).
Copy the identity key to `~/.config/chezmoi/key.txt` (mode 600) on each machine —
it is provisioned out-of-band and never committed. Add new secrets with
`chezmoi add --encrypt <file>`.
