# dotfiles

personal config for Arch & macOS, managed with [chezmoi](https://chezmoi.io).

- modern unix utils
- neovim
- zellij

## Layout

- `home/` — chezmoi source state (see `.chezmoiroot`). Deployed to `$HOME` by `chezmoi apply`.
- `home/packages/` — `Yayfile` (Arch) and `Brewfile` (macOS); never deployed, consumed by
  `home/.chezmoiscripts/` which re-runs package sync whenever they change.
- `scripts/` — manual/system-level scripts, not managed by chezmoi.

## Setup on a new machine

```sh
sh -c "$(curl -fsLS get.chezmoi.io)" -- -b ~/.local/bin
chezmoi init --apply --source ~/projects/dotfiles git@github.com:zgeoff/dotfiles.git
```

`chezmoi init` prompts for machine data (email, home/work profile, GUI) on first run;
answers are remembered. Re-run `chezmoi init` to change them.

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

Encrypted files (e.g. `.ssh/config`) use [age](https://github.com/FiloSottile/age).
Copy the identity key to `~/.config/chezmoi/key.txt` (mode 600) on each machine —
it is provisioned out-of-band and never committed. Add new secrets with
`chezmoi add --encrypt <file>`.

## Post-setup notes

SSH & PGP keys are provisioned manually:

```sh
# 1. put public and private SSH keys in ~/.ssh/id.pub and ~/.ssh/id, respectively
# 2. fix the file permissions to make the ssh agent happy
chmod 600 ~/.ssh/id ~/.ssh/id.pub

# 3. load the ssh agent and add the key
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id

# 4. import GPG keys from disk then remove them
gpg --import ~/gpg.pub
gpg --import ~/gpg.key
rm -f ~/gpg.pub ~/gpg.key

# 5. restart the gpg agent
killall gpg-agent
gpg-agent --daemon
```
