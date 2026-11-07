# The docs/ tree

A reader of `docs/` should find only what is true of the system today. Keep research, plans and
history out of it, and delete a design once its code is built. The table below gives the place for
each kind of doc.

Contents: [where content goes](#where-each-kind-of-content-goes) · [length](#length) ·
[designs](#designs) · [decision records](#decision-records) · [spikes](#spikes)

| Folder               | Holds                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| `docs/README.md`     | the index                                                                 |
| `docs/architecture/` | how the built system works: `overview.md`, then one doc per concept       |
| `docs/guides/`       | the steps a user takes, one doc per user task                             |
| `docs/runbooks/`     | operator and contributor procedures, development and releasing included   |
| `docs/reference/`    | generated reference only, such as the schema for the config file          |
| `docs/decisions/`    | numbered decision records: the choice, the rejected alternatives, and why |
| `docs/design/`       | a design: work with open questions that need spikes; temporary            |

Once `docs/architecture/` holds more than 6 docs, not counting `overview.md`, group them into
subfolders by area, so a reader can scan the folder. Link `docs/reference/` from the index.

## Where each kind of content goes

- **Reference lives in the code.** Describe each config key in the config schema, and generate the
  schema into `docs/reference/`. Describe each flag in `--help`, and each MCP tool in its tool
  description. A configuration guide in `docs/guides/` covers where config lives, gives worked
  examples, and links the schema.
- **Keep these out of `docs/`:**
  - evaluations and research write-ups, except a design's own spikes;
  - plans, which go in their issue or PR;
  - diagnoses;
  - history, except a decision record's `## Changes` list.

  When a finding from a write-up still constrains the system, write it as one sentence in the
  architecture doc that owns it. Put each finding someone will act on in the issue tracker. Delete
  the write-up.

- **Development and releasing live in runbooks.** Put the contributor setup in
  `docs/runbooks/development.md`. The release runbook, `docs/runbooks/releasing.md`, is for the
  steps the release tooling doesn't do. When the tooling does every step, delete the runbook.

## Length

Keep each doc under its cap. `chex length` sets the caps, and warns when a doc goes over one,
without failing the run. Past the cap, cut paragraphs first, then split the doc at a concept
boundary. If the doc is still over, say so in the PR body. Don't fit it under the cap by any of
these:

- compressing sentences, meaning dropping their articles and connecting words;
- moving the overflow into a README or code comments;
- splitting where the concept has no boundary.

## Designs

Start a design only when the user asks for one. A design has open questions that need spikes before
anyone can build; a plan for work about to be built has none, and goes in its issue or PR. The
design lives in `docs/design/<work>/`, where `<work>` is the work in a few words, while its code is
unbuilt.

When the work lands:

1. Move what was built into `docs/architecture/`.
2. Write each spike finding that still constrains the system as a sentence in the architecture doc
   that owns it.
3. Point each decision record's design link at the architecture doc instead.
4. Delete the design folder, spikes included.

## Decision records

A decision record holds a choice between alternatives that the user signed off, in a design session,
a ticket or a PR. Write one only for such a choice, never for a choice you made alone. You may write
it later, from the session where the user decided. Never delete one.

Name it `NNNN-<slug>.md`, with the next free number, and open it like this:

```markdown
# 0007: The durable layer

- Date: 2026-10-07
- Updated: 2026-10-15
- Status: decided
- Design: [event log](../design/core/event-log.md)
```

`decided` is the only status. Add the `Updated` line only when the decision changes.

It states the choice and the alternatives it rejected, with why, and never how the system works now:
the architecture doc owns that. When a decision changes, edit the record in place:

1. Keep its number, and state the decision as it now stands.
2. Add or change the `Updated` line in its header.
3. Add a line to the `## Changes` list at its end, with the date and a one-line summary.

## Spikes

A spike is an experiment you run to answer one question a design depends on. It lives in
`docs/design/<work>/spikes/<name>/`, unless the repo's `project-docs-writing` skill sets another
folder, such as `research/<name>/` at the repo root. A spike outside the design folder stays when
the design folder is deleted. Every spike has the same layout:

```text
<spike>/
  README.md     the landing page: a spike README, one of the five kinds of README
  results.md    the full report: versions, setup, every table, the reasons, the full untested list
  <run>.md      a separate run, such as a run on a deployment host
  code, runs/ …
```

The README has these sections, in this order:

1. An H1 `Spike: <title>` and 2 to 3 sentences: what the spike measures, and for which decision.
2. `## Question`: the question, in one paragraph.
3. `## Answer`: the verdict and the headline numbers in 5 bullets or fewer, then the recommendation
   in one line.
4. `## Run it`: one code block, and a link to the `## Setup` section of `results.md` for the flags
   and versions. Leave this section out of a spike that only reads sources.
5. `## Results`: one line that links `results.md` and each `<run>.md`.
6. `## Untested`: 1 to 2 lines, with a link to the `## Untested` section of `results.md`.

Give only the landing page the name `README.md`, because `chex length` applies a README limit to
every file with that name. `results.md` and the other files have no length cap.
