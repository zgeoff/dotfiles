# Agent Guidelines

This repo is the chezmoi source for Geoff's Arch and macOS machines. `.chezmoiroot` points chezmoi
at `home/`, and the repo root is a normal project.

## Layout

```text
home/                 chezmoi source state; each name maps to its target through chezmoi's
                      prefixes and suffixes (dot_, private_, executable_, encrypted_, modify_, .tmpl)
  .chezmoiscripts/    setup scripts that chezmoi runs on apply: packages, fonts, mise tools, shell
  .chezmoitemplates/  agents/ holds the global agent rules, which dot_claude/CLAUDE.md.tmpl and
                      dot_codex/AGENTS.md.tmpl render
  packages/           Yayfile and Brewfile; never deployed, read by the package scripts
  dot_claude/         ~/.claude: skills, agents, workflows, output styles, settings
  dot_codex/          ~/.codex: global rules and config
  dot_local/bin/      personal CLIs
tests/                bun tests for the CLIs in home/dot_local/bin/; run them with `bun test`
```

## This repo

- A package script re-runs when its manifest changes. The Yayfile sync installs only the packages
  the repos offer and skips the rest, so check its `not available, skipped` stderr when a package
  seems absent.
- Tools rewrite some managed files. The `modify_` scripts own only some keys of
  `~/.claude/settings.json` and `~/.codex/config.toml`, and leave the rest (tokens, trust, MCP
  paths) to the machine.
- After `mise use -g`, run `chezmoi re-add ~/.config/mise/config.toml` to bring the change back into
  the source.
- Check a change with `chezmoi diff --source <worktree>`, which renders templates against the real
  machine data, and run `zsh -n` on each rendered shell file.
- Never run `chezmoi apply`. Geoff applies a change after it merges.
- Never run a command that needs sudo. The agent shell has no TTY for the password prompt, and each
  failure counts toward pam_faillock, which locks the account for 10 minutes after 3 failures. Hand
  Geoff the exact command instead.
