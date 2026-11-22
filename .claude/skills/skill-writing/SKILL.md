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
- the reasons behind rules that look arbitrary.

Keep the skill short, or the agent skims.

When you write or edit one, hand back the skill's path, the PR link, the proof from
[Check it](#check-it), each rule you added to close a gap and each question for the user. With no
PR, put the proof from step 4 in your reply. You're done when step 4 is done. When you review one,
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
- [When an agent gets it wrong](#when-an-agent-gets-it-wrong): remove the cause, or rewrite the
  step.
- [Check it](#check-it): the `@zgeoff/chex` checks, a cold read, then deslop, with the proof in the
  PR.

## References

- [Kinds of skill](./references/skill-kinds.md): writing a new skill or its `description`; writing a
  rule set or a project skill; adding a command, a step or a reply line to any skill.
- [Writing a reference](./references/writing-references.md): writing or editing a file in a skill's
  `references/`, a subagent's brief included.

## Write it plainly

The agent copies how you write as well as what you say.

- **Say "you", and say what to do.** An agent fed a list of don'ts writes a list of don'ts.
- **Put the reason next to any rule that needs one.** Then the agent can handle a case you didn't
  foresee. "MUST" and "CRITICAL" give it no reason to work from, and agents over-apply them.
- **Make a person or the agent the subject.** "Run the slow tests only if…", never "the slow tests
  earn their place". A thing as the actor hides who does the work.
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

Open every skill but a rule set the same way. The agent decides what to do from the top of a skill.

1. A paragraph or two: the job and what the agent hands back, if anything. Write them for this
   skill, with no stock opener. When a skill hands something back, repeat it in a `**Reply:**` line
   at the end.
2. `## Key rules`: one line per `##` section, with a link and the rule in a phrase. Leave
   `## Key rules`, `## References` and each `###` out of the list. Leave out `## Key rules` when the
   skill has no `##` section.
3. `## References`, when the skill has any: one line per file in `references/`, with the task that
   needs it.

Keep a rule's detail in its section. When you change the rule, change its key rules line.

Shape a rule set as [A rule set](./references/skill-kinds.md#a-rule-set) says.

## What goes in

For the parts each kind of skill needs, and the frontmatter, read
[Kinds of skill](./references/skill-kinds.md).

When several repos may use a skill, invent every example, and never use a term only one repo or team
knows. A reader in another repo can't open a file the example names, or doesn't know the word.

## Point at the code, don't copy it

When you mention a file, a function or a setting, link the file, in a sentence that says what the
code doesn't: a reason or a choice. When someone renames the file, `chex links` fails. Write an
invented path as its file and folder apart, such as `nextest.toml` in `.config/`, or with a
placeholder, such as `<name>`. `chex skill` warns on a bare path that matches a repo file.

- **Replace a list of files, functions or options,** with the rule that defines the list and the
  search that finds it: "each stand-in is a `*-stub-*` file in `test-utils/`; search there before
  you write one". A table of commands is fine: each row says what its command needs.
- **Replace a retelling,** such as "the script builds, tags, pushes, then rolls out", with the fact
  the agent acts on, such as "a failed push leaves the old version serving", and link the script.
- **Quote only when the exact words are the point.** Otherwise invent the example. A copied error
  message teaches the old text once the code changes.
- **Never link a line anchor.** `chex skill` fails on one. A `#L42` anchor points at the wrong line
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

Leave out anything time-bound, like "until the next release": it goes false unnoticed.

Call each thing by one name. The agent reads a second word as a second thing.

## When an agent gets it wrong

Remove the cause:

1. Change the code, a type, a lint rule or an error message so the wrong move fails, as
   [correct](../correct/SKILL.md) says.
2. When you can't change the cause, rewrite the step the agent followed so the right action is the
   instruction: "Pass `--region` to each deploy command. The CLI defaults to your last region."

Never write a list of mistakes or a warning about one. The agent still follows the wrong step. Edit
the rule that covers the mistake, or add one. In a doc that one agent writes for another, such as a
handoff doc, write each lesson as the instruction to follow, with its reason.

## Check it

1. From the repo root, run the checks from
   [`@zgeoff/chex`](https://github.com/zgeoff/tools/tree/main/packages/chex):

   ```bash
   bun x @zgeoff/chex prose links skill
   ```

   While you draft, check one skill with `bun x @zgeoff/chex skill <folder>`, the folder that holds
   its SKILL.md. When a check flags a sentence you like, rewrite it until the check passes, and name
   the sentence and the check to the user or your caller. Name each failure in a file you didn't
   change, and leave it: it belongs to another change. Outside a repo, or when chex can't run, skip
   the checks and say so.

2. Run the `cold-read` skill on each file of the skill you wrote or changed. It sets how many reads
   each file gets.
3. Run the `deslop` skill on each section you wrote or changed, the cold-read fixes included. A
   cold-read fix adds words, and the checks in step 4 don't catch padding.
4. Run the checks again, and commit. Build the PR description from the repo's
   `PULL_REQUEST_TEMPLATE.md` in `.github/`. Tick two lines in its `## Checks` section, both with
   the short hash of that commit:
   - `- [x] Deslop (<commit>)`
   - `- [x] Cold read (<commit>)`

   Leave `- [ ] chex` as it is: CI ticks it when the checks clear. When the repo has no template,
   add a `## Checks` section with those three lines yourself. When a later commit changes a skill, a
   README or a file under `docs/`, run step 3 on what it changed, and put that commit's hash on the
   Deslop line. The PR-body check fails a Deslop hash older than the last such commit. Move the Cold
   read hash only after you give the file another cold read.

**Reply:** for a skill you wrote or edited, its path, its proof, the PR link, each rule you added to
close a gap and each question for the user; for a review, each finding with its line and the quoted
rule.
