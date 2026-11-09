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

test('it adds the op-mint rules after the allow rules the machine already has', async () => {
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
      allow: [
        'Bash(git status)',
        'WebFetch(domain:kite.example)',
        'Bash(op-mint --list)',
        'Bash(op-mint hq)',
        'Bash(op-mint imp)',
        'Bash(op-mint nixie)',
        'Bash(op-mint noslop)',
        'Bash(op-mint osrs)',
        'Bash(op-mint pepys)',
        'Bash(op-mint vers)',
        'Bash(op-mint wow-forever)',
      ],
      deny: ['Bash(rm -rf *)'],
      defaultMode: 'auto',
    },
    stderr: '',
  });
});

test('it adds the op-mint rules to a settings file with no permissions', async () => {
  const ctx = setupTest();

  const result = await ctx.applySettings({}, { personal: false, decrypted: {} });

  expect(JSON.parse(result.stdout.toString()).permissions).toStrictEqual({
    allow: [
      'Bash(op-mint --list)',
      'Bash(op-mint hq)',
      'Bash(op-mint imp)',
      'Bash(op-mint nixie)',
      'Bash(op-mint noslop)',
      'Bash(op-mint osrs)',
      'Bash(op-mint pepys)',
      'Bash(op-mint vers)',
      'Bash(op-mint wow-forever)',
    ],
  });
});

test('it keeps one copy of an op-mint rule the machine already has, in its place', async () => {
  const ctx = setupTest();
  const live = { permissions: { allow: ['Bash(op-mint vers)', 'Bash(git status)'] } };

  const result = await ctx.applySettings(live, { personal: false, decrypted: {} });

  expect(JSON.parse(result.stdout.toString()).permissions.allow).toStrictEqual([
    'Bash(op-mint vers)',
    'Bash(git status)',
    'Bash(op-mint --list)',
    'Bash(op-mint hq)',
    'Bash(op-mint imp)',
    'Bash(op-mint nixie)',
    'Bash(op-mint noslop)',
    'Bash(op-mint osrs)',
    'Bash(op-mint pepys)',
    'Bash(op-mint wow-forever)',
  ]);
});

test('it adds the op-mint rules on a personal machine', async () => {
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
    permissions: {
      allow: [
        'Bash(git status)',
        'Bash(op-mint --list)',
        'Bash(op-mint hq)',
        'Bash(op-mint imp)',
        'Bash(op-mint nixie)',
        'Bash(op-mint noslop)',
        'Bash(op-mint osrs)',
        'Bash(op-mint pepys)',
        'Bash(op-mint vers)',
        'Bash(op-mint wow-forever)',
      ],
    },
    autoMode: { environment: ['a kite workshop'] },
    stderr: '',
  });
});
