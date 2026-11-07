import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { $ } from 'bun';

const scriptPath = join(import.meta.dir, '../home/dot_config/atc/modify_private_config.json');

test('it adds the pr-evidence address and token path to the claude agent env', async () => {
  const live = { agents: { claude: { env: { HARBOUR_MODE: 'calm' } } } };

  const result = await $`sh ${scriptPath} < ${Response.json(live)}`.nothrow().quiet();

  expect({
    exitCode: result.exitCode,
    config: JSON.parse(result.stdout.toString()),
    stderr: result.stderr.toString(),
  }).toStrictEqual({
    exitCode: 0,
    config: {
      agents: {
        claude: {
          env: {
            HARBOUR_MODE: 'calm',
            PR_EVIDENCE_URL: 'https://files.geoff.cloud/api/files',
            PR_EVIDENCE_TOKEN_PATH: 'zgeoff/files-agent-token/credential',
          },
        },
      },
    },
    stderr: '',
  });
});

test('it removes the op:// token reference that op run would try to resolve', async () => {
  const live = {
    agents: {
      claude: {
        env: {
          PR_EVIDENCE_URL: 'https://files.geoff.cloud/api/files',
          PR_EVIDENCE_TOKEN_REF: 'op://zgeoff/files-agent-token/credential',
        },
      },
    },
  };

  const result = await $`sh ${scriptPath} < ${Response.json(live)}`.nothrow().quiet();

  expect(JSON.parse(result.stdout.toString()).agents.claude.env).toStrictEqual({
    PR_EVIDENCE_URL: 'https://files.geoff.cloud/api/files',
    PR_EVIDENCE_TOKEN_PATH: 'zgeoff/files-agent-token/credential',
  });
});

test('it keeps every key it does not own', async () => {
  const live = {
    agents: {
      claude: { auth: { profiles: ['claude', 'github'] }, env: { HARBOUR_MODE: 'calm' } },
      lantern: { kind: 'claude', env: { LANTERN_COLOUR: 'amber' } },
    },
    targets: { local: { provider: 'local-pty' } },
    authProfiles: { github: { kind: 'github' } },
    defaultTarget: 'local',
  };

  const result = await $`sh ${scriptPath} < ${Response.json(live)}`.nothrow().quiet();

  expect(JSON.parse(result.stdout.toString())).toStrictEqual({
    agents: {
      claude: {
        auth: { profiles: ['claude', 'github'] },
        env: {
          HARBOUR_MODE: 'calm',
          PR_EVIDENCE_URL: 'https://files.geoff.cloud/api/files',
          PR_EVIDENCE_TOKEN_PATH: 'zgeoff/files-agent-token/credential',
        },
      },
      lantern: { kind: 'claude', env: { LANTERN_COLOUR: 'amber' } },
    },
    targets: { local: { provider: 'local-pty' } },
    authProfiles: { github: { kind: 'github' } },
    defaultTarget: 'local',
  });
});

test('it writes a file formatted as atc writes it, so a second run changes nothing', async () => {
  const first = await $`sh ${scriptPath} < ${Response.json({ defaultTarget: 'local' })}`.quiet();

  const second = await $`sh ${scriptPath} < ${new Response(first.stdout)}`.nothrow().quiet();

  expect(second.stdout.toString()).toBe(
    `${JSON.stringify(JSON.parse(first.stdout.toString()), null, 2)}\n`,
  );
});

test('it starts from an empty object when the live file is absent', async () => {
  const result = await $`sh ${scriptPath} < ${new Response('')}`.nothrow().quiet();

  expect({
    exitCode: result.exitCode,
    config: JSON.parse(result.stdout.toString()),
    stderr: result.stderr.toString(),
  }).toStrictEqual({
    exitCode: 0,
    config: {
      agents: {
        claude: {
          env: {
            PR_EVIDENCE_URL: 'https://files.geoff.cloud/api/files',
            PR_EVIDENCE_TOKEN_PATH: 'zgeoff/files-agent-token/credential',
          },
        },
      },
    },
    stderr: '',
  });
});
