# Workflow testing

Test a GitHub Actions step by running the script that holds its logic. Keep GitHub's behaviour and
the layout of the YAML out of your tests, because a test of either fails on a change that breaks
nothing:

- Never pull a step's `run:` text out of the YAML and run it.
- Never snapshot the ordered list of a workflow's jobs or a job's steps.
- Never write your own version of the scheduler, the triggers or the `if:` evaluation in a test.
  That logic is GitHub's, and your version checks only itself.

## Test the step through its script

When a step's `run:` line holds more than one plain command, such as an `if`, a loop, `&&`, `||`,
`;`, a pipe or a `${{ }}`, move the logic into a TypeScript script. Put the script in a folder of
`scripts/` named for its job, such as `scripts/release/tag-release.ts`, and the test beside it. The
Step scripts section of the ci-design skill has the rest of the rules for the script.

In the test, spawn the script with `Bun.$`, as in `` $`bun ${scriptPath} ${version}` ``, and pass it
what a real run gives it:

- the arguments its `run:` line passes;
- the values the step sets in `env:`;
- each GitHub variable the script reads, such as `GITHUB_REF_NAME`.

When the script writes to `$GITHUB_OUTPUT`, set `GITHUB_OUTPUT` to a file in the test's temp
directory, and read the file back.

A step whose only key is `uses:` runs someone else's action. Write no test for it.

## Config files and workflow files

Check the contents of a config file, such as `package.json`, in a script that CI runs as a check,
never in a test file. A workflow file is the one exception: read it in a test only to check it
against data the repo keeps elsewhere, such as a CI matrix against the list of suites that a script
defines. A change to one side then fails the test until the other side matches. Parse the file with
`Bun.YAML.parse`, and assert with `toMatchObject` on the path to the value you check, so the test
holds no other job or key.

A made-up repo lists its end-to-end suites in `scripts/e2e-suites.ts` and runs one matrix job per
suite:

```ts
// scripts/e2e-suites.test.ts
import { expect, test } from 'bun:test';
import { suites } from './e2e-suites.ts';

test('it runs one e2e matrix job for each suite the e2e runner defines', async () => {
  const text = await Bun.file(new URL('../.github/workflows/ci.yml', import.meta.url)).text();
  const workflow: unknown = Bun.YAML.parse(text);

  expect(workflow).toMatchObject({
    jobs: { e2e: { strategy: { matrix: { suite: suites.map((suite) => suite.name) } } } },
  });
});
```

Never test a rule that every zgeoff repo follows, such as `timeout-minutes` on each job or
`cancel-in-progress` on a concurrency group. `bun x @zgeoff/chex workflows` checks those rules in
every repo. When you find a rule of that kind that the check misses, tell the user; the check lives
in zgeoff/tools.
