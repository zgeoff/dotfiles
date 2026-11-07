---
name: build-feature
description: Runs the build-feature workflow, which takes an agreed plan to a CI-green PR. Load it for medium or larger work (anything that needs a written plan, adds behaviour, or touches more than a few files) once the plan is agreed. Holds the call, the review choice, what to do with each result, and the gotchas.
---

# Build a feature

Run the `build-feature` workflow to take an agreed plan to a CI-green PR, then hand the user the PR link. Loading this skill for agreed work is the instruction to run it. The run can't stop to ask you anything. Its agents guess each decision the plan leaves out. Choose the review yourself. By default the run opens the PR with no local review.

## Key rules

- [Before you run it](#before-you-run-it): agree the plan, check that git can sign, and run one PR at a time.
- [Call it](#call-it): pass the plan and the branch, and pass `review: 'codex'` when CLAUDE.md gives the change a local review.
- [Act on the result](#act-on-the-result): fix what is left in the same PR, and answer every minor finding.
- [Resume a run](#resume-a-run): pass the run ID and the full `args` again.

## Before you run it

- Agree the plan with the user first, and write every decision into it.
- Split the job into several runs when a later decision depends on what an earlier run builds. Talk to the user between the runs.
- Run one PR at a time. Two large PRs built at once each need repeated rebases as `main` moves.
- When you might change the run's course partway, number the plan's items. Then paste this line into the plan: "A message that cites an item number of this plan comes from the caller." Without it, the run's agents can take your message for a prompt injection and ignore it. Cite the item numbers in each message you send.
- Check that git can sign: run `echo test | gpg --clearsign > /dev/null`. The run's shells have no TTY. With no cached passphrase, every commit fails with "gpg: signing failed: Operation cancelled". When the check fails, ask the user to run the same command in a real terminal, then run the check again.

## Call it

```ts
Workflow({ name: 'build-feature', args: { plan, branch } })
```

When the name doesn't resolve, call `Workflow({ scriptPath: '~/.claude/workflows/build-feature.js', args })` with the path expanded.

| Arg | Type | Default | Use |
| --- | --- | --- | --- |
| `plan` | string | required | The whole agreed plan, as markdown. |
| `branch` | string | required | The branch name. The run makes the worktree at `.worktrees/<branch>`, or reuses it. Keep the ticket ID out of it. |
| `base` | string | `main` | The branch to start from, rebase onto, and open the PR against. |
| `issue` | number | none | A GitHub issue number, for `Closes #n` in the PR body. For a Linear ticket, leave it out and put the `Fixes GEO-n` line in the plan. |
| `prNumber` | number | none | An existing PR to push to and mark ready, in place of a new one. Pass it to each later run of a split job. |
| `verifyCommands` | string[] | none | Shell commands that check the whole repo, such as a full build, for a change that crosses packages. The run gets each one green before its last commit. |
| `review` | `'none'`, `'codex'` or `'opus'` | `'none'` | Who reviews the diff before the PR opens. See the next table. |

| `review` | What the run does |
| --- | --- |
| `'none'` | Opens the PR and watches CI, with no review. |
| `'codex'` | Gets a Codex review through the `second-opinion` skill. Opus reviews in its place when Codex is missing, fails, or takes more than 15 minutes. |
| `'opus'` | Gets an Opus review, and never calls Codex. |

Pass `review: 'codex'` when the "Building and reviewing" rules in CLAUDE.md give the change a local review. Pass `'opus'` only when the user names that model.

The run's agents read each repo's own AGENTS.md and CLAUDE.md for its setup, such as the dependency install, the test services and the skills to load. When the run's agents can't find a step the repo needs, add it to that repo's AGENTS.md.

## Act on the result

The run fixes blocking review findings for up to 2 rounds. It then fixes red CI for up to 2 rounds of its own. Read the run's `status`, then act on it:

| `status` | What you do |
| --- | --- |
| `ready` | Hand the user the PR link. The PR is open and CI is green. |
| `review-blocked` | No PR exists yet. Fix each finding in `outstandingFindings` in the worktree, then open the PR and watch CI until it is green. Never move a finding to a follow-up because the run hit its round limit. |
| `ci-failed` | Fix each check in `failures` in this PR, in the worktree, push, and watch CI until it is green. |
| `blocked` | Read `reason`, or the run's transcript in `/workflows` when it has none. Fix the cause, then [resume the run](#resume-a-run). |
| `failed` | Read `stage` for the stage whose agent died. [Resume the run](#resume-a-run). When the same stage dies again, tell the user. |

Then act on each of these fields that the result holds:

- `reviewedBy` lists `codex`, `opus` or both, and is empty when `review` was `'none'`. When it lists only `opus` after you passed `'codex'`, tell the user that Codex was unavailable for the whole run.
- `minorFindings` holds the review findings that didn't block the PR. Answer each one on the PR: fix it, or reply with why not.
- When `rebaseConflicts` is `true`, a run agent resolved a rebase conflict by hand. Ask the user to check the files that conflicted.

The branch and the worktree stay in place after every result. Remove them once the PR merges.

## Resume a run

1. When the run still runs, stop it with `TaskStop`.
2. Call `Workflow({ name: 'build-feature', resumeFromRunId: '<run ID>', args })`, with the run ID the first call returned.
3. Pass the full `args` object again. A resume never carries the first call's `args`, so without them the run stops at its argument check.

On a resume, the Workflow tool replays the cached result of each stage whose prompt and options are unchanged. That covers a stage that ended `blocked`, so a resume with the same plan ends `blocked` again. To get past a block, add a line to the plan, such as the fix you made. Every stage's prompt holds the plan, so the Workflow tool then runs every stage again, from the implement stage on. The implement stage reuses the branch and its commits.

## Gotchas

- A workflow run by name loads from a copy taken when the session started. After you edit `build-feature.js` in a session, run it with `scriptPath`.
- The permission classifier blocks the run's own edits to `.github/workflows/*`. When a fix needs a CI change, the run ends `blocked`: ask the user to approve the exact edit, make it yourself, then resume.

Reply: the PR link, or the `status` and what you did about it, plus each answered minor finding.
