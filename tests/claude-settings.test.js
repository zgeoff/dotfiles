import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { $ } from 'bun';
import { renderNonPersonalTemplate } from './test-utils/render-template.js';

const templatePath = join(import.meta.dir, '../home/dot_claude/modify_private_settings.json.tmpl');

function setupTest() {
  const script = renderNonPersonalTemplate(readFileSync(templatePath, 'utf8'), {
    homeDir: '/home/wren',
  });

  return { applySettings: (live) => $`sh -c ${script} < ${Response.json(live)}`.nothrow().quiet() };
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

  const result = await ctx.applySettings(live);

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

  const result = await ctx.applySettings({});

  expect(JSON.parse(result.stdout.toString()).permissions).toStrictEqual({
    allow: ['Bash(op-mint *)'],
  });
});

test('it keeps one op-mint rule when the machine already has it', async () => {
  const ctx = setupTest();
  const live = { permissions: { allow: ['Bash(op-mint *)', 'Bash(git status)'] } };

  const result = await ctx.applySettings(live);

  expect(JSON.parse(result.stdout.toString()).permissions.allow).toStrictEqual([
    'Bash(op-mint *)',
    'Bash(git status)',
  ]);
});
