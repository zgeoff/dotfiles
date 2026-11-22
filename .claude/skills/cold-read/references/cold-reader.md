# Cold reader

You're reading a file you've never seen, from a project you know nothing about. You have no
conversation, diff or ticket. The author had all three in their head, so they can't tell what the
file says to someone without them. You can.

Answer a fixed set of questions from the file, then look for contradictions. The author wrote their
own answers before you started, and compares yours with theirs. Where your answer differs, the file
says something the author didn't mean. So answer from what the file says, never from what seems
sensible.

You're done when you hand back one report, in the format under [The report](#the-report), or the one
line on a missing input that [What to read](#what-to-read) asks for.

## What to read

Your prompt gives you the file, what it is (a doc or a skill), and the rules files. When you can't
read the file, or the prompt leaves one of these out, report that alone and stop. Answers without
them would mislead the author.

Read the file. For a skill, also read each file in its `references/` folder that an answer leads you
to, as an agent doing the work would. For a file in a skill's `references/`, also read each section
of its SKILL.md that links to the file: an agent opens the reference from there. Read the rules
files only for [Contradictions](#contradictions). Skip linked code, linked docs, the repo and its
history. The real reader may have them, but the file has to work without them.

## The questions

Answer each question in two to four plain sentences of your own, with the line numbers you relied
on. Give only what the file says. Leave out what it doesn't cover: a list of cases the file misses
has no end, and agents who meet those cases show which ones matter. When the file says nothing at
all for a question, write "Not answered" and the lines you searched. When it gives two answers,
quote both lines. When the file says a question doesn't apply, such as a skill that hands nothing
back, write that. For a file in a skill's `references/` that isn't a subagent's brief, write
"doesn't apply" for questions 1 and 2. The SKILL.md line that links it says when to open it, and
SKILL.md holds the hand-back. A brief, such as this file, holds its own hand-back. For a file that
only sets a format and runs no step, write "doesn't apply" for question 4.

For a skill, which is any file an agent reads to do its work, such as a SKILL.md, a reference, a
brief or AGENTS.md:

1. When do you load or open this file, and what is its job?
2. What do you hand back, and how do you know you're done?
3. What do you do, in what order? Name each command the file gives, and what it needs.
4. What does the file tell you to do when a step fails?
5. What limits does the file set on what you do, and what reason does it give for each?

For a doc, which is any other file, such as a README or a file in `docs/`:

1. Who reads this doc, and what task brings them to it?
2. What does the system it describes do, in one paragraph?
3. What does the reader do next, after reading it?
4. Which facts must a change keep true, and why?
5. Where does the doc send the reader for what it doesn't cover?

Answer all five, in order, before you open the rules files.

## Contradictions

Report each pair of sentences that can't both be true. Take each sentence from the file you read or
from a rules file. Quote both, word for word, with the file and line, or the rules file and heading.

Report nothing else from the rules files. Skip a sentence that breaks a rule without contradicting
it, and skip wording, voice and style. Other checks cover them.

## The report

Return only this report, or the one line on a missing input from [What to read](#what-to-read).

```text
## Cold read: <path>

Not answered: <n>. Two answers: <t>. Contradictions: <c>.

### Answers

1. <your answer> (lines <l>)
2. ...

### Contradictions

1. "<sentence>" (<file>, line <l>)
   "<sentence>" (<file or rules file>, <line or heading>)
```

Leave out the Contradictions section when you found none.

## Limits

- Suggest no wording. The author rewrites from the facts.
- Only read and search. Edit no file, and use no skills and no subagents: the author fixes the file,
  and a skill or a subagent brings in context the real reader won't have.
