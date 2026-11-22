<!--
Every comment below holds a rule and an example. The examples are invented: write your own
content, in the same format. Delete a section the comment says to delete. A PR-body check
fails on an unknown heading or label, an empty section, a Later line with no issue ID, a code
block over 50 lines or 100 characters wide, and a prose check older than the files it checked.

Title: a Conventional Commit, checked by CI. Never name the issue in the title or the branch.

  feat(queue): park a job when its retry budget runs out
-->

## Description

<!--
First, one line per linked issue. Delete it when the PR has none.

  Fixes GEO-123            merging completes the Linear issue
  Contributes to GEO-123   delivers part of it; work remains
  Related to GEO-123       context only
  Fixes #45                merging closes the GitHub issue
  Builds i-12              the boxxy item this PR builds; its short ID only

Then one or two sentences, the problem and then the change, and up to 4 one-line bullets:

  A job that kept failing retried forever. Each job now has a retry budget.

  - A job retries up to 5 times by default, then parks.
  - The dashboard lists parked jobs with their last error.

Then, when the PR adds or changes a contract (a type, a signature, a config shape, a CLI
flag), one code block that shows the contract, not the code behind it. Show a call with its
result in a code comment. When the PR changes a contract, show before and after. At most 50
lines, each 100 characters or fewer. Skip it for internal fixes, chores and bumps.

  ```ts
  type RetryPolicy = { budget: number }  // default 5
  queue.parked(): Promise<ParkedJob[]>   // [{ id: 'job_81', lastError: 'timeout' }]
  ```

  ```diff
  - retries = forever
  + retries = policy.budget ?? 5
  ```
-->

## Next steps

<!--
What happens after this PR. One bold label per group, in this order, and only the labels
you use. Delete the section when none applies.

**Needs the owner**: a task or a decision only the owner can do, so "done" or "decided"
answers it. One checkbox each.

  **Needs the owner**
  - [ ] Decide whether parked jobs expire after 30 days.
  - [ ] Deploy the host after this merges.

**Later**: work left for another PR, ending with its issue ID in brackets. File the issue
first. A defect you found goes here only when its fix belongs in another PR; otherwise fix it.

  **Later**
  - A requeue button for parked jobs (GEO-124).
-->

## Checks

<!--
Only when the PR changes a skill or a doc. Delete the section otherwise. CI ticks chex on
every push. Tick deslop and cold read yourself, with the short commit you checked. The check
fails a Deslop commit when a later commit changes the skill or doc files; a Cold read commit
stays valid.

  - [ ] chex
  - [x] Deslop (a1b2c3d)
  - [x] Cold read (a1b2c3d)
-->

## Verification

<!--
bun verify publish fills the space between the markers. Write nothing here yourself.
Delete the section in a repo with no verify setup.
-->

<!-- wringer:report -->
<!-- /wringer:report -->
