---
name: ci-design
description:
  "Rules for CI in a zgeoff repo: workflows, jobs, test budgets, timeouts, triggers, builds and the
  dependency gates. Load it before you add, change or review a workflow, a job or a trigger, or a
  release-age exclude, override or audit ignore. For how to write tests, load the testing skill.
  Load the repo's project-ci-design skill beside it; where they disagree, the project skill wins."
metadata:
  kind: rule-set
---

# CI design

## References

- [Dependency exceptions](./references/dependency-exceptions.md): adding a release-age exclude, an
  override or an audit ignore for a third-party package.
- [Run times](./references/run-times.md): measuring a median time for the test budget or a timeout.

## Workflow lint

- After you change a workflow, run `bun x @zgeoff/chex workflows` and fix every warning. CI stays
  green on a warning.

## Jobs

Never edit [`pr.yml`](https://github.com/zgeoff/tools/blob/main/sync/workflow-callers/pr.yml):
[repo-sync](https://github.com/zgeoff/tools/blob/main/docs/architecture/repo-sync.md) copies it from
zgeoff/tools and overwrites your change. `pr.yml` runs the shared
[`bun-checks.yml`](https://github.com/zgeoff/tools/blob/main/.github/workflows/bun-checks.yml) on
each pull request.

- Add CI work as a package script. Unless `BUN_CHECK_SCRIPTS` is set, `bun-checks.yml` runs the
  standard list: `audit`, `deadcode`, `format:check`, `lint`, `typecheck` and `test`, and each of
  `test:e2e`, `test:browser`, `test:docker`, `test:host` and `test:agent-sdk` that the repo defines.
  [Where each test runs](../testing/references/slow-tests.md#where-each-test-runs) says what each
  test script runs. `test:model-api` stays out of the list, and runs as that page says.
- To run a script outside the standard list, such as a made-up `check:sql`, set the repo variable
  `BUN_CHECK_SCRIPTS`. Write in it every script to run, the standard ones included. A script you
  leave out stops running, and a name that `package.json` lacks fails the run.
- Expect a private repo to run every script in one `checks` job. In a public repo, `bun-checks.yml`
  gives each of `test:e2e`, `test:browser`, `test:docker`, `test:host` and `test:agent-sdk` a job of
  its name, such as `test-e2e`. It runs each other `test:<name>` script in the `test` job, and the
  rest in the `static` job.
- Require `pr / checks` in the `main` ruleset. In a public repo, the `checks` job fails when any
  other job fails.
- Put a job of your own in a workflow you write, such as `image.yml`.
- Never require a branch to be up to date before merge. The push run on `main` tests the merged
  tree.

Find the repo's test budget in the Facts table of its project-ci-design skill. The budget caps the
median test time: the slowest test job in a public repo, and the sum of the steps that run test
scripts in a private one. When the repo has no budget, skip each rule that uses one. Measure each
time and median in this skill as [Run times](./references/run-times.md) says.

- In a public repo, move a script into a job in a workflow you write only when its step takes over
  60 s longer than the steps that set up a job, such as the checkout and `bun install`. Shard tests
  only when the repo is over its test budget.
- In a private repo, write a job of your own only for a heavy check: one on any runner but a
  GitHub-hosted `ubuntu-*`, or one that sets up KVM. Run it on `schedule` or `workflow_dispatch`. A
  required check runs on every push to a pull request, so never require a heavy check.
- Give a required job no `if:` or path filter. GitHub counts a skipped required check as a pass.

## Timeouts

- Set `timeout-minutes` on every job that runs steps. GitHub refuses it on a job that calls a
  reusable workflow, so pass the workflow's `timeout-minutes` input when it has one.
- Set 20 minutes on a job with tests. Once its tests have stayed within the test budget for a week
  of runs on `main`, set twice the budget plus the job's median time outside its tests.
- Set twice the median time on a job with no tests, and never less than 5 minutes.
- Set the timeout of the `bun-checks.yml` jobs with the repo variable `BUN_CHECK_TIMEOUT_MINUTES`.
  Set it to the slowest test job's timeout. In a workflow you write that calls `bun-checks.yml`,
  pass the variable the way
  [`pr.yml`](https://github.com/zgeoff/tools/blob/main/sync/workflow-callers/pr.yml) does.

## Reusable workflows

- Share steps as a reusable workflow. A composite action fails as one red line, with no step to
  point at.
- Before you write setup steps, look for a shared workflow in zgeoff/tools.
- In a workflow you write, pin each call of a zgeoff/tools workflow to the latest commit on `main`,
  with the `# main` comment:

  ```yaml
  uses: zgeoff/tools/.github/workflows/<name>.yml@<commit> # main
  ```

- Never move the pin by hand. Repo-sync moves each pin in `.github/workflows/`, yours included.

## Step scripts

- Keep each `run:` to one plain command, with no shell `if`, loop, `&&`, `||`, `;`, pipe or
  `${{ }}`. Pass an expression's value through `env:`.
- Write the script in TypeScript under `scripts/<job>/`. Run it as `bun run --silent ci:<name>`,
  from a package script such as `"ci:tag-release": "bun scripts/release/tag-release.ts"`.
- Keep step scripts out of `.github/`. Each script's test sits beside it, and `bun test` skips
  hidden folders.

## Path filters

Filter a job only when you can list every path it reads, shared packages, `bun.lock` and the
workflow's own file included. Filter it with a `changes` job, and leave `paths` off the trigger: a
workflow that never starts reports no checks, so a required check in it blocks the merge.

```yaml
jobs:
  changes:
    uses: zgeoff/tools/.github/workflows/paths-changed.yml@<commit> # main
    with:
      paths: |
        services/api/**
        packages/shared/**
        bun.lock
        .github/workflows/image.yml
  image: # not a required check, so a skip is safe
    needs: changes
    # != 'false', so a failed changes job still runs the image build
    if: ${{ !cancelled() && needs.changes.outputs.changed != 'false' }}
    timeout-minutes: 15
```

## Cancelling runs

- Write a workflow of your own for the checks of a push to `main`, such as a `main.yml` that calls
  `bun-checks.yml`. Repo-sync delivers none. Never cancel its runs: a cancelled run leaves that
  merged commit untested.
- In each pull-request workflow you write, cancel the older run. Name the workflow in the group, so
  two workflows never cancel each other:

  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true
  ```

- Never cancel a release, deploy or migrate job: a deploy cut off halfway leaves its target half
  changed. Give the job its own job-level group, such as `deploy-${{ github.ref }}`, with
  `cancel-in-progress: false`.
- When checks and a deploy share a workflow, put the checks' group at job level too. Then a newer
  run cancels only the checks.
- In a workflow that runs only on `main`, group by `github.sha`, with `cancel-in-progress: false`.
  Then two runs of one commit, such as a rerun and a dispatch, wait for each other.

## Builds

- Build each artifact once per run. Pass an image on through the registry or buildx's `type=gha`
  cache, and a file through `actions/upload-artifact`.
- Never cache `~/.bun/install/cache` or `node_modules`. `bun install --frozen-lockfile` is faster
  than the restore.
- When a job reads git history, such as tags, check out with `fetch-depth: 0` and
  `filter: blob:none`. When it reads many old files, use `filter: ''` in place of `blob:none`. For a
  diff against the base branch, use `fetch-depth: 2`.

## `workflow_run` triggers

When a job that `workflow_run` starts holds a secret or write access, give the job this `if:`. A
`pull_request` run can hold a fork's code, and a fork's `main` passes a `branches: [main]` filter on
the trigger.

```yaml
if: >-
  contains(fromJSON('["push","schedule"]'), github.event.workflow_run.event) &&
  github.event.workflow_run.head_repository.full_name == github.repository
```

## First-party packages

When `bunfig.toml` sets `minimumReleaseAge`, give each first-party package an exclude. Renovate
bumps each one as soon as it publishes, and `bun install` refuses a release younger than that age.

- Run `bun x @zgeoff/chex dependency-gates`, and add each first-party package it lists to
  `minimumReleaseAgeExcludes`, by its full name, such as `@zgeoff/std`.
- Never write a scope, such as `@zgeoff/*`. Bun accepts it with no warning and lets nothing through.
- Never write a [removal comment](./references/dependency-exceptions.md#release-age-excludes) for a
  first-party package. The
  [audit-fix workflow](https://github.com/zgeoff/tools/blob/main/docs/architecture/dependency-updates.md#the-audit-fix-workflow)
  deletes the exclude of each package a removal comment names, on its removal date.
- Add a missing exclude in a pull request of its own into `main`. Renovate drops a commit you push
  to its branch. Once yours merges, tick the rebase checkbox in each red Renovate pull request.

## Dependency exceptions

- Add a release-age exclude, an override or an audit ignore for a third-party package only for a
  named reason, such as a fix the repo needs. Add it as
  [Dependency exceptions](./references/dependency-exceptions.md) says.
- When a release older than `minimumReleaseAge` holds the fix, lock it as step 2 of
  [Release-age excludes](./references/dependency-exceptions.md#release-age-excludes) says, and add
  no exclude.
- Remove each exclude, override or ignore once it guards nothing. `chex dependency-gates` fails the
  run on an expired exclude, an override that every `bun.lock` range admits, and an ignore that no
  locked package needs.
