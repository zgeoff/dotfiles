# NixOS testing

Put each kind of NixOS test in its own flake check, under the flake's `checks.<system>`: one for
option evaluation, one for each generated file, and one for each VM test. Then you can tell from a
failure which kind broke. Follow the [Principles](../SKILL.md#principles) of the testing skill. Skip
the parts that only Bun has:

- the `test()` syntax and its matchers;
- the test preload;
- the file layout.

The mistakes to avoid:

- Wait on a condition of the NixOS test driver, such as `wait_for_unit` or `wait_until_succeeds`, in
  place of the sleep that [System tests](./system-tests.md) rules out.
- Never let a case inherit tokens, files, mounts or service settings from an earlier case it doesn't
  depend on.
- Before you add a path filter to a workflow that holds a required check, read
  [Path filters](../../ci-design/SKILL.md#path-filters) in the ci-design skill.

## Option evaluation

Test module defaults, generated configuration and invalid option combinations by evaluating them,
with no VM.

- Set the options each case tests inside the case itself.
- Write each expected value by hand. Never compute it with the module's own code.
- Write each case as an attribute whose name starts with `test`, holding an `expr` and an
  `expected`. Nixpkgs' `lib.debug.runTests` runs only the attributes named `test…`, and returns a
  list of the cases that failed.
- Turn that list into a flake check that fails, such as a `runCommand` that throws when the list
  isn't empty.
- Use nix-unit instead when a case expects evaluation to throw, or when one case's error must not
  stop the others. Pin it as a flake input. On Lix, use its fork lix-unit, because nix-unit runs
  only on Nix.
- You may share a VM or module definition between cases. Evaluating it twice changes nothing.

## Generated files

Evaluation never runs a build, so a case can't read a generated file's contents. Read the file in a
check derivation that takes the file as an input, so Nix builds the file first.

## VM tests

Use a VM test, built with the NixOS test driver, for boot, systemd, kernel, networking and storage
behaviour. Each `with subtest("…"):` block in its `testScript` is one case. Name each one for the
behaviour it checks, such as `with subtest("api restarts after a config switch"):`.

- Run the steps that depend on each other, such as a `switch-to-configuration` and a check of the
  restarted service, in one subtest.
- Before a subtest that doesn't depend on the one before it, reset the machine to its starting
  state, or boot a fresh one. Give the reset its own subtest: dirty the state, run the reset and
  check the starting state.
- Share an expensive VM between subtests, as
  [End-to-end suites](./system-tests.md#end-to-end-suites) describes. You don't need a VM per
  subtest to keep them apart.
- Pass `timeout=` to each driver wait, such as `wait_for_unit` or `wait_until_succeeds`. The default
  is 15 minutes, so a hang holds the run that long.
- Run the real service, systemd and kernel in the guest. Never stub the thing under test. For
  timers, see
  [Native timers and scenario delays](./system-tests.md#native-timers-and-scenario-delays).
- Read each value with its own `machine.succeed` call, and compare it with the value you expect.
  Never check only that a command exited with 0.
- When a subtest expects a refusal, run the command with `machine.execute`, and check both its exit
  code and its output. `machine.fail` checks only that the exit code isn't 0.
- Check values with Python `assert`. The testing skill's bans on `describe` and on an `if` in a test
  body cover only Bun tests.
- The driver shuts down the VMs it starts. Wrap anything else the test script starts, such as a
  process on the host, in `try`/`finally`.
- You may use a fixed path inside a guest. For a resource that the whole host shares, see
  [Program-fixed paths and global resources](./system-tests.md#program-fixed-paths-and-global-resources).

## CI

- Build a flake check in CI by its name, with `nix build .#checks.<system>.<name>`.
- In a public repo, make the required GitHub check a job that runs on every pull request. Inside the
  job, pick which VM tests to build, such as from the changed paths, and fail the job when one of
  them fails. In a private repo, run VM tests on `schedule` or `workflow_dispatch`, and never make
  them a required check, as the [ci-design](../../ci-design/SKILL.md) skill says.
- Keep the build log of each VM test, from `nix log`, as a CI artifact. The driver writes how long
  each subtest took into the log.

For the APIs, see the [NixOS test manual](https://nixos.org/manual/nixos/stable/#sec-nixos-tests),
the [Nixpkgs test helpers](https://nixos.org/manual/nixpkgs/stable/#sec-lib-debug) and
[nix-unit](https://nix-community.github.io/nix-unit/).
