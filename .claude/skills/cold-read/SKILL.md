---
name: cold-read
description:
  "Runs a cold read of a doc or a skill. A fresh subagent gets the writing rules and none of your
  conversation, and reports each place it got stuck, with the rule that applies quoted word for
  word. For a skill, it also reports each point where an agent doing a real task would have to
  guess. Use for /cold-read <path>, 'cold read this', and before you hand over any doc or skill you
  wrote."
---

# Cold read

You wrote the file with the conversation, the ticket and the diff in your head, so every sentence
makes sense to you. The real reader has none of that. Hand the file to a fresh subagent, the cold
reader, and let it tell you where it got stuck.

Tell it nothing about what the file is for. If you do, it reads the file the way you do, with your
context filling the gaps.

When it reports, redraft each section you fix, never just the sentences it quoted. When you fixed
anything, run one more cold read, and stop.

Hand back:

- each finding of the second read that you left unfixed, and each section you restructured, or
  "clean" when there are none or you fixed nothing after the first read;
- each finding you declined, with the reason;
- each gap in the rules;
- each check you skipped, such as the scripted checks outside a repo;
- when the user asked to see the findings: the table, and your question about the calls.

## Key rules

- [Run it](#run-it): one fresh subagent per file, never a fork, told nothing about the change.
- [Act on it](#act-on-it): a call on every finding, and a redraft of each section with a fix or a
  gap.
- [Read it again](#read-it-again): one more cold read when you fixed anything, then stop.
- [Show the user, when asked](#show-the-user-when-asked): the findings as a table with your call on
  each.

## References

- [Cold reader](./references/cold-reader.md): the cold reader's instructions. Point the subagent at
  cold-reader.md itself. If you paraphrase it, you drop rules the cold reader needs.

## Run it

1. From the repo root, run the scripted checks:

   ```bash
   bun x @zgeoff/chex prose length links readmes skill
   ```

   Fix each failure in a file you changed, and each candidate that `chex prose` lists under
   "Candidates" that you judge a real fault. The cold reader skips what the scripts check, so
   anything they would catch stays in the file. Outside a repo, skip this step, and say so in your
   reply.

2. Collect the rules files, and pass all of them, for a doc as well as a skill:
   - [docs-writing](../docs-writing/SKILL.md);
   - [skill-writing](../skill-writing/SKILL.md);
   - the repo's project-docs-writing skill, when it has one.

   Take each from the repo you work in: under `.agents/skills/`, or under `skills/` in the repo that
   publishes these skills. The file you check may be the one that changes the rules, so an installed
   copy can be out of date.

   Outside a repo, take each from where your agent loads skills, such as `~/.claude/skills/`.

3. Decide what the file is. Anything an agent reads to do its work, such as a skill, a reference, a
   playbook, a brief or AGENTS.md, is a skill. Anything else is a doc.
4. Spawn one `general-purpose` subagent for each file: the path that `/cold-read <path>` names, or,
   before you hand over work, each file you wrote or changed. Run them in parallel when there are
   several. A skill's SKILL.md and each of its references are separate files. Never use a fork: a
   fork inherits your conversation, and the cold reader must not have it.
5. Give each subagent this prompt and nothing else. `<skill_dir>` is the absolute path of the folder
   this SKILL.md is in.

   ```text
   Read <skill_dir>/references/cold-reader.md and follow it as your instructions.
   The file: <absolute path>
   It is a: <doc | skill>
   The rules: <absolute path to each rules file, one per line>
   ```

   Leave out what the file is for, what changed, and what you're worried about. The real reader
   won't know any of it.

## Act on it

Unless the user asked to see the findings, act on them. A bare `/cold-read <path>` means act.

For a skill, the cold reader answers three questions about the top of the file: does it give the
job, the mistakes to avoid, and what to hand back? If any answer is "no", fix the opening first. An
agent decides what to do from the top.

Then make a call on every item in the report, whether the cold reader got stuck, guessed, or found a
rule break:

- **Fix it** when the cold reader hit a real problem.
- **Decline it** when the only fix is to copy code into the file, or when the cold reader misread
  the file or a rule. Note the reason in a few words, for your reply.
- **Report a gap** when the cold reader got stuck and no rule covers it. Redraft its section too.
  Tell the user that the rules may need a new rule. Never add the rule yourself, even in the repo
  that holds the rules files: the user decides each rule.

Redraft every section with a fix or a gap. Start from what the section needs to say, and write it
fresh. If you start from the sentences the cold reader quoted, you keep the shape that got it stuck.
Then run the [deslop](../deslop/SKILL.md) skill on each section you redrafted.

## Read it again

If you fixed nothing after the first read, stop. Otherwise give each file you changed one more cold
read, of the whole file, with a fresh subagent, even when your fix changed one sentence. Act on its
findings the same way. Then stop. No third read, whatever the second read finds.

When the second read gets stuck in a section you redrafted, restructure that section: empty it,
write it again in a new order, and hand it back as restructured. Fix a guess or a rule break there
as you would any other.

## Show the user, when asked

When the user asks to see the findings, show them before you act, one row per finding, worst first:

| #   | Line | What the cold reader hit                                    | Rule                      | My call                             |
| --- | ---- | ----------------------------------------------------------- | ------------------------- | ----------------------------------- |
| 1   | 42   | Couldn't tell which "the limit" meant                       | docs-writing, House rules | Fix: name the rate limit            |
| 2   | 77   | Guessed whether to run the check before or after the commit | (none)                    | Gap: no rule on the order of checks |

- **Rule** is the rules file and the section heading, or "(none)" when no rule applies.
- **My call** is fix, decline or gap, with a reason for a decline.
- For a skill, put the cold reader's task and its three answers above the table.

Then ask which calls to change. Act on the answer, then go on to [Read it again](#read-it-again).

**Reply:**

- each finding of the second read that you left unfixed, and each section you restructured, or
  "clean" when there are none or you fixed nothing after the first read;
- each finding you declined, with the reason;
- each gap in the rules;
- each check you skipped, such as the scripted checks outside a repo;
- when the user asked to see the findings: the table, and your question about the calls.
