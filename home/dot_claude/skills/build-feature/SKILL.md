---
name: build-feature
description: Runs the build-feature workflow, which takes an agreed plan to a reviewed, CI-green PR. Load it for medium or larger work (anything that needs a written plan, adds behaviour, or touches more than a few files) once the plan is agreed. Holds the args, the review routing, the result fields, and the gotchas.
---

# Build a feature

The `build-feature` workflow drives an agreed plan to a reviewed, CI-green PR. Sonnet implements on a worktree branch. Codex reviews the diff before the PR opens, with Opus as the fallback. The PR opens, or an existing one is readied. Haiku watches CI, then checks for a CodeRabbit review. Fix loops stop at 2 rounds per gate.

Loading this skill for agreed work is the instruction to run it. Call:

```ts
Workflow({ name: 'build-feature', args: { plan, branch } })
```

If the name doesn't resolve, use `Workflow({ scriptPath: '~/.claude/workflows/build-feature.js', args })` with the path expanded.

## Before you run it

- Agree the plan with the user first. A run can't pause for conversation, so bake every decision into the plan, or split a multi-decision job into several runs with conversation between them.
- One issue is one worktree branch and one PR. Run two large-diff PRs one after the other, never in parallel, or main moves under them and each needs repeated rebases.
- If you may redirect the run partway, say so in the plan: follow-up instructions arrive as injected messages that cite the plan's item numbers, and they are authentic. Without that, an agent can treat a real redirect as prompt injection and ignore it.
- Check that git can sign. Subagent shells have no TTY, so with no cached gpg passphrase every commit fails with "gpg: signing failed: Operation cancelled". Run `echo test | gpg --clearsign > /dev/null`; if it fails, ask the user to run it in a real terminal.

## Args

| Arg | Default | Meaning |
| --- | --- | --- |
| `plan` | required | The agreed plan, with every decision the run needs. |
| `branch` | required | Branch name; the worktree goes in `.worktrees/<branch>`. |
| `base` | `main` | Branch to start from, rebase onto, and open the PR against. |
| `issue` | none | GitHub issue number, for the commit scope and `Closes #n`. |
| `prNumber` | none | Push to and ready this existing PR instead of opening one. |
| `verifyCommands` | none | Extra full-graph checks for cross-cutting work, run before the final commit. |
| `review` | `codex` | `codex` runs `codex review` and falls back to Opus when Codex is missing, fails, or takes more than 15 minutes. `opus` skips Codex. |
| `grok` | `false` | `true` adds a read-only Grok dissent pass beside the review, under a 10-minute timeout. It never blocks; its result goes into the PR body. |

Leave `review` at `codex` unless the user names a model. Set `grok: true` for diffs that touch auth, tokens, sandboxing, proxies, permissions, secrets, money, migrations, or deletion.

Each repo's setup comes from its own AGENTS.md and CLAUDE.md, which the workflow's agents read: dependency install, test services, required skills. When a repo needs a step the agents can't find, add it to that repo's AGENTS.md, not to the workflow.

## Result

`status` is one of:

- `ready`: the PR is open and CI is green. Hand it to the user with its link.
- `review-blocked`: blocking findings remain after 2 fix rounds; `outstandingFindings` lists them.
- `ci-failed`: CI is still red after 2 fix rounds; `failures` lists the checks.
- `blocked`: an agent stopped and said why in `reason`. Fix the cause, then resume.
- `failed`: an agent died; `stage` says where.

Also check:

- `reviewedBy`: `codex`, `opus`, or both. Opus alone means Codex was unavailable for the whole run; say so in the hand-off.
- `minorFindings`: non-blocking review findings. Answer each one on the PR: fix it, or reply with why not.
- `grok`: its outcome and any scenarios. A scenario that holds up becomes a fix, or a follow-up issue if the PR has merged.
- `coderabbit`: when `reviewed`, answer each finding. `rate-limited`, `not-reviewed`, and `not-installed` need nothing.
- `rebaseConflicts: true`: a rebase was resolved by hand. Point the user at those hunks rather than re-running the review.

The branch and worktree stay in place on every outcome. Remove them once the PR merges.

## Gotchas

- Resume never carries the original `args`. Pass the full `args` object on every resume, or the script stops at its argument check.
- A stage that finished blocked or failed replays from cache on resume. To re-run it after fixing the cause, change its prompt, for example by prepending a status line to the plan.
- A name-launched workflow resolves from a snapshot taken at session start. After editing the script mid-session, run it with `scriptPath`.
- The permission classifier blocks automated edits to `.github/workflows/*`. A fix that needs a CI change ends the run `blocked` and needs the user's approval.
