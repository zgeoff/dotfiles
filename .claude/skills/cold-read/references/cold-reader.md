# Cold reader

Contents: [what to read](#what-to-read) · [who you're reading for](#who-youre-reading-for) ·
[reading a doc](#reading-a-doc) · [reading a skill](#reading-a-skill) ·
[quoting the rules](#quoting-the-rules) · [the report](#the-report) · [limits](#limits)

You're reading a file you've never seen, from a project you know nothing about. You have no
conversation, diff or ticket. The author had the conversation, the diff and the ticket in their
head, so they can't see where the file leans on them. You can.

Find the places a reader gets stuck: you read a sentence twice, read it wrong, can't tell what a
word refers to, or think "nobody writes like this".

The main mistakes to avoid:

- Opening the rules before you've read the file. Read it as its reader would, first.
- Making up a rule, or stretching one to fit. Quote each rule word for word, or report the place as
  stuck with no rule.
- Suggesting new wording. Report the problem, and leave the rewrite to the author.

You're done when you hand back one report, in the format under [The report](#the-report).

## What to read

Your prompt gives you:

- the file;
- what it is: a doc or a skill;
- the rules files.

Read the file and the rules files. For a skill, also read the files in its `references/` folder that
your task leads to. Skip everything else:

- linked code and linked docs;
- the repo and its git history.

The real reader may have those, but the file has to work without them. A sentence that only makes
sense after you read the code is a place you got stuck.

A term counts as defined when the file links or defines it where the term first appears. Otherwise
it's a place you got stuck.

The author has run the docs-writing scripts, which check banned words, broken links, untagged code
blocks and frontmatter limits. Don't report those. Report one only when it also got you stuck. Skip
the inside of fenced code blocks too. Report a block only when you couldn't tell what it was for.

Some rules govern how the author works, such as redrafting a section instead of patching a sentence.
You can't see that in the text, so leave those rules out.

## Who you're reading for

- **A doc** is read by a person who wasn't there: an engineer months from now, with the repo but not
  the history.
- **A skill** is read by an agent in the middle of a task. It has the code open, does what the skill
  says, copies its examples, and takes the shortest path that works. When the text leaves it a
  choice, it guesses.

## Reading a doc

1. Read the file in full, one sentence at a time. Write down each place you get stuck, with its line
   number and a few words on what happened. Keep the rules closed.
2. Read the rules files in full. Each one opens with its key rules. Read those most closely.
3. For each place you got stuck, find the rule that applies. Quote it as
   [Quoting the rules](#quoting-the-rules) says.
4. Read the file again with the rules in mind. Note each sentence that breaks a rule but didn't slow
   you down. Report these as rule breaks, apart from the places you got stuck.

## Reading a skill

1. Read only the `description` in the frontmatter. With no frontmatter, read the first paragraph of
   prose. Make up one realistic task that would make an agent load this file, and write it down in a
   sentence.
2. Read the top of the file and stop. The top ends after `## Key rules` and `## References`. When
   the file has neither, it ends at the first `##`.
3. Answer three questions yes or no, with a line on why:
   - Do you know what the job is?
   - Do you know the mistakes to avoid?
   - Do you know what to hand back, and when you're done? Answer no if either part is missing.

   For a file in a skill's `references/` folder, skip the third question and write "skipped" in the
   report. Answer it when the file is a brief for a subagent, such as this one: a brief gives its
   own return format. For a rule set (`kind: rule-set` under `metadata`), skip the first and third
   questions: a rule set opens with its first rule, not a job.

4. Read the rest as if you're doing your task. Write down each place you get stuck, and each point
   where you'd have to guess what to do next. Write down a guess even when the sentence reads fine.
   List a sentence once, under the first that fits: stuck, then guess.
5. Do steps 2 to 4 of [Reading a doc](#reading-a-doc).

When the skill sends your task to a file in its `references/` folder, open that file, as a real
agent would. When you get stuck in it, write "<file> line <l>".

## Quoting the rules

Quote every rule word for word, so the author can find it and you can't make one up. Quote it from
its section, where it's in full. Name the rules file and the nearest heading above the rule. For a
rule above the first heading, name the file alone.

If you can't find a rule to quote for a rule break, drop it. If you got stuck and no rule applies,
keep it under "Stuck, no rule". The author uses these to find what the rules are missing.

## The report

Return only this report. Put the worst first: the places most likely to mislead a reader. Report at
most 15 places you got stuck and 5 with no rule. Give the totals in the count line, and add how many
of each you left out. Guesses and rule breaks have no cap. Leave out an empty section, and the skill
sections when the file is a doc.

```text
## Cold read: <path>

Stuck: <n>. Stuck, no rule: <u>. Guesses: <g>. Rule breaks: <m>. Left out: <stuck>, <no rule>.

### Task (skill only)

<your made-up task, in one sentence>

### Top of the file (skill only)

- The job: <yes or no>. <why>
- The mistakes to avoid: <yes or no>. <why>
- What to hand back: <yes, no or skipped>. <why>

### Stuck

1. **Line <l>.** "<the sentence, word for word>"
   What happened: <one or two plain sentences>
   Rule: <rules file>, <section heading>: "<the rule, word for word>"

### Guesses (skill only)

1. **Line <l>.** "<the sentence>"
   Guess: <what you had to decide, and what you'd have done>

### Stuck, no rule

1. **Line <l>.** "<the sentence>"
   What happened: <one or two plain sentences>

### Rule breaks

1. **Line <l>.** "<the sentence>"
   Rule: <rules file>, <section heading>: "<the rule, word for word>"

### Sections to redraft

<each section with a place you got stuck, a guess or a rule break, one per line, by heading>
```

## Limits

- Report the problem and leave the wording to the author. They rewrite from the facts. Hand them a
  sentence, and they tend to paste it in.
- Only read and search. Edit no file.
- Read the rules files directly, with no skills and no subagents.
- Report what you found. Don't go easy on a good file, and don't pad a short report.
