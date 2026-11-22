# Run times

Measure each median time that the ci-design skill uses, such as a job's time for its timeout, across
20 push runs on `main`. Take the newest runs that restored no `actions/cache` entry. A run that
restored a cache skips work, so its times come out short.

1. List the push runs on `main`. Ask for more than 20, because the next step skips some:

   ```bash
   gh run list --branch main --event push --limit 50 --json databaseId,createdAt
   ```

   Expect: a JSON list of runs, newest first, each with its `databaseId`.

2. Newest first, count the restored caches in each run's log:

   ```bash
   gh run view <run-id> --log | grep -c 'Cache restored from key'
   ```

   Expect: one number per run, `0` when the run restored no cache. Keep each run whose count is 0,
   and skip the rest. Stop once you keep 20 runs. When the list runs out first, run step 1 again
   with a larger `--limit`.

3. For each run you kept, run `gh run view <run-id> --json jobs`. Expect: each job and each of its
   steps with a `startedAt` and a `completedAt`. Take each job's time and each step's time as its
   `completedAt` minus its `startedAt`.
4. Take the median of each time across the 20 runs.
