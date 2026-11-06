import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const scriptPath = join(import.meta.dir, '../home/dot_config/atc/modify_private_config.json');

// chezmoi runs a modify_ script with the live file on stdin and writes its stdout back
function modify(input) {
  const run = Bun.spawnSync(['sh', scriptPath], { stdin: Buffer.from(input) });
  expect(run.stderr.toString()).toBe('');
  expect(run.exitCode).toBe(0);
  return run.stdout.toString();
}

const prEvidenceEnv = {
  PR_EVIDENCE_URL: 'https://files.geoff.cloud/api/files',
  PR_EVIDENCE_TOKEN_REF: 'op://zgeoff/files-agent-token/credential',
};

// An invented daemon config in the shape atc writes: a target, an auth profile and two agents.
const liveConfig = {
  agents: {
    claude: {
      auth: { profiles: ['claude', 'github'] },
      env: { HARBOUR_MODE: 'calm' },
    },
    lantern: {
      kind: 'claude',
      env: { LANTERN_COLOUR: 'amber' },
    },
  },
  targets: { local: { provider: 'local-pty' } },
  authProfiles: { github: { kind: 'github' } },
  defaultTarget: 'local',
};

describe('the atc config modify script', () => {
  test('adds the pr-evidence address and token reference to the claude agent env', () => {
    const output = JSON.parse(modify(JSON.stringify(liveConfig)));

    expect(output.agents.claude.env).toEqual({ HARBOUR_MODE: 'calm', ...prEvidenceEnv });
  });

  test('keeps every key it does not own', () => {
    const output = JSON.parse(modify(JSON.stringify(liveConfig)));

    expect(output).toEqual({
      ...liveConfig,
      agents: {
        ...liveConfig.agents,
        claude: { ...liveConfig.agents.claude, env: { HARBOUR_MODE: 'calm', ...prEvidenceEnv } },
      },
    });
  });

  test('writes a file formatted as atc writes it, so a second run changes nothing', () => {
    const first = modify(JSON.stringify(liveConfig));

    expect(first).toBe(`${JSON.stringify(JSON.parse(first), null, 2)}\n`);
    expect(modify(first)).toBe(first);
  });

  test('starts from an empty object when the live file is absent', () => {
    const output = JSON.parse(modify(''));

    expect(output).toEqual({ agents: { claude: { env: prEvidenceEnv } } });
  });
});
