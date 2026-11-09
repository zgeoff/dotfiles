# Kinds of skill

Pick the kind before you write. In a machinery skill or a method skill, write the opening that
[SKILL.md](../SKILL.md#open-with-the-job-and-the-key-rules) sets out, and add the parts below. Leave
that opening out of a rule set and out of a project skill.

- [A machinery skill](#a-machinery-skill) covers one repo's tools, such as its migrations or its
  deploy scripts.
- [A method skill](#a-method-skill) teaches a way of working, such as finding out why code is the
  way it is.
- [A rule set](#a-rule-set), such as a code style, holds rules the agent applies while it writes
  something else.
- [A project skill](#a-project-skill), such as project-testing beside testing, holds one repo's
  facts for a shared rule set, and the repo's own rules that replace shared ones.

When a skill has a reply line, make it the last line. It starts with "**Reply:**" and gives what the
agent hands back, such as "**Reply:** each risk with its proof".

In a skill of any kind, put a mechanical step, one with no judgment in it, in a script in the
skill's `scripts/` folder, with a test beside it that the repo's test command runs. Tell the agent
to run the script, not read it.

## A machinery skill

Write:

- a line on what it covers;
- the commands, in a table when there's more than one, each with what it needs to run, such as a
  running database or an environment variable;
- the mistakes to avoid, each as a bullet that gives the fact and then what to do about it.

Add a mistake only if an agent with the source open would still lose time to it. A made-up example
of a mistake worth adding, in a skill at `.claude/skills/<name>/SKILL.md`:

```markdown
- **The theme cache outlives a test.** [`loadTheme`](../../../src/theme/load-theme.ts) memoises per
  process, so a test that changes a theme file calls `resetThemes()` first.
```

When the agent only runs commands, end the skill without a reply line. When the agent writes
something for a reader, such as a report, say who reads it, and end with a reply line.

## A method skill

Write:

- the attitude you want the agent to take to the work, such as "treat a comment as stale until the
  code agrees with it", and the mistakes the agent avoids when it holds that attitude;
- who reads the agent's output, and what they do with it;
- numbered steps, each with the decision the agent makes in it, such as when to stop;
- a reply line.

When both the user and agents load the skill, write it for the agent. Put how to word the answer for
the user in its own section, such as "When the user asked the question".

## A rule set

Mark it with `kind: rule-set` under a `metadata` key in its frontmatter. Keep the `#` title. Then
put `## References`, when it has any, and the rule sections, one `##` per topic. Leave out the
opening paragraph, `## Key rules`, the hand-back and the reply line: the agent reads a rule set for
the rule that fits what it is writing, and hands nothing back.

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
`<name>` is the shared rule set it sits beside, such as `project-testing` beside testing.
[Repo-sync](https://github.com/zgeoff/tools/blob/main/docs/architecture/repo-sync.md) copies the
shared skills from zgeoff/skills into the same `.claude/skills/` folder, and never touches a
`project-` folder. The agent loads both, and where they disagree, the project skill wins. Read the
shared skill before you write, so you know which rules the repo replaces and which it follows.

Write it as a rule set: `kind: rule-set` under `metadata`, the `#` title, `## References` when it
has any, and the bullet rules in [A rule set](#a-rule-set). Then write these sections, in this
order:

1. `## Facts`, in project-ci-design and project-testing only: a table with the columns Fact and
   Where, and the rows in [Facts rows](#facts-rows), in that order. Write "none" in the Where cell
   of a row that doesn't apply.
2. `## Departures`: one bullet for each shared rule the repo replaces. Open it with what the repo
   does, link the shared rule's section, and give the reason. Write "None." when the repo follows
   every rule. Write project-code-style with these exceptions:
   - Put each stricter rule in a topic section, because [code-style](../../code-style/SKILL.md) lets
     a repo add rules.
   - List a departure only for code whose shape another tool sets, such as a plugin that a host's
     API shapes.
3. Then add one `##` section for each topic of the repo that the shared skill can't know, such as a
   test harness or a test helper.

Never repeat a rule the shared skill states. The agent reads both, and two copies drift apart.

### Facts rows

Say where each fact lives. Link the file that holds it with a path relative to the skill, such as
`../../../config/ci.json` from `.claude/skills/<project-skill>/SKILL.md`, and name the key or the
command that shows the fact. Then the row stays true when the value changes, and
[`chex links`](https://github.com/zgeoff/tools/tree/main/packages/chex) fails when the file moves.
Give a row a value only when no file in the repo holds the fact, such as the
[test budget](../../ci-design/SKILL.md#jobs).

The terms come from the shared skills: a test budget from [Jobs](../../ci-design/SKILL.md#jobs) in
ci-design, and a lane from [Lanes](../../testing/references/slow-tests.md#lanes) in testing.

Each row below names a project skill, a fact, and what goes in the Where cell of its `## Facts`
table.

| Project skill     | Fact            | Where                                                                    |
| ----------------- | --------------- | ------------------------------------------------------------------------ |
| project-ci-design | Test budget     | the figure itself, such as "3 min"                                       |
| project-ci-design | Required checks | the command that lists the checks the `main` ruleset requires            |
| project-testing   | Lanes           | the config that declares each lane's suffix or folder and its time limit |
| project-testing   | Test utils      | the folder to search before you write a test helper                      |

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
  `checks`: its artifact upload needs a second runner.

## Release builds

- Run `build` on a tag push only, with `fetch-depth: 0`, so the changelog step sees every commit.
```
