---
name: deslop
description:
  "Edits prose that already exists so it reads plainly. Its edits lead with the reader's situation,
  turn a described process into an instruction, cut contrast frames ('X, not Y'), drama and a
  sentence that explains the line before it, and keep blunt lines blunt. Load it to deslop a skill,
  a doc, a PR description or a comment, when text reads like AI wrote it, and after you fix what a
  cold read found."
---

# Deslop

Edit text that already exists, in place, until it reads like a person wrote it. Work through it line
by line, and change only these:

- each fault in [What to fix](#what-to-fix);
- each failure of the prose check, `bun x @zgeoff/chex prose <file>`, even one that What to fix
  leaves out;
- the structure of a section that still reads oddly after you rewrote it twice, as
  [Change the structure](#change-the-structure) says.

Leave everything else as it is, and add no new content.

- **Fix the faults in What to fix, even when someone asks you to write like a named writer.** When
  you copy a writer's voice, you copy their faults too. Name the fault each change fixes, such as a
  contrast frame.
- **Reread each rewrite on its own.** A tidy rewrite can read worse than the line it replaced.
- **Leave a blunt line blunt.** Leave a short, flat line as it is: it may already work.

You're done when every line has had one pass, you've reread each rewrite, and the prose check
passes. Write your edits into the file, then hand back each change as a `diff` block, and what you
left as it was. Whoever asked reads each change, and reverts the ones they reject. For text outside
a file, such as a PR description, hand back the changes and leave the source alone.

## Key rules

- [What to fix](#what-to-fix): lead with the job, give the instruction, open each bullet with what
  the reader does, use plain names, and cut contrast frames, drama and counted lists.
- [Leave these alone](#leave-these-alone): formats, commands, the frontmatter, and lines that
  already work.
- [Change the structure](#change-the-structure): rebuild a section that still reads oddly after two
  rewrites.
- [Check each rewrite](#check-each-rewrite): read it on its own, and run the prose check.
- [Show the changes](#show-the-changes): a heading and a reason per kind of fault, and a `diff`
  block per place.
- [After a cold read](#after-a-cold-read): deslop again each section you redrafted.

## What to fix

The rules behind these faults live in the [skill-writing](../skill-writing/SKILL.md) skill, under
"Write it plainly".

- In a skill or its references, a PR description, an issue, a commit message or a code comment, fix
  every fault below.
- In a README, AGENTS.md, CLAUDE.md or another doc, fix only the rhetoric, items 3, 5, 6 and 8, and
  each failure of the prose check. List each other fault you leave in your hand-back. The
  [docs-writing](../docs-writing/SKILL.md) skill's rules cover those.

1. **Lead with the job or the reader's situation.** Cut a stock opener, such as "This skill…", "Use
   this file when…" or "Your job is to…".

   ```diff
   - This skill helps you plan a vegetable bed before planting.
   + Plan the vegetable bed before planting.
   ```

2. **Turn a described process into the instruction.**

   ```diff
   - A second gardener walks the bed and notes each plant that gets too little sun.
   + Ask a second gardener to walk the bed and note each plant that gets too little sun.
   ```

3. **Cut contrast frames: "X, not Y" and "X rather than Y".** Say what to do. When a reader without
   the "not" would pick the wrong thing, keep the frame, such as "Run it from the repo root, not the
   package folder".

   ```diff
   - Sow after the last frost, not before it.
   + Sow after the last frost.
   ```

4. **Split the reason into its own short sentence.** When the order already gives the reason, drop
   "because".

   ```diff
   - Mulch the bed in spring, because bare soil dries out by June.
   + Mulch the bed in spring. Bare soil dries out by June.
   ```

5. **Cut drama words,** such as "critical", "worthless" and "has failed".

   ```diff
   - Labelling each row is critical, and a bed without labels has failed.
   + Label each row.
   ```

6. **Cut counted lists and aphorisms.** Name the items, or keep only the instruction.

   ```diff
   - A bed goes wrong in three ways: too much sun, too little water and slugs.
   + A bed goes wrong with too much sun, too little water or slugs.
   ```

   ```diff
   - A plan is only a guess until it rains. Check the bed after the first heavy rain.
   + Check the bed after the first heavy rain.
   ```

7. **Make a person or the reader the subject.** A thing that acts like a person hides who does the
   work. So does a sentence that states a rule as what "a [noun]" does, such as "a new bed" below.
   Start each such sentence with what the reader does. Keep a definition, and a fact about a named
   tool.

   ```diff
   - The seed packet decides how deep each seed goes.
   + Sow each seed at the depth on its packet.
   ```

   ```diff
   - A new bed fails when nobody spreads compost on it.
   + Spread a layer of compost on each new bed.
   ```

8. **Keep blunt lines blunt.** Don't explain them, qualify them or make them more formal. Cut a
   sentence that explains the line before it, such as a closing "and that's the point".

   ```diff
   - Tomatoes hate frost. This means that they should not be planted out early in the season.
   + Tomatoes hate frost.
   ```

9. **Replace a made-up label with the plain name.** When the writer coined a name for a thing that
   developers already call something else, say the plain thing, and cut the sentence that defines
   the label. Search the repo for the label first. When another file uses the label, rename it there
   too and list that file in your hand-back, unless you are editing text outside a file.

   ```diff
   - Check the wilt score each week.
   + Each week, count the plants that wilted.
   ```

   ```diff
   - A bed's keeper is the gardener who planted it. Ask the keeper before you prune.
   + Ask the gardener who planted the bed before you prune it.
   ```

10. **Turn a lead-in and a colon into a sentence.** Write the verb that a lead-in, such as
    "Watering:" or "Exception:", leaves the reader to guess.

    ```diff
    - - Watering: early morning, at the roots.
    + - Water early in the morning, at the roots.
    ```

## Leave these alone

- The shape of numbered steps, templates, tables and report formats. An agent copies a format into
  its own output exactly. You may still edit the wording of a sentence inside a step.
- Commands and code blocks.
- The frontmatter. The skill-writing skill sets its form.
- A term that a check or a script depends on, such as a heading a script greps for. Search the repo
  for a term before you rename it. Rename a made-up label that only other prose uses, as
  [What to fix](#what-to-fix) says.
- A line that already reads plainly.

## Change the structure

When a section still reads oddly after you rewrote it twice, change its structure. Rebuild it in a
new order, and say the plain instruction, as "Write it plainly" in the
[skill-writing](../skill-writing/SKILL.md) skill says.

## Check each rewrite

Read each rewrite on its own, as if you'd never seen the old line. Look for:

- a new "it" with two meanings;
- a list that grew inside a sentence;
- a sentence that got longer.

Then run the prose check from the repo root. The check must pass, so fix each failure, even one that
What to fix leaves out. For text outside a file, write it to a file in your scratch folder first:

```bash
bun x @zgeoff/chex prose <file>
```

Apart from its failures, it prints candidates: possible faults, such as the contrast frames, counted
lists and stock openers a search can find. The check can't tell a fair use from a mistake, so judge
each candidate, and fix the mistakes.

## Show the changes

Give each kind of fault you fixed one `###` heading, named in a few words, such as "Cut drama
words". Under it, write one line on why. Then give each place you changed its own `diff` block, with
`-` before and `+` after, so the lines show in colour. When the fault is outside What to fix, use
the heading "Prose check" or "Structure". Never show the whole file.

End with short bulleted lists, each with its reasons:

- each line the prose check flagged that you kept, and each fault you chose not to fix;
- each fault in a doc that you left for docs-writing;
- each other file that uses a label you renamed.

## After a cold read

When you fix what a cold read found, you add precision and drift back toward sentences that explain
the line before them, "because" clauses and long sentences. After you redraft a section for a cold
read, deslop that section again.

**Reply:** each change as a `diff` block, then what you left as it was, the faults left for
docs-writing, and the other files a renamed label touches.
