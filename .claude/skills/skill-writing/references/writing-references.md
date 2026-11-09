# Writing a reference

## A reference the main agent reads

- Give it a `#` title, then start it with the facts and the mistakes to avoid that its reader needs
  first. Leave out when to read it: the line in SKILL.md that links the reference already says when.
- Use the terms SKILL.md sets up without explaining them again. The agent reads SKILL.md first.
- Keep what the agent hands back to its caller in SKILL.md.

## A subagent's brief

Write a subagent's brief, its instructions, as a reference, and have the agent hand the subagent
that file. The subagent never sees SKILL.md, so put in the brief what it would find there:

- Give the subagent's job and the mistakes it must avoid.
- Define every term you use.
- Give the subagent's return format.

## Links between references

Link to a heading in another file in `references/` with a Markdown link, such as
`[Per-run templates](./slow-tests.md#per-run-templates)`, never with a plain mention of the file.
Then `chex links` fails when someone renames the heading. Link a heading in SKILL.md or in another
skill the same way, such as `[Jobs](../../ci-design/SKILL.md#jobs)`.

Link from a reference to another reference only when the reader needs a fact from it. When SKILL.md
links reference A, and A links reference B, an agent may read only part of B and miss the fact you
sent it for. Put a fact that most tasks need in SKILL.md.
