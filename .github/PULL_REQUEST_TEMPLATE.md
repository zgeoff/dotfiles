<!--
Name the issue the PR works on in the body only, never in the title or
the branch name: Linear closes an issue that a merged PR names there.
Write the title as a Conventional Commit whose scope, if any, names the
area the PR changes: `feat(retry): add the retry budget`.

Link the issue with one line anywhere in the body, and omit the line
when the PR has none:

Fixes GEO-123           merging completes the Linear issue
Contributes to GEO-123  the PR delivers part of it; work remains
Related to GEO-123      context only
Fixes #45               merging closes the GitHub issue
-->

## Description

<!--
A lead of 2 sentences or fewer: what changed and why. Then bullets of
one line each, with no **bold-label:** prefixes and no semicolon chains.
Cover decisions, deviations and tradeoffs, not an inventory of the diff:
if the diff shows it plainly, don't restate it. Keep this section to 150
words or fewer, with no story of earlier attempts or review rounds.
-->

## Not changed

<!--
One line each for what a reviewer could expect this PR to change but it
leaves alone, such as a caller that keeps the old behavior or a part left
to a follow-up issue. Write `None.` when nothing fits.
-->

## Testing

<!--
List each check you ran, as the exact command and its result. Name a
test file only when this PR adds or changes it. Say which check you
could not run, and why.
-->

- [ ] New or changed code has a test, or this section holds the reason it has none

## Context

<!--
Only what the diff can't show, such as an external constraint.
Delete this section when nothing fits.
-->
