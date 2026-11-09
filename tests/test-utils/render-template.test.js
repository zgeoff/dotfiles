import { expect, test } from 'bun:test';
import { renderTemplate } from './render-template.js';

test('it drops a personal-only block on a machine that is not personal', () => {
  const template = 'lamp=on\n{{- if and (hasKey . "personal") .personal }}\nkite=red\n{{- end }}\n';

  expect(renderTemplate(template, { homeDir: '/home/wren', personal: false, decrypted: {} })).toBe(
    'lamp=on\n',
  );
});

test('it keeps a personal-only block on a personal machine', () => {
  const template = 'lamp=on\n{{- if and (hasKey . "personal") .personal }}\nkite=red\n{{- end }}\n';

  expect(renderTemplate(template, { homeDir: '/home/wren', personal: true, decrypted: {} })).toBe(
    'lamp=on\nkite=red\n',
  );
});

test('it keeps a block for machines that are not personal on such a machine', () => {
  const template =
    'lamp=on\n{{- if not (and (hasKey . "personal") .personal) }}\nkite=red\n{{- end }}\n';

  expect(renderTemplate(template, { homeDir: '/home/wren', personal: false, decrypted: {} })).toBe(
    'lamp=on\nkite=red\n',
  );
});

test('it drops a block for machines that are not personal on a personal machine', () => {
  const template =
    'lamp=on\n{{- if not (and (hasKey . "personal") .personal) }}\nkite=red\n{{- end }}\n';

  expect(renderTemplate(template, { homeDir: '/home/wren', personal: true, decrypted: {} })).toBe(
    'lamp=on\n',
  );
});

test('it fills in the home directory', () => {
  const template = 'path={{ .chezmoi.homeDir }}/.kite\n';

  expect(renderTemplate(template, { homeDir: '/home/wren', personal: false, decrypted: {} })).toBe(
    'path=/home/wren/.kite\n',
  );
});

test('it fills in the trimmed text of a decrypted file', () => {
  const template =
    'tail={{ joinPath .chezmoi.sourceDir "kites/tail.txt.age" | include | decrypt | trim }}\n';

  expect(
    renderTemplate(template, {
      homeDir: '/home/wren',
      personal: true,
      decrypted: { 'kites/tail.txt.age': '  ribbon\n' },
    }),
  ).toBe('tail=ribbon\n');
});

test('it throws on a decrypted file it has no text for', () => {
  const template =
    'tail={{ joinPath .chezmoi.sourceDir "kites/tail.txt.age" | include | decrypt | trim }}\n';

  expect(() =>
    renderTemplate(template, { homeDir: '/home/wren', personal: true, decrypted: {} }),
  ).toThrow('no decrypted text for kites/tail.txt.age');
});

test('it throws on a malformed personal block', () => {
  const template =
    'lamp=on\n{{- if not (and (hasKey . "personal") .personal }}\nkite=red\n{{- end }}\n';

  expect(() =>
    renderTemplate(template, { homeDir: '/home/wren', personal: false, decrypted: {} }),
  ).toThrow('no rule for {{- if not (and (hasKey . "personal") .personal }}');
});

test('it throws on a directive split across lines', () => {
  const template = 'os={{\n  .chezmoi.os\n}}\n';

  expect(() =>
    renderTemplate(template, { homeDir: '/home/wren', personal: false, decrypted: {} }),
  ).toThrow('no rule for {{\n  .chezmoi.os\n}}');
});

test('it throws on a directive it has no rule for', () => {
  const template = 'os={{ .chezmoi.os }}\n';

  expect(() =>
    renderTemplate(template, { homeDir: '/home/wren', personal: false, decrypted: {} }),
  ).toThrow('no rule for {{ .chezmoi.os }}');
});
