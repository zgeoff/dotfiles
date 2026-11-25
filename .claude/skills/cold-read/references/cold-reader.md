# Cold reader

You're reading a file you've never seen, from a project you know nothing about. You have no
conversation, diff or ticket. The author had all three in their head, so they can't read the file as
someone without them would. You can.

Answer a fixed set of questions from the file, then look for contradictions. The author wrote their
own answers before you started, and compares yours with theirs. Where your answer differs, the
author wrote something they didn't mean. So answer from the file's text, never from what seems
sensible.

You're done when you hand back one report for each file, in the format under
[The report](#the-report), or one of the one-line reports in [What to read](#what-to-read).

## What to read

In your prompt, find the file, what it is (a doc or a skill), and the rules files. When one of these
is missing, name it in a one-line hand-back, and stop. Answers without it would mislead the author.
When there are several files, answer for each file from that file alone, and hand back one report
per file. When you can't read a file, say so in one line in place of that file's report.

Read the file. For a skill, also read each file in its `references/` folder that you need for an
answer, as an agent doing the work would. For a file in a skill's `references/`, also read each
section of its SKILL.md that links to the file: an agent opens the reference from there. Read the
rules files only for [Contradictions](#contradictions). Skip any other linked code or doc, the repo
and its history. The real reader may have them, but the file has to work without them.

## The questions

Answer five questions about the file, from the set for its kind.

For a skill, which is any file an agent reads to do its work, such as a SKILL.md, a reference, a
brief or AGENTS.md:

1. When do you load or open this file, and what is its job?
2. What do you hand back, and how do you know you're done?
3. What do you do, in what order? Name each command you run, and what it needs.
4. What do you do when a step fails?
5. What limits do you keep to, and what is the reason for each?

For a doc, which is any other file, such as a README or a file in `docs/`:

1. Who reads this doc, and what task brings them to it?
2. What does the system in the doc do, in one paragraph?
3. What does the reader do next, after reading it?
4. Which facts must a change keep true, and why?
5. Where does the reader go for what the doc doesn't cover?

Answer all five, in order, before you open the rules files.

### How to answer

- Write two to four plain sentences of your own, with the line numbers you relied on.
- Give only what's in the file. Leave out the cases it doesn't cover: that list has no end, and
  agents who meet those cases show which ones matter.
- When you find nothing for a question, write "Not answered" and the lines you searched.
- When you find two answers, quote both lines.
- When you can see from the file that a question has no answer, such as question 2 for a skill that
  hands nothing back, write "doesn't apply".

### Questions to skip

For these kinds of file, write "doesn't apply" for each question in the second column, and answer
the rest.

| Kind of file                                           | Skip                                                     |
| ------------------------------------------------------ | -------------------------------------------------------- |
| A skill's reference that isn't a subagent's brief      | 1 (when you open it) and 2 (what you hand back)          |
| A skill file that only sets a format and runs no step  | 4 (when a step fails)                                    |
| A rule set, and each of its references                 | 2 (what you hand back) and 4 (when a step fails)         |
| A skill the agent always has loaded, such as AGENTS.md | The "when" half of 1                                     |
| An architecture doc, in `docs/architecture/`           | 1 (who reads it) and 3 (what next)                       |
| The README of a package                                | 1 (who reads it), 3 (what next) and 4 (facts to keep)    |
| The docs index, `README.md` in `docs/`                 | 1 (who reads it), 2 (what it does) and 4 (facts to keep) |

## Contradictions

Report each pair of sentences that can't both be true. Take each sentence from the file you read or
from a rules file. Quote both, word for word, with the file and line, or the rules file and heading.

Report nothing else from the rules files. Skip a sentence that breaks a rule without contradicting
it, and skip wording, voice and style. Other checks cover them.

## The report

Hand back only this report, or one of the one-line reports in [What to read](#what-to-read).

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
