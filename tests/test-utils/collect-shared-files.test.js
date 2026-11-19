import { expect, test } from 'bun:test';
import { collectSharedFiles } from './collect-shared-files.js';

test('it gives a file its target path, without the source attributes', () => {
  const sourceFiles = [
    { path: 'dot_local/bin/executable_kite', text: 'fly\n' },
    { path: 'dot_config/lamp/modify_private_config.json.tmpl', text: 'glow\n' },
  ];
  const ignoreText = '{{ if not (and (hasKey . "personal") .personal) }}\n{{ end }}\n';

  expect(collectSharedFiles(sourceFiles, ignoreText)).toStrictEqual([
    { target: '.local/bin/kite', text: 'fly\n' },
    { target: '.config/lamp/config.json', text: 'glow\n' },
  ]);
});

test('it leaves out a file that the ignore file keeps to personal machines', () => {
  const sourceFiles = [
    { path: 'dot_local/bin/executable_kite', text: 'fly\n' },
    { path: 'dot_local/bin/executable_heron', text: 'wade\n' },
  ];
  const ignoreText =
    '{{ if not (and (hasKey . "personal") .personal) }}\n# reads the heron vault\n.local/bin/heron\n{{ end }}\n';

  expect(collectSharedFiles(sourceFiles, ignoreText)).toStrictEqual([
    { target: '.local/bin/kite', text: 'fly\n' },
  ]);
});

test('it leaves out each file under a folder that the ignore file keeps to personal machines', () => {
  const sourceFiles = [
    { path: 'dot_claude/skills/heron/SKILL.md', text: 'wade\n' },
    { path: 'dot_claude/skills/heron-watch/SKILL.md', text: 'look\n' },
  ];
  const ignoreText =
    '{{ if not (and (hasKey . "personal") .personal) }}\n.claude/skills/heron\n.claude/skills/heron/**\n{{ end }}\n';

  expect(collectSharedFiles(sourceFiles, ignoreText)).toStrictEqual([
    { target: '.claude/skills/heron-watch/SKILL.md', text: 'look\n' },
  ]);
});

test('it cuts a personal-only block from a file', () => {
  const sourceFiles = [
    {
      path: 'dot_lamp.tmpl',
      text: 'lamp=on\n{{- if and (hasKey . "personal") .personal }}\nkite=red\n{{- end }}\nheron=grey\n',
    },
  ];
  const ignoreText = '{{ if not (and (hasKey . "personal") .personal) }}\n{{ end }}\n';

  expect(collectSharedFiles(sourceFiles, ignoreText)).toStrictEqual([
    { target: '.lamp', text: 'lamp=on\n\nheron=grey\n' },
  ]);
});

test('it writes a shared template in where a file calls it, and leaves out a template called from a personal-only block', () => {
  const sourceFiles = [
    { path: '.chezmoitemplates/rules/shared.md', text: 'Keep the lamp on.' },
    { path: '.chezmoitemplates/rules/private.md', text: 'Feed the heron.' },
    {
      path: 'dot_rules.md.tmpl',
      text: '{{ template "rules/shared.md" . }}\n{{- if and (hasKey . "personal") .personal }}\n{{ template "rules/private.md" . }}\n{{- end }}\n',
    },
  ];
  const ignoreText = '{{ if not (and (hasKey . "personal") .personal) }}\n{{ end }}\n';

  expect(collectSharedFiles(sourceFiles, ignoreText)).toStrictEqual([
    { target: '.rules.md', text: 'Keep the lamp on.\n\n' },
  ]);
});

test('it gives an encrypted file no text', () => {
  const sourceFiles = [{ path: 'private_dot_ssh/encrypted_private_config.tmpl.age', text: 'sealed' }];
  const ignoreText = '{{ if not (and (hasKey . "personal") .personal) }}\n{{ end }}\n';

  expect(collectSharedFiles(sourceFiles, ignoreText)).toStrictEqual([
    { target: '.ssh/config', text: null },
  ]);
});

test('it rejects an ignore file with no block for machines that are not personal', () => {
  const sourceFiles = [{ path: 'dot_lamp', text: 'lamp=on\n' }];

  expect(() => collectSharedFiles(sourceFiles, '.local/bin/kite\n')).toThrow(
    /no block for machines that are not personal/,
  );
});
