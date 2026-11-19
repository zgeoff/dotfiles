const templateDir = '.chezmoitemplates/';
const personalOnlyIgnoreBlock =
  /\{\{-? if not \(and \(hasKey \. "personal"\) \.personal\) -?\}\}([\s\S]*?)\{\{-? end -?\}\}/;
const personalOnlyBlock =
  /\{\{-? if and \(hasKey \. "personal"\) \.personal -?\}\}[\s\S]*?\{\{-? end -?\}\}/g;
const templateCall = /\{\{-? template "([^"]+)" \. -?\}\}/g;
const sourceAttributes =
  /^(?:after_|before_|create_|empty_|encrypted_|exact_|executable_|literal_|modify_|once_|onchange_|private_|readonly_|remove_|run_|symlink_)+/;

// The files that a machine with `personal` false gets, as { target, text }. `sourceFiles` holds each
// file under home/ as { path, text }, with the path relative to home/. A personal-only block is cut
// from each text, and a shared template is written in where a file calls it. An encrypted file has
// no text.
export function collectSharedFiles(sourceFiles, ignoreText) {
  const personalOnlyPaths = collectPersonalOnlyPaths(ignoreText);
  const templates = new Map(
    sourceFiles
      .filter((file) => file.path.startsWith(templateDir))
      .map((file) => [file.path.slice(templateDir.length), file.text]),
  );

  return sourceFiles
    .filter((file) => !file.path.startsWith(templateDir) && file.path !== '.chezmoiignore')
    .map((file) => ({ target: toTargetPath(file.path), source: file }))
    .filter((entry) => !isPersonalOnly(entry.target, personalOnlyPaths))
    .map((entry) => ({
      target: entry.target,
      text: entry.source.path.endsWith('.age') ? null : expandSharedText(entry.source.text, templates),
    }));
}

function collectPersonalOnlyPaths(ignoreText) {
  const block = ignoreText.match(personalOnlyIgnoreBlock);

  if (!block) {
    throw new Error('collectSharedFiles: the ignore file has no block for machines that are not personal');
  }

  return block[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

function toTargetPath(sourcePath) {
  return sourcePath
    .split('/')
    .map((segment) => segment.replace(sourceAttributes, '').replace(/^dot_/, '.'))
    .join('/')
    .replace(/\.age$/, '')
    .replace(/\.tmpl$/, '');
}

function isPersonalOnly(target, personalOnlyPaths) {
  return personalOnlyPaths.some((path) =>
    path.endsWith('/**') ? target.startsWith(path.slice(0, -2)) : target === path,
  );
}

function expandSharedText(text, templates) {
  return text.replace(personalOnlyBlock, '').replace(templateCall, (_call, name) => {
    if (!templates.has(name)) {
      throw new Error(`collectSharedFiles: no template named ${name}`);
    }

    return expandSharedText(templates.get(name), templates);
  });
}
