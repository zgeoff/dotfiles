# Doc files

A file in `docs/` or a README goes stale when it copies the code. State the rule the code follows in
place of a copy. Give each doc one of the four types [Diátaxis](https://diataxis.fr/) defines:
tutorial, how-to, reference or explanation.

## One type per doc

An architecture doc is an explanation, a runbook is a how-to, and `docs/reference/` is reference. A
doc called a guide is a tutorial when it teaches a newcomer, and a how-to when it walks someone who
already knows the system through one task. A how-to assumes competence. Reference states facts and
holds no opinion. An explanation may hold a view. When a doc mixes two types, split it into two
docs.

A README is the one exception: each of its sections has one type, and the README keeps them
together. Its install steps are a how-to, and its API section is reference.

## State a rule in place of a copy

Each item below is a kind of copy, with what to write in its place.

- **A list of the code's parts,** such as its services or files. State the property every part
  shares in place of naming each one: "every domain service is private". The parts of one flow, each
  named by its role, are fine, and so are a list of commands the reader runs and a reference page a
  script generates from the code.
- **A config value.** State the rule the value serves. Write "the pool closes an idle connection
  before the database suspends" in place of "`idle_timeout` (240 s) closes a connection before the
  300 s suspend". A measured result is different: give it, with its source.
- **A name.** Name a function or module by its role, such as "the retry policy", in place of its
  identifier: a renamed function leaves the doc wrong with no error. When the reader needs to find
  it, name its directory, with no link to the file. Write a command, flag or path exactly as the
  reader types it. Call a library or a product by its real name.
- **Code.** Put only a command the reader runs, a config the reader pastes, or a short invented
  example in a code block. Say what other code does in a sentence.

## The opening

Open a doc in `docs/` with three to six plain sentences. A reader who stops there still leaves with
the main facts. In most docs, they say what the system does and what the reader most needs to know.
In a runbook, they say what it fixes and when to use it. A README opens as the READMEs reference
says.

## Diagrams for pipelines, state machines and topologies

When a section is about a pipeline, a state machine or a topology, open it with one mermaid diagram.
When the whole doc is about one, put the diagram right after the opening sentences. A request flow
and a job handoff through a queue each count as a pipeline. A service dependency map and a
deployment layout each count as a topology. Label each node with the name the text uses for that
part, so the reader can match the two. Under the diagram, write only what it can't show, such as the
invariant on each edge.
