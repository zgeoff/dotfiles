import { afterAll, describe, expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  Failure,
  answerSkillProposal,
  editSkillFiles,
  formatReviewSummary,
  formatSkillProposal,
  formatWrittenSkill,
  resolveWrittenSkill,
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
  isStale: false,
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
  test('a stale proposal says an answer is refused, and a version nixie wrote says so', () => {
    const shown = formatSkillProposal(
      proposal({ isStale: true, inForce: { ...proposal().inForce, origin: 'nixie' } }),
      now,
    );

    expect(shown).toContain('  skill   replaces hash-old-012 (nixie wrote it; its export may not have merged yet)');
    expect(shown).toContain('  stale   the skill in force moved past the version this replaces; an answer is refused, and it lapses');
  });
});

// Drives reviewSkillProposals with scripted keys, reasons and edits. run records each host command
// and answers an approval with an approval ID.
async function drive(pending, keys, { reasons = [], edits = [], failApprove = false } = {}) {
  const sent = [];
  const lines = [];
  const run = async (...args) => {
    sent.push(args);
    if (failApprove && args[0] === 'skill-approve') {
      throw new Failure('skill-approve failed (exit 1): 409: the skill in force moved past the proposal');
    }
    return args[0] === 'skill-approve' ? { proposalID: args[1], approvalID: 'approval-1', skillHash: args[3] } : { proposalID: args[1] };
  };
  const counts = await reviewSkillProposals(pending, {
    run,
    readKey: async () => keys.shift() ?? 'q',
    readReason: async () => reasons.shift(),
    editFiles: async () => edits.shift(),
    log: (line) => lines.push(line),
  });
  return { counts, sent, lines };
}

describe('nixie skill review', () => {
  test('approve, edit and approve, reject and skip each send the right command, and the summary counts match', async () => {
    const pending = [
      proposal({ proposalID: 'a1aaaaaaaa', skillHash: 'hash-1' }),
      proposal({ proposalID: 'b2bbbbbbbb', skillHash: 'hash-2' }),
      proposal({ proposalID: 'c3cccccccc', skillHash: 'hash-3' }),
      proposal({ proposalID: 'd4dddddddd', skillHash: 'hash-4' }),
    ];
    const edited = [proposal().files[0], { path: 'ports.md', text: 'Port list, by coast\n' }];
    const { counts, sent, lines } = await drive(pending, ['a', 'e', 'r', 's'], {
      reasons: ['the tide tables come from a feed'],
      edits: [edited],
    });

    expect(sent).toEqual([
      ['skill-approve', 'a1aaaaaaaa', '--hash', 'hash-1'],
      ['skill-approve', 'b2bbbbbbbb', '--hash', 'hash-2', `--files=${JSON.stringify(edited)}`],
      ['skill-reject', 'c3cccccccc', '--hash', 'hash-3', '--reason=the tide tables come from a feed'],
    ]);
    expect(lines).toContain('✓ approved with your edits: in force for new tasks (approval approval-1)');
    expect(lines.some((line) => line.includes('-description: Reads a tide table.'))).toBe(true);
    expect(formatReviewSummary(counts)).toBe('approved 1, edited 1, rejected 1, skipped 1');
  });

  test('an edit that changes nothing approves the proposal as it is', async () => {
    const { counts, sent } = await drive([proposal()], ['e'], { edits: [proposal().files] });

    expect(sent).toEqual([['skill-approve', 'k3x9m2p7qa', '--hash', 'hash-new']]);
    expect(counts).toMatchObject({ approved: 1, edited: 0 });
  });

  test('a failed editor sends nothing and asks again', async () => {
    const { counts, sent, lines } = await drive([proposal()], ['e', 's'], { edits: [undefined] });

    expect(sent).toEqual([]);
    expect(lines).toContain('edit cancelled: the editor failed; nothing sent');
    expect(counts).toMatchObject({ skipped: 1 });
  });

  test('a rejection with a blank reason sends nothing and asks again', async () => {
    const { counts, sent, lines } = await drive([proposal()], ['r', 'r'], { reasons: ['  ', 'not needed'] });

    expect(sent).toEqual([['skill-reject', 'k3x9m2p7qa', '--hash', 'hash-new', '--reason=not needed']]);
    expect(lines.some((line) => line.includes('a rejection takes a reason'))).toBe(true);
    expect(counts).toMatchObject({ rejected: 1 });
  });

  test('a refused approval prints the server reason, and the loop goes on', async () => {
    const pending = [proposal(), proposal({ proposalID: 'p8w2n4c6ld' })];
    const { counts, lines } = await drive(pending, ['a', 's'], { failApprove: true });

    expect(lines).toContain('✗ refused: skill-approve failed (exit 1): 409: the skill in force moved past the proposal');
    expect(formatReviewSummary(counts)).toBe('approved 0, edited 0, rejected 0, skipped 1, refused 1');
  });
});

describe('nixie skill edit', () => {
  test('the editor edits every file of the proposal in place, and the folder goes away', async () => {
    const editor = join(scratch, 'editor.sh');
    const edited = join(scratch, 'edited');
    // the stand-in editor appends a line to each file it is given and logs each path
    writeFileSync(editor, `#!/bin/sh\nfor file in "$@"; do printf "Edited in review.\\n" >> "$file"; echo "$file" >> '${edited}'; done\n`);
    chmodSync(editor, 0o755);
    const files = await editSkillFiles(proposal(), editor);
    const [firstPath] = readFileSync(edited, 'utf8').trim().split('\n');

    expect(files).toEqual([
      { path: 'SKILL.md', text: `${proposal().files[0].text}Edited in review.\n` },
      { path: 'ports.md', text: 'Port list\nEdited in review.\n' },
    ]);
    expect(existsSync(dirname(firstPath))).toBe(false);
  });

  test('a failing editor returns nothing', async () => {
    expect(await editSkillFiles(proposal(), 'false')).toBeUndefined();
  });

  test('a file path that leaves the folder is refused before anything is written', () => {
    expect(editSkillFiles(proposal({ files: [{ path: '../persona.md', text: 'You are someone else.\n' }] }), 'true')).rejects.toThrow(
      "the proposal's file ../persona.md leaves the skill's folder; nothing written",
    );
  });
});

describe('nixie skill approve and reject', () => {
  // Answers one proposal with --yes, recording each host command; skill-pending lists the pending.
  async function answer(kind, args) {
    const sent = [];
    const run = async (...command) => {
      sent.push(command);
      return command[0] === 'skill-pending' ? [proposal()] : { proposalID: 'k3x9m2p7qa', approvalID: 'approval-1' };
    };
    await answerSkillProposal(kind, args, { run, log: () => {}, ask: () => {} });
    return sent;
  }

  test('reject sends the reason through to skill-reject', async () => {
    const sent = await answer('reject', ['k3x9m2p7qa', '--reason', 'not needed', '--yes']);

    expect(sent).toEqual([['skill-pending'], ['skill-reject', 'k3x9m2p7qa', '--hash', 'hash-new', '--reason=not needed']]);
  });

  test('a rejection without a reason is refused and sends nothing', () => {
    expect(answer('reject', ['k3x9m2p7qa', '--yes'])).rejects.toThrow('usage: nixie skill reject <id> --reason <why>');
  });

  test('approve sends the approval under the hash shown, and opens no pull request', async () => {
    const sent = await answer('approve', ['k3x9m2p7qa', '--yes']);

    expect(sent).toEqual([['skill-pending'], ['skill-approve', 'k3x9m2p7qa', '--hash', 'hash-new']]);
  });

  test('the stopgap --pull-request option is gone', () => {
    expect(answer('approve', ['k3x9m2p7qa', '--pull-request=https://git.example.com/owner/definitions/pull/4', '--yes'])).rejects.toThrow(
      'unknown option --pull-request',
    );
  });

  test('an unknown proposal ID is refused', () => {
    expect(answer('approve', ['zzzzzzzzzz', '--yes'])).rejects.toThrow('no pending skill proposal zzzzzzzzzz');
  });
});

// An invented skill nixie wrote, in the shape `skill-written` prints, whose definitions changed
// after the approval.
const written = (overrides = {}) => ({
  approvalID: '5b1e0c7a-3d9f-4e62-8a14-7c2f6b0d9e31',
  proposalID: 'k3x9m2p7qa',
  name: 'tide-tables',
  skillHash: 'hash-new-0123456789',
  base: { skillHash: 'hash-old-0123456789', origin: 'definitions' },
  definitions: { skillHash: 'hash-edit-0123456789', origin: 'definitions' },
  isConflict: true,
  approvedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('nixie skill written and resolve', () => {
  test('a conflict shows what your definitions did and how to keep one side', () => {
    expect(formatWrittenSkill(written(), now)).toBe(
      [
        'tide-tables approval 5b1e0c7a-3d9f-4e62-8a14-7c2f6b0d9e31',
        '  from    proposal k3x9m2p7qa, approved 1d 0h ago',
        '  skill   hash-new-012 (replaces hash-old-012)',
        '  conflict your definitions changed it to hash-edit-01 after the approval',
        '  keep one: nixie skill resolve 5b1e0c7a-3d9f-4e62-8a14-7c2f6b0d9e31 --keep nixie|definitions',
      ].join('\n'),
    );
  });

  test('a new skill with no conflict shows no conflict line', () => {
    const shown = formatWrittenSkill(written({ base: null, definitions: null, isConflict: false }), now);

    expect(shown).toContain('(new to your definitions)');
    expect(shown).not.toContain('conflict');
  });

  test('resolve sends the side to keep for the approval', async () => {
    const sent = [];
    const run = async (...command) => (sent.push(command), command[0] === 'skill-written' ? [written()] : {});
    await resolveWrittenSkill(['5b1e0c7a-3d9f-4e62-8a14-7c2f6b0d9e31', '--keep', 'definitions', '--yes'], { run, log: () => {}, ask: () => {} });

    expect(sent).toEqual([['skill-written'], ['skill-resolve', '5b1e0c7a-3d9f-4e62-8a14-7c2f6b0d9e31', '--keep=definitions']]);
  });

  test('resolve refuses a side other than nixie or definitions', () => {
    expect(resolveWrittenSkill(['5b1e0c7a-3d9f-4e62-8a14-7c2f6b0d9e31', '--keep', 'both'], { run: async () => [] })).rejects.toThrow(
      'usage: nixie skill resolve <approval> --keep nixie|definitions',
    );
  });
});
