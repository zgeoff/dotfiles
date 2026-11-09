# Slow tests and where each test runs

Keep each test that `bun run test` runs under 5 s on CI. Keep each test that another command runs
under that command's timeout in [Where each test runs](#where-each-test-runs). You pay for a slow
test again in every later run. Never raise the timeout or add a sleep to hide that cost. The oxlint
rules in `@zgeoff/oxlint-config` enforce this: `zgeoff/max-test-timeout` refuses a timeout above the
one for the file's command, and `zgeoff/no-test-sleep` refuses a fixed sleep.

When a test is slow, find its cause in [Causes and fixes](#causes-and-fixes) and make that fix.
Raise a timeout only as [A test over its limit](#a-test-over-its-limit) allows. Never move a test to
another command only because it is slow.

- [Causes and fixes](#causes-and-fixes)
- [Tests that need a real system](#tests-that-need-a-real-system)
- [Per-run templates](#per-run-templates)
- [Where each test runs](#where-each-test-runs)
- [A test over its limit](#a-test-over-its-limit)
- [The run mode and workers](#the-run-mode-and-workers)

## Causes and fixes

| The test                                                                       | The cause                     | The fix                                                                                                                              |
| ------------------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| starts the app, a server or a CLI to call it                                   | a real process start          | Call the code in the test process.                                                                                                   |
| waits for a deadline, an idle limit or a retry delay that the repo's code sets | a real timer                  | Make the delay an option, and pass a short one.                                                                                      |
| sleeps to let something settle                                                 | no signal to wait on          | Wait on a condition with `waitFor` from `@zgeoff/testing/helpers`.                                                                   |
| proves that something does not happen                                          | it waits out a timeout        | Wait for a later event.                                                                                                              |
| migrates a database or builds a bundle                                         | a fixture built in each test  | Use a [per-run template](#per-run-templates).                                                                                        |
| drives a program the repo starts, such as a VM guest agent or a worker         | a real process start          | Use a [stateful stand-in](./system-tests.md#stateful-stand-ins): a fake of the program that keeps its state and speaks its protocol. |
| runs a linter or checker binary over text the code builds                      | a real process start          | Check the text with a script in `scripts/`.                                                                                          |
| needs a real system that `bun run test` can't host                             | a VM, the kernel or a browser | Put it where [Where each test runs](#where-each-test-runs) says.                                                                     |

Each fix in more detail:

- To call the code in the test process, call its handler, its main function with a test argv, an
  in-memory RPC link or an injected transport. Start the program under test as a process only in
  `e2e/`. Use `run` from `@zgeoff/testing/process` for a program that exits, and `start` for one
  that keeps running, as [End-to-end suites](./system-tests.md#end-to-end-suites) says.

  Keep these tests beside their script, outside `e2e/`. Each starts the script itself, and runs in
  `bun run test` under its 5 s timeout:
  - the test of a shell script;
  - the test of a TypeScript script that a CI step runs.

- To shorten a timer that the repo's code sets, make the delay an option of the code that sets it,
  pass a short one, and wait on the event the delay causes. For a timer inside a library, Bun, Node
  or the kernel, which the repo's code can't set, follow
  [Native timers and scenario delays](./system-tests.md#native-timers-and-scenario-delays). When
  that test still takes longer than 5 s, keep it in `bun run test`, with the disable comment from
  [A test over its limit](#a-test-over-its-limit). Give the comment a ticket when the library could
  take a fix, such as an option for the delay. Otherwise, give it `floor:` and the delay that
  nothing can set.
- When the code has nothing to wait on, add an event, a log marker or a state flag, and wait on
  that.
- To prove that something does not happen, wait for an event that comes only after it could have
  happened, such as the reply to a second request sent after the first.
- Look for a stateful stand-in in `src/test-utils/` of the package that owns the program it fakes.
  Look in the repo's project-testing skill too, when the repo has one. When none exists, write one
  there, as [Stateful stand-ins](./system-tests.md#stateful-stand-ins) describes.
- To check text that a linter or a checker reads, such as a generated shell script, export the
  function that builds the text. Never run the binary in a test. Run it from a script in CI and in
  the pre-push hook:
  - Write the script in `scripts/<job>/` at the repo root. It calls the function and runs the binary
    on its output.
  - Add a `ci:<name>` package script that runs it, and a CI step that runs
    `bun run --silent ci:<name>`, as [Step scripts](../../ci-design/SKILL.md#step-scripts) in the
    ci-design skill says.
  - Add a job that runs the same command under `pre-push` in the repo's `lefthook.yml`. Give the job
    a name that doesn't start with `chex-`, so it runs beside the
    [pre-push baseline](https://github.com/zgeoff/tools/blob/main/docs/architecture/pre-push-baseline.md#limits-of-the-baseline)
    jobs.

Measure a test's time in the log of a CI run. `bun run test` runs `bun test` through rig, and
`bun test` prints each test's time. A host that swaps memory or shares its cores runs the same test
slower.

## Tests that need a real system

When everything a test needs starts in milliseconds and gives each test its own copy, keep the test
in `bun run test`. An in-memory store, a database template copied per test and a stateful stand-in
each pass this check.

Move a test out of `bun run test` only when it needs:

- a real system that `bun run test` can't host, such as a VM, the kernel or root, a browser, a
  container image, the Claude Agent SDK subprocess or a live API;
- the product's own process, to test its start-up, signals or exit codes.

Put such a test in the folder, or give it the file suffix, that
[Where each test runs](#where-each-test-runs) names for what it needs.

## Per-run templates

When a fixture costs more to build than a test costs to run, such as a migrated database or a built
bundle, build it once per run as a template. Copy it in each test that writes to it. Read it in
place in each test that only reads it.

- Build it in the first worker that needs it. Take a lock first by creating a lock file with the
  `wx` flag, which fails when the file exists. Write the prefix from
  [Leftovers of a killed run](./cleanup.md#leftovers-of-a-killed-run) into the lock file, so a sweep
  can tell whether its builder still runs. Build into a temporary name. Rename it into place when it
  is done.
- When the build throws, remove the lock file before you rethrow, so the next run can build the
  template.
- In each other worker, wait with `waitFor` from `@zgeoff/testing/helpers` until the template
  appears. When something kills the builder, the waiting tests fail at their timeout. The sweep at
  the start of the next run then removes the lock file.
- Never keep it in a module-level variable. Each worker would build it again, and the workers race
  on one output folder.
- Put a hash of its inputs, such as the migration files, in its name. Then the run builds a new
  template when an input changes, and reuses the last one otherwise.
- Keep it in a git-ignored folder inside the repo, such as `node_modules/.cache/`, never in `/tmp`.
  When `/tmp` is tmpfs, it holds every file in RAM.
- In the repo's test script, before `bun test` starts, sweep what earlier runs left: temp folders,
  database clones, lock files and old templates.
  [Leftovers of a killed run](./cleanup.md#leftovers-of-a-killed-run) describes the sweep. Never
  remove the template for the current hash, because a run that is still going may be copying it.

For each engine's template, see the Postgres isolation and SQLite isolation sections of
[Database testing](./database.md).

## Where each test runs

Find the row for what the test needs. Put the test where the row says, and run it with the row's
command. A test that runs past the row's timeout fails. Put a file with a suffix beside the module
it tests, or in `e2e/` when it drives the program from outside. The rig command column names the
`rig` command that each `bun run` script calls.

| rig command | Put it in                                                                  | Timeout | The test needs                                                                      | Run it with              |
| ----------- | -------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------- | ------------------------ |
| unit        | every other test file, such as `<name>.test.ts` beside the module it tests | 5 s     | no real system: code in the test process, a per-run template or a stateful stand-in | `bun run test`           |
| e2e         | `e2e/` in the package that builds the program                              | 15 s    | the program, run as a process and driven from outside                               | `bun run test:e2e`       |
| browser     | `<name>.browser.test.ts`                                                   | 10 s    | a real browser                                                                      | `bun run test:browser`   |
| docker      | `<name>.docker.test.ts`                                                    | 15 s    | a container engine                                                                  | `bun run test:docker`    |
| host        | `<name>.host.test.ts`                                                      | 15 s    | the host kernel, root or the network stack                                          | `bun run test:host`      |
| agent-sdk   | `<name>.agent-sdk.test.ts`                                                 | 5 s     | the Claude Agent SDK subprocess, against a scripted model                           | `bun run test:agent-sdk` |
| model-api   | `<name>.model-api.test.ts`                                                 | 120 s   | a live model API                                                                    | `bun run test:model-api` |

<!-- Tests in zgeoff/tools parse the first three columns of this table: keep their shape. -->

[`@zgeoff/rig`](https://github.com/zgeoff/tools/tree/main/packages/rig) runs each command.
`rig init` writes the `test:<name>` scripts into `package.json`, and `bun run test` runs `rig unit`,
which leaves out every file that another command runs. The pre-push hook runs only the
`bun run test` files beside the files a branch changes, so every other command runs only in CI, as
the
[pre-push baseline](https://github.com/zgeoff/tools/blob/main/docs/architecture/pre-push-baseline.md#the-related-tests)
describes. For the CI job that runs each command, see the ci-design skill.

- rig runs a file with a suffix only under that suffix's command, wherever the file sits, `e2e/`
  included. In a made-up repo, `bun run test:kvm` runs `e2e/boot.kvm.test.ts`, and
  `bun run test:e2e` skips it.
- In an `.agent-sdk` test, never call the live API. Start a scripted model: a local server that
  answers the model API with the replies the test queues. Point the SDK at it with
  `ANTHROPIC_BASE_URL` in the SDK's `env` option. `@zgeoff/testing` has no scripted model. Look for
  one in `src/test-utils/` and in the repo's project-testing skill. When none exists, write one in
  `src/test-utils/` of the package whose tests use it, with its own test beside it.
- Run `bun run test:model-api` nightly, on `workflow_dispatch`, and on a pull request that bumps the
  Agent SDK. Never run it on every pull request.
- Give each test that calls a live model the `.model-api` suffix, wherever it lives.
- Give a test that calls another live API a suffix and a command named for that API, such as a
  made-up `.payments` that `bun run test:payments` runs.
- Name one real system in a suffix, never a speed. Prefer a specific suffix to the generic `.host`,
  such as a made-up `.kvm` for a test that boots a VM.
- Add a suffix of the repo's own only for a real system from the list in
  [Tests that need a real system](#tests-that-need-a-real-system). Declare it under `lanes` in
  `rig.config.ts`, with its `suffix` and its timeout in `limit`, such as `'15s'`. The repo's lint
  rules read each timeout from there. List the suffix, its command and its timeout in the Facts
  table of the repo's project-testing skill. Put the measured test times in the pull request that
  adds the suffix.
- Put the code that starts the real system, such as the code that starts a VM, in a helper with its
  own test beside it. Keep the helper in `src/test-utils/` of the package that owns what it starts,
  as [Where a test lives](../SKILL.md#where-a-test-lives) says.

For a Rust crate, run these tests through cargo-nextest, as
[Rust tests that need a real system](./system-tests.md#rust-tests-that-need-a-real-system)
describes.

## A test over its limit

When a test is slow and [Causes and fixes](#causes-and-fixes) has a fix for it, make the fix in the
pull request where you find the test slow, even when your change doesn't touch its file. Leave the
fix for a ticket only when it can't land in this pull request, such as a fix in another repo.

When a test still can't finish within the timeout of its command, give it a disable comment with the
time it takes on CI and one of these reasons:

- the ticket that tracks the fix, when the fix can't land in this pull request, such as a fix in
  another repo: `48 s on CI, OPS-212`;
- `floor:` and the evidence that the time can't drop:
  `48 s on CI; floor: two VM boots plus a restic restore`.

Separate the time from the reason with a comma or a semicolon. The lint rule checks only for the
ticket or `floor:`.

Set the timeout about a quarter above the time on CI, as in this made-up example:

```ts
test(
  'it restores a volume from its oldest snapshot',
  async () => {
    // …
  },
  // oxlint-disable-next-line zgeoff/max-test-timeout -- 48 s on CI, OPS-212
  { timeout: 60_000 },
);
```

`zgeoff/max-test-timeout` reports on the line of the timeout value, so put the comment on the line
before the options object. Pass the options object after the callback. Bun's types accept no other
order. The formatter puts each argument on its own line, so the comment stays next to the object.

`zgeoff/test-timeout-exception-ticket` fails a disable of `zgeoff/max-test-timeout` whose reason
after `--` holds neither a ticket nor `floor:` with text. The `test-timeouts` check of
[`@zgeoff/chex`](https://github.com/zgeoff/tools/tree/main/packages/chex) fails an oxlint config
that turns `zgeoff/max-test-timeout` or `zgeoff/test-timeout-exception-ticket` off or down to a
warning, unless a comment on that setting holds a ticket or `floor:`.

## The run mode and workers

- Run the tests with `bun run test`, which runs `rig unit`. rig sets `--parallel` from the host's
  cores and memory, passes `--randomize` and `--no-isolate`, and takes the worker count from
  `TEST_WORKERS` when it is set.
- When you call `bun test` yourself, pass `--randomize`, as rig does. Pass `--no-isolate` with every
  `--parallel=<N>`. `--parallel` implies `--isolate`, which runs each test file in a fresh global
  object. With isolation on, the suite runs slower, and a leak between files never fails a test.
  With isolation off, the resets in the [test preload](./cleanup.md#the-test-preload) and
  `--randomize` make that leak fail a test.
- Never pass a bare `--parallel`, which starts one worker per core and takes memory the workers
  need.
- Name a resource that each worker keeps across its files, such as a database cloned from the
  per-run template, after the worker's process ID. In the helper that hands it out, open it when it
  exists and create it when it doesn't. Never drop it in `afterAll`, because that hook can run after
  every file. The cleanup at the start of the next run, in [Per-run templates](#per-run-templates),
  removes it.
