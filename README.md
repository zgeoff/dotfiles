<div align="center">
  <h1>dotfiles</h1>

  <p>
    <a href="./UNLICENSE.md"><img src="https://img.shields.io/badge/license-Unlicense-blue" alt="Unlicense"></a>
  </p>

  <p>
    <a href="./docs/README.md">Documentation</a> •
    <a href="./docs/guides/new-machine.md">Set up a new machine</a>
  </p>
</div>

Personal config for Arch and macOS machines, managed with [chezmoi](https://chezmoi.io). Start here to set up a new machine, or to change the config of one.

The repo holds the shell, editor and terminal config for each machine, the packages each one installs, and the global rules for Claude Code and Codex. chezmoi renders the source state in `home/` into `$HOME`, and [age](https://github.com/FiloSottile/age) encrypts the secrets in it.

## Quick start

Copy the age identity key to `~/.config/chezmoi/key.txt` first, then install chezmoi and apply the repo:

```sh
sh -c "$(curl -fsLS get.chezmoi.io)" -- -b ~/.local/bin
chezmoi init --apply --source ~/projects/dotfiles https://github.com/zgeoff/dotfiles.git
```

[Set up a new machine](./docs/guides/new-machine.md) covers the age key, the prompts, the SSH and GPG keys, and the prompt font on WSL.

## Checks

CI runs these on each pull request:

```sh
bun run audit
bun test
```

CI also scans each pull request for leaked secrets with gitleaks, and checks its title and description.

## Layout

- `home/`: the chezmoi source state, which `chezmoi apply` renders into `$HOME`. chezmoi skips `home/packages/`, which holds the package lists that the setup scripts in `home/.chezmoiscripts/` install.
- `tests/`: bun tests for the CLIs, the Claude skills and workflow, and the machine split.
- `docs/`: the guides.

## Documentation

See the [docs index](./docs/README.md).
