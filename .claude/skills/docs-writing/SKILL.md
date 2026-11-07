---
name: docs-writing
description:
  "Writes or reviews prose that gets committed to a repo: docs/, READMEs, AGENTS.md, skills and code
  comments. Builds on published standards, adds the house rules they don't cover, and holds the
  README and docs/ rules and the scripts that check them. Load it before you write, edit or review
  any of them."
---

# Writing docs

The reader of committed prose wasn't there. They didn't see the conversation, the ticket or the
diff. You know what every word refers to, so you can't feel where a sentence leans on that context.
Check for these on purpose:

- a sentence that only makes sense if you were there;
- a copy of the code;
- padding, such as a paragraph that defends a decision nobody attacked;
- prose that keeps every rule and still reads like a machine wrote it.

When you write, run [the checks](#check-it) and a [cold read](../cold-read/SKILL.md), and hand back
the files you changed, the check output and what the cold read found. When you review, run the
checks on the changed files, read each one against every section below, and hand back each finding
with its line and the quoted rule, for the author to fix.

When the `skill-writing` skill disagrees with this one about a skill, follow skill-writing. When a
repo's `project-docs-writing` skill disagrees with this one about that repo's docs, follow it. Write
committed prose by these rules, whatever style you use in chat.

## Key rules

- [Cut words, keep it readable](#cut-words-keep-it-readable): when a rule makes a sentence worse,
  fix the sentence another way.
- [Standards](#standards): Google style for sentences, ASD-STE100 for instructions, Global English
  for one reading per sentence.
- [What goes in](#what-goes-in): the present system, nothing a reader can get from the code, one doc
  per fact.
- [House rules](#house-rules): lead with what the reader does, name the actor, use plain names, and
  cut the tells of machine-written prose.
- [Shape the doc](#shape-the-doc): a list, a table or numbered steps where each fits.
- [Check it](#check-it): three scripts, then a cold read.

## References

- [Doc files](./references/doc-files.md): writing or reviewing any file in `docs/` or a README. It
  covers the doc's type, the rule to state in place of a copy of the code, the opening and diagrams.
- [Architecture docs](./references/architecture-docs.md): a doc under `docs/architecture/`.
- [The docs/ tree](./references/docs-tree.md): deciding where a doc goes, or writing a design, a
  decision record or a spike.
- [READMEs](./references/readmes.md): writing or reviewing a README, with Doc files open too. It
  holds the five kinds of README and what each holds.

## Cut words, keep it readable

Write so a tired engineer understands on the first read. Two rules come before all the others:

- **Cut every word that does no work.**
- **When a rule makes a sentence worse, fix the sentence another way.**

Vary the rhythm. Use a short sentence for what the reader must remember, and a longer one for a fact
with its condition. Be specific. Write "a column rename fails the build" in place of "schema changes
can cause issues".

## Standards

- **[Google developer documentation style](https://developers.google.com/style), for sentences:**
  - "you", and the present tense;
  - the condition before the instruction;
  - the common case first;
  - never "simply" or "easy" in a procedure, because a reader who is stuck reads them as blame.
- **[ASD-STE100](https://www.asd-ste100.org/), for instructions only**, meaning numbered steps and
  sentences that tell the reader what to do. Keep STE out of explanation and reference, where its
  short sentences read like orders.
  - one instruction per sentence, about 20 words at most;
  - one meaning per word;
  - the warning before the step.
- **Global English, for one reading per sentence**, from _The Global English Style Guide_:
  - "only" next to the word it changes;
  - no noun strings, slashes or idioms;
  - every "it" and "this" pointing at one thing.

## What goes in

**Describe the system as it is now.** Leave these out, because each goes false without anyone
noticing:

- history and plans;
- temporary states;
- links to the project's own tracker;
- words that make sense only next to the old version, such as "the new endpoint", or an "also" that
  means "in addition to before".

**Cut what a reader can get from the code.** Picture a reader who has the code open. If a paragraph
tells them nothing new, delete the whole paragraph. Keep a fact that shows only across several
files.

**After a bug fix, rewrite the sentence the fix made false.** Don't add a paragraph. A doc that
grows a paragraph per fix turns into a changelog.

**Give each doc one job, and each fact one doc that owns it.** A doc serves one reader doing one
task. Explain each fact, with its reason, in one doc, and link to that doc from the others. When two
docs disagree, check the owning doc against the code, and replace the other copy with a link.

**In a code comment,** write why the code is the way it is. The rules in this section and the house
rules apply to it.

## House rules

**Say who does what.** Name the actor. Don't make a thing act like a person ("the field says", "the
reason does the work", "the error names the fix"). That hides who acts.

**Lead with what the reader does.** Open a paragraph or a bullet with the instruction or the fact
the reader acts on. A definition first ("A heavy check is a job that…") or a label and a colon
("Private:") leaves the reader to work out what to do.

**Use the plain name.** Call a thing what the reader already calls it. A label you made up, such as
"a negative" for a failed check, reads as a term they should know.

**Don't hedge a decision.** Save "may" and "should" for options that are still open.

**State the rule, then put the exception in a sentence of its own.** When there are two or more
exceptions, list them.

**Link the doc that owns a fact instead of writing "as noted above".** Repeat a noun rather than
make the reader scroll back.

**Put the negation on the verb.** "The worker never retries a failed payment" is clear from its
first words. "No worker retries a failed payment" reads as a claim about every worker until the verb
arrives.

**Replace a vague qualifier with the claim.** Give the figure and its source where you'd write
"often". With no figure, delete the qualifier.

**Cut the tells of machine-written prose:**

- a transition that recaps the last paragraph ("With this in place…");
- feature-list voice ("provides", "offers a flexible way to");
- three adjectives on one noun;
- the same move three times, such as "X, not Y";
- a question that only sets up the next sentence;
- a slogan in place of a rule.

A short line that sums up a rule is fine when the rule sits next to it in full.

## Shape the doc

- **Lists or prose.** Put parallel items in a list. Write cause and effect as a paragraph.
- **Tables.** Use one for three or more items that each have two or more attributes, with one value
  per cell.
- **Procedures.** Number the steps, and give the expected outcome after each one that has one:
  "Expect: HTTP 202".
- **Headings.** Name what the section is about. Skip a role name such as "Overview". Use no
  horizontal rule between sections.
- **Formatting.** Tag every code block with a language, link with a path relative to the file, and
  name what each placeholder stands for (`<service_id>`, never `xxx`).
- **Line breaks.** When the repo's pre-commit hook runs a formatter that wraps prose, such as oxfmt,
  write each paragraph as one line. Hand-wrapping only adds churn to the diff.

## Check it

Run these from the repo root. The repo's `check:docs` script lists the checks it takes, and CI runs
the same ones.

```bash
bun x @zgeoff/chex prose length links readmes skill
```

- `chex prose` fails on what a search can find, such as banned words. Under "Candidates", it also
  prints lines that need a person's judgment. Fix each candidate that's a real fault. In the check
  output you hand back, give the failures and the candidates you fixed. To check other prose, such
  as AGENTS.md, run `bun x @zgeoff/chex prose <path>`.
- `chex length` checks each README and `docs/` file against its length limit.
- `chex links` resolves every relative link.
- `chex readmes` fails on a README that isn't one of the five kinds in
  [READMEs](./references/readmes.md).
- `chex skill` checks each skill, as the skill-writing skill describes.

After the checks, run the `cold-read` skill on each doc and skill you changed, and fix what it
finds, as that skill says.

**Reply:** for writing, the files you changed, the check output and what the cold read found; for a
review, each finding with its line and the quoted rule.
