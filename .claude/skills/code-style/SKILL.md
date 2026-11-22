---
name: code-style
description:
  "Code style for zgeoff TypeScript repos: file layout, names, state, unions, types, structure,
  errors, comments, and the function-name verb table. Load it before you write, review or rename
  TypeScript. Load the repo's project-code-style skill beside it, for that repo's stricter rules and
  its departures."
metadata:
  kind: rule-set
---

# Code style

## References

- [State, waiting and processes](./references/state-and-processes.md): code that saves or sends a
  status, keeps states in a long-lived object, waits, locks a file, or sends data to another process
  or package.

## Files and modules

- Give each file one main export, and name the file after it: `parse-cli-args.ts` exports
  `parseCLIArgs`. `index.ts`, `types.ts` and `constants.ts` are exempt from both. When a file has
  only a side effect, name it for what it does: `augment-bun-test.ts`.
- Order a file as imports, the main export, then its helpers in the order it calls them. Put each
  type or constant just above its first use: the main export's types and constants go between the
  imports and the main export.
- When two or more non-test files use a type, put it in `types.ts` in the nearest folder that holds
  them all. Create that `types.ts` when the folder has none. Keep a type that one file uses in that
  file.
- Make objects with factory functions. Write a class only for a custom error:
  `class QuotaError extends Error`.

## Names

- Write an acronym in capitals: `parseCLIArgs`, `userID`, `packageURL`. At the start of a camelCase
  name, write it in lowercase: `cliPath`, `idToken`.
- Name a value for what it holds, in full words: `session`, not `s`; `manager`, not `mgr`.
- Use a short name only from this list:
  - `x` and `y` for coordinates, `z` for zod, `$` for Bun's shell, `_` for an unused value;
  - `ctx`, `id`, `db`, `args`, `params`, `repo` and `info`.
- End a name with its unit, timestamps too: `dueAtMs`, never `ms`.

## Unions

- Branch on a union with `match(value)…exhaustive()` from `ts-pattern`, never `switch`, so a new
  member fails the type check.
- End with `.otherwise()` only for an open value, such as a string from outside the program.
- When a match covers a fixed list of kinds, such as an SDK's event kinds, name only the kinds the
  code handles, and send every other kind to one `.otherwise()` that does nothing.

## Types

- Use a type guard, an annotation, `satisfies` or a schema parse in place of a type assertion,
  except `as const`.
- When none of those works, get the maintainer's approval in the PR, and add a lint disable comment
  that gives the reason. In review, flag every new assertion.
- Never let `any` reach a typed value. Make it `unknown` and narrow it, or parse it. `JSON.parse`
  returns `any`.

## Structure

- Split in two a function that reads, branches on what it read, then writes, removes or runs
  something:
  - Make a pure function that takes the values read and returns what to do. Give it a verb from a
    no-I/O row of the [verb table](#function-names), such as `collect` or `pick`, so the
    [`zgeoff/verb-contract`](https://github.com/zgeoff/tools/blob/main/docs/architecture/oxlint-config-code-style.md)
    lint rule keeps I/O out of it;
  - Make a thin function that does the reads, calls the pure one, and acts on its result. Give it
    the I/O verb that fits, such as `run`, `write` or `remove`, and no decision of its own.
- Write and test the pure function before the thin one, with one `test.each` row of plain data per
  edge case. In one combined function, each case needs a stand-in for every read and write, so edges
  go untested.
- Reach I/O through dependencies the caller passes in. Create real clients only in the entry point.
  For a file lock, import `withFileLock` directly, as
  [File locks](./references/state-and-processes.md#file-locks) says.
- Never write a wrapper that only passes its arguments on.
- Never add an option, parameter or extension point before a caller uses it.

```ts
export async function runReminders(dependencies: ReminderDependencies): Promise<void> {
  const tasks = await dependencies.db.readOpenTasks();

  for (const task of collectDueReminders(tasks, dependencies.clock.now())) {
    await dependencies.mail.writeReminder(task.owner, task.id);
  }
}

export function collectDueReminders(tasks: readonly Task[], nowMs: number): Task[] {
  return tasks.filter((task) => task.dueAtMs < nowMs && task.remindedAtMs === null);
}
```

## Errors and logs

- Return an expected outcome, such as a miss or bad input from outside, as a value of the return
  type. Throw only what the caller can't plan for.
- Never recheck what the value's source guarantees, such as a field its schema requires, its type,
  or a library's documented behaviour.
- Call `invariant()` from `tiny-invariant` on a state that only a bug can reach.
- Log failures, state changes and slow calls. A call to the network, a database, a disk or a
  subprocess is slow past its latency target, or past 1 second without one. Log a slow call's
  duration and what it called.
- In per-request or per-item code, put the request or item ID in each log line. Never log a call
  there that succeeds, isn't slow and changes no state.

## Comments

- Write a `//` comment only to give a lint disable's reason, or to say why the obvious alternative
  is wrong when the cause sits outside the file: a library bug, a runtime quirk, a measured number.
  Put it beside the code it explains, in three lines at most.
- Never restate what the code or a test shows.
- Never write history or project state in a comment, such as "previously", an issue number or "not
  wired yet". Put it in the commit.
- Put what callers rely on in a test name, such as `it returns null for an unknown ID`. When code in
  another package depends on an invariant of yours, also state it in the doc under `docs/` for that
  part of the system.
- Don't name another declaration in a comment. State the fact, so a rename can't leave it stale.

## One-off codemods

- Put a one-off codemod in the PR description, in a `<details>` block with the command that ran it,
  never in the repo.

## Function names

When a function's job has a row, start its name with that row's verb, and keep the row's guarantee.
Give any other function any verb that fits, except the banned verbs below.

| Job                                                                                                       | Verb                         | Guarantee                                                                      |
| --------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| boolean answer                                                                                            | `is`, `has`, `can`, `should` | returns a boolean; no I/O                                                      |
| boolean answer that needs I/O                                                                             | `probe`                      | returns a boolean; may do I/O                                                  |
| value from arguments, test data factories included                                                        | `build`                      | no I/O                                                                         |
| text or raw input → structure                                                                             | `parse`                      | no I/O                                                                         |
| value → text or markup                                                                                    | `format`, `render`           | no I/O                                                                         |
| choice among known alternatives                                                                           | `pick`                       | no I/O                                                                         |
| lookup that can miss                                                                                      | `find`                       | no I/O; can return null or undefined                                           |
| lookup that can't miss                                                                                    | `get`                        | no I/O; never returns null or undefined                                        |
| many values gathered from a traversal                                                                     | `collect`                    | no I/O                                                                         |
| cheap change of representation                                                                            | `to`                         | no I/O                                                                         |
| content in from outside the process                                                                       | `read`                       | may do I/O                                                                     |
| content out to outside the process                                                                        | `write`                      | may do I/O                                                                     |
| subprocess or task                                                                                        | `run`                        | may do I/O                                                                     |
| resource brought into existence                                                                           | `create`                     | may do I/O                                                                     |
| resource taken away                                                                                       | `remove`                     | may do I/O                                                                     |
| function that returns a function                                                                          | `make`                       | returns a function                                                             |
| higher-order wrapper                                                                                      | `with`                       | runs a callback inside a context                                               |
| React hook                                                                                                | `use`                        | follows the rules of hooks                                                     |
| prop or parameter that takes an event callback                                                            | `on`                         | follows the framework's callback convention                                    |
| function passed to an `on` prop, or a function that handles a framework lifecycle event such as a request | `handle`                     | follows the framework's callback convention                                    |
| a test file's per-test fixture                                                                            | `setupTest`                  | as the testing skill's [setupTest](../testing/SKILL.md#setuptest) section says |
| stored state put in place for a test, through the production module when the module can make that state   | `seed`                       | may do I/O; test code only ([seeding rules](../testing/references/seeding.md)) |

- Keep a pure function pure all the way down: a `build` that calls a `read` does I/O. The
  [`zgeoff/verb-contract`](https://github.com/zgeoff/tools/blob/main/docs/architecture/oxlint-config-code-style.md)
  rule in `@zgeoff/oxlint-config` checks the verbs, but it can't see I/O inside an npm package or
  behind a helper whose name hides it. Check those by hand.
- Start a boolean function with `is`, `has`, `can` or `should` even when another verb reads well,
  except:
  - Use `probe` when it needs I/O;
  - Keep the I/O verb when it returns a success flag, such as `removeFile`;
  - Keep a leading `use`, `on` or `handle`.
- Never use `make`, `with`, `use`, `on` or `to` as a whole name. Follow it with a noun, such as
  `toPosixPath`.
- You may start a name with `resolve` in place of a row's verb, whether or not it does I/O.
- Never start a name with one of these verbs. They say nothing about I/O or a miss:
  - `process`, `manage`, `do`, `perform`, `execute` or `compute`;
  - `fetch`, `save`, `store`, `delete`, `search` or `lookup`. For a database read that can miss, use
    `read` and return `null`;
  - `handle`, outside a callback.
