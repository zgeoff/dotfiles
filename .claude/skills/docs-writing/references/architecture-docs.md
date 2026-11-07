# Architecture docs

A reader opens an architecture doc in `docs/architecture/` before they change a subsystem: one
concept, such as how a job's lease passes between workers, whatever packages implement it. The
reader needs to predict what the system does in a case the doc doesn't describe. Explain the
concept, and give the reason that leads from each fact to the next. When you list the package's
parts, or retell one function step by step, the reader gets names without a working model. The rules
in the [docs-writing skill](../SKILL.md) apply throughout, and so do its Doc files reference's rules
on the opening and on diagrams.

Contents: [working model](#give-the-reader-a-working-model) · [the concept](#open-with-the-concept)
· [mechanisms](#describe-a-mechanism-that-spans-files) ·
[reasons](#give-the-reason-in-the-sentence-that-needs-it) ·
[the set of docs](#shape-the-set-of-docs-around-concepts) · [what stays out](#what-stays-out)

## Give the reader a working model

After reading the doc, the reader knows:

- what the subsystem is for;
- what its parts are, and how they fit together;
- which part owns each piece of state;
- what stays true whatever a caller does;
- why the system is built this way.

To test the doc:

1. Pick a case it doesn't describe outright, such as a process that dies halfway through a write.
2. Predict from the doc alone what the system does. The cold read the docs-writing skill asks for
   does this best, because its reader hasn't seen the code.
3. Check the code. When the prediction was wrong, add the fact that would have made it right, and go
   back to step 1 with a new case. Stop when a prediction holds.

## Open with the concept

Say what the subsystem does in the domain's own terms, because the reader thinks in those terms
before they know the code. In the opening, name the package that implements it only by what it does,
never by its path. The bad example below opens with the path.

- Bad: "`libs/stock-ledger` holds the ledger row, the two counters, and the reserve function."
- Good: "Every order a buyer places at a warehouse takes its stock from one place: that warehouse's
  stock ledger. The ledger is a single sequence of entries running forward. An order reserves the
  units it needs, ships from them, and leaves what is left for the order that follows."

## Describe a mechanism that spans files

When understanding a mechanism takes more than one file, or its reason isn't visible in the code,
describe it. How a lease on a job passes to another worker when its holder stops is one: the lease,
the worker and the timeout live in different files. Write the mechanism as a paragraph of cause and
effect: each step happens because of the one before it, and that chain is what the reader needs to
change the subsystem safely. Leave out a step-by-step account of one function: the reader can open
the function.

## Give the reason in the sentence that needs it

Put the reason for each fact whose reason isn't obvious in the same sentence or the next, joined by
"because", "so" or "therefore". For the reason, say why the system works this way, or what would
fail if it didn't. Write a paragraph that explains a design choice in this order:

1. the problem;
2. its consequence;
3. the response;
4. the limit on the response: what the response doesn't cover, or the condition it needs.

A `**Why:**` marker is a bold label in front of a reason. Join a reason to its fact with "because",
"so" or "therefore" instead. Keep the marker for a one-off decision that no paragraph's chain of
cause and effect explains, and give it a paragraph of its own. With a `**Why:**` on every paragraph,
the doc turns into a list of rules, and the reader loses how one fact leads to the next.

- Bad:

  > The database factory detects a resume as a wall-clock gap. **Why:** timers don't run while the
  > machine is paused.
  >
  > The factory swaps in a fresh pool on a resume. **Why:** the database may have closed the old
  > sockets.

- Good:

  > The pool's timeouts stop while the process is paused. The host suspends an idle machine with its
  > memory intact, so the pool resumes holding its old sockets, and the database may have closed
  > them in the meantime. The database factory therefore detects a resume, as a wall-clock gap
  > between two clock reads it takes on a timer, and swaps in a fresh pool for new queries. The gap
  > threshold stays above any stretch of work that blocks the event loop, so a long job never trips
  > a reset that would destroy its own queries.

State an invariant, a rule that holds whatever a caller does, in the paragraph about the part that
keeps it, with its reason beside it.

## Shape the set of docs around concepts

- **Keep an overview.** `docs/architecture/overview.md` shows the whole system on one page, so a
  reader can find the doc they need. It has a paragraph and a link for each of:
  - the path a request takes, end to end;
  - the topology: which processes and deployments exist, and how they reach each other;
  - the data: each store, and the shapes of data it holds;
  - each concern that cuts across the system.

  When you add an architecture doc, add a paragraph and a link for it to the overview, and write the
  overview first when the repo has none. Put the paragraph under the part of the system it belongs
  to. The overview isn't a product overview, which says what the product is and who it's for.

- **Write one architecture doc per subsystem, not per package.** A subsystem can span several
  packages, and a reader changing it needs all of it in one place. Split a doc at a concept
  boundary.
- **Link the docs whose concepts this one uses**, after the opening sentences and any diagram that
  follows them, with one sentence on what each covers, so the reader can open those docs beside this
  one. An invented example:

  ```markdown
  [Replay verification](./replay-verification.md) covers the verifier that proves a stream and
  settles it.
  ```

- **Draw a diagram** for the overview's request path, and another for its topology. Every other doc
  follows the Doc files reference's diagram rule.

## What stays out

Each of these has another owner, and a copy here would go out of date:

- **Design the code doesn't implement yet.** It goes under `docs/design/`. When a built part came
  from a design, link the design in one sentence.
- **What a user sees and does.** That goes in a guide, in `docs/guides/`.
- **The alternatives you rejected, and the history of the design.** When the user signed off the
  choice, those go in a decision record, a numbered file in `docs/decisions/`. Otherwise they go in
  the PR description.
- **Reference for internals**, such as one entry per protocol method, config key or module. That
  stays in the code, or in reference generated from it.
