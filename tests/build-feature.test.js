import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const scriptPath = join(import.meta.dir, '../home/dot_claude/workflows/build-feature.js');

// The Workflow runtime runs the script body as an async function, so its
// top-level returns only parse once the meta export is cut off.
function loadWorkflow() {
  const source = readFileSync(scriptPath, 'utf8');
  const body = source.slice(source.indexOf('\n};\n') + 4);
  const AsyncFunction = (async () => {}).constructor;
  const run = new AsyncFunction('args', 'agent', 'log', 'phase', 'parallel', body);
  // The Workflow runtime's parallel: a thunk that throws resolves to null.
  const parallel = (thunks) => Promise.all(thunks.map((thunk) => thunk().catch(() => null)));
  return (args, agent, log, phase) => run(args, agent, log, phase, parallel);
}

// A scout result for a branch that changes no doc and a repo with no verify skill.
const plainScan = {
  worktreePath: '/repo/.worktrees/quota-check',
  head: 'aaa0001',
  docRule: 'Markdown under docs/',
  docFiles: [],
  deslopSkillDir: '/repo/.agents/skills/deslop',
  coldReadSkillDir: '/repo/.agents/skills/cold-read',
  rulesFiles: ['/repo/.agents/skills/docs-writing/SKILL.md'],
  checkLines: true,
  verifySkill: '',
};

// Invented findings for a plan that never ran.
const quotaFinding = {
  file: 'src/quota.ts',
  line: 12,
  severity: 'blocking',
  summary: 'The quota check counts a refunded order twice.',
};
const labelFinding = {
  file: 'src/labels.ts',
  line: 4,
  severity: 'blocking',
  summary: 'The label helper drops the trailing unit.',
};
const unitFinding = {
  file: 'src/units.ts',
  line: 9,
  severity: 'minor',
  summary: 'The unit table lists grams twice.',
};

/**
 * Runs the workflow against stub agents. `reviews` maps a review label to the
 * findings it returns; a label it doesn't name returns no findings. `review`
 * is the workflow's review arg, left out when null.
 */
async function dryRun(reviews, review) {
  const calls = [];
  const trace = [];
  const agent = async (prompt, opts) => {
    calls.push({ label: opts.label, prompt });
    trace.push(`agent ${opts.label}`);
    if (opts.label === 'implement') return { status: 'done', summary: 'Adds a quota check.', commits: [] };
    if (opts.label === 'scan-repo') return plainScan;
    if (opts.label.startsWith('codex-')) {
      return { ran: true, findings: reviews[opts.label.slice('codex-'.length)] || [] };
    }
    if (opts.label.startsWith('fix-')) {
      return { status: 'done', summary: 'Fixed.' };
    }
    if (opts.label === 'open-pr') {
      return { url: 'https://github.com/example/shop/pull/7', number: 7, resolvedConflicts: false };
    }
    if (opts.label.startsWith('watch-ci-')) return { conclusion: 'green', failures: [] };
    throw new Error(`unexpected agent ${opts.label}`);
  };
  const result = await loadWorkflow()(
    { plan: 'Add a quota check to checkout.', branch: 'quota-check', ...(review === null ? {} : { review }) },
    agent,
    (line) => trace.push(`log   ${line}`),
    () => {},
  );
  return { result, calls, trace, labels: calls.map((c) => c.label) };
}

describe('build-feature review arg', () => {
  test('with no review arg, the run skips the review and opens its PR', async () => {
    const run = await dryRun({}, null);
    expect(run.labels).toEqual(['implement', 'scan-repo', 'open-pr', 'watch-ci-1']);
    expect(run.result).toMatchObject({ status: 'ready', reviewedBy: [], minorFindings: [] });
  });

  test('review "none" skips the review and opens its PR', async () => {
    const run = await dryRun({}, 'none');
    expect(run.labels).toEqual(['implement', 'scan-repo', 'open-pr', 'watch-ci-1']);
  });

  test('review "codex" runs the review before the PR opens', async () => {
    const run = await dryRun({}, 'codex');
    expect(run.labels).toEqual(['implement', 'codex-review', 'scan-repo', 'open-pr', 'watch-ci-1']);
    expect(run.result).toMatchObject({ status: 'ready', reviewedBy: ['codex'] });
  });

  test('an unknown review value stops the run at its argument check', async () => {
    await expect(dryRun({}, 'gemini')).rejects.toThrow('review must be "none", "codex" or "opus"');
  });
});

describe('build-feature review loop', () => {
  test('a finding that survives 2 fix rounds ends review-blocked with no third round', async () => {
    const run = await dryRun({
      review: [quotaFinding],
      're-review-1': [quotaFinding],
      're-review-2': [quotaFinding],
    }, 'codex');
    if (process.env.DRY_RUN) console.log([...run.trace, `status ${run.result.status}`].join('\n'));
    expect(run.labels).toEqual([
      'implement',
      'codex-review',
      'fix-review-1',
      'codex-re-review-1',
      'fix-review-2',
      'codex-re-review-2',
    ]);
    expect(run.result).toMatchObject({
      status: 'review-blocked',
      reason: 'blocking findings remain after 2 fix rounds',
      outstandingFindings: [quotaFinding],
    });
    expect(run.result).not.toHaveProperty('redesigned');
  });

  test('a branch clean after the second fix round opens its PR', async () => {
    const run = await dryRun({ review: [quotaFinding], 're-review-1': [labelFinding] }, 'codex');
    expect(run.labels).toContain('open-pr');
    expect(run.result).toMatchObject({ status: 'ready' });
  });

  test('minor findings from the first review reach the report after a clean re-review', async () => {
    const run = await dryRun({ review: [quotaFinding, unitFinding] }, 'codex');
    expect(run.labels).toContain('codex-re-review-1');
    expect(run.result).toMatchObject({ status: 'ready', minorFindings: [unitFinding] });
  });

  test('minor findings from the first review reach a review-blocked report', async () => {
    const run = await dryRun({
      review: [quotaFinding, unitFinding],
      're-review-1': [quotaFinding],
      're-review-2': [quotaFinding],
    }, 'codex');
    expect(run.result).toMatchObject({ status: 'review-blocked', minorFindings: [unitFinding] });
  });

  test('each fixer holds the whole diff to the cited rule', async () => {
    const run = await dryRun({ review: [quotaFinding], 're-review-1': [quotaFinding], 're-review-2': [quotaFinding] }, 'codex');
    for (const label of ['fix-review-1', 'fix-review-2']) {
      const prompt = run.calls.find((c) => c.label === label).prompt;
      expect(prompt).toContain('re-read the rule it cites');
      expect(prompt).toContain('search the whole PR diff');
      expect(prompt).toContain('Hold new code, tests included, to every rule.');
      expect(prompt).toContain('A round limit is never a reason to skip a fix');
    }
  });
});

describe('build-feature gh repo', () => {
  // A red first CI round sends the fixer, so every prompt after the PR runs.
  async function runWithRedCi() {
    const calls = [];
    const agent = async (prompt, opts) => {
      calls.push({ label: opts.label, prompt });
      if (opts.label === 'implement') return { status: 'done', summary: 'Adds a quota check.', commits: [] };
      if (opts.label === 'scan-repo') return plainScan;
      if (opts.label === 'open-pr') {
        return { url: 'https://github.com/example/shop/pull/7', number: 7, resolvedConflicts: false };
      }
      if (opts.label === 'watch-ci-1') {
        return { conclusion: 'red', failures: [{ check: 'test', summary: 'quota test failed', excerpt: '' }] };
      }
      if (opts.label === 'fix-ci-1') return { status: 'done', summary: 'Fixed.' };
      if (opts.label === 'watch-ci-2') return { conclusion: 'green', failures: [] };
      throw new Error(`unexpected agent ${opts.label}`);
    };
    const result = await loadWorkflow()(
      { plan: 'Add a quota check to checkout.', branch: 'quota-check' },
      agent,
      () => {},
      () => {},
    );
    return { result, prompt: (label) => calls.find((c) => c.label === label).prompt };
  }

  test('the CI watcher names the PR repo in every gh command', async () => {
    const run = await runWithRedCi();
    expect(run.result).toMatchObject({ status: 'ready' });
    const prompt = run.prompt('watch-ci-1');
    expect(prompt).toContain('gh pr checks 7 -R example/shop --watch');
    expect(prompt).toContain('gh pr view 7 -R example/shop --json');
    expect(prompt).toContain('gh run view <run-id> -R example/shop --log-failed');
    expect(prompt).toContain('gh run list -R example/shop --branch quota-check');
    expect(prompt).not.toMatch(/gh pr (checks|view) 7 --/);
  });

  test('the CI fixer names the PR repo', async () => {
    const run = await runWithRedCi();
    expect(run.prompt('fix-ci-1')).toContain('Pass `-R example/shop` to every `gh` command');
  });

  test('the PR opener runs gh from inside the worktree', async () => {
    const run = await runWithRedCi();
    expect(run.prompt('open-pr')).toContain('cd .worktrees/quota-check && gh');
  });

  test('a PR URL with no GitHub repo stops the run before CI', async () => {
    const agent = async (_prompt, opts) => {
      if (opts.label === 'implement') return { status: 'done', summary: 'Adds a quota check.', commits: [] };
      if (opts.label === 'scan-repo') return plainScan;
      if (opts.label === 'open-pr') return { url: 'PR #7', number: 7, resolvedConflicts: false };
      throw new Error(`unexpected agent ${opts.label}`);
    };
    const result = await loadWorkflow()({ plan: 'Add a quota check.', branch: 'quota-check' }, agent, () => {}, () => {});
    expect(result).toMatchObject({ status: 'failed', stage: 'open-pr' });
  });
});

// An invented doc that a plan for a quota check changes.
const quotaDoc = {
  path: '/repo/.worktrees/quota-check/docs/quota.md',
  kind: 'doc',
  sections: ['Refunds'],
};
const docScan = { ...plainScan, docFiles: [quotaDoc] };
const plan = 'Add a quota check to checkout.';

/**
 * Runs the workflow with stub agents for the doc check, verify and CI stages.
 * `compare(read)` gives the compare agent's result for each read of the doc,
 * `ci` lists each CI watch result in turn, and `fix` gives each CI fix result.
 */
async function stageRun({ scan, compare, ci, fix, verify, reader, openPrHashes = true } = {}) {
  const calls = [];
  const ciResults = [...(ci || [{ conclusion: 'green', failures: [] }])];
  const agent = async (prompt, opts) => {
    calls.push({ label: opts.label, prompt, opts });
    const label = opts.label;
    if (label === 'implement') return { status: 'done', summary: 'Adds a quota check.', commits: [] };
    if (label === 'scan-repo') return scan || plainScan;
    if (label.includes('docs-checks-')) return { changed: false, summary: 'The docs checks pass.' };
    if (label.includes('deslop-check-')) return { changed: true, summary: 'Kept both passes.' };
    if (label.startsWith('deslop-')) return '### Cut drama words\n```diff\n- critical\n+ needed\n```';
    if (label.startsWith('commit-') || label.startsWith('push-docs-') || label.includes('-commit-')) return { committed: true, head: `sha-${label}` };
    if (label.includes('cold-answers-')) return { answers: '1. Read it before changing a quota.' };
    if (/(^|-)cold-read-\d/.test(label)) return reader ? reader(label) : 'Report: question 1 answered as "read it after checkout".';
    if (label.includes('cold-compare-')) {
      const read = Number(label.split('-').at(-1));
      return (compare || (() => ({ clean: true, changedFiles: [], changedSections: [], differences: [] })))(read);
    }
    if (label === 'open-pr') {
      const pr = { url: 'https://github.com/example/shop/pull/7', number: 7, resolvedConflicts: false };
      const deslop = /- \[x\] Deslop \(([^)]+)\)/.exec(prompt);
      const coldRead = /- \[x\] Cold read \(([^)]+)\)/.exec(prompt);
      if (!openPrHashes || !deslop) return pr;
      return { ...pr, deslopCommit: deslop[1], coldReadCommit: coldRead[1] };
    }
    if (label.startsWith('verify-')) {
      return (verify || (() => ({ status: 'published', unverified: [], docFilesChanged: [] })))(label);
    }
    if (label.startsWith('watch-ci-')) return ciResults.shift();
    if (label.startsWith('fix-ci-')) return (fix || (() => ({ status: 'done', summary: 'Fixed.' })))(label);
    if (label.startsWith('retick-')) {
      const [, deslopCommit] = /Deslop \(([^)]+)\)/.exec(prompt);
      const [, coldReadCommit] = /Cold read \(([^)]+)\)/.exec(prompt);
      return { deslopCommit, coldReadCommit };
    }
    throw new Error(`unexpected agent ${label}`);
  };
  const result = await loadWorkflow()({ plan, branch: 'quota-check' }, agent, () => {}, () => {});
  const labels = calls.map((c) => c.label);
  return { result, labels, calls, prompt: (label) => calls.find((c) => c.label === label).prompt };
}

const fixedOnce = (read) =>
  read === 1
    ? { clean: false, changedFiles: [quotaDoc.path], changedSections: ['Refunds'], differences: ['Q1 differed'] }
    : { clean: true, changedFiles: [], changedSections: [], differences: [] };

describe('build-feature doc check', () => {
  test('a branch that changes no doc skips the doc check', async () => {
    const run = await stageRun();
    expect(run.labels.filter((l) => /^(deslop|cold|commit)-/.test(l))).toEqual([]);
    expect(run.result).toMatchObject({ status: 'ready', docCheck: null });
    expect(run.prompt('open-pr')).not.toContain('- [x] Deslop');
  });

  test('a changed doc gets two deslop passes, then a cold read, before the PR opens', async () => {
    const run = await stageRun({ scan: docScan });
    expect(run.labels).toEqual([
      'implement',
      'scan-repo',
      'deslop-1-1',
      'deslop-check-1-1',
      'deslop-1-2',
      'deslop-check-1-2',
      'docs-checks-before',
      'commit-deslop',
      'cold-answers-1',
      'cold-read-1-1',
      'cold-compare-1-1',
      'open-pr',
      'watch-ci-1',
    ]);
    expect(run.result).toMatchObject({ status: 'ready', docCheck: { stillDiffer: [] } });
  });

  test('the deslop and cold-reader agents get the skills\' prompts and nothing else', async () => {
    const run = await stageRun({ scan: docScan });
    expect(run.prompt('deslop-1-1')).toBe(
      'Read /repo/.agents/skills/deslop/SKILL.md and follow it as your instructions.\n' +
        `The text: ${quotaDoc.path}\nIt is a: doc\nDeslop these sections: Refunds`,
    );
    expect(run.prompt('cold-read-1-1')).toBe(
      'Read /repo/.agents/skills/cold-read/references/cold-reader.md and follow it as your instructions.\n' +
        `The file: ${quotaDoc.path}\nIt is a: doc\nThe rules: /repo/.agents/skills/docs-writing/SKILL.md`,
    );
    for (const label of ['deslop-1-1', 'cold-read-1-1']) {
      const call = run.calls.find((c) => c.label === label);
      expect(call.prompt).not.toContain(plan);
      expect(call.opts).toMatchObject({ model: 'sonnet', agentType: 'general-purpose' });
    }
  });

  test('a doc that never reads clean stops after 3 cold reads', async () => {
    const run = await stageRun({
      scan: docScan,
      compare: () => ({ clean: false, changedFiles: [quotaDoc.path], changedSections: ['Refunds'], differences: ['Q2 differed'] }),
    });
    expect(run.labels.filter((l) => l.startsWith('cold-read-'))).toEqual(['cold-read-1-1', 'cold-read-1-2', 'cold-read-1-3']);
    expect(run.labels).toContain('deslop-1-after-cold-read-2');
    expect(run.result).toMatchObject({
      status: 'ready',
      docCheck: { stillDiffer: ['docs/quota.md: Q2 differed'], unreadFixes: [quotaDoc.path] },
    });
  });

  test('every agent the doc check and verify start names a model', async () => {
    const run = await stageRun({
      scan: { ...docScan, verifySkill: '/repo/.agents/skills/verify/SKILL.md' },
      compare: fixedOnce,
    });
    expect(run.calls.filter((c) => !c.opts.model).map((c) => c.label)).toEqual([]);
  });

  test('more doc files than the cap stops the run before any deslop agent', async () => {
    const docFiles = Array.from({ length: 21 }, (_, i) => ({ ...quotaDoc, path: `/repo/docs/page-${i}.md` }));
    const run = await stageRun({ scan: { ...docScan, docFiles } });
    expect(run.labels).toEqual(['implement', 'scan-repo']);
    expect(run.result).toMatchObject({ status: 'blocked', stage: 'doc-check' });
  });
});

describe('build-feature PR body ticks', () => {
  test('a clean first read ticks both lines at the deslop commit', async () => {
    const run = await stageRun({ scan: docScan });
    const body = run.prompt('open-pr');
    expect(body).toContain('- [x] Deslop (sha-commit-deslop)');
    expect(body).toContain('- [x] Cold read (sha-commit-deslop)');
  });

  test('Deslop ticks the last deslop commit, and Cold read the commit the last read read', async () => {
    const run = await stageRun({ scan: docScan, compare: fixedOnce });
    const body = run.prompt('open-pr');
    expect(body).toContain('- [x] Deslop (sha-commit-deslop-after-cold-read)');
    expect(body).toContain('- [x] Cold read (sha-commit-cold-read-1)');
    expect(run.result.docCheck.ticks).toEqual({
      deslop: 'sha-commit-deslop-after-cold-read',
      coldRead: 'sha-commit-cold-read-1',
    });
  });

  test('a repo whose template has no tick lines leaves them to the template', async () => {
    const run = await stageRun({ scan: { ...docScan, checkLines: false } });
    expect(run.labels).toContain('deslop-1-1');
    expect(run.prompt('open-pr')).not.toContain('- [x] Deslop');
    expect(run.prompt('open-pr')).toContain('Write the Checks section as the template says.');
  });

  test('a CI fix that changes a doc moves the Deslop tick and leaves Cold read', async () => {
    const run = await stageRun({
      scan: docScan,
      ci: [
        { conclusion: 'red', failures: [{ check: 'docs', summary: 'a link is broken' }] },
        { conclusion: 'green', failures: [] },
      ],
      fix: () => ({ status: 'done', summary: 'Fixed the link.', docFilesChanged: [quotaDoc.path] }),
    });
    expect(run.labels).toContain('deslop-ci-1-1-2');
    const retick = run.prompt('retick-ci-1');
    expect(retick).toContain('- [x] Deslop (sha-commit-deslop-ci-1)');
    expect(retick).toContain('- [x] Cold read (sha-commit-deslop)');
    expect(retick).toContain('change only these two lines');
    expect(run.result).toMatchObject({
      status: 'ready',
      docCheck: { ticks: { deslop: 'sha-commit-deslop-ci-1', coldRead: 'sha-commit-deslop' } },
    });
  });

  test('a CI fix that changes no doc leaves both ticks', async () => {
    const run = await stageRun({
      scan: docScan,
      ci: [
        { conclusion: 'red', failures: [{ check: 'test', summary: 'quota test failed' }] },
        { conclusion: 'green', failures: [] },
      ],
      fix: () => ({ status: 'done', summary: 'Fixed.', docFilesChanged: [] }),
    });
    expect(run.labels.filter((l) => l.startsWith('retick-') || l.startsWith('deslop-ci-'))).toEqual([]);
  });

  test('a rebase after a merge conflict moves both ticks to their copies', async () => {
    const run = await stageRun({
      scan: docScan,
      ci: [
        { conclusion: 'red', failures: [{ check: 'merge-conflict', summary: 'CONFLICTING' }] },
        { conclusion: 'green', failures: [] },
      ],
      fix: () => ({ status: 'done', summary: 'Rebased.', resolvedConflicts: true, docFilesChanged: [] }),
    });
    expect(run.prompt('retick-ci-1')).toContain('git patch-id --stable');
  });
});

describe('build-feature verify stage', () => {
  const verifyScan = { ...plainScan, verifySkill: '/repo/.agents/skills/verify/SKILL.md' };

  test('a repo with no verify skill skips the verify stage', async () => {
    const run = await stageRun();
    expect(run.labels.filter((l) => l.startsWith('verify-'))).toEqual([]);
    expect(run.result).toMatchObject({ verify: null });
  });

  test('a repo with a verify skill publishes the report after the PR opens and before CI', async () => {
    const run = await stageRun({ scan: verifyScan });
    expect(run.labels).toEqual(['implement', 'scan-repo', 'open-pr', 'verify-1', 'watch-ci-1']);
    expect(run.prompt('verify-1')).toContain('Load the verify skill at /repo/.agents/skills/verify/SKILL.md');
    expect(run.result).toMatchObject({ status: 'ready', verify: { status: 'published', unverified: [] } });
  });

  test('a changed feature with no verdict stops the run at the verify stage', async () => {
    const run = await stageRun({
      scan: verifyScan,
      verify: () => ({ status: 'published', unverified: [{ feature: 'checkout', reason: 'the quota page 500s' }] }),
    });
    expect(run.labels).not.toContain('watch-ci-1');
    expect(run.result).toMatchObject({ status: 'blocked', stage: 'verify', pr: 'https://github.com/example/shop/pull/7' });
  });

  test('a CI fix runs the verify steps again for stale verdicts', async () => {
    const run = await stageRun({
      scan: verifyScan,
      ci: [
        { conclusion: 'red', failures: [{ check: 'test', summary: 'quota test failed' }] },
        { conclusion: 'green', failures: [] },
      ],
    });
    expect(run.labels).toEqual([
      'implement',
      'scan-repo',
      'open-pr',
      'verify-1',
      'watch-ci-1',
      'fix-ci-1',
      'verify-2',
      'watch-ci-2',
    ]);
    expect(run.prompt('verify-2')).toContain('stale or missing');
  });
});

describe('build-feature doc check fixes', () => {
  const verifyDocScan = { ...docScan, verifySkill: '/repo/.agents/skills/verify/SKILL.md' };

  test('changed docs with no deslop or cold-read skill stop the run before the PR', async () => {
    const run = await stageRun({ scan: { ...docScan, coldReadSkillDir: '' } });
    expect(run.labels).not.toContain('open-pr');
    expect(run.result).toMatchObject({ status: 'blocked', stage: 'doc-check' });
  });

  test('a branch that only deletes a doc ticks both lines at its HEAD, with no deslop', async () => {
    const run = await stageRun({ scan: { ...plainScan, deletedDocFiles: ['/repo/docs/old.md'] } });
    expect(run.labels.filter((l) => /deslop|cold/.test(l))).toEqual([]);
    expect(run.prompt('open-pr')).toContain('- [x] Deslop (aaa0001)');
    expect(run.prompt('open-pr')).toContain('- [x] Cold read (aaa0001)');
  });

  test('a cold read with no report stops the run, with no tick', async () => {
    const run = await stageRun({ scan: docScan, reader: () => null });
    expect(run.labels).toContain('cold-read-1-1-retry');
    expect(run.labels).not.toContain('open-pr');
    expect(run.result).toMatchObject({ status: 'failed', stage: 'doc-check' });
  });

  test('a compare agent may edit only its own doc', async () => {
    const run = await stageRun({ scan: docScan });
    expect(run.prompt('cold-compare-1-1')).toContain(`Edit only ${quotaDoc.path}`);
  });

  test('the scripted docs checks run before the reads and after the cold-read fixes', async () => {
    const run = await stageRun({ scan: docScan, compare: fixedOnce });
    const labels = run.labels;
    expect(labels.indexOf('docs-checks-before')).toBeLessThan(labels.indexOf('cold-read-1-1'));
    expect(labels.indexOf('docs-checks-after')).toBeGreaterThan(labels.indexOf('deslop-check-1-after-cold-read-2'));
  });

  test('an opener that returns no hashes gets its ticks checked against the branch', async () => {
    const run = await stageRun({ scan: docScan, openPrHashes: false });
    expect(run.labels).toContain('retick-open-pr');
    expect(run.prompt('retick-open-pr')).toContain('the newest commit with the recorded one');
  });

  test('a doc that verify adds first gets the whole doc check, and the body gains its tick lines', async () => {
    const run = await stageRun({
      scan: { ...plainScan, verifySkill: '/repo/.agents/skills/verify/SKILL.md' },
      verify: (label) => ({ status: 'published', unverified: [], docFilesChanged: label === 'verify-1' ? [quotaDoc.path] : [] }),
    });
    expect(run.labels).toContain('verify-1-cold-read-1-1');
    expect(run.labels).toContain('push-docs-verify-1');
    expect(run.prompt('retick-verify-1')).toContain('when it has no Checks section, add one');
    expect(run.labels).toContain('verify-1-recheck');
    expect(run.result).toMatchObject({ status: 'ready', docCheck: { files: [quotaDoc.path] } });
  });

  test('a verify run that pushes a doc and then blocks still moves the Deslop tick', async () => {
    const run = await stageRun({
      scan: verifyDocScan,
      verify: () => ({ status: 'blocked', unverified: [], docFilesChanged: [quotaDoc.path], blockedReason: 'publish failed' }),
    });
    expect(run.prompt('retick-verify-1')).toContain('- [x] Deslop (sha-commit-deslop-verify-1)');
    expect(run.result).toMatchObject({ status: 'blocked', stage: 'verify' });
  });

  test('a deslop push after verify publishes gets one verify recheck', async () => {
    const run = await stageRun({
      scan: verifyDocScan,
      verify: () => ({ status: 'published', unverified: [], docFilesChanged: [quotaDoc.path] }),
    });
    expect(run.labels.filter((l) => l.startsWith('verify-1'))).toEqual(['verify-1', 'verify-1-recheck']);
    expect(run.prompt('verify-1-recheck')).toContain('stale or missing');
  });

  test('more later doc changes than the cap stop the run', async () => {
    const paths = Array.from({ length: 21 }, (_, i) => `/repo/docs/page-${i}.md`);
    const run = await stageRun({
      scan: verifyDocScan,
      verify: () => ({ status: 'published', unverified: [], docFilesChanged: paths }),
    });
    expect(run.labels.filter((l) => l.startsWith('deslop-verify'))).toEqual([]);
    expect(run.result).toMatchObject({ status: 'blocked', stage: 'doc-check' });
  });
});
