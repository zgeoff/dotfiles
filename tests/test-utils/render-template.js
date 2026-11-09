const personalBlock =
  /\s*\{\{- if (not \()?and \(hasKey \. "personal"\) \.personal\)? \}\}([\s\S]*?)\s*\{\{- end \}\}/g;

/**
 * Renders chezmoi template text as chezmoi would on a machine without the `personal` flag, for the
 * directives the source uses. Throws on any other directive, so a template change that this
 * render can't follow fails the test instead of running a half-rendered script.
 */
export function renderNonPersonalTemplate(template, { homeDir }) {
  const rendered = template
    .replace(personalBlock, (_block, negated, body) => (negated ? body : ''))
    .replaceAll('{{ .chezmoi.homeDir }}', homeDir);
  const leftover = rendered.match(/\{\{.*?\}\}/);

  if (leftover) {
    throw new Error(`renderNonPersonalTemplate: no rule for ${leftover[0]}`);
  }

  return rendered;
}
