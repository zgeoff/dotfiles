# Schemas and access rules

## Schemas and parsers

Test through the parser's method that returns a result, such as Zod's `safeParse`, in place of the
method that throws, such as `parse`. The result holds every issue, so you can assert the issue path
and the output. The examples use Zod's `{ success, data, error }`. Map them onto the result shape of
your parser.

- Write each payload as a literal in the test. With a factory's defaults, the reader can't see which
  field the test checks.
- Build each rejected payload from the valid literal, with one field changed or removed. Then that
  one field is the only reason the payload can fail.
- Assert a rejection's issue path:
  `expect(result.error?.issues).toPartiallyContain({ path: ['title'] })`. Never assert `issues[0]`,
  because the order of the issues changes with the schema. Never assert a bare `success: false`,
  because it passes for any rejection.
- Assert an accepted payload's `result.data` with `toStrictEqual` against a literal of the output
  you expect. Then a trim, a coercion or a default shows in the test.

## Access rules

- Write one test for each kind of caller the rule allows, such as an admin and a team editor, and
  assert that the call succeeds. When someone deletes the check for that kind, the test fails.
- Write one test for each condition joined by `&&`. Give it a caller who fails only that condition
  and is no other allowed kind, and assert that the rule refuses the caller. For
  `admin || (editor && sameTeam)`, use an editor of another team, and a non-editor on the team,
  neither of them an admin. When someone deletes that condition, its test fails.
- Name the caller in the title, such as `it refuses an editor of another team`.
- When the rule refuses with a thrown error, assert it as [Errors](../SKILL.md#errors) says. When it
  returns the refusal, assert its code or status, such as `toBe(403)`.
- When the rule hides a record from a read, assert the refused caller's empty result in place of a
  code or status, such as `toBeNull()` or `toStrictEqual([])`.
