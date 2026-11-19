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

test('it gives the cloud profile write access to the fleet vault', () => {
  const ctx = setupTest();
  ctx.makeRepo('cloud');

  const result = ctx.mint('cloud');

  expect(result.code).toBe(0);
  expect(ctx.readCalls()).toInclude('--vault cloud:read_items,write_items --vault cloud-deploy:read_items,write_items --vault imp:read_items,write_items --vault fleet:read_items,write_items --format=json');
});

test('it mints the boxxy profile with write access to the boxxy vault, into the repo settings', () => {
  const ctx = setupTest();
  const repo = ctx.makeRepo('boxxy');

  const result = ctx.mint('boxxy');

  expect(result.code).toBe(0);
  expect(ctx.readCalls()).toMatch(/^service-account create claude-boxxy-\d{8} --expires-in=7d --vault boxxy:read_items,write_items --format=json\n$/u);
  expect(JSON.parse(readFileSync(join(repo, '.claude/settings.local.json'), 'utf8'))).toStrictEqual({
    env: { OP_SERVICE_ACCOUNT_TOKEN: 'kettle', PR_EVIDENCE_TOKEN_PATH: 'boxxy/files-upload-token/credential' },
  });
});

test.each([
  ['global', 'zgeoff/files-upload-token/credential'],
  ['imp', 'imp-e2e/files-upload-token/credential'],
])('it points the %s profile upload at the token in its own vault', (profile, path) => {
  const ctx = setupTest();
  const settings =
    profile === 'global' ? join(ctx.home, '.claude/settings.json') : join(ctx.makeRepo('impz'), '.claude/settings.local.json');

  const result = ctx.mint(profile);

  expect(result.code).toBe(0);
  expect(JSON.parse(readFileSync(settings, 'utf8')).env.PR_EVIDENCE_TOKEN_PATH).toBe(path);
});

test('it lists the boxxy profile with its vault and settings file', () => {
  const ctx = setupTest();

  const result = ctx.mint('--list');

  expect(result.stdout).toInclude(`boxxy        --vault boxxy:read_items,write_items\n             -> ${ctx.home}/projects/boxxy/.claude/settings.local.json\n`);
});

test('it mints the atc profile with write access to the atc vault, into the repo settings', () => {
  const ctx = setupTest();
  const repo = ctx.makeRepo('atc');

  const result = ctx.mint('atc');

  expect(result.code).toBe(0);
  expect(ctx.readCalls()).toMatch(/^service-account create claude-atc-\d{8} --expires-in=7d --vault atc:read_items,write_items --format=json\n$/u);
  expect(JSON.parse(readFileSync(join(repo, '.claude/settings.local.json'), 'utf8'))).toStrictEqual({
    env: { OP_SERVICE_ACCOUNT_TOKEN: 'kettle', PR_EVIDENCE_TOKEN_PATH: 'atc/files-upload-token/credential' },
  });
});
