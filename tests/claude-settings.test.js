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

test('it adds the op-mint rules after the allow rules a personal machine already has', async () => {
  const ctx = setupTest();
  const live = {
    permissions: {
      allow: ['Bash(git status)', 'WebFetch(domain:kite.example)'],
      deny: ['Bash(rm -rf *)'],
      defaultMode: 'auto',
    },
  };

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
        'WebFetch(domain:kite.example)',
        'Bash(op-mint --list)',
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
    autoMode: { environment: ['a kite workshop'] },
    stderr: '',
  });
});

test('it adds the op-mint rules to a personal settings file with no permissions', async () => {
  const ctx = setupTest();

  const result = await ctx.applySettings(
    {},
    {
      personal: true,
      decrypted: { '.chezmoitemplates/claude/automode.json.age': '{ "environment": [] }\n' },
    },
  );

  expect(JSON.parse(result.stdout.toString()).permissions).toStrictEqual({
    allow: [
      'Bash(op-mint --list)',
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

test('it keeps one copy of an op-mint rule a personal machine already has, in its place', async () => {
  const ctx = setupTest();
  const live = { permissions: { allow: ['Bash(op-mint vers)', 'Bash(git status)'] } };

  const result = await ctx.applySettings(live, {
    personal: true,
    decrypted: { '.chezmoitemplates/claude/automode.json.age': '{ "environment": [] }\n' },
  });

  expect(JSON.parse(result.stdout.toString()).permissions.allow).toStrictEqual([
    'Bash(op-mint vers)',
    'Bash(git status)',
    'Bash(op-mint --list)',
    'Bash(op-mint imp)',
    'Bash(op-mint nixie)',
    'Bash(op-mint noslop)',
    'Bash(op-mint osrs)',
    'Bash(op-mint pepys)',
    'Bash(op-mint wow-forever)',
  ]);
});

test('it drops the allow rule of a profile that op-mint no longer has', async () => {
  const ctx = setupTest();
  const live = { permissions: { allow: ['Bash(op-mint hq)', 'Bash(git status)'] } };

  const result = await ctx.applySettings(live, {
    personal: true,
    decrypted: { '.chezmoitemplates/claude/automode.json.age': '{ "environment": [] }\n' },
  });

  expect(JSON.parse(result.stdout.toString()).permissions.allow).toStrictEqual([
    'Bash(git status)',
    'Bash(op-mint --list)',
    'Bash(op-mint imp)',
    'Bash(op-mint nixie)',
    'Bash(op-mint noslop)',
    'Bash(op-mint osrs)',
    'Bash(op-mint pepys)',
    'Bash(op-mint vers)',
    'Bash(op-mint wow-forever)',
  ]);
});

test('it removes the GitHub token and key overrides from the env of a personal machine', async () => {
  const ctx = setupTest();
  const live = {
    env: { GH_TOKEN: 'heron', GITHUB_TOKEN: 'heron', GIT_SSH_COMMAND: 'ssh -i ~/.ssh/heron', HARBOUR_MODE: 'calm' },
  };

  const result = await ctx.applySettings(live, {
    personal: true,
    decrypted: { '.chezmoitemplates/claude/automode.json.age': '{ "environment": [] }\n' },
  });

  expect(JSON.parse(result.stdout.toString()).env).toStrictEqual({
    HARBOUR_MODE: 'calm',
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
    FORCE_HYPERLINK: '1',
  });
});

test('it keeps the GitHub token and key overrides in the env of a machine that is not personal', async () => {
  const ctx = setupTest();
  const live = { env: { GH_TOKEN: 'heron', GIT_SSH_COMMAND: 'ssh -i ~/.ssh/heron' } };

  const result = await ctx.applySettings(live, { personal: false, decrypted: {} });

  expect({
    exitCode: result.exitCode,
    env: JSON.parse(result.stdout.toString()).env,
    stderr: result.stderr.toString(),
  }).toStrictEqual({
    exitCode: 0,
    env: {
      GH_TOKEN: 'heron',
      GIT_SSH_COMMAND: 'ssh -i ~/.ssh/heron',
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
      FORCE_HYPERLINK: '1',
    },
    stderr: '',
  });
});

test('it removes the op-mint rules from a machine that is not personal', async () => {
  const ctx = setupTest();
  const live = {
    permissions: {
      allow: ['Bash(git status)', 'Bash(op-mint --list)', 'Bash(op-mint vers)'],
      defaultMode: 'auto',
    },
  };

  const result = await ctx.applySettings(live, { personal: false, decrypted: {} });

  expect(JSON.parse(result.stdout.toString()).permissions).toStrictEqual({
    allow: ['Bash(git status)'],
    defaultMode: 'auto',
  });
});

test('it adds no permissions to a settings file without them on a machine that is not personal', async () => {
  const ctx = setupTest();

  const result = await ctx.applySettings({}, { personal: false, decrypted: {} });

  expect(JSON.parse(result.stdout.toString()).permissions).toBeUndefined();
});

test('it keeps the model that the machine has set', async () => {
  const ctx = setupTest();

  const result = await ctx.applySettings({ model: 'kestrel' }, { personal: false, decrypted: {} });

  expect(JSON.parse(result.stdout.toString()).model).toBe('kestrel');
});

test('it sets the advisor model on a machine that is not personal', async () => {
  const ctx = setupTest();

  const result = await ctx.applySettings({}, { personal: false, decrypted: {} });

  expect(JSON.parse(result.stdout.toString()).advisorModel).toBe('fable');
});

test('it keeps a plugin that a machine that is not personal has turned on', async () => {
  const ctx = setupTest();
  const live = { enabledPlugins: { 'codex-image@codex-image-in-cc': true } };

  const result = await ctx.applySettings(live, { personal: false, decrypted: {} });

  expect(JSON.parse(result.stdout.toString()).enabledPlugins).toStrictEqual({
    'codex-image@codex-image-in-cc': true,
  });
});
