import { expect, test } from 'bun:test';
import { renderNonPersonalTemplate } from './render-template.js';

test('it drops a personal-only block', () => {
  const template = 'lamp=on\n{{- if and (hasKey . "personal") .personal }}\nkite=red\n{{- end }}\n';

  expect(renderNonPersonalTemplate(template, { homeDir: '/home/wren' })).toBe('lamp=on\n');
});

test('it keeps a block for machines that are not personal', () => {
  const template =
    'lamp=on\n{{- if not (and (hasKey . "personal") .personal) }}\nkite=red\n{{- end }}\n';

  expect(renderNonPersonalTemplate(template, { homeDir: '/home/wren' })).toBe(
    'lamp=on\nkite=red\n',
  );
});

test('it fills in the home directory', () => {
  const template = 'path={{ .chezmoi.homeDir }}/.kite\n';

  expect(renderNonPersonalTemplate(template, { homeDir: '/home/wren' })).toBe(
    'path=/home/wren/.kite\n',
  );
});

test('it throws on a directive it has no rule for', () => {
  const template = 'os={{ .chezmoi.os }}\n';

  expect(() => renderNonPersonalTemplate(template, { homeDir: '/home/wren' })).toThrow(
    'no rule for {{ .chezmoi.os }}',
  );
});
