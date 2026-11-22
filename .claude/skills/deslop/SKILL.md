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
  you copy a writer's voice, you copy their faults too.
- **Reread each rewrite on its own.** A tidy rewrite can read worse than the line it replaced. When
  it does, put the old line back.

You're done when every line of the text, or of the sections your caller named, has had one pass,
you've reread each rewrite, and the prose check passes, or you skipped it as
[Check each rewrite](#check-each-rewrite) allows. Write your edits into the file, then hand back the
changes as [Show the changes](#show-the-changes) says. For text outside a file, such as a PR
description, hand back the changes and leave the source alone.

When the text is yours, hand it to a fresh subagent, as [Text you wrote](#text-you-wrote) says.

## Key rules

- [Text you wrote](#text-you-wrote): a fresh subagent deslops it, and you check its changes.
- [What to fix](#what-to-fix): in every file, make the reader the subject, use plain names, turn
  lead-ins and described processes into instructions, fix a "so" that doesn't follow, and do the
  cleanup.
- [Leave these alone](#leave-these-alone): formats, commands, the form of the frontmatter, and lines
  that already work.
- [Change the structure](#change-the-structure): rebuild a section that still reads oddly after two
  rewrites.
- [Check each rewrite](#check-each-rewrite): read it on its own, and run the prose check.
- [Show the changes](#show-the-changes): a count to a person; a `diff` block per change to an agent.
- [After a cold read](#after-a-cold-read): deslop again each section you redrafted.

## References

- [Agent hand-back](./references/agent-hand-back.md): handing your changes back to an agent.

## Text you wrote

Text you just wrote reads as plain to you, so you miss its faults. Deslop it with a fresh
`general-purpose` subagent, never a fork: a fork inherits your context. Give it this prompt and
nothing else. `<skill_dir>` is the absolute path of the folder this SKILL.md is in.

```text
Read <skill_dir>/SKILL.md and follow it as your instructions.
The text: <absolute path>
It is a: <skill | doc>
Deslop these sections: <each heading you wrote or changed>
```

Read each change it hands back. Revert any that changes a fact, breaks a format, cuts a rule's
reason, or renames a term a check or script depends on. Then run the prose check.

## What to fix

The rules behind these faults live in the [skill-writing](../skill-writing/SKILL.md) skill, under
"Write it plainly". Fix every fault below in one pass, line by line, in every kind of text: a skill,
a doc, AGENTS.md, a PR description, an issue, a commit message or a code comment.

Items 1 to 5 leave the reader unsure what a sentence means, so never leave one of them in place.
Items 6 to 10 are cleanup.

1. **Make a person or the reader the subject.** A thing that acts like a person hides who does the
   work. So does a sentence that states a rule as what "a [noun]" does, such as "a new bed fails
   when…". Start each such sentence with what the reader does. Watch for quiet verbs as well as loud
   ones: a file, a list or a doc that "says", "lists", "names", "tells" or "asks" acts like a person
   too. Keep a definition of a term the reader already uses, and a fact about a named tool.

   ```diff
   - The seed packet decides how deep each seed goes.
   + Sow each seed at the depth on its packet.
   ```

   ```diff
   - The planting plan lists which beds get water.
   + Water only the beds in the planting plan.
   ```

2. **Replace a made-up label with the plain name.** When the writer coined a name for a thing that
   developers already call something else, say the plain thing, and cut the sentence that defines
   the label. Search the repo for the label first. When another file uses the label, rename it there
   too and list that file in your hand-back, unless you are editing text outside a file.

   ```diff
   - Check the wilt score each week.
   + Each week, count the plants that wilted.
   ```

3. **Turn a lead-in and a colon into a sentence.** Write the verb that a lead-in, such as
   "Watering:" or "Exception:", leaves the reader to guess. In a skill, keep the labelled lines that
   skill-writing asks for, such as the Key rules lines.

   ```diff
   - - Watering: early morning, at the roots.
   + - Water early in the morning, at the roots.
   ```

4. **Turn a described process into the instruction.**

   ```diff
   - A second gardener walks the bed and notes each plant that gets too little sun.
   + Ask a second gardener to walk the bed and note each plant that gets too little sun.
   ```

5. **Fix a "so" or a "because" that doesn't follow.** Read the two halves on their own. When the
   first half doesn't lead to the second, say the fact the writer meant, and drop the link word.

   ```diff
   - The hose reaches only the beds by the shed, so a seed in one of them comes up.
   + Only the beds by the shed get water from the hose.
   ```

6. **Lead with the job or the reader's situation.** Cut a stock opener, such as "This skill…", "Use
   this file when…" or "Your job is to…".

   ```diff
   - This skill helps you plan a vegetable bed before planting.
   + Plan the vegetable bed before planting.
   ```

7. **Cut contrast frames: "X, not Y" and "X rather than Y".** Say what to do. When a reader without
   the "not" would pick the wrong thing, keep the frame, such as "Run it from the repo root, not the
   package folder".

   ```diff
   - Sow after the last frost, not before it.
   + Sow after the last frost.
   ```

8. **Cut drama words,** such as "critical", "worthless" and "has failed".

   ```diff
   - Labelling each row is critical, and a bed without labels has failed.
   + Label each row.
   ```

9. **Cut counted lists and aphorisms.** Name the items, or keep only the instruction. Keep a short
   line that sums up the rule beside it, as docs-writing allows: it isn't an aphorism.

   ```diff
   - A bed goes wrong in three ways: too much sun, too little water and slugs.
   + A bed goes wrong with too much sun, too little water or slugs.
   ```

10. **Keep blunt lines blunt.** Don't explain them, qualify them or make them more formal. Cut a
    sentence that explains the line before it, such as a closing "and that's the point". Keep a
    rule's reason: the reader needs it for a case the rule didn't foresee. Keep a sentence that
    states a separate fact, even when a reader could work it out.

    ```diff
    - Tomatoes hate frost. This means that they should not be planted out early in the season.
    + Tomatoes hate frost.
    ```

Leave a reason in the same sentence as its rule, joined by "because" or "so", when it follows. Split
it off only when the sentence is too long to read in one go.

## Leave these alone

- The shape of numbered steps, templates, tables and report formats. An agent copies a format into
  its own output exactly. You may still edit the wording of a sentence inside a step.
- Commands and code blocks.
- The form of the frontmatter. The skill-writing skill sets it. Fix a prose-check failure in its
  wording.
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

Then run the prose check from the repo root, and fix each failure. Outside a repo, or when chex
can't run, skip the check and say so. For text outside a file, write it to a file in your scratch
folder first:

```bash
bun x @zgeoff/chex prose <file>
```

Apart from its failures, it prints candidates: possible faults that a search can find. Judge each
one, and fix the mistakes.

## Show the changes

To a person, give the number of edits and the kinds of fault, in a line or two, and show the changes
only when asked. For text outside a file, also give the edited text. To an agent, show each change
as [Agent hand-back](./references/agent-hand-back.md) says.

## After a cold read

When you fix what a cold read found, you add precision, and you tend to write long sentences and
sentences that explain the line before them. After you redraft a section for a cold read, deslop
that section again.

**Reply:** to a person, the number of edits and the kinds of fault, plus the edited text for text
outside a file; to an agent, the changes as [Agent hand-back](./references/agent-hand-back.md) says.
