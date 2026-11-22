---
name: cold-read
description:
  "Runs a cold read of a doc or a skill. You write your answers to a fixed set of questions, a fresh
  subagent with none of your conversation answers the same questions from the file alone, and each
  answer that differs from yours is a place the file doesn't say what you meant. It also reports
  sentences that contradict each other or the writing rules. Use for /cold-read <path>, 'cold read
  this', and before you hand over any doc or skill you wrote."
---

# Cold read

You read a file with your own context in your head: the conversation, the ticket and the diff when
you wrote it, the repo when you didn't. So you can't tell what it says to someone without them.
Write down what the file should tell a reader, hand the file to a fresh subagent, the cold reader,
and compare its answers with yours. Fix each place they differ, then deslop what you changed.

Every read asks the same questions, so a second read checks your fixes and finds little new. A read
is clean when every answer matches yours and the cold reader finds no contradiction. Stop at a clean
read, until a later commit changes what one of your answers says.

Hand back:

- "clean", or each answer that still differs after the last read;
- each rule you added to close a gap;
- each question for the user;
- each check you skipped, such as the scripted checks outside a repo.

## Key rules

- [Run it](#run-it): your answers first, then one fresh subagent per file, told nothing about the
  change.
- [Act on it](#act-on-it): turn each finding into a change in the repo: a fix to the file or the
  rules file, or a rule that closes a gap.
- [Read it again](#read-it-again): at most 3 reads of a file in a pull request, stopping at a clean
  read, then deslop what you changed.

## References

- [Cold reader](./references/cold-reader.md): the cold reader's instructions and its questions.
  Point the subagent at cold-reader.md itself. If you paraphrase it, you drop rules it needs.

## Run it

1. From the repo root, run the scripted checks, and fix each failure in a file you changed:

   ```bash
   bun x @zgeoff/chex prose length links readmes skill
   ```

   Name a failure in any other file in your reply. Outside a repo, skip this step, and say so.

2. Collect the rules files: [docs-writing](../docs-writing/SKILL.md),
   [skill-writing](../skill-writing/SKILL.md), and the repo's project-docs-writing skill when it has
   one. Take each from the repo you work in, under `.agents/skills/`, or under `skills/` in the repo
   that publishes these skills. The file you check may be the one that changes the rules. Outside a
   repo, take each from where your agent loads skills, such as `~/.claude/skills/`.
3. Decide what the file is. Anything an agent reads to do its work, such as a skill, a reference, a
   brief or AGENTS.md, is a skill. Anything else is a doc.
4. Write your own answer to each question in
   [The questions](./references/cold-reader.md#the-questions) for that kind of file, in a scratch
   file, before you spawn anything. Answer with what the file is meant to tell a reader. When you
   didn't write the file, take that from the file, the skills or docs that point at it, and the
   repo. Write "doesn't apply" for a question this kind of file has no need to answer, such as
   commands in a skill that runs none, or a next step in an architecture doc. When the rules have a
   reference for the file's kind, such as READMEs, a question that reference doesn't ask for doesn't
   apply. When a question applies and you can't answer it, note it as a gap in the file or in the
   rules.
5. Spawn one `general-purpose` subagent for each file you check, in parallel. A skill's SKILL.md and
   each of its references are separate files. Never use a fork: a fork inherits your conversation.
6. Give each subagent this prompt and nothing else. `<skill_dir>` is the absolute path of the folder
   this SKILL.md is in.

   ```text
   Read <skill_dir>/references/cold-reader.md and follow it as your instructions.
   The file: <absolute path>
   It is a: <doc | skill>
   The rules: <absolute path to each rules file, one per line>
   ```

   Leave out what the file is for and what changed. The real reader won't know either. When a
   subagent ends without its report, ask it once for the report. A read with no report doesn't
   count.

## Act on it

Compare each of the cold reader's answers with yours. Count an answer as matching when it gives the
same facts, in any words. Where your answer is "doesn't apply", "Not answered" matches it, and so
does an answer that says the file covers no such thing.

Turn every finding into a change to text in the repo. Another session never sees a call you made
only in your head. Its cold reader raises the same finding again.

- **Fix the file** when the answer differs, says "Not answered", or quotes two answers, and when the
  file contradicts itself or breaks a rule that is right for it. Fix it too when the cold reader
  misread a sentence: a fresh reader misread it, so the next one can. When the answer lives in code,
  say which file holds it and link that file, without copying the code.
- **Fix the rules file** when the file contradicts a rule and both are right for their own case.
  Write the exception into the rule, so no later reader raises it.
- **Close a gap** when you couldn't write your own answer, or a fix needs a rule no rules file has.
  Write the answer most repos would expect as a rule, in the file or in the rules file, and list it
  in your reply.
- **Ask the user** only when the gap needs a call on taste, priority or cost, or would reverse a
  rule that exists. Write your answer as the rule anyway, and ask the user whether to keep it. Don't
  ask about a reason you wrote for a rule, or a guess at what the author meant. The user reads the
  rules you added in your reply.

Redraft each section a fix lands in. Start from what the section needs to say, and write it fresh.
If you start from the sentences the cold reader quoted, you keep the shape that misled it.

Leave the rest of the file alone. A sentence that led to no differing answer and contradicts nothing
isn't a finding.

## Read it again

Give each file at most 3 reads in one pull request, or in one task when there's no pull request.

1. When a read is clean, go to step 4.
2. Otherwise read the file again, whole, with a fresh subagent and the same prompt. Keep your
   answers, unless you changed what the file is meant to say.
3. Act on each read the same way. After the third read, go to step 4, and hand back each answer that
   still differs.
4. Run the [deslop](../deslop/SKILL.md) skill on each section you changed, then the scripted checks
   from [Run it](#run-it).

When a later commit in the same pull request changes a file you read, run deslop on what it changed.
When the change alters what one of your answers says, and the file has reads left, read it again.

**Reply:** "clean", or each answer that still differs; each rule you added to close a gap; each
question for the user; each check you skipped.
