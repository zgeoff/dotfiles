---
name: skill-writing
description:
  "Writes or reviews an agent skill: what goes in it, the voice it's written in, how it points at
  code instead of copying it, and how to keep it short and true. Load it before you write, edit, or
  review a SKILL.md or a skill's references, and before you answer a review finding on one."
---

# Writing skills

Write a skill as a briefing for an agent in the middle of a task. The agent has the code open and
none of your context. It does what you write, copies your examples, and fills every gap with a
guess.

So give it what the code can't:

- when to reach for the skill;
- which commands to run, and what each needs;
- the mistakes that cost an hour;
- the reasons behind rules that look arbitrary.

Don't copy the code into the skill: the copy goes stale without the agent knowing. Keep the skill
short, or the agent skims.

When you write or edit one, hand back the skill's path, the PR link and the proof from
[Check it](#check-it). With no PR, put the proof from step 4 in your reply. When you review one,
hand back each finding with its line and the rule it breaks, quoted.

## Key rules

- [Write it plainly](#write-it-plainly): "you", short blunt lines, the reason beside the rule, no
  rhetoric.
- [Open with the job and the key rules](#open-with-the-job-and-the-key-rules): the same opening in
  every skill but a rule set.
- [What goes in](#what-goes-in): the parts of each kind of skill, a description that says when to
  load it, and invented examples.
- [Point at the code, don't copy it](#point-at-the-code-dont-copy-it): link the file and say what
  the code can't.
- [Keep it short and true](#keep-it-short-and-true): under the word limit, with rules and no
  incidents.
- [Check it](#check-it): the `@zgeoff/chex` checks, deslop and a cold read, with the proof in the
  PR.

## References

- [Kinds of skill](./references/skill-kinds.md): writing a new skill, a rule set or a project skill,
  or adding a command, a mistake to avoid, a step or a reply line to any skill.
- [Writing a reference](./references/writing-references.md): writing or editing a file in a skill's
  `references/`, a subagent's brief included.

## Write it plainly

The agent copies how you write as well as what you say.

- **Say "you", and say what to do.** An agent fed a list of don'ts writes a list of don'ts.
- **Put the reason next to any rule that needs one.** Then the agent can handle a case you didn't
  foresee. "MUST" and "CRITICAL" give it no reason to work from, and agents over-apply them.
- **Make a person or the agent the subject.** "Add a mistake only if…", never "a mistake earns its
  place". A thing as the actor hides who does the work.
- **Keep short lines short.** "Slow, but right." Don't pad a blunt line with an explanation, a
  qualifier or tidier grammar. The padding reads as machine-written.
- **Cut the rhetoric.** No "X is not the job. The job is Y", no aphorisms, no drama words
  ("worthless", "critical"), no point made three ways. Say the instruction and its reason once.
- **Put a list the agent acts on in bullets.** A list inside a sentence is hard to scan.

When a section still reads oddly after two rewrites, change its structure. Rebuild it in a new
order, and say the plain instruction.

The prose rules in [docs-writing](../docs-writing/SKILL.md) apply too. Where they disagree about a
skill, this skill wins.

## Open with the job and the key rules

Every skill but a rule set opens the same way, because the agent decides what to do from the top of
a skill:

1. A paragraph or two: the job, what the agent hands back, if anything, and the main mistakes to
   avoid. Write them for this skill, with no stock opener, and name the mistakes without counting
   them. When a skill hands something back, repeat it in a `**Reply:**` line at the end.
2. `## Key rules`: one line per `##` section, with a link and the rule in a phrase. Leave
   `## Key rules`, `## References` and each `###` out of the list.
3. `## References`, when the skill has any: one line per file in `references/`, with the task that
   needs it.

Keep a rule's detail in its section. When you change the rule, change its key rules line.

Shape a rule set as [A rule set](./references/skill-kinds.md#a-rule-set) says.

## What goes in

For the parts each kind of skill needs, read [Kinds of skill](./references/skill-kinds.md).

Write the `description` in the third person: the agent reads it as a label, not an order. The
description is all the agent sees when it picks a skill, so say what the skill does and when to load
it, in the words a task would use. `chex skill` fails when the `name` differs from the skill's
folder name.

When several repos may use a skill, invent every example, and never use a term only one repo or team
knows. A reader in another repo can't open a file the example names, or doesn't know the word.

## Point at the code, don't copy it

When you mention a file, a function or a setting, link the file, in a sentence that says what the
code doesn't: a mistake to avoid, a reason or a choice. When someone renames the file, `chex links`
fails. Write an invented path as its file and folder apart, such as `nextest.toml` in `.config/`, or
with a placeholder, such as `<name>`: `chex skill` warns on a bare path that matches a repo file.

- **Replace a list of files, functions or options,** with the rule that defines the list and the
  search that finds it: "each stand-in is a `build-stub-*` file in `test-utils/`; search there
  before you write one". A table of commands is fine: each row says what its command needs.
- **Replace a retelling,** such as "the script builds, tags, pushes, then rolls out", with the fact
  the agent acts on, such as "a failed push leaves the old version serving", and link the script.
- **Quote only when the exact words are the point.** A copied error message teaches the old text
  once the code changes. Otherwise invent the example.
- **Never link a line anchor.** `chex skill` fails on one, because `#L42` points at the wrong line
  after the next edit. Name what to look for in the file.

When a review asks for one of these copies, decline it and name this section.

## Keep it short and true

Keep SKILL.md under the word limit `chex skill` sets, a rule set included: it warns at 1,500 words
and fails at 1,700. After a compaction, Claude Code restores only the first 5,000 tokens of each
loaded skill. When a skill grows, cut first, then move what only some tasks need into a reference.
In a rule set, keep every rule the common task needs in SKILL.md, and move only the rest.

Write the rule. The incident, the issue ID and the date go in the PR.

When a script or a lint checks a rule, delete the prose and say which check runs. In a rule set,
keep a short bullet for the rule too, as [A rule set](./references/skill-kinds.md#a-rule-set) says.

When an agent gets something wrong, fix the rule that covers the mistake. A near-copy of the rule
leaves the agent unsure which one to follow. Call each thing by one name: the agent reads a second
word as a second thing.

Leave out anything time-bound, like "until the next release": it goes false unnoticed.

## Check it

1. From the repo root, run the checks from
   [`@zgeoff/chex`](https://github.com/zgeoff/tools/tree/main/packages/chex):

   ```bash
   bun x @zgeoff/chex prose links skill
   ```

   While you draft, check one skill with `bun x @zgeoff/chex skill <folder>`, the folder of its
   SKILL.md: `.claude/skills/<skill>`, or `skills/<skill>` in the repo that publishes the skills.
   When a check flags a sentence you like, rewrite it so the check passes, and tell the user or your
   caller which sentence and which check: the check may be wrong.

2. Run the `deslop` skill on each section you wrote or changed.
3. Run the `cold-read` skill on each file of the skill you wrote or changed. After you fix what it
   finds, give each changed file one more cold read, and stop.
4. Run the checks again, and give the proof in a `## Checks` section of the PR description:
   - `- [x] chex prose, links and skill: cleared`, once the last run clears.
   - `- [x] Cold read: <fixed> fixed, <declined> declined`, counting every cold read.
   - `- [x] Deslop: <edits> edits`.

   Under `Declined:`, give one line to each finding you declined and each gap in the rules, where a
   cold reader got stuck and no rule applies. With neither, write `Declined: none.` Each line holds:
   - the check or review that found it;
   - the finding or the gap;
   - why not, or the issue it went to.

   Paste no command output, fixed finding or diff: CI and the commits hold them.

**Reply:** for a skill you wrote or edited, its path, its proof and the PR link; for a review, each
finding with its line and the quoted rule.
