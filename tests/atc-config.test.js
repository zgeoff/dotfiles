import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { $ } from 'bun';

const scriptPath = join(import.meta.dir, '../home/dot_config/atc/modify_private_config.json');

const uploadURL = 'https://files.geoff.cloud/api/files';
const impTokenRef = 'op://imp/files-upload-token/credential';

async function runScript(live) {
  const result = await $`sh ${scriptPath} < ${Response.json(live)}`.nothrow().quiet();

  return {
    exitCode: result.exitCode,
    config: JSON.parse(result.stdout.toString()),
    stderr: result.stderr.toString(),
  };
}

test('it adds the upload address under both names, and no token reference, to the claude agent env', async () => {
  const live = { agents: { claude: { env: { HARBOUR_MODE: 'calm' } } } };

  expect(await runScript(live)).toStrictEqual({
    exitCode: 0,
    config: { agents: { claude: { env: { HARBOUR_MODE: 'calm', CLOUD_FILES_URL: uploadURL, VERIFY_UPLOAD_URL: uploadURL } } } },
    stderr: '',
  });
});

test('it sets the imp token reference in the session env of each imp target alone', async () => {
  const live = {
    targets: {
      local: { provider: 'local-pty' },
      cloud: { provider: 'imp', url: 'https://imp.example.test', sessionEnv: { TIDE: 'high' } },
      spare: { provider: 'imp', url: 'https://imp-spare.example.test' },
    },
  };

  expect((await runScript(live)).config.targets).toStrictEqual({
    local: { provider: 'local-pty' },
    cloud: {
      provider: 'imp',
      url: 'https://imp.example.test',
      sessionEnv: { TIDE: 'high', CLOUD_FILES_TOKEN_REF: impTokenRef, VERIFY_UPLOAD_TOKEN_REF: impTokenRef },
    },
    spare: {
      provider: 'imp',
      url: 'https://imp-spare.example.test',
      sessionEnv: { CLOUD_FILES_TOKEN_REF: impTokenRef, VERIFY_UPLOAD_TOKEN_REF: impTokenRef },
    },
  });
});

test('it adds no target to a config without one', async () => {
  const live = { agents: { claude: { env: {} } } };

  expect((await runScript(live)).config).toStrictEqual({
    agents: { claude: { env: { CLOUD_FILES_URL: uploadURL, VERIFY_UPLOAD_URL: uploadURL } } },
  });
});

test('it deletes the old upload keys and the agent token reference so an existing config migrates', async () => {
  const live = {
    agents: {
      claude: {
        env: {
          HARBOUR_MODE: 'calm',
          PR_EVIDENCE_URL: 'https://files.example.test/api/files',
          PR_EVIDENCE_TOKEN_PATH: 'imp/files-upload-token/credential',
          PR_EVIDENCE_TOKEN_REF: 'op://lighthouse/files-upload-token/credential',
          VERIFY_UPLOAD_TOKEN_REF: impTokenRef,
          CLOUD_FILES_TOKEN_REF: impTokenRef,
        },
      },
    },
  };

  expect((await runScript(live)).config.agents.claude.env).toStrictEqual({
    HARBOUR_MODE: 'calm',
    CLOUD_FILES_URL: uploadURL, VERIFY_UPLOAD_URL: uploadURL,
  });
});

test('it keeps a key whose name only starts like an old pr evidence key', async () => {
  const live = { agents: { claude: { env: { PR_EVIDENCEFUL_MODE: 'lighthouse' } } } };

  expect((await runScript(live)).config.agents.claude.env).toStrictEqual({
    PR_EVIDENCEFUL_MODE: 'lighthouse',
    CLOUD_FILES_URL: uploadURL, VERIFY_UPLOAD_URL: uploadURL,
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

  expect((await runScript(live)).config).toStrictEqual({
    agents: {
      claude: {
        auth: { profiles: ['claude', 'github'] },
        env: { HARBOUR_MODE: 'calm', CLOUD_FILES_URL: uploadURL, VERIFY_UPLOAD_URL: uploadURL },
      },
      lantern: { kind: 'claude', env: { LANTERN_COLOUR: 'amber' } },
    },
    targets: { local: { provider: 'local-pty' } },
    authProfiles: { github: { kind: 'github' } },
    defaultTarget: 'local',
  });
});

test('it writes a file formatted as atc writes it, so a second run changes nothing', async () => {
  const live = { defaultTarget: 'local', targets: { cloud: { provider: 'imp' } } };
  const first = await $`sh ${scriptPath} < ${Response.json(live)}`.quiet();

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
    config: { agents: { claude: { env: { CLOUD_FILES_URL: uploadURL, VERIFY_UPLOAD_URL: uploadURL } } } },
    stderr: '',
  });
});
