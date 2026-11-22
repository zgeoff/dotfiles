# Agent hand-back

Show an agent each change, so it can check each one and revert what it rejects.

Give each kind of fault you fixed one `###` heading, named in a few words, such as "Cut drama
words". Under it, write one line on why. Then give each place you changed its own `diff` block, with
`-` before and `+` after. A `diff` block shows the lines in colour. When the fault is outside What
to fix, use the heading "Prose check" or "Structure". Never show the whole file: the agent has it.

End with one bulleted list, each item with its reason:

- each candidate the prose check printed that you kept, and each fault What to fix lets you keep,
  such as a contrast frame the reader needs;
- each other file that uses a label you renamed.
