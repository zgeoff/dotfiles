const personalOnlyBlock =
  /\s*\{\{- if and \(hasKey \. "personal"\) \.personal \}\}[\s\S]*?\s*\{\{- end \}\}/g;
const nonPersonalBlock =
  /\s*\{\{- if not \(and \(hasKey \. "personal"\) \.personal\) \}\}([\s\S]*?)\s*\{\{- end \}\}/g;

export function renderNonPersonalTemplate(template, { homeDir }) {
  const rendered = template
    .replace(personalOnlyBlock, '')
    .replace(nonPersonalBlock, '$1')
    .replaceAll('{{ .chezmoi.homeDir }}', homeDir);
  const leftover = rendered.match(/\{\{[\s\S]*?\}\}/);

  if (leftover) {
    throw new Error(`renderNonPersonalTemplate: no rule for ${leftover[0]}`);
  }

  return rendered;
}
