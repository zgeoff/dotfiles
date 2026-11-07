import { expect, onTestFinished, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cliPath = join(import.meta.dir, '../home/dot_local/bin/executable_op-mint');

function setupTest() {
  const scratch = join(import.meta.dir, '../.scratch');
  mkdirSync(scratch, { recursive: true });
  const home = mkdtempSync(join(scratch, 'op-mint-test-'));
  onTestFinished(() => rmSync(home, { recursive: true, force: true }));
  const bin = join(home, 'bin');
  mkdirSync(bin);
  const calls = join(home, 'op-win-calls');
  // A stand-in for op-win: records its arguments and answers with an invented token.
  writeFileSync(join(bin, 'op-win'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${calls}'\nprintf '{"token":"kettle"}\\r\\n'\n`);
  chmodSync(join(bin, 'op-win'), 0o755);

  return {
    home,
    makeRepo: (name) => {
      const repo = join(home, 'projects', name);
      mkdirSync(repo, { recursive: true });
      Bun.spawnSync(['git', 'init', '-q', repo]);
      writeFileSync(join(repo, '.gitignore'), '.claude/settings.local.json\n');
      return repo;
    },
    mint: (...args) => {
      const result = Bun.spawnSync(['sh', cliPath, ...args], { env: { HOME: home, PATH: `${bin}:${process.env.PATH}` } });
      return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
    },
    readCalls: () => readFileSync(calls, 'utf8'),
  };
}

test('it mints the hq profile with read-only access to the fleet vault, into the hq settings file', () => {
  const ctx = setupTest();
  const repo = ctx.makeRepo('hq');

  const result = ctx.mint('hq');

  expect(result).toStrictEqual({ code: 0, stdout: expect.stringContaining(`-> ${repo}/.claude/settings.local.json`), stderr: '' });
  expect(ctx.readCalls()).toMatch(/^service-account create claude-hq-\d{8} --expires-in=7d --vault fleet:read_items --format=json\n$/u);
  expect(JSON.parse(readFileSync(join(repo, '.claude/settings.local.json'), 'utf8'))).toStrictEqual({ env: { OP_SERVICE_ACCOUNT_TOKEN: 'kettle' } });
});

test('it gives the cloud profile write access to the fleet vault', () => {
  const ctx = setupTest();
  ctx.makeRepo('cloud');

  const result = ctx.mint('cloud');

  expect(result.code).toBe(0);
  expect(ctx.readCalls()).toInclude('--vault cloud:read_items,write_items --vault cloud-deploy:read_items,write_items --vault imp:read_items,write_items --vault fleet:read_items,write_items --format=json');
});

test('it lists the hq profile with its vault and settings file', () => {
  const ctx = setupTest();

  const result = ctx.mint('--list');

  expect(result.stdout).toInclude(`hq           --vault fleet:read_items\n             -> ${ctx.home}/projects/hq/.claude/settings.local.json\n`);
});
