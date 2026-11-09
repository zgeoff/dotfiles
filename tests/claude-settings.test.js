import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { $ } from 'bun';
import { renderTemplate } from './test-utils/render-template.js';

const templatePath = join(import.meta.dir, '../home/dot_claude/modify_private_settings.json.tmpl');

function setupTest() {
  const template = readFileSync(templatePath, 'utf8');

  return {
    applySettings: (live, machine) => {
      const script = renderTemplate(template, { homeDir: '/home/wren', ...machine });

      return $`sh -c ${script} < ${Response.json(live)}`.nothrow().quiet();
    },
  };
}

test('it adds the op-mint rule after the allow rules the machine already has', async () => {
  const ctx = setupTest();
  const live = {
    permissions: {
      allow: ['Bash(git status)', 'WebFetch(domain:kite.example)'],
      deny: ['Bash(rm -rf *)'],
      defaultMode: 'auto',
    },
  };

  const result = await ctx.applySettings(live, { personal: false, decrypted: {} });

  expect({
    exitCode: result.exitCode,
    permissions: JSON.parse(result.stdout.toString()).permissions,
    stderr: result.stderr.toString(),
  }).toStrictEqual({
    exitCode: 0,
    permissions: {
      allow: ['Bash(git status)', 'WebFetch(domain:kite.example)', 'Bash(op-mint *)'],
      deny: ['Bash(rm -rf *)'],
      defaultMode: 'auto',
    },
    stderr: '',
  });
});

test('it adds the op-mint rule to a settings file with no permissions', async () => {
  const ctx = setupTest();

  const result = await ctx.applySettings({}, { personal: false, decrypted: {} });

  expect(JSON.parse(result.stdout.toString()).permissions).toStrictEqual({
    allow: ['Bash(op-mint *)'],
  });
});

test('it keeps one op-mint rule when the machine already has it', async () => {
  const ctx = setupTest();
  const live = { permissions: { allow: ['Bash(op-mint *)', 'Bash(git status)'] } };

  const result = await ctx.applySettings(live, { personal: false, decrypted: {} });

  expect(JSON.parse(result.stdout.toString()).permissions.allow).toStrictEqual([
    'Bash(op-mint *)',
    'Bash(git status)',
  ]);
});

test('it adds the op-mint rule on a personal machine', async () => {
  const ctx = setupTest();
  const live = { permissions: { allow: ['Bash(git status)'] } };

  const result = await ctx.applySettings(live, {
    personal: true,
    decrypted: {
      '.chezmoitemplates/claude/automode.json.age': '{ "environment": ["a kite workshop"] }\n',
    },
  });
  const settings = JSON.parse(result.stdout.toString());

  expect({
    exitCode: result.exitCode,
    permissions: settings.permissions,
    autoMode: settings.autoMode,
    stderr: result.stderr.toString(),
  }).toStrictEqual({
    exitCode: 0,
    permissions: { allow: ['Bash(git status)', 'Bash(op-mint *)'] },
    autoMode: { environment: ['a kite workshop'] },
    stderr: '',
  });
});
