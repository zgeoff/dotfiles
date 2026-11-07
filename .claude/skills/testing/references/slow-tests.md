# Slow tests and lanes

Keep each test in the unit run under 5 s on CI, and each test in another lane under that lane's
limit in [Lanes](#lanes). You pay for a slow test again in every later run. Never raise the timeout
or add a sleep to hide that cost. Two oxlint rules from `@zgeoff/oxlint-config` enforce this:
`zgeoff/max-test-timeout` refuses a timeout above the limit of the file's lane, and
`zgeoff/no-test-sleep` refuses a fixed sleep.

When a test is slow, find its cause in [Causes and fixes](#causes-and-fixes) and make that fix.
Raise a timeout only as [A test over its limit](#a-test-over-its-limit) allows, and never move a
test to a lane only because it is slow.

- [Causes and fixes](#causes-and-fixes)
- [A real system in the unit run](#a-real-system-in-the-unit-run)
- [Per-run templates](#per-run-templates)
- [Lanes](#lanes)
- [A test over its limit](#a-test-over-its-limit)
- [The run mode and workers](#the-run-mode-and-workers)

## Causes and fixes

| The test                                                                       | The cause                     | The fix                                         |
| ------------------------------------------------------------------------------ | ----------------------------- | ----------------------------------------------- |
| starts the app, a server or a CLI to call it                                   | a real process start          | Call the code in the test process.              |
| waits for a deadline, an idle limit or a retry delay that the repo's code sets | a real timer                  | Make the delay an option, and pass a short one. |
| sleeps to let something settle                                                 | no signal to wait on          | Wait on a condition with `waitFor`.             |
| proves that something does not happen                                          | it waits out a timeout        | Wait for a later event.                         |
| migrates a database or builds a bundle                                         | a fixture built in each test  | Use a [per-run template](#per-run-templates).   |
| drives a program the repo starts, such as a VM guest agent or a worker         | a real process start          | Use a stateful stand-in for the program.        |
| runs a linter or checker binary over text the code builds                      | a real process start          | Check the text with a script in `scripts/`.     |
| needs a real system that the unit run can't host                               | a VM, the kernel or a browser | Put it in a [lane](#lanes).                     |

Each fix in more detail:

- To call the code in the test process, call its handler, its main function with a test argv, an
  in-memory RPC link or an injected transport. Start a real process only in `e2e/`, through
  `@zgeoff/testing`, as [Where a test lives](../SKILL.md#where-a-test-lives) says.

  Two kinds of test are the exception. Each sits in the file beside its script, starts the script
  itself, and runs in the unit run within the unit limit:
  - the test of a shell script;
  - the test of a TypeScript script that a CI step runs.

- To shorten a timer that the repo's code sets, make the delay an option of the code that sets it,
  pass a short one, and wait on the event the delay causes. For a timer inside Bun, Node or the
  kernel, which the repo's code can't set, follow
  [Native timers and scenario delays](./system-tests.md#native-timers-and-scenario-delays). When
  that test is still over its limit, keep it in the unit run, with the disable comment from
  [A test over its limit](#a-test-over-its-limit).
- When the code has nothing to wait on, add an event, a log marker or a state flag, and wait on
  that.
- To prove that something does not happen, wait for an event that comes only after it could have
  happened, such as the reply to a second request sent after the first.
- Look for a stateful stand-in in `src/test-utils/` and in the repo's project-testing skill, when
  the repo has one. When none exists, write one, as
  [Stateful stand-ins](./system-tests.md#stateful-stand-ins) describes.
- To check text that a linter or a checker reads, such as a generated shell script, export the
  function that builds the text. Write a script in `scripts/` that calls the function and runs the
  binary on its output, and run the script in CI and in the pre-push hook. Never run the binary in a
  test.

Measure a test's time on CI, because a host that swaps memory or shares its cores runs the same test
slower. The pre-push hook runs only the unit tests beside the files a branch changes, and the other
lanes run only in CI: see the
[pre-push baseline](https://github.com/zgeoff/tools/blob/main/docs/architecture/pre-push-baseline.md#the-related-tests).

## A real system in the unit run

Run a real system in the unit run when it starts in milliseconds and gives each test its own copy,
such as an in-memory store, a database template copied per test, or a stateful stand-in. Put a test
in a lane when it needs one of these:

- a real system that the unit run can't host, such as a VM, the kernel or root, a browser, a
  container image, the Agent SDK subprocess or a live API;
- the product's own process, to test its start-up, signals or exit codes.

## Per-run templates

When a fixture costs more to build than a test costs to run, such as a migrated database or a built
bundle, build it once per run as a template. Copy it in each test that writes to it, and read it in
place in each test that only reads it.

- Build it in the first worker that needs it. Take a lock first by creating a lock file with the
  `wx` flag, which fails when the file exists. Build into a temporary name, and rename it into place
  when it is done. The other workers wait until the template appears.
- Never keep it in a module-level variable. Each worker would build it again, and the workers race
  on one output folder.
- Put a hash of its inputs, such as the migration files, in its name. Then the run builds a new
  template when an input changes, and reuses the last one otherwise.
- Keep it in a git-ignored folder inside the repo, such as `node_modules/.cache/`, never in `/tmp`.
  `/tmp` is tmpfs on many hosts, so it holds every file in RAM.
- At the start of each run, remove the folders, clones and old templates that earlier runs left, as
  [Leftovers of a killed run](./cleanup.md#leftovers-of-a-killed-run) describes. Never remove the
  template for the current hash, because a run that is still going may be copying it.

For each engine's template, see the Postgres isolation and SQLite isolation sections of
[Database testing](./database.md).

## Lanes

Put each test that needs a real system in a lane. Mark each file with the lane's suffix, or put it
in `e2e/` for the e2e lane. Run the lane with its own `test:<lane>` script, and give its tests the
lane's per-test limit. The unit run is the `unit` lane in the table below, and it leaves out the
files of every other lane, as does the pre-push hook.

[`@zgeoff/rig`](https://github.com/zgeoff/tools/tree/main/packages/rig) runs the lanes. `rig init`
writes the `test:<lane>` scripts, and `rig unit` leaves out every lane's files. Declare each lane
the repo adds in `rig.config.ts`, with its suffix and limit. The repo's lint rules read each lane's
limit from there.

Put a lane's harness, such as the code that starts the browser, in a package with its own tests.

For the CI job that runs each lane, see the ci-design skill. For when the `model-api` lane runs, see
its bullet below.

| Lane      | Where                                         | Limit | The real system                                                  |
| --------- | --------------------------------------------- | ----- | ---------------------------------------------------------------- |
| unit      | every other test file                         | 5 s   | none: code in process, per-run templates, and stateful stand-ins |
| e2e       | `e2e/` in the package that builds the program | 15 s  | the program, run as a process and driven from outside            |
| browser   | `<name>.browser.test.ts`                      | 10 s  | a real browser                                                   |
| docker    | `<name>.docker.test.ts`                       | 15 s  | a container engine                                               |
| host      | `<name>.host.test.ts`                         | 15 s  | the host kernel, root, or the network stack                      |
| agent-sdk | `<name>.agent-sdk.test.ts`                    | 5 s   | the Claude Agent SDK subprocess, against a scripted model        |
| model-api | `<name>.model-api.test.ts`                    | 120 s | a live model API                                                 |

- Run a file with a lane's suffix only in that lane, wherever it sits, `e2e/` included. A test in
  `e2e/` with a made-up `.kvm` suffix runs in the `kvm` lane, and the e2e lane skips it.
- In an `agent-sdk` test, never call the live API. Start a scripted model: a local server that
  answers the model API with the replies the test queues. Point the SDK at it with
  `ANTHROPIC_BASE_URL` in the SDK's `env` option.
- Run the `model-api` lane nightly, on `workflow_dispatch`, and on a pull request that bumps the
  Agent SDK. Never run it on every pull request.
- Give each test that calls a live model the `.model-api` suffix, wherever it lives.
- Give a test that calls another live API its own lane, with a suffix named for that API, such as a
  made-up `.payments`.
- Name one real system in a suffix, never a speed. Prefer a specific suffix to the generic `.host`,
  such as a made-up `.kvm` for a test that boots a VM.
- Add a lane of the repo's own only for a real system from the list in
  [A real system in the unit run](#a-real-system-in-the-unit-run). List the lane, with its real
  system and its limit, in the Facts table of the repo's project-testing skill. Declare it in
  `rig.config.ts`, as above, and put the measured test times in the pull request that adds it.

Run a Rust crate's lanes through cargo-nextest, as [Rust lanes](./system-tests.md#rust-lanes)
describes.

## A test over its limit

When a test is slow and [Causes and fixes](#causes-and-fixes) has a fix for it, make the fix in the
pull request where you find the test slow, even when your change doesn't touch its file. Never leave
it for a ticket.

When a test still can't finish within its lane's limit, give it a disable comment with the time it
takes on CI and one of these reasons:

- the ticket that tracks the fix, when the fix can't land in this pull request, such as a fix in
  another repo: `48 s on CI, OPS-212`;
- `floor:` and the evidence that the time can't drop:
  `48 s on CI; floor: two VM boots plus a restic restore`.

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

The rule reports on the line of the timeout value, so put the comment on the line before the options
object. Pass the options object after the callback, because Bun's types accept no other order. The
formatter puts each argument on its own line, so the comment stays next to the object.

`zgeoff/test-timeout-exception-ticket` fails a disable of `zgeoff/max-test-timeout` whose reason
after `--` holds neither a ticket nor `floor:` with text. The `test-timeouts` check of
[`@zgeoff/chex`](https://github.com/zgeoff/tools/tree/main/packages/chex) fails an oxlint config
that turns `zgeoff/max-test-timeout` or `zgeoff/test-timeout-exception-ticket` off or down to a
warning, unless a comment on that setting holds a ticket or `floor:`.

## The run mode and workers

- Pass `--no-isolate` with every `--parallel=<N>`. `--parallel` implies `--isolate`, which runs each
  test file in a fresh global object. With isolation on, the suite runs slower, and a leak between
  files never fails a test. With isolation off, the resets in the test preload and `--randomize`
  make that leak fail a test.
- Run the unit tests with `rig unit --no-isolate`. rig sets `--parallel` from the host's cores and
  memory, and `TEST_WORKERS` overrides the count. Never pass a bare `--parallel`, which starts one
  worker per core and takes memory the workers need.
- Name a resource that each worker keeps across its files, such as a database cloned from the
  per-run template, after the worker's process ID. In the helper that hands it out, open it when it
  exists and create it when it doesn't. Never drop it in `afterAll`, because that hook can run after
  every file. The cleanup at the start of the next run, in [Per-run templates](#per-run-templates),
  removes it.
