# Run times

Measure each median time that the ci-design skill uses from the 20 latest push runs on `main` that
restored no `actions/cache` entry.

1. List the push runs on `main`. Ask for more than 20, because the next step skips some:

   ```bash
   gh run list --branch main --event push --limit 50 --json databaseId,createdAt
   ```

   Expect: a JSON list of runs, newest first, each with its `databaseId`.

2. Newest first, count the restored caches in each run's log:

   ```bash
   gh run view <run-id> --log | grep -c 'Cache restored from key'
   ```

   Expect: one number per run, `0` when the run restored no cache. Skip each run whose count is
   above 0. Stop once 20 runs remain. When fewer than 20 remain, run step 1 again with a larger
   `--limit`.

3. Read each job's time and each step's time from the start and end times in
   `gh run view <run-id> --json jobs`. Expect: each job and each of its steps with a `startedAt` and
   a `completedAt`.
4. Take the median of each time across the 20 runs.
