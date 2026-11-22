# Agent Guidelines

This repo is the chezmoi source for Geoff's Arch and macOS machines. `.chezmoiroot` points chezmoi
at `home/`, and the repo root is a normal project. Hand back a pull request into `main` with green
CI. Geoff applies each change to his machines after it merges.

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
tests/                bun tests for the CLIs, the Claude skills and workflow, the modify_ scripts
                      and the split between personal machines and the rest
```

## Make a change

1. Work in a git worktree at `.worktrees/<branch>`, cut from `main`.
2. Edit the source under `home/`, never the deployed file in `$HOME`. After `mise use -g`, run
   `chezmoi re-add ~/.config/mise/config.toml` to bring the change back into the source.
3. Keep each file to the machines that need it, as [Machines](#machines) says.
4. Run `chezmoi diff --source <worktree>`, where `<worktree>` is the worktree's absolute path. It
   renders the templates against this machine's data. Expect only the change you meant.
5. For each shell file you changed, render it with `chezmoi cat --source <worktree> <target>`, where
   `<target>` is its path under `$HOME`, and run `zsh -n` on the output.
6. Run `bun test` from the repo root.
7. Open the pull request, and watch CI until it is green.

## Machines

- Each machine answers four prompts on `chezmoi init`: `email`, `gui`, `personal` and `work`. A
  machine that answers no to both `personal` and `work` gets only the shared files.
- Keep a file that reaches a personal vault or host to personal machines. Add its target to the
  block for machines that are not personal in `home/.chezmoiignore`. In a template, wrap the lines
  in `{{- if and (hasKey . "personal") .personal }}`.
- Give a work-only rule or setting to work machines with `{{- if and (hasKey . "work") .work }}`.
- When you add a CLI to `home/dot_local/bin/` or a skill to `home/dot_claude/skills/`,
  `tests/machine-split.test.js` fails. List it there as shared, or keep it to personal machines.

## When something goes wrong

- A package script re-runs when its manifest changes. The Yayfile sync installs only the packages
  the repos offer and skips the rest. When a package seems absent, check the sync's stderr for
  `not available, skipped`.
- Tools rewrite some managed files. The `modify_` scripts own only some keys of
  `~/.claude/settings.json`, `~/.codex/config.toml` and `~/.config/atc/config.json`. Leave the rest
  (tokens, trust, MCP paths, atc targets and agents) to the machine.

## Limits

- Never run `chezmoi apply`. Geoff applies a change after it merges.
- Never run a command that needs sudo. The agent shell has no TTY for the password prompt, and each
  failure counts toward pam_faillock, which locks the account for 10 minutes after 3 failures. Hand
  Geoff the exact command instead.
