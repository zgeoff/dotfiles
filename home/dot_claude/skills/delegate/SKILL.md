---
name: delegate
description: How to call Codex from Claude Code — the CLI commands, the prompt packet, and the gotchas. Load before any `codex` call. When to delegate lives in the Delegation section of ~/.claude/CLAUDE.md.
---

# Delegate to Codex

Use the CLI directly. The plugin wrappers are uninstalled on purpose: their agents defaulted to `--write` in the main tree.

## Commands

Run every call with `run_in_background`. Expect about 40 s to 2 min for a Codex question and 3 to 9 min for a Codex review. Write output to the scratchpad.

| Job | Command |
|---|---|
| Codex review, uncommitted work | `codex review --uncommitted < /dev/null` |
| Codex review, branch | `codex review --base <ref> < /dev/null` |
| Codex diagnosis or question | `codex exec -s read-only -o <out.md> "<packet>" < /dev/null` |

- Always redirect stdin from `/dev/null`. Without it, a background `codex exec` waits on stdin forever.
- Outside a git repo, add `--skip-git-repo-check` to `codex exec`.

## Prompt packet

Write the packet to a file, then pass it. In order:

1. The question: find a bug, or review for data loss.
2. Constraints that must not change, including the stack rules that apply.
3. The diff, the snapshot ref, or the file paths.
4. The exact error text.
5. Observed facts, kept separate from suspected causes.
6. What was tried, and the result of each attempt.
7. The acceptance checks.

Omit the session transcript and your preferred conclusion. Never ask the model to confirm a diagnosis.

Ask for the return shape:

- Review: at most 3 findings, each with a location, the trigger, the consequence, and the check that falsifies it. Zero findings is a valid answer.
- Diagnosis: the evidence, and the next check that separates the causes.

## After the call

- Reproduce a finding before you act on it. Drop nits and drive-by refactors.
- Relay results to Geoff in plain language. Say which model said what.
- A timeout or an empty run on an optional call is a skip. On a required review, report it.
