# Shell script testing

Write a stand-in for each program or server that the script calls and the test can't use, such as a
fake `gh` on `PATH` or a stub webhook.

Test a shell script with bats when any of these holds:

- the repo already has bats, with `bats` in its dev dependencies;
- the repo has tests for 5 shell scripts or more, before you add yours;
- your tests and the repo's other shell tests share a stand-in written in shell, such as a stub
  server.

Then write a `<script>.bats` file beside the script, as [bats suites](#bats-suites) says. Otherwise,
write a `<script>.test.ts` file beside it, which runs the real script through Bun's `$` shell, as
[Bun's $ shell](#buns--shell) says. When you add bats to a repo, leave its `$` tests as they are,
and write each new test in bats. The rules in [SKILL.md](../SKILL.md) cover bats tests and `$` tests
alike.

Never write a ShellSpec suite, or a hand-written runner: a `test-*.sh` file that runs cases and
counts failures itself. bats already runs the cases, times them out and reports each failure. Check
every script with [ShellCheck](#shellcheck), whichever tool tests it.

## bats suites

### Set up bats

1. Add `bats`, `bats-support` and `bats-assert` from npm as exact-pinned dev dependencies. Never add
   `bats-file` from npm: that name holds a security placeholder, not the library. Check a file with
   `assert [ -f <path> ]`.
2. Add a run script, such as `run-bats.sh` in `scripts/`, and point the repo's test script at it. It
   calls `node_modules/.bin/bats`, so CI and a laptop run the same version. It sets `BATS_LIB_PATH`
   to the root `node_modules`, and passes `--timing` and `--print-output-on-failure`, so a failed
   test shows what the command printed. It lists the `.bats` files that git tracks and passes them
   to bats. It takes an optional group as its first argument and passes it on as
   `--filter-tags suite:<group>`, as [Write each test](#write-each-test) says.
3. Add a `setup.bash` in a `bats/` folder beside the repo's other test utils. It holds what every
   file shares:
   - `bats_require_minimum_version 1.5.0`, which `run -<status>` needs. bats then warns about a
     `run` that checks no exit code.
   - `bats_load_library bats-support` and `bats_load_library bats-assert`, which find the libraries
     through `BATS_LIB_PATH`.
   - `export BATS_TEST_TIMEOUT="${BATS_TEST_TIMEOUT:-30}"`, a 30-second default.
   - The function in [Stop the timeout watchdog](#stop-the-timeout-watchdog).
4. Have every file load `setup.bash` from both `setup_file` and `setup`, with a path relative to
   `$BATS_TEST_DIRNAME`. bats reads the timeout before a test's `setup` runs, so only `setup_file`
   can set the default. A function that `setup_file` loads never reaches the tests, so `setup` loads
   the libraries again.

In a NixOS VM test, get bats from nixpkgs as
`bats.withLibraries (p: [ p.bats-support p.bats-assert ])`.

### Stop the timeout watchdog

When a test fails, bats 1.13 leaves its timeout watchdog running until the timeout passes, and the
run waits for it. Give `setup.bash` a function that stops the watchdog, and call it first in every
`teardown`. Add a `teardown` to a file that has none.

The watchdog is a child process of the test's shell, `$$`, and it runs `sleep $BATS_TEST_TIMEOUT` as
its own child. List the children of `$$` with `ps -o pid= --ppid $$`. Kill each one that has that
`sleep` as a child.

After a bats upgrade, fail a test with a 30-second timeout and time the run, to check whether the
new version still needs this.

### Write each test

- Check the exit code in `run` itself, as in `run -0 …` or `run -28 curl …`, or with
  `assert_success` and `assert_failure <code>`.
- Use `run !` or `refute` for a command that must fail. Bash ignores a bare `! cmd` under `set -e`,
  so it never fails the test.
- Wrap a pipe in a function or `bash -c` before `run`. `run a | b` pipes the output of `run`.
- Start each background process, such as a stand-in server, with `3>&-`. Without it, bats waits for
  the process at the end of the run.
- Write per-test files in `$BATS_TEST_TMPDIR`. bats removes it.
- When a file's tests need more than the default time, set `BATS_TEST_TIMEOUT` at the top of the
  file. Never wrap a command in `timeout` to cap a test: `timeout` ends only the command, and the
  test goes on.
- Pass `--separate-stderr` to `run` when the test checks stderr apart from stdout.
- Keep each stand-in server as a shell function in the `bats/` test utils folder, and `load` it.
  Stop it in `teardown`, after the watchdog.
- Write each stand-in program as an executable shell file with the program's name, in a folder under
  `$BATS_TEST_TMPDIR`. Make it append its arguments to a log file in that folder and print the
  answer the test needs. Put the folder first on `PATH` with `export`, and assert the log.

Sort the files into groups, one per CI job, so a job that needs Docker runs only the files that need
it. Tag each file with its group on the line after the shebang, as in
`# bats file_tags=suite:<group>`, and give a new file the repo's default group unless it needs what
another group's job provides. The run script takes the group and passes
`--filter-tags suite:<group>`. Tag every file: a run that filters by tag skips a file with no tag.

## Bun's $ shell

### Running the script

Add `@zgeoff/testing` to the repo's dev dependencies if it isn't there. Make the temp folders and
the stand-ins below with its `fs` and `bin` subpaths.

Call the script through `$` this way:

- Name the interpreter from the script's shebang, then the script's path, as in
  `` $`bash ${scriptPath} ${version}` ``, so the test doesn't depend on the file's execute bit.
  Build the path with `join(import.meta.dir, '<script>.sh')`.
- Pass each argument as an interpolated value. Bun escapes it, so a value with a space, a `;`, or a
  `$` reaches the script as one argument, and an array becomes one argument per element.
- Never build the command line as a string. Never interpolate `{ raw: … }` either: Bun passes its
  text unescaped.
- Chain `.nothrow()`, so a nonzero exit returns its result instead of throwing. Chain `.quiet()`, so
  the script's output stays out of the test run's output.
- When the script reads or writes files, or runs `git`, set its working directory with `.cwd(dir)`.
  Make `dir` with `createTempDir` from `@zgeoff/testing/fs`, which removes it after the test.
- When you set the environment with `.env({ … })`, spread `process.env` into it. `.env()` replaces
  the whole environment, so without it the script loses `PATH` and can't find `bash`, `git` or any
  other program.
- Feed standard input with a redirect from a `Response`: `new Response(text)` for text, or
  `Response.json(value)` for JSON, as in `` $`bash ${scriptPath} < ${new Response(text)}` ``.
- Run a setup command, such as `git init`, through `$` without `.nothrow()`. Then the test throws at
  the setup step that fails, and the failure never shows up later as a wrong result.

Read `stdout` and `stderr` with `.toString()` before a string matcher. `$` returns both as buffers.

### Programs the script calls

When the script calls a program that the test can't run, such as `gh` against GitHub, write a
stand-in for it with `createStubBin` from `@zgeoff/testing/bin`.

1. Make a folder for the stand-ins with `createTempDir`.
2. Call `createStubBin(folder, '<program>', { answers })`, with one answer for each call the test
   expects, such as `{ args: ['pr', 'view'], stdout: '{"number":7}\n' }`. An answer matches a call
   whose arguments start with its `args`, and can also set `exitCode` and `stderr`. The first unused
   answer that matches answers each call, and the last one answers again once all are used. A call
   that no answer matches exits 97.
3. Put the folder first on `PATH` in `.env()`.
4. Read the calls the script made with the stand-in's `readCalls()`, and assert their `argv`, which
   holds the arguments without the program's name.

When the stand-in must run its own logic, pass `{ script }` in place of `answers`, with the
stand-in's own shell script.

When the script waits, such as between polls, make it read the wait from an environment variable,
with the real wait as the default. In the test, set the variable to `0`, so the test never waits in
real time.

### A test of an exit code

A made-up `tag-release.sh` takes a version and exits 2 on one that is not a version. In the test
below, an argument with a space stays one argument, `.nothrow()` keeps the exit code, and
`.toString()` reads the output. Follow [Assertions](../SKILL.md#assertions) for the rest.

```ts
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { $ } from 'bun';

test('it refuses a version with a space in it', async () => {
  const result = await $`bash ${join(import.meta.dir, 'tag-release.sh')} ${'1.2 beta'}`
    .nothrow()
    .quiet();

  expect({
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }).toStrictEqual({
    exitCode: 2,
    stdout: '',
    stderr: "tag-release: '1.2 beta' is not a version\n",
  });
});
```

## ShellCheck

Fix each ShellCheck finding in the script. Disable one only when the fix would change what the
script does. Name its code and give the reason on the same line, as in
`# shellcheck disable=SC2053 # the pattern is a glob on purpose`.

When the repo calls `bun-checks.yml` from zgeoff/tools, CI runs ShellCheck and shfmt over every
`.sh` file that git tracks. The pre-push hook that zgeoff/tools syncs into the repo runs both over
the `.sh` files a branch changes. To check one script sooner, run `shellcheck <script>`.
