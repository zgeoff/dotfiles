# Agent hand-back

Show an agent each change, so it can check each one and revert what it rejects.

Give each kind of fault you fixed one `###` heading, named in a few words, such as "Cut drama
words". Under it, write one line on why it's a fault. Then give each place you changed its own
`diff` block, with `-` before and `+` after. A `diff` block shows the lines in colour. For a
prose-check failure outside the faults in What to fix, use the heading "Prose check". For a section
you rebuilt, use "Structure". Never show the whole file: the agent has it.

End with one bulleted list, each item with its reason:

- each fault you noticed and left in place, such as a contrast frame the reader needs, whether it's
  in What to fix or is a candidate the prose check printed;
- each other file where a label you renamed appears;
- each sentence you changed that also appears word for word in another file you know of, so your
  caller can pick one wording for all of them.
