import { afterAll, describe, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Failure,
  editInEditor,
  formatReviewSummary,
  reviewProposals,
} from '../home/dot_local/bin/executable_nixie';

// Invented proposals in the shape `memory-pending` prints.
const proposal = (n, text) => ({
  proposalID: `${String(n).repeat(8)}-0000-4000-8000-000000000000`,
  actionHash: `hash-${n}`,
  operation: 'create',
  targetVersion: null,
  isPinned: false,
  reason: 'said so in a chat',
  createdAt: '2026-01-01T00:00:00.000Z',
  lapseAt: '2026-01-08T00:00:00.000Z',
  origin: 'owner',
  source: 'chat',
  text,
  quote: null,
});

const scratch = mkdtempSync(join(tmpdir(), 'nixie-test-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

// A stub editor: writes fixed text over the file it is given, or exits 1.
function stubEditor(name, body) {
  const path = join(scratch, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

// Drives reviewProposals with scripted keys. run records each host command and answers it the
// way the server would; a hash in staleHashes refuses the answer, as a changed proposal does.
async function drive(pending, keys, { editText = async () => undefined, staleHashes = [] } = {}) {
  const sent = [];
  const lines = [];
  const prompts = [];
  const run = async (...args) => {
    sent.push(args);
    const hash = args[args.indexOf('--hash') + 1];
    if (staleHashes.includes(hash)) {
      throw new Failure(`${args[0]} failed (exit 1): 409: the proposal changed since it was read`);
    }
    return args[0] === 'memory-approve' ? { status: 'applied', itemID: 'item-1', version: 1 } : {};
  };
  const readKey = async (question) => {
    prompts.push(question);
    return keys.shift() ?? 'q';
  };
  const counts = await reviewProposals(pending, { run, readKey, editText, log: (line) => lines.push(line) });
  return { counts, sent, lines, prompts };
}

describe('nixie memory review', () => {
  test('approve, reject, edit and skip each send the right command, and the summary counts match', async () => {
    const pending = [
      proposal(1, 'Prefers tea to coffee'),
      proposal(2, 'Owns a red bicycle'),
      proposal(3, 'Lives near a lighthouse'),
      proposal(4, 'Plays the oboe'),
    ];
    const editor = stubEditor('edit.sh', 'printf "Lives near two lighthouses\\n" > "$1"');
    const { counts, sent } = await drive(pending, ['a', 'r', 'e', 's'], {
      editText: (text) => editInEditor(text, editor),
    });

    expect(sent).toEqual([
      ['memory-approve', pending[0].proposalID, '--hash', 'hash-1'],
      ['memory-reject', pending[1].proposalID, '--hash', 'hash-2'],
      ['memory-approve', pending[2].proposalID, '--hash', 'hash-3', '--text=Lives near two lighthouses'],
    ]);
    expect(counts).toMatchObject({ approved: 1, rejected: 1, edited: 1, skipped: 1, refused: 0, unanswered: 0 });
    expect(formatReviewSummary(counts)).toBe('approved 1, edited 1, rejected 1, skipped 1');
  });

  test('a proposal whose action hash changed is refused, reported, and the loop goes on', async () => {
    const pending = [proposal(1, 'Prefers tea to coffee'), proposal(2, 'Owns a red bicycle')];
    const { counts, sent, lines } = await drive(pending, ['a', 'a'], { staleHashes: ['hash-1'] });

    expect(sent.map((args) => args[1])).toEqual([pending[0].proposalID, pending[1].proposalID]);
    expect(lines.some((line) => line.includes('refused: memory-approve failed (exit 1): 409'))).toBe(true);
    expect(counts).toMatchObject({ approved: 1, refused: 1 });
    expect(formatReviewSummary(counts)).toBe('approved 1, edited 0, rejected 0, skipped 0, refused 1');
  });

  test('q quits and counts the rest as unanswered; an unknown key asks again', async () => {
    const pending = [proposal(1, 'Prefers tea to coffee'), proposal(2, 'Owns a red bicycle'), proposal(3, 'Plays the oboe')];
    const { counts, sent, prompts } = await drive(pending, ['x', 's', 'q']);

    expect(sent).toEqual([]);
    expect(prompts.length).toBe(3);
    expect(formatReviewSummary(counts)).toBe('approved 0, edited 0, rejected 0, skipped 1; quit with 2 unanswered');
  });

  test('a failed editor or a blank edit sends nothing and asks again; an unchanged edit approves as is', async () => {
    const failing = stubEditor('fail.sh', 'exit 1');
    const blank = stubEditor('blank.sh', ': > "$1"');
    const editors = [failing, blank, 'true'];
    const pending = [proposal(1, 'Prefers tea to coffee')];
    const { counts, sent } = await drive(pending, ['e', 'e', 'e'], {
      editText: (text) => editInEditor(text, editors.shift()),
    });

    expect(sent).toEqual([['memory-approve', pending[0].proposalID, '--hash', 'hash-1']]);
    expect(counts).toMatchObject({ approved: 1, edited: 0 });
  });

  test('an approval the server holds for a close match counts as held', async () => {
    const lines = [];
    const counts = await reviewProposals([proposal(1, 'Prefers tea to coffee')], {
      run: async () => ({ status: 'close_match', item: { itemID: 'item-9', version: 2 } }),
      readKey: async () => 'a',
      editText: async () => undefined,
      log: (line) => lines.push(line),
    });

    expect(counts).toMatchObject({ approved: 0, held: 1 });
    expect(lines.at(-1)).toContain('held: it closely matches item-9 v2');
  });
});

describe('nixie memory --help', () => {
  for (const flag of ['--help', '-h']) {
    test(`${flag} prints the usage and exits 0`, () => {
      const proc = Bun.spawnSync(['bun', join(import.meta.dir, '../home/dot_local/bin/executable_nixie'), 'memory', flag]);
      expect(proc.exitCode).toBe(0);
      expect(proc.stdout.toString()).toStartWith('usage: nixie memory pending | review');
    });
  }
});
