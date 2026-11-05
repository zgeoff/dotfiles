<!--
Name the issue the PR works on in the body only, never in the title or
the branch name: Linear closes an issue that a merged PR names there.
Write the title as a Conventional Commit whose scope, if any, names the
area the PR changes: `feat(retry): add the retry budget`.
-->

## Description

<!--
First, one line per linked issue, and omit them when the PR has none:

Fixes GEO-123           merging completes the Linear issue
Contributes to GEO-123  the PR delivers part of it; work remains
Related to GEO-123      context only
Fixes #45               merging closes the GitHub issue

Then plain prose for the owner, who won't read the diff: in 2 sentences
or fewer, the problem, then the change. When the change has separate
parts, add a list of up to 4 items, one line each. No code, file names
or identifiers: they belong in the diff and in Verification. Keep this
section to 150 words or fewer, with no story of earlier attempts.
-->

## Not changed

<!--
One line each, 25 words or fewer, in plain words, starting with a label:

Needs the owner:  left alone because the owner decides it (list first)
Later:            deferred to another PR or issue, with its ID
Kept:             a reader could expect it to change; say why it didn't

No blanket reassurance such as "no behaviour change". Write `None.`
when nothing fits.
-->

## Verification

<!--
One line per Acceptance item, in the issue's words, then a colon and
what shows it: a test name, a command and its result, or a screenshot.
Put unticked lines first, each with why the item wasn't shown and what
happens next. Then any fix made on the way, and any check CI can't run.
Leave out checks CI runs anyway. Keep each line to 30 words or fewer.

Under the lines, a line may have up to two <details> blocks, each 40
lines or fewer, trimmed to what it shows:

Output: <the line> — <result>   the output that proves the line
Rerun: <the line>               the command or script that reproduces it

Link anything longer, or of any other kind, with `cloud up --md`.
Paste `bun verify report --human` last, untouched.
-->

- [ ] New or changed code has a test, or this line holds the reason it has none

## Checks

<!--
One ticked line per review you ran: `<review> (<who>): <n> fixed,
<n> declined`, where <who> names the model, and may be left out for a
review your own session ran. Keep the chex, Cold read and Deslop lines
only when the PR changes a skill's SKILL.md or a file under its
references/. Under "Declined:", give each declined finding one line: the
review that found it, the finding, then why not or the issue it went
to. Or write "Declined: none." A fixed finding shows in the diff; don't
list it.
-->

- [ ] Second opinion (<model>, <effort>): <n> fixed, <n> declined
- [ ] chex prose, links and skill: cleared
- [ ] Cold read: <n> fixed, <n> declined
- [ ] Deslop: <n> edits

Declined:

- <review>: <the finding>. <why not, or the issue it went to>
