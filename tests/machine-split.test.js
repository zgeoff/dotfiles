import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectSharedFiles } from './test-utils/collect-shared-files.js';

const homePath = join(import.meta.dir, '../home');

function setupTest() {
  const sourceFiles = readdirSync(homePath, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);

      return { path: path.slice(homePath.length + 1), text: readFileSync(path, 'utf8') };
    });
  const sharedFiles = collectSharedFiles(sourceFiles, readFileSync(join(homePath, '.chezmoiignore'), 'utf8'));

  return {
    listSharedNames: (folder) => [
      ...new Set(
        sharedFiles
          .filter((file) => file.target.startsWith(`${folder}/`))
          .map((file) => file.target.slice(folder.length + 1).split('/')[0]),
      ),
    ].sort(),
    // The settings script names the op-mint rules to remove them. claude-settings.test.js checks
    // what it writes.
    findPersonalReferences: () =>
      sharedFiles
        .filter((file) => file.target !== '.claude/settings.json')
        .flatMap((file) =>
          (file.text?.match(/op-mint|geoff\.cloud|op:\/\/|vault[ =]zgeoff|zgeoff\/files-agent-token/g) ?? []).map(
            (reference) => `${file.target}: ${reference}`,
          ),
        ),
  };
}

// A new CLI fails this test until it is listed here, or kept to personal machines in the block of
// home/.chezmoiignore for machines that are not personal.
test('it gives a machine that is not personal only the listed CLIs', () => {
  const ctx = setupTest();

  expect(ctx.listSharedNames('.local/bin')).toStrictEqual([
    'clip',
    'csql',
    'forecast',
    'gst',
    'qcheck',
    'qpeek',
    'qrm',
    'weather',
    'widget',
    'wtmv',
    'wtnb',
    'wtpick',
    'wtrm',
    'zed',
  ]);
});

// A new skill fails this test until it is listed here, or kept to personal machines in the block of
// home/.chezmoiignore for machines that are not personal.
test('it gives a machine that is not personal only the listed skills', () => {
  const ctx = setupTest();

  expect(ctx.listSharedNames('.claude/skills')).toStrictEqual(['build-feature', 'function-naming']);
});

test('it keeps 1Password references and personal host names out of each file a machine that is not personal gets', () => {
  const ctx = setupTest();

  expect(ctx.findPersonalReferences()).toStrictEqual([]);
});
