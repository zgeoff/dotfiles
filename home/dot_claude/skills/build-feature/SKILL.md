---
name: build-feature
description: Runs the build-feature workflow, which takes an agreed plan to a CI-green PR. Load it for medium or larger work (anything that needs a written plan, adds behaviour, or touches more than a few files) once the plan is agreed. Holds the call, the review choice, what to do with each result, and the gotchas.
---

# Build a feature

Run the `build-feature` workflow to take an agreed plan to a CI-green PR. Hand the user the PR link, or the run's `status` and what you did about it, plus each minor finding you answered. You're done when the PR is open with green CI and each minor finding has an answer, or when a row of the [result table](#act-on-the-result) tells you to hand the failure to the user and you have. Run it as soon as you load this skill for agreed work. The run can't stop to ask you anything. Its agents guess each decision the plan leaves out. Choose the review yourself. By default the run opens the PR with no local review.

## Key rules

- [Before you run it](#before-you-run-it): agree the plan, check that git can sign, and run one PR at a time.
- [Call it](#call-it): pass the plan and the branch, and pass `review: 'codex'` when the change needs a local review under CLAUDE.md.
- [Act on the result](#act-on-the-result): fix what is left in the same PR, and answer every minor finding.
- [Resume a run](#resume-a-run): pass the run ID and the full `args` again, and put any new line in `resumeNotes`.

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
| `branch` | string | required | The branch name. The run makes the worktree at `.worktrees/<branch>`, or reuses it. Keep the ticket ID out of it: Linear closes an issue that a merged PR names in its branch. |
| `base` | string | `main` | The branch to start from, rebase onto, and open the PR against. |
| `issue` | number | none | A GitHub issue number, for `Closes #n` in the PR body. For a Linear ticket, leave it out and put the `Fixes GEO-n` line in the plan. |
| `prNumber` | number | none | An existing PR to push to and mark ready, in place of a new one. Pass it to each later run of a split job. |
| `verifyCommands` | string[] | none | Shell commands that check the whole repo, such as a full build, for a change that crosses packages. The run gets each one green before its last commit. |
| `review` | `'none'`, `'codex'` or `'opus'` | `'none'` | Who reviews the diff before the PR opens. See the next table. |
| `resumeNotes` | string | none | Lines for a [resumed run](#resume-a-run), such as the fix you made. |
| `resumeFrom` | `'implement'`, `'review'`, `'doc-check'`, `'open-pr'`, `'watch-ci'` or `'verify'` | none | The first stage whose prompts get `resumeNotes`. Required with `resumeNotes`. |

| `review` | What the run does |
| --- | --- |
| `'none'` | Opens the PR and watches CI, with no review. |
| `'codex'` | Gets a Codex review through the `second-opinion` skill. Opus reviews in its place when Codex is missing, fails, or takes more than 15 minutes. |
| `'opus'` | Gets an Opus review, and never calls Codex. |

Pass `review: 'codex'` when the change needs a local review under the "Building and reviewing" rules in CLAUDE.md. Pass `'opus'` only when the user names that model.

The run's agents read each repo's own AGENTS.md and CLAUDE.md for its setup, such as the dependency install and the test services. When they can't find a step the repo needs, add it to that repo's AGENTS.md.

The run also does the checks that need a fresh agent, which its own agents can't start:

- When the branch changes a doc or a skill file, as the repo's docs checks count them, one fresh agent cold-reads all of them before the PR opens. A second agent writes its own answers, fixes what the read found, deslops, runs the docs checks and commits. The run ticks the Deslop and Cold read lines in the PR body when the repo's PR template has them. When a later commit changes a doc, one agent deslops what changed, and the Deslop line moves to its commit.
- When the repo has a verify skill, the run gets CI green first, and counts the verify gate check as passed while the PR has no verify report. An agent then runs the verify steps once and publishes the report into the PR, and the run watches CI again for the gate check. CI fixes before verify don't add a verify run. After a fix that comes after verify, an agent gets the earlier verdicts, and checks only the features that the report command, run against the verified commit, marks changed.

## Act on the result

The run fixes blocking review findings for up to 2 rounds. It then fixes red CI for up to 2 rounds of its own. Read the run's `status`, then act on it:

| `status` | What you do |
| --- | --- |
| `ready` | Hand the user the PR link. The PR is open and CI is green. |
| `review-blocked` | The run opened no PR, and left a `prNumber` PR unchanged. Fix each finding in `outstandingFindings` in the worktree. Then open the PR, or push to the `prNumber` PR and mark it ready, and watch CI until it is green. Never move a finding to a follow-up because the run hit its round limit. |
| `ci-failed` | Fix each check in `failures` in this PR, in the worktree, push, and watch CI until it is green. |
| `blocked` | Read `reason`, or the run's transcript in `/workflows` when it has none. Fix the cause, then [resume the run](#resume-a-run). When `stage` is `verify`, verify each feature in `verify.unverified` yourself, publish the report, then watch CI. When `stage` is `doc-check` and `reason` names the cap of 20 doc files, run the deslop and cold-read skills on them yourself. |
| `failed` | Read `stage` for the stage whose agent died. [Resume the run](#resume-a-run). When the same stage dies again, tell the user. |

Then act on each of these fields that the result holds:

- `reviewedBy` lists `codex`, `opus` or both, and is empty when `review` was `'none'`. When it lists only `opus` after you passed `'codex'`, tell the user that Codex was unavailable for the whole run.
- `minorFindings` holds the review findings that didn't block the PR. Answer each one on the PR: fix it, or reply with why not.
- `docCheck` is null when the run checked no doc. Otherwise `stillDiffer` lists each cold-read answer that still differed after the one read. Fix each one, and tell the user. Bring each item in `openItems` to the user.

The branch and the worktree stay in place after every result. Remove them once the PR merges.

## Resume a run

1. When the run still runs, stop it with `TaskStop`.
2. Call `Workflow({ name: 'build-feature', resumeFromRunId: '<run ID>', args })`, with the run ID the first call returned.
3. Pass the full `args` object again. A resume never carries the first call's `args`, so without them the run stops at its argument check.

On a resume, the Workflow tool replays each agent's cached result up to the first agent whose prompt or options changed, then runs that agent and every later one. A stage that ended `blocked` replays too, so a resume with the same `args` ends `blocked` again.

To get past a block, leave `plan` as it was, and put what changed in `resumeNotes`, such as the fix you made. Set `resumeFrom` to the result's `stage`, or to an earlier stage when the fix changes what an earlier stage did. Pass `'review'` for `review-fix`, `'doc-check'` for `scan`, and `'watch-ci'` for `ci-fix`. The notes go into the prompts of that stage and every later one, so each earlier stage replays. The cold reader never gets them: it reads the docs blind.

On a second resume, keep `resumeFrom`, and add lines to the end of the same notes. Any change to the notes changes every prompt from the first `resumeFrom` on, so the run reruns from that stage.

When the plan itself is wrong, change `plan`. The run reruns from the implement stage, on the same branch, because only that stage's prompt holds the plan. Each later stage that needs the plan reads `.build-feature/plan.md` in the worktree, which git ignores.

## Gotchas

- A workflow run by name loads from a copy taken when the session started. After you edit `build-feature.js` in a session, run it with `scriptPath`.
- The permission classifier blocks the run's own edits to `.github/workflows/*`. When a fix needs a CI change, the run ends `blocked`: ask the user to approve the exact edit, make it yourself, then resume.

**Reply:** the PR link, or the `status` and what you did about it, plus each answered minor finding.
