# Dependency exceptions

Add an exception only for a reason you give in the pull request, such as a fix the repo needs. For a
fix to an advisory that `bun audit` reports, wait for the
[audit-fix workflow](https://github.com/zgeoff/tools/blob/main/docs/architecture/dependency-updates.md#the-audit-fix-workflow):
its pull request adds the exclude or the ignore for you.

In CI, `chex dependency-gates` fails on each exception that guards nothing, as
[Dependency exceptions](../SKILL.md#dependency-exceptions) lists. It also fails on a third-party
exclude without a removal comment in the form below.

## Release-age excludes

1. Add the package's name to `minimumReleaseAgeExcludes`, under `[install]` in `bunfig.toml`.
2. Lock the release with the fix. Follow the bullet for the package:
   - For a direct dependency, pin the release in the catalog of the root `package.json`. Then run
     `bun install`.
   - For a transitive dependency, when every range in `bun.lock` admits the release, run
     `bun update <package>`. Bun locks the newest release those ranges admit, and changes no
     `package.json`. Add no override. `chex dependency-gates` fails on an override that every range
     admits.
   - For a transitive dependency, when a range in `bun.lock` leaves out the release, add an
     [override](#overrides). Then run `bun install`.
3. Find the version that `bun.lock` now locks for the package. Check that it has npm provenance:

   ```bash
   npm view <package>@<version> dist.attestations.provenance
   ```

   When the command prints nothing, revert steps 1 and 2. Tell the user that the release has no
   provenance.

4. Copy the example comment to the line above `minimumReleaseAgeExcludes = [`, one line for each
   exclude. Change only the package, the locked version and the two dates. The audit-fix workflow
   matches the rest of the line character for character, and removes the exclude on the second date.
   - For the publish date, take the UTC day from `npm view <package> 'time[<version>]'`.
   - For the removal date, add `minimumReleaseAge`, in days, to the publish date.

   ```toml
   # @scope/example 2.4.1 (published 2026-10-30) ages past the gate ~2026-11-06 — remove then (audit-fix)
   ```

## Overrides

Pin one exact version in `overrides` in the root `package.json`. JSON takes no comments, so give the
reason in the pull request.

## Audit ignores

Let the audit-fix workflow add each ignore and set its expiry. It runs every day and after a failed
audit on `main`.

In a repo whose `.github/workflows/` has no audit-fix workflow, add the ignore by hand:

1. Add `--ignore <advisory-id>` to the `audit` script in the root `package.json`.
2. Add an entry under that ID in the root `audit-ignores.json`, with its `package`, `reason` and ISO
   `expires` date. Set the expiry 30 days ahead, the default that audit-fix uses.
