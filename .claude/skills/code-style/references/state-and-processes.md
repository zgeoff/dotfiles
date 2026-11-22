# State, waiting and processes

When you save or send a status, wait, lock a file, or send data to another process or package, use
the tool or pattern in its section below. Write your own only in a case that section lists.

## State

- When a status is saved outside the process or sent to another process, write a transition table
  for it: its states, the moves allowed between them, and one function that checks a move. Keep all
  three in the only module that writes the status.
- Build a long-lived object whose states live only in memory, such as a reconnecting client, as an
  xstate machine.

## Waiting

- Sleep with `Bun.sleep` in Bun-only code, and with `setTimeout` from `node:timers/promises` in code
  that ships to Node.
- Wait for one event with `events.once`. Make a promise with `Promise.withResolvers()` when code
  outside its executor settles it.
- Write `new Promise` by hand only when none of these fits.

## File locks

- Lock a file across processes with `withFileLock` from `@zgeoff/std/with-file-lock`. Read, decide
  and write in its callback. The lock then spans all three.
- When you need a lock `withFileLock` can't give, such as a shared read lock, write your own, and
  name the need in a comment.
- Import `withFileLock` directly in the thin function that [Structure](../SKILL.md#structure)
  describes, the one that calls the pure function and acts on its result. Pass every other piece of
  I/O into that function from its caller as dependencies, and do the reads and writes through them.

## Data between processes and packages

- Send data between processes or packages through a typed interface the repo already has, such as
  its RPC layer, a shared schema or its CLI parser. Never match a route, parse a body or read
  arguments by hand.
