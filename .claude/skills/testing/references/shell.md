# Shell script testing

Test a shell script with a `<script>.test.ts` file beside it, which runs the real script through
Bun's `$` shell. Check the script with ShellCheck. Never write a bats or ShellSpec suite, or a
hand-written runner, such as a `test-*.sh` file that runs cases and counts failures. With a
`bun:test` file, every rule in [SKILL.md](../SKILL.md) covers the shell script too, and the repo
needs no second test tool.

In `$`, `.env()` replaces the whole environment, and the output comes back as buffers.

## Running the script

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
  Make `dir` with `mkdtemp`, and remove it in `onTestFinished`, as [Cleanup](../SKILL.md#cleanup)
  shows.
- When you set the environment with `.env({ … })`, spread `process.env` into it. Without it, the
  script loses `PATH` and can't find `bash`, `git` or any other program.
- Feed standard input with a redirect from a `Response`: `new Response(text)` for text, or
  `Response.json(value)` for JSON, as in `` $`bash ${scriptPath} < ${new Response(text)}` ``.
- Run a setup command, such as `git init`, through `$` without `.nothrow()`. Then the test throws at
  the setup step that fails, and the failure never shows up later as a wrong result.

Read `stdout` and `stderr` with `.toString()` before a string matcher, because both are buffers.

## Programs the script calls

When the script calls a program that the test can't run, such as `gh` against GitHub, stub it:

1. Write an executable file with the program's name into a temp folder. Start it with a
   `#!/usr/bin/env bash` line.
2. `chmod` it to `0o755`.
3. Make it print the fixed answer the test needs. When the stub must answer differently for each
   argument, or record its calls, follow [Test data](../SKILL.md#test-data).
4. Put that folder first on `PATH` in `.env()`.

When the script waits, such as between polls, make it read the wait from an environment variable,
with the real wait as the default. In the test, set the variable to `0`, so the test never waits in
real time.

## ShellCheck

Fix each ShellCheck finding in the script. Disable one only when the fix would change what the
script does. Name its code and give the reason on the same line, as in
`# shellcheck disable=SC2053 # the pattern is a glob on purpose`.

When the repo calls `bun-checks.yml` from zgeoff/tools, CI runs ShellCheck and shfmt over every
`.sh` file that git tracks. The synced pre-push hook runs both over the `.sh` files a branch
changes. To check one script sooner, run `shellcheck <script>`.

## Example

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
