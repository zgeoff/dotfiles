---
name: delegate
description: How to call Codex or Grok from Claude Code — the CLI commands, the prompt packet, and the gotchas. Load before any `codex` or `grok` call. When to delegate lives in the Delegation section of ~/.claude/CLAUDE.md.
---

# Delegate to Codex or Grok

Use the CLIs directly. The plugin wrappers are uninstalled on purpose: their agents defaulted to `--write` in the main tree.

## Commands

Run every call with `run_in_background`. Expect about 40 s to 2 min for a Codex question and 3 to 9 min for a Codex review. Grok runs from 10 s to more than an hour and often returns nothing, so wrap every Grok call in `timeout 600`. Write output to the scratchpad.

| Job | Command |
|---|---|
| Codex review, uncommitted work | `codex review --uncommitted < /dev/null` |
| Codex review, branch | `codex review --base <ref> < /dev/null` |
| Codex diagnosis or question | `codex exec -s read-only -o <out.md> "<packet>" < /dev/null` |
| Codex implementation | `codex exec -s workspace-write -C <worktree> -o <out.md> "<packet>" < /dev/null` |
| Grok dissent or alternate cause | `timeout 600 grok -p "<packet>" --permission-mode plan --tools read_file,grep,list_dir --deny 'mcp__*' --no-subagents --output-format plain --disable-web-search < /dev/null > <out.md>` |

- Always redirect stdin from `/dev/null`. Without it, a background `codex exec` waits on stdin forever.
- `grok -p` and `--prompt-file` cannot be combined. Pass the packet inline: `-p "$(cat packet.md)"`.
- Outside a git repo, add `--skip-git-repo-check` to `codex exec`.
- Grok stays read-only through the tool allowlist, not plan mode alone. Plan mode does not inspect shell commands, and its subagents can edit. `--sandbox read-only` would add a kernel boundary, but bwrap fails to start under WSL. Never give Grok write access.
- For a Codex implementation, create the worktree first. Merge its diff in the main thread.

## Prompt packet

Write the packet to a file, then pass it. In order:

1. The question: find a bug, give one alternate cause, review for data loss, or implement this spec.
2. Constraints that must not change, including the stack rules that apply.
3. The diff, the snapshot ref, or the file paths.
4. The exact error text.
5. Observed facts, kept separate from suspected causes.
6. What was tried, and the result of each attempt.
7. The acceptance checks.
8. For an implementation: the shared services it must not touch (ports, databases, credentials, deploys).

Omit the session transcript and your preferred conclusion. Never ask the model to confirm a diagnosis.

Ask for the return shape:

- Review or dissent: at most 3 findings, each with a location, the trigger, the consequence, and the check that falsifies it. Zero findings is a valid answer.
- Diagnosis: the evidence, and the next check that tells the causes apart.
- Implementation: the diff, the commands run and their results, and the checks that did not run.

## After the call

- Reproduce a finding before you act on it. Drop nits and drive-by refactors.
- Relay results to Geoff in plain language. Say which model said what.
- A timeout or an empty run on an optional call is a skip. On a required review, report it.
- A Grok call never blocks a merge. When the timeout fires, write "Grok timed out" in the PR body, not as a comment. When the run ends with no output, write "Grok returned no output" there. Then continue.
