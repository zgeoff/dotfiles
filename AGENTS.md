# Agent Guidelines

## Operations

- Perform all work on a branch in a git worktree under `.worktrees/` (e.g.
  `git worktree add .worktrees/<branch> -b <branch>`) — never commit directly on `main`.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages.
- When the work is ready, open a PR against `main` using the PR template
  (`.github/PULL_REQUEST_TEMPLATE.md`).
- PR descriptions are condensed by default: lead paragraph ≤2 sentences, one-line bullets, ≤150
  words. Write the short version first — do not draft long and trim.
- After pushing, link the opened PR's URL in your response so it's one click away.

## This repo

- chezmoi source state lives in `home/` (see `.chezmoiroot`); targets map via chezmoi naming
  (`dot_`, `private_`, `executable_`, `encrypted_`, `.tmpl`). The repo root is a normal project.
- `home/packages/` (Yayfile, Brewfile) is consumed by `home/.chezmoiscripts/`; package sync
  re-runs when a manifest changes. The Yayfile sync intersects with available packages and
  silently skips misses — check its "not available, skipped" stderr when a package seems absent.
- Verify with `chezmoi diff --source <worktree>` (renders templates against real machine data)
  and `zsh -n` on rendered shell files. `chezmoi apply` happens after merge, by the user.
- Never run sudo-requiring commands from the agent shell — there is no TTY for the password
  prompt, and each failure counts toward pam_faillock (3 failures = 10-minute account lockout).
  Hand the exact command to the user instead.
