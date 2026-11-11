# The docs/ tree

Keep `docs/` to what is true of the system today. Keep research, plans and history out of it, and
delete a design once its code is built. Put each kind of doc in the folder that the table after the
contents list names.

Contents: [where content goes](#where-each-kind-of-content-goes) · [length](#length) ·
[designs and decision records](#designs-and-decision-records) · [spikes](#spikes)

| Folder               | Holds                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| `docs/README.md`     | the index                                                                 |
| `docs/architecture/` | how the built system works: `overview.md`, then one doc per concept       |
| `docs/guides/`       | the steps a user takes, one doc per user task                             |
| `docs/runbooks/`     | operator and contributor procedures, development and releasing included   |
| `docs/reference/`    | generated reference only, such as the schema for the config file          |
| `docs/decisions/`    | numbered decision records: the choice, the rejected alternatives, and why |
| `docs/design/`       | a design for work not yet built, deleted once built                       |

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

- **Development and releasing live in runbooks.** Put the contributor setup in `development.md`, in
  `docs/runbooks/`. The release runbook, `releasing.md` in the same folder, is for the steps the
  release tooling doesn't do. When the tooling does every step, delete the runbook.

## Length

Keep each doc under its cap. `chex length` sets the caps, and warns when a doc goes over one,
without failing the run. Past the cap, cut paragraphs first, then split the doc at a concept
boundary. If the doc is still over, say so in the PR body. Don't fit it under the cap by any of
these:

- compressing sentences, meaning dropping their articles and connecting words;
- moving the overflow into a README or code comments;
- splitting where the concept has no boundary.

## Designs and decision records

Load the [design-docs](../../design-docs/SKILL.md) skill before you write a design or a decision
record. It sets where a design lives, its shape, and when a decision record is written and how it
changes. A design in `docs/design/<work>/` is deleted once its code is built, and a decision record
is never deleted.

## Spikes

Run a spike to answer one question a design depends on. The spike lives in
`docs/design/<work>/spikes/<name>/`, unless the repo's `project-docs-writing` skill sets another
folder, such as `research/<name>/` at the repo root. A spike outside the design folder stays when
the design folder is deleted. Every spike has the same layout:

```text
<name>/
  README.md     the landing page, a spike README
  results.md    the full report: versions, a `## Setup` section, every table, the reason behind each result, an `## Untested` section
  <run>.md      a separate run, such as a run on a deployment host
  code, runs/ …
```

The README is a spike README, one of the [five kinds](./readmes.md#the-five-kinds). It has these
sections, in this order:

1. An H1 `Spike: <title>` and 2 to 3 sentences: what the spike measures, and for which decision.
2. `## Question`: the question, in one paragraph.
3. `## Answer`: the verdict and the headline numbers in 5 bullets or fewer, then the recommendation
   in one line.
4. `## Run it`: one code block, and a link to the `## Setup` section of `results.md` for the flags
   and versions. Leave this section out of a spike that runs nothing.
5. `## Results`: one line that links `results.md` and each `<run>.md`.
6. `## Untested`: 1 to 2 lines, with a link to the `## Untested` section of `results.md`.

Give only the landing page the name `README.md`, because `chex length` applies a README limit to
every file with that name. `results.md` and the other files have no length cap.
