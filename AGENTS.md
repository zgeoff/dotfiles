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
tests/                bun tests for the CLIs in home/dot_local/bin/, the atc config and Claude
                      settings modify_ scripts, and the split between personal machines and the
                      rest; run them with `bun test`
```

## This repo

- Each machine answers two questions on `chezmoi init`: `personal` and `work`. A machine that
  answers no to both gets only the shared files.
- Keep a file that reaches a personal vault or host to personal machines: add its target to the
  block for machines that are not personal in `home/.chezmoiignore`. In a template, wrap the lines
  in `{{- if and (hasKey . "personal") .personal }}`.
- Give a work-only rule or setting to work machines with `{{- if and (hasKey . "work") .work }}`.
- When you add a CLI to `home/dot_local/bin/` or a skill to `home/dot_claude/skills/`,
  `tests/machine-split.test.js` fails until you list it there as shared, or keep it to personal
  machines.
- A package script re-runs when its manifest changes. The Yayfile sync installs only the packages
  the repos offer and skips the rest, so check its `not available, skipped` stderr when a package
  seems absent.
- Tools rewrite some managed files. The `modify_` scripts own only some keys of
  `~/.claude/settings.json`, `~/.codex/config.toml` and `~/.config/atc/config.json`, and leave the
  rest (tokens, trust, MCP paths, atc targets and agents) to the machine.
- After `mise use -g`, run `chezmoi re-add ~/.config/mise/config.toml` to bring the change back into
  the source.
- Check a change with `chezmoi diff --source <worktree>`, which renders templates against the real
  machine data, and run `zsh -n` on each rendered shell file.
- Never run `chezmoi apply`. Geoff applies a change after it merges.
- Never run a command that needs sudo. The agent shell has no TTY for the password prompt, and each
  failure counts toward pam_faillock, which locks the account for 10 minutes after 3 failures. Hand
  Geoff the exact command instead.
