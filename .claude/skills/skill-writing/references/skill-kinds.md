# Kinds of skill

Pick the kind before you write:

- When the skill covers one repo's tools, such as its migrations or its deploy scripts, and no
  shared rule set covers that topic, write [a machinery skill](#a-machinery-skill).
- When the skill teaches a way of working, such as finding out why code is the way it is, write
  [a method skill](#a-method-skill).
- When the skill holds rules the agent applies while it writes something else, such as a code style,
  write [a rule set](#a-rule-set).
- When the skill holds one repo's facts for a shared rule set, and the repo's own rules that replace
  shared ones, write [a project skill](#a-project-skill), such as project-testing beside testing.
  When a shared rule set covers the topic of a repo's tool, put the tool in the project skill, such
  as the repo's test harness in project-testing.

In a machinery skill or a method skill, write the opening that
[SKILL.md](../SKILL.md#open-with-the-job-and-the-key-rules) sets out, and add the parts below. Leave
that opening out of a rule set and out of a project skill.

When a skill has a reply line, make it the last line. It starts with "**Reply:**" and gives what the
agent hands back, such as "**Reply:** each risk with its proof".

In a skill of any kind, put a mechanical step, one with no judgment in it, in a script in the
skill's `scripts/` folder. Put the script's test beside it, such as `check.test.ts` beside
`check.sh`. Make sure the repo's test command runs that test. Tell the agent to run the script, not
read it.

## A machinery skill

Write a machinery skill in the repo it covers, at `.claude/skills/<name>/SKILL.md`. Say what it
covers in the opening paragraph. Then give each of these a `##` section:

- the commands, in a table when there's more than one, with a column for the command and a column
  for what it needs to run, such as a running database or an environment variable;
- the mistakes to avoid, each as a bullet that gives the fact and then what to do about it.

Add a mistake only if an agent with the source open would still lose time to it. A made-up example
of a mistake worth adding, in a skill at `.claude/skills/<name>/SKILL.md`:

```markdown
- **The theme cache outlives a test.** [`loadTheme`](../../../src/theme/load-theme.ts) memoises per
  process, so a test that changes a theme file calls `resetThemes()` first.
```

When the agent only runs commands, end the skill without a reply line. When the agent writes
something for a reader, such as a report, name the reader in the opening paragraph, next to what the
agent hands back. Then end the skill with a reply line.

## A method skill

Put these in the opening paragraph, beside the job:

- the attitude you want the agent to take to the work, such as "treat a comment as stale until the
  code agrees with it", and the mistakes the agent avoids when it holds that attitude;
- who reads the agent's output, and what they do with it.

After `## Key rules` and `## References`, write numbered steps, each with the decision the agent
makes in it, such as when to stop. End with a reply line.

When the user can also start the skill, such as with a slash command, write it for the agent. Put
how to word the answer for the user in its own section, such as "When the user asked the question".

## A rule set

Mark it with `kind: rule-set` under a `metadata` key in its frontmatter. Start it with the `#`
title. Then put `## References`, when it has any, and the rule sections, one `##` per topic. Leave
out the opening paragraph, `## Key rules` and the reply line: the agent reads a rule set for the
rule that fits what it is writing, and hands nothing back.

In its SKILL.md:

- Start each bullet with what the agent does, with a ban, or with the condition the rule applies
  under: "Name a value for what it holds", "No classes, except a custom error", "When a test changes
  process state, …".
- Never start a bullet with a label and a colon, such as "Exception:", or with "A", "The" or "Each"
  and a noun, such as "A factory builds…".
- Give an example when the agent would otherwise guess the shape, such as a file name or a call.
- Write a short paragraph and a code block for a rule that needs more than a bullet.
- Keep a short bullet for a rule a lint enforces, so the agent writes it right the first time.

## A project skill

Write a project skill in the repo it describes, at `.claude/skills/project-<name>/SKILL.md`, where
`<name>` is the shared rule set it sits beside, such as `project-testing` beside testing. The shared
skills and the project skills sit side by side in `.claude/skills/`. The agent loads both, and where
they disagree, the project skill wins. Read the shared skill before you write, so you know which
rules the repo replaces and which it follows.

Put the repo's own rules in the `project-` folder, and never edit a shared skill's folder. The next
update of the shared skills overwrites that folder. In the zgeoff repos,
[repo-sync](https://github.com/zgeoff/tools/blob/main/docs/architecture/repo-sync.md) makes that
update, and never touches a `project-` folder.

Write it as a rule set: `kind: rule-set` under `metadata`, the `#` title, `## References` when it
has any, and the bullet rules in [A rule set](#a-rule-set). Then write these sections, in this
order:

1. In project-ci-design and project-testing, write `## Facts`, a table with the columns Fact and
   Where. Give it the rows in [Facts rows](#facts-rows), in that order. Write "none" in the Where
   cell of a row that doesn't apply. Leave `## Facts` out of every other project skill, such as
   project-docs-writing.
2. Write `## Departures`, with one bullet for each shared rule the repo replaces. Open each bullet
   with what the repo does, link the shared rule's section, and give the reason. Write "None." when
   the repo follows every rule. In project-code-style only, write these two sections another way,
   because the [code-style](../../code-style/SKILL.md) skill allows a repo to add rules:
   - Put each stricter rule in a topic section from step 3, never under Departures.
   - List a departure only for code whose shape another tool sets, such as a plugin whose shape a
     host's API decides.
3. Then add one `##` section for each topic of the repo that the shared skill can't know, such as a
   test harness or a test helper.

Never repeat a rule the shared skill states. The agent reads both, and two copies drift apart.

### Facts rows

Say where each fact lives. Link the file that holds it with a path relative to the skill, such as
`../../../config/ci.json` from `.claude/skills/<project-skill>/SKILL.md`, and name the key that
holds the fact. Then the row stays true when the value changes, and
[`chex links`](https://github.com/zgeoff/tools/tree/main/packages/chex) fails when the file moves.

- When a command shows the fact and no file holds it, write the command in place of the link.
- When neither a file nor a command holds the fact, write the value itself, such as the
  [test budget](../../ci-design/SKILL.md#jobs).

Each row below names a project skill, a fact, and what goes in the Where cell of its `## Facts`
table. The shared skills define each fact: the test budget in [Jobs](../../ci-design/SKILL.md#jobs)
in ci-design, and the test commands in
[Where each test runs](../../testing/references/slow-tests.md#where-each-test-runs) in testing.

| Project skill     | Fact            | Where                                                                                                                                              |
| ----------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| project-ci-design | Test budget     | the figure itself, such as "3 min"                                                                                                                 |
| project-ci-design | Required checks | the command that lists the checks the `main` ruleset requires                                                                                      |
| project-testing   | Test commands   | the config that gives each test command its folder or file suffix, and its timeout, such as `rig.config.ts`; link each file when several hold them |
| project-testing   | Test utils      | the folder to search before you write a test helper                                                                                                |

A made-up project-ci-design skill:

```markdown
---
name: project-ci-design
description:
  'The CI facts of the Ledgerlark repo, and the ci-design rules it replaces. Load it beside
  ci-design before you change a workflow or a job.'
metadata:
  kind: rule-set
---

# Ledgerlark CI design

## Facts

| Fact            | Where                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| Test budget     | 90 s                                                                                  |
| Required checks | `gh api repos/acme/ledgerlark/rules/branches/main`, the `required_status_checks` rule |

## Departures

- Run `build` as a job of its own, though [Jobs](../ci-design/SKILL.md#jobs) puts every script in
  `checks`. The `build` job uploads an artifact, and the upload needs a second runner.

## Release builds

- Keep `fetch-depth: 0` in the `release` workflow, which runs `build` on a tag push. The changelog
  step in that workflow reads every commit since the last tag.
```
