import { expect, onTestFinished, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { $ } from 'bun';

const scriptPath = join(import.meta.dir, '../home/dot_claude/statusline.sh');

function setupTest() {
  // Outside the repo, so the folder has no git branch to show.
  const folder = mkdtempSync(join(tmpdir(), 'statusline-test-'));
  onTestFinished(() => rmSync(folder, { recursive: true, force: true }));

  return {
    folder,
    folderName: basename(folder),
    render: async (payload) => {
      const result = await $`bash ${scriptPath} < ${Response.json(payload)}`
        .env({ ...process.env, COLUMNS: '0', STATUSLINE_NERD_FONT: '0' })
        .nothrow()
        .quiet();

      return {
        exitCode: result.exitCode,
        line: result.stdout.toString().replaceAll(/\u001B\[[0-9;]*m/g, ''),
        stderr: result.stderr.toString(),
      };
    },
  };
}

test('it prints the folder, the PR, the context, the weekly limit and the model', async () => {
  const ctx = setupTest();
  const payload = {
    workspace: { current_dir: ctx.folder },
    model: { display_name: 'Kestrel 3' },
    effort: { level: 'high' },
    thinking: { enabled: true },
    pr: { number: 12, review_state: 'approved' },
    context_window: { context_window_size: 1_000_000, total_input_tokens: 182_000, used_percentage: 18 },
    rate_limits: {
      seven_day: { used_percentage: 12, resets_at: Math.floor(Date.now() / 1000) + 3 * 86_400 + 11 * 3600 + 1800 },
    },
  };

  const result = await ctx.render(payload);

  expect(result).toStrictEqual({
    exitCode: 0,
    line: `dir ${ctx.folderName}    |    PR #12 ok    |    182k/1M 18%    |    7d 12%·3d11h    |    Kestrel 3·high think`,
    stderr: '',
  });
});

test('it leaves out the diff size and the 5-hour limit', async () => {
  const ctx = setupTest();
  const payload = {
    workspace: { current_dir: ctx.folder },
    model: { display_name: 'Kestrel 3' },
    cost: { total_lines_added: 212, total_lines_removed: 47 },
    rate_limits: { five_hour: { used_percentage: 34 } },
  };

  const result = await ctx.render(payload);

  expect(result).toStrictEqual({
    exitCode: 0,
    line: `dir ${ctx.folderName}    |    Kestrel 3`,
    stderr: '',
  });
});

test('it prints the tokens without a window size when the payload has none', async () => {
  const ctx = setupTest();
  const payload = {
    workspace: { current_dir: ctx.folder },
    model: { display_name: 'Kestrel 3' },
    context_window: { total_input_tokens: 950, used_percentage: 1 },
  };

  const result = await ctx.render(payload);

  expect(result).toStrictEqual({
    exitCode: 0,
    line: `dir ${ctx.folderName}    |    950 1%    |    Kestrel 3`,
    stderr: '',
  });
});

test('it prints the weekly limit without a reset time when the payload has none', async () => {
  const ctx = setupTest();
  const payload = {
    workspace: { current_dir: ctx.folder },
    model: { display_name: 'Kestrel 3' },
    rate_limits: { seven_day: { used_percentage: 80 } },
  };

  const result = await ctx.render(payload);

  expect(result).toStrictEqual({
    exitCode: 0,
    line: `dir ${ctx.folderName}    |    7d 80%    |    Kestrel 3`,
    stderr: '',
  });
});
