# Writing a reference

## A reference the main agent reads

- Start it with the facts and the mistakes to avoid that its reader needs first. Leave out when to
  read it: the line in SKILL.md that links the reference already says when.
- Use the terms SKILL.md sets up without explaining them again. The agent reads SKILL.md first.
- Keep what the agent hands back to its caller in SKILL.md.

## A subagent's brief

A brief is a reference that the agent gives a subagent as its instructions. The subagent never sees
SKILL.md, so put in the brief what it would find there:

- Define every term you use.
- Give the subagent's return format.

## Links between references

Link to a heading in another file in `references/` with a Markdown link, such as
`[Lanes](./slow-tests.md#lanes)`, never with a plain mention of the file. Then `chex links` fails
when someone renames the heading.

Keep such links few. An agent that reaches a reference from SKILL.md may read only part of a second
reference that the first one links, and miss the fact you sent it for. Put a fact that most tasks
need in SKILL.md.
