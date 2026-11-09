const personalOnlyBlock =
  /\s*\{\{- if and \(hasKey \. "personal"\) \.personal \}\}([\s\S]*?)\s*\{\{- end \}\}/g;
const nonPersonalBlock =
  /\s*\{\{- if not \(and \(hasKey \. "personal"\) \.personal\) \}\}([\s\S]*?)\s*\{\{- end \}\}/g;
const decryptedInclude =
  /\{\{ joinPath \.chezmoi\.sourceDir "([^"]+)" \| include \| decrypt \| trim \}\}/g;

export function renderTemplate(template, { homeDir, personal, decrypted }) {
  const rendered = template
    .replace(personalOnlyBlock, (_block, body) => (personal ? body : ''))
    .replace(nonPersonalBlock, (_block, body) => (personal ? '' : body))
    .replace(decryptedInclude, (directive, path) => {
      if (!(path in decrypted)) {
        throw new Error(`renderTemplate: no decrypted text for ${path}`);
      }

      return decrypted[path].trim();
    })
    .replaceAll('{{ .chezmoi.homeDir }}', homeDir);
  const leftover = rendered.match(/\{\{[\s\S]*?\}\}/);

  if (leftover) {
    throw new Error(`renderTemplate: no rule for ${leftover[0]}`);
  }

  return rendered;
}
