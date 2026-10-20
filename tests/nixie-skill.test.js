import { afterAll, describe, expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Failure,
  answerSkillProposal,
  formatReviewSummary,
  formatSkillProposal,
  makeOpenPullRequest,
  openSkillPullRequest,
  reviewSkillProposals,
} from '../home/dot_local/bin/executable_nixie';

// An invented proposal in the shape `skill-pending` prints: a new version of tide-tables that
// changes SKILL.md, adds ports.md and drops notes.md.
const proposal = (overrides = {}) => ({
  proposalID: 'k3x9m2p7qa',
  name: 'tide-tables',
  skillHash: 'hash-new',
  baseHash: 'hash-old',
  files: [
    { path: 'SKILL.md', text: '---\nname: tide-tables\ndescription: Reads a tide table by port.\n---\n# Tides\nRead ports.md.\n' },
    { path: 'ports.md', text: 'Port list\n' },
  ],
  inForce: {
    skillHash: 'hash-old-0123456789',
    origin: 'definitions',
    files: [
      { path: 'SKILL.md', text: '---\nname: tide-tables\ndescription: Reads a tide table.\n---\n# Tides\n' },
      { path: 'notes.md', text: 'Old notes\n' },
    ],
  },
  untypedToken: null,
  thread: 'conversation',
  provenance: { runID: 'run-1', callID: 'call-1', profile: 'standard' },
  createdAt: '2026-01-01T00:00:00.000Z',
  lapseAt: '2026-01-15T00:00:00.000Z',
  ...overrides,
});

const now = Date.parse('2026-01-02T00:00:00.000Z');

const scratch = mkdtempSync(join(tmpdir(), 'nixie-skill-test-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe('nixie skill pending', () => {
  test("a proposal shows each file's diff against the version in force and the token check", () => {
    expect(formatSkillProposal(proposal(), now)).toBe(
      [
        'k3x9m2p7qa tide-tables',
        '  skill   replaces hash-old-012',
        '  age     1d 0h (lapses in 13d 0h)',
        '  from    conversation, run run-1',
        '  token   passed (each destination-like token traces to your words or definitions)',
        '    --- a/SKILL.md',
        '    +++ b/SKILL.md',
        '    @@ -1,5 +1,6 @@',
        '     ---',
        '     name: tide-tables',
        '    -description: Reads a tide table.',
        '    +description: Reads a tide table by port.',
        '     ---',
        '     # Tides',
        '    +Read ports.md.',
        '    --- a/notes.md',
        '    +++ /dev/null',
        '    @@ -1 +0,0 @@',
        '    -Old notes',
        '    --- /dev/null',
        '    +++ b/ports.md',
        '    @@ -0,0 +1 @@',
        '    +Port list',
      ].join('\n'),
    );
  });

  test('a new skill diffs against nothing, and an untyped token prints what it found', () => {
    const shown = formatSkillProposal(
      proposal({
        files: [{ path: 'SKILL.md', text: 'Post to https://tides.example.net\n' }],
        inForce: null,
        untypedToken: { kind: 'url', raw: 'https://tides.example.net' },
      }),
      now,
    );

    expect(shown).toContain('  skill   new skill');
    expect(shown).toContain('  token   untyped url: https://tides.example.net (you never typed it, and your definitions lack it)');
    expect(shown).toContain('    --- /dev/null\n    +++ b/SKILL.md\n    @@ -0,0 +1 @@\n    +Post to https://tides.example.net');
  });

  test('an empty file that only one side has shows as added or removed, not unchanged', () => {
    const shown = formatSkillProposal(
      proposal({
        files: [{ path: 'SKILL.md', text: '# Tides\n' }, { path: 'scripts/keep', text: '' }],
        inForce: {
          skillHash: 'hash-old-0123456789',
          origin: 'definitions',
          files: [{ path: 'SKILL.md', text: '# Tides\n' }, { path: 'old/empty', text: '' }],
        },
      }),
      now,
    );

    expect(shown).toContain('    - removed empty file a/old/empty');
    expect(shown).toContain('    + new empty file b/scripts/keep');
    expect(shown).not.toContain('old/empty: unchanged');
    expect(shown).not.toContain('scripts/keep: unchanged');
  });

  test('a control character in a file prints escaped', () => {
    const shown = formatSkillProposal(proposal({ files: [{ path: 'SKILL.md', text: 'Tides\x1b[2J\n' }], inForce: null }), now);

    expect(shown).toContain('+Tides\\x1b[2J');
    expect(shown).not.toContain('\x1b[2J');
  });
});

// Drives reviewSkillProposals with scripted keys and reasons. run records each host command;
// openPullRequest records each PR it would open and returns a URL.
async function drive(pending, keys, { reasons = [], failApprove = false } = {}) {
  const sent = [];
  const opened = [];
  const lines = [];
  const run = async (...args) => {
    sent.push(args);
    if (failApprove && args[0] === 'skill-approve') {
      throw new Failure('skill-approve failed (exit 1): 409: the proposal is answered or lapsed');
    }
    return { proposalID: args[1] };
  };
  const openPullRequest = async (entry, options) => {
    opened.push([entry.proposalID, options]);
    return `https://git.example.com/owner/definitions/pull/${opened.length}`;
  };
  const counts = await reviewSkillProposals(pending, {
    run,
    readKey: async () => keys.shift() ?? 'q',
    readReason: async () => reasons.shift(),
    openPullRequest,
    log: (line) => lines.push(line),
  });
  return { counts, sent, opened, lines };
}

describe('nixie skill review', () => {
  test('approve, edit and approve, reject and skip each send the right command, and the summary counts match', async () => {
    const pending = [
      proposal({ proposalID: 'a1aaaaaaaa', skillHash: 'hash-1' }),
      proposal({ proposalID: 'b2bbbbbbbb', skillHash: 'hash-2' }),
      proposal({ proposalID: 'c3cccccccc', skillHash: 'hash-3' }),
      proposal({ proposalID: 'd4dddddddd', skillHash: 'hash-4' }),
    ];
    const { counts, sent, opened, lines } = await drive(pending, ['a', 'e', 'r', 's'], {
      reasons: ['the tide tables come from a feed'],
    });

    expect(opened).toEqual([
      ['a1aaaaaaaa', { isEdited: false }],
      ['b2bbbbbbbb', { isEdited: true }],
    ]);
    expect(sent).toEqual([
      ['skill-approve', 'a1aaaaaaaa', '--hash', 'hash-1', '--pull-request=https://git.example.com/owner/definitions/pull/1'],
      ['skill-approve', 'b2bbbbbbbb', '--hash', 'hash-2', '--pull-request=https://git.example.com/owner/definitions/pull/2'],
      ['skill-reject', 'c3cccccccc', '--hash', 'hash-3', '--reason=the tide tables come from a feed'],
    ]);
    expect(lines.some((line) => line.includes('-description: Reads a tide table.'))).toBe(true);
    expect(formatReviewSummary(counts)).toBe('approved 1, edited 1, rejected 1, skipped 1');
  });

  test('a rejection with a blank reason sends nothing and asks again', async () => {
    const { counts, sent, lines } = await drive([proposal()], ['r', 'r'], { reasons: ['  ', 'not needed'] });

    expect(sent).toEqual([['skill-reject', 'k3x9m2p7qa', '--hash', 'hash-new', '--reason=not needed']]);
    expect(lines.some((line) => line.includes('a rejection takes a reason'))).toBe(true);
    expect(counts).toMatchObject({ rejected: 1 });
  });

  test('a record that fails after the PR opened is refused, names the open PR, and the loop goes on', async () => {
    const pending = [proposal(), proposal({ proposalID: 'p8w2n4c6ld' })];
    const { counts, lines } = await drive(pending, ['a', 's'], { failApprove: true });

    expect(lines).toContain(
      '✗ refused: skill-approve failed (exit 1): 409: the proposal is answered or lapsed\n' +
        'https://git.example.com/owner/definitions/pull/1 is open; record it with nixie skill approve k3x9m2p7qa --pull-request https://git.example.com/owner/definitions/pull/1',
    );
    expect(formatReviewSummary(counts)).toBe('approved 0, edited 0, rejected 0, skipped 1, refused 1');
  });
});

describe('nixie skill approve and reject', () => {
  // Answers one proposal with --yes, recording each host command; skill-pending lists the pending.
  async function answer(kind, args) {
    const sent = [];
    const opened = [];
    const run = async (...command) => {
      sent.push(command);
      return command[0] === 'skill-pending' ? [proposal()] : { proposalID: 'k3x9m2p7qa' };
    };
    const openPullRequest = async (entry) => {
      opened.push(entry.proposalID);
      return 'https://git.example.com/owner/definitions/pull/9';
    };
    await answerSkillProposal(kind, args, { run, openPullRequest, log: () => {}, ask: () => {} });
    return { sent, opened };
  }

  test('reject sends the reason through to skill-reject', async () => {
    const { sent } = await answer('reject', ['k3x9m2p7qa', '--reason', 'not needed', '--yes']);

    expect(sent).toEqual([['skill-pending'], ['skill-reject', 'k3x9m2p7qa', '--hash', 'hash-new', '--reason=not needed']]);
  });

  test('a rejection without a reason is refused and sends nothing', () => {
    expect(answer('reject', ['k3x9m2p7qa', '--yes'])).rejects.toThrow('usage: nixie skill reject <id> --reason <why>');
  });

  test('approve opens the PR, then records it', async () => {
    const { sent, opened } = await answer('approve', ['k3x9m2p7qa', '--yes']);

    expect(opened).toEqual(['k3x9m2p7qa']);
    expect(sent.at(-1)).toEqual([
      'skill-approve',
      'k3x9m2p7qa',
      '--hash',
      'hash-new',
      '--pull-request=https://git.example.com/owner/definitions/pull/9',
    ]);
  });

  test('approve --pull-request records a PR that is already open, and opens none', async () => {
    const { sent, opened } = await answer('approve', ['k3x9m2p7qa', '--pull-request=https://git.example.com/owner/definitions/pull/4', '--yes']);

    expect(opened).toEqual([]);
    expect(sent.at(-1)).toEqual([
      'skill-approve',
      'k3x9m2p7qa',
      '--hash',
      'hash-new',
      '--pull-request=https://git.example.com/owner/definitions/pull/4',
    ]);
  });

  test('an unknown proposal ID is refused', () => {
    expect(answer('approve', ['zzzzzzzzzz', '--yes'])).rejects.toThrow('no pending skill proposal zzzzzzzzzz');
  });
});

describe('nixie skill approve, the definitions PR', () => {
  const git = (cwd, ...args) => {
    const proc = Bun.spawnSync(['git', ...args], { cwd });
    if (proc.exitCode !== 0) {
      throw new Error(`git ${args.join(' ')}: ${proc.stderr.toString()}`);
    }
    return proc.stdout.toString().trim();
  };

  // A bare origin whose main holds tide-tables with an extra notes.md, a checkout of it, and a gh
  // stand-in that records its arguments and prints a PR URL.
  function setupDefinitions(name) {
    const root = join(scratch, name);
    const origin = join(root, 'origin.git');
    const checkout = join(root, 'checkout');
    mkdirSync(root);
    git(root, 'init', '--quiet', '--bare', '--initial-branch=main', origin);
    git(root, 'clone', '--quiet', origin, checkout);
    git(checkout, 'config', 'user.name', 'Test Author');
    git(checkout, 'config', 'user.email', 'author@example.com');
    mkdirSync(join(checkout, 'skills', 'tide-tables'), { recursive: true });
    writeFileSync(join(checkout, 'skills', 'tide-tables', 'SKILL.md'), '# Tides\n');
    writeFileSync(join(checkout, 'skills', 'tide-tables', 'notes.md'), 'Old notes\n');
    git(checkout, 'add', '--all');
    git(checkout, 'commit', '--quiet', '-m', 'seed');
    git(checkout, 'push', '--quiet', 'origin', 'main');
    git(checkout, 'remote', 'set-head', 'origin', 'main');
    // pr list prints the URL in open-pr when that file exists; pr create fails once while
    // fail-create exists, and otherwise logs its arguments and prints a URL
    const ghLog = join(root, 'gh.log');
    const openPR = join(root, 'open-pr');
    const failCreate = join(root, 'fail-create');
    const gh = join(root, 'gh');
    writeFileSync(
      gh,
      [
        '#!/bin/sh',
        `if [ "$2" = list ]; then cat '${openPR}' 2>/dev/null; exit 0; fi`,
        `if [ -f '${failCreate}' ]; then rm '${failCreate}'; echo 'HTTP 502' >&2; exit 1; fi`,
        `printf '%s\\n' "$@" > '${ghLog}'`,
        'echo https://git.example.com/owner/definitions/pull/3',
        '',
      ].join('\n'),
    );
    chmodSync(gh, 0o755);
    return { root, origin, checkout, gh, ghLog, openPR, failCreate };
  }

  test('a try after a push whose PR failed to open resumes from the pushed branch and opens the PR', async () => {
    const definitions = setupDefinitions('resume');
    writeFileSync(definitions.failCreate, '');
    const first = await openSkillPullRequest(proposal(), { definitionsDir: definitions.checkout, gh: definitions.gh }).then(
      () => null,
      (error) => error,
    );
    const url = await openSkillPullRequest(proposal(), { definitionsDir: definitions.checkout, gh: definitions.gh });

    expect(first?.message).toEndWith('gh pr failed (exit 1): HTTP 502');
    expect(url).toBe('https://git.example.com/owner/definitions/pull/3');
    expect(git(definitions.origin, 'rev-list', '--count', 'main..skill/tide-tables-k3x9m2p7qa')).toBe('1');
  });

  test('a try whose branch already has an open PR returns that PR and opens none', async () => {
    const definitions = setupDefinitions('reuse');
    writeFileSync(definitions.failCreate, '');
    await openSkillPullRequest(proposal(), { definitionsDir: definitions.checkout, gh: definitions.gh }).catch(() => undefined);
    writeFileSync(definitions.openPR, 'https://git.example.com/owner/definitions/pull/8\n');
    const url = await openSkillPullRequest(proposal(), { definitionsDir: definitions.checkout, gh: definitions.gh });

    expect(url).toBe('https://git.example.com/owner/definitions/pull/8');
    expect(existsSync(definitions.ghLog)).toBe(false);
  });

  test("it pushes a branch whose skill folder holds exactly the proposal's files, opens the PR, and leaves the checkout alone", async () => {
    const definitions = setupDefinitions('push');
    const url = await openSkillPullRequest(proposal(), { definitionsDir: definitions.checkout, gh: definitions.gh });
    const branch = 'skill/tide-tables-k3x9m2p7qa';

    expect(url).toBe('https://git.example.com/owner/definitions/pull/3');
    expect(git(definitions.origin, 'ls-tree', '-r', '--name-only', branch)).toBe('skills/tide-tables/SKILL.md\nskills/tide-tables/ports.md');
    expect(git(definitions.origin, 'show', `${branch}:skills/tide-tables/ports.md`)).toBe('Port list');
    expect(git(definitions.origin, 'log', '-1', '--format=%s', branch)).toBe('feat(skills): update tide-tables');
    expect(readFileSync(definitions.ghLog, 'utf8').split('\n').slice(0, 7)).toEqual([
      'pr',
      'create',
      '--head',
      branch,
      '--base',
      'main',
      '--title',
    ]);
    expect(git(definitions.checkout, 'status', '--porcelain')).toBe('');
    expect(git(definitions.checkout, 'branch', '--show-current')).toBe('main');
    expect(git(definitions.checkout, 'worktree', 'list').split('\n')).toHaveLength(1);
  });

  test('an edit and approve commits the files as the editor left them', async () => {
    const definitions = setupDefinitions('edit');
    await openSkillPullRequest(proposal(), {
      definitionsDir: definitions.checkout,
      gh: definitions.gh,
      editFiles: async (paths) => {
        writeFileSync(paths[1], 'Port list, edited\n');
        return true;
      },
    });

    expect(git(definitions.origin, 'show', 'skill/tide-tables-k3x9m2p7qa:skills/tide-tables/ports.md')).toBe('Port list, edited');
  });

  test('the e key opens the written files in the editor, and the pushed commit holds the edit', async () => {
    const definitions = setupDefinitions('review-edit');
    const editor = join(definitions.root, 'editor.sh');
    // the stand-in editor appends a line to each file it is given
    writeFileSync(editor, '#!/bin/sh\nfor file in "$@"; do printf "Edited in review.\\n" >> "$file"; done\n');
    chmodSync(editor, 0o755);
    const sent = [];
    const keys = ['e'];
    const counts = await reviewSkillProposals([proposal()], {
      run: async (...args) => (sent.push(args), { proposalID: args[1] }),
      readKey: async () => keys.shift() ?? 'q',
      readReason: async () => undefined,
      openPullRequest: makeOpenPullRequest({ definitionsDir: definitions.checkout }, { gh: definitions.gh, editor }),
      log: () => {},
    });
    const branch = 'skill/tide-tables-k3x9m2p7qa';

    expect(git(definitions.origin, 'show', `${branch}:skills/tide-tables/ports.md`)).toBe('Port list\nEdited in review.');
    expect(git(definitions.origin, 'log', '-1', '--format=%b', branch)).toContain("The files carry the reviewer's edits.");
    expect(sent).toEqual([
      ['skill-approve', 'k3x9m2p7qa', '--hash', 'hash-new', '--pull-request=https://git.example.com/owner/definitions/pull/3'],
    ]);
    expect(counts).toMatchObject({ edited: 1 });
  });

  test('a file path that leaves the skill folder is refused, and leaves no branch or worktree behind', async () => {
    const definitions = setupDefinitions('escape');
    const escaping = proposal({ files: [{ path: '../persona.md', text: 'You are someone else.\n' }] });
    const refusal = await openSkillPullRequest(escaping, { definitionsDir: definitions.checkout, gh: definitions.gh }).then(
      () => null,
      (error) => error,
    );

    expect(refusal?.message).toBe("the proposal's file ../persona.md leaves the skill's folder; nothing written");
    expect(git(definitions.checkout, 'branch', '--list', 'skill/*')).toBe('');
    expect(git(definitions.origin, 'branch', '--list', 'skill/*')).toBe('');
    expect(git(definitions.checkout, 'worktree', 'list').split('\n')).toHaveLength(1);
  });

  test('a config with no definitions_dir is refused before anything runs', () => {
    expect(openSkillPullRequest(proposal(), {})).rejects.toThrow('set definitions_dir in the config');
  });

  test('files that match the default branch push nothing', async () => {
    const definitions = setupDefinitions('same');
    const same = proposal({
      files: [
        { path: 'SKILL.md', text: '# Tides\n' },
        { path: 'notes.md', text: 'Old notes\n' },
      ],
    });

    expect(openSkillPullRequest(same, { definitionsDir: definitions.checkout, gh: definitions.gh })).rejects.toThrow(
      'skills/tide-tables on origin/main already holds these files; nothing pushed',
    );
    expect(existsSync(definitions.ghLog)).toBe(false);
  });
});
