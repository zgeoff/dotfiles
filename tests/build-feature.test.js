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
    calls.push({ label: opts.label, prompt, opts });
    trace.push(`agent ${opts.label}`);
    if (opts.label === 'implement') return { status: 'done', summary: 'Adds a quota check.', commits: [] };
    if (opts.label === 'scan-repo') return plainScan;
    const reviewMatch = /^(codex|opus)-(.+)$/.exec(opts.label);
    if (reviewMatch) return { ran: true, findings: reviews[reviewMatch[2]] || [] };
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

describe('build-feature review scope', () => {
  test('the review and fix prompts leave the plan\'s verify items to the verify stage', async () => {
    const run = await dryRun({ review: [quotaFinding], 're-review-1': [] }, 'codex');
    for (const label of ['codex-review', 'fix-review-1', 'codex-re-review-1']) {
      const prompt = run.calls.find((c) => c.label === label).prompt;
      expect(prompt).toContain("The plan's verify items (running journeys, their verdicts, the published report) belong to the verify stage");
      expect(prompt).toContain('A reviewer never raises them as a finding, and a fixer never runs journeys.');
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
const refundsSkill = {
  path: '/repo/.worktrees/quota-check/.agents/skills/refunds/SKILL.md',
  kind: 'skill',
  sections: ['the whole file'],
};
const docScan = { ...plainScan, docFiles: [quotaDoc] };
const verifyScan = { ...plainScan, verifySkill: '/repo/.agents/skills/verify/SKILL.md' };
const plan = 'Add a quota check to checkout.';
const cleanPass = (files) => ({
  files: files.map((f) => ({ path: f.path, clean: true, differences: [] })),
  readHead: 'read0001',
  head: 'sha-deslop',
  committed: true,
});
const publishedVerify = (label) => ({
  status: 'published',
  unverified: [],
  verdicts: [{ feature: 'checkout', verdict: 'verified' }],
  head: `head-${label}`,
  docFilesChanged: [],
});

/**
 * Runs the workflow with stub agents for the doc check, verify and CI stages.
 * `pass(label)` gives the doc pass agent's result, `ci` lists each CI watch
 * result in turn, and `fix` gives each CI fix result. `args` adds to the
 * workflow's args.
 */
async function stageRun({ scan, pass, ci, fix, verify, reader, openPrHashes = true, args = {} } = {}) {
  const calls = [];
  const ciResults = [...(ci || [{ conclusion: 'green', failures: [] }])];
  const theScan = scan || plainScan;
  const agent = async (prompt, opts) => {
    calls.push({ label: opts.label, prompt, opts });
    const label = opts.label;
    if (label === 'implement') return { status: 'done', summary: 'Adds a quota check.', commits: [] };
    if (label === 'scan-repo') return theScan;
    if (label.startsWith('codex-')) return { ran: true, findings: [] };
    if (/(^|-)cold-read(-retry)?$/.test(label)) return reader ? reader(label) : 'Report: question 1 answered as "read it after checkout".';
    if (/(^|-)deslop$/.test(label)) {
      if (pass) return pass(label);
      const paths = [...prompt.matchAll(/^- (\/\S+) \(a /gm)].map((m) => ({ path: m[1] }));
      return { ...cleanPass(paths), readHead: `read-${label}`, head: `sha-${label}` };
    }
    if (label.startsWith('deslop-')) return { committed: true, head: `sha-${label}` };
    if (label === 'open-pr') {
      const pr = { url: 'https://github.com/example/shop/pull/7', number: 7, resolvedConflicts: false };
      const deslop = /- \[x\] Deslop \(([^)]+)\)/.exec(prompt);
      const coldRead = /- \[x\] Cold read \(([^)]+)\)/.exec(prompt);
      if (!openPrHashes || !deslop) return pr;
      return { ...pr, deslopCommit: deslop[1], coldReadCommit: coldRead[1] };
    }
    if (label.startsWith('verify-')) return (verify || publishedVerify)(label);
    if (label.startsWith('watch-ci-')) return ciResults.length > 1 ? ciResults.shift() : ciResults[0];
    if (label.startsWith('fix-ci-')) return (fix || (() => ({ status: 'done', summary: 'Fixed.' })))(label);
    if (label.startsWith('retick-')) {
      const [, deslopCommit] = /Deslop \(([^)]+)\)/.exec(prompt);
      const [, coldReadCommit] = /Cold read \(([^)]+)\)/.exec(prompt);
      return { deslopCommit, coldReadCommit };
    }
    throw new Error(`unexpected agent ${label}`);
  };
  const result = await loadWorkflow()({ plan, branch: 'quota-check', ...args }, agent, () => {}, () => {});
  const labels = calls.map((c) => c.label);
  return { result, labels, calls, prompt: (label) => calls.find((c) => c.label === label).prompt };
}

const differedOnce = () => ({
  files: [{ path: quotaDoc.path, clean: false, differences: ['Q1 differed'] }],
  openItems: ['Ask whether refunds count toward the quota.'],
  readHead: 'read0001',
  head: 'sha-deslop',
  committed: true,
});

describe('build-feature doc check', () => {
  test('a branch that changes no doc skips the doc check', async () => {
    const run = await stageRun();
    expect(run.labels.filter((l) => /deslop|cold/.test(l))).toEqual([]);
    expect(run.result).toMatchObject({ status: 'ready', docCheck: null });
    expect(run.prompt('open-pr')).not.toContain('- [x] Deslop');
  });

  test('a changed doc gets one cold read, then one deslop agent, before the PR opens', async () => {
    const run = await stageRun({ scan: docScan });
    expect(run.labels).toEqual(['implement', 'scan-repo', 'cold-read', 'deslop', 'open-pr', 'watch-ci-1']);
    expect(run.result).toMatchObject({ status: 'ready', docCheck: { stillDiffer: [] } });
  });

  test('two changed docs still get one cold reader and one deslop agent', async () => {
    const run = await stageRun({ scan: { ...docScan, docFiles: [quotaDoc, refundsSkill] } });
    expect(run.labels.filter((l) => /deslop|cold/.test(l))).toEqual(['cold-read', 'deslop']);
    expect(run.prompt('cold-read')).toContain(`The file: ${quotaDoc.path}\nIt is a: doc\nThe file: ${refundsSkill.path}\nIt is a: skill\n`);
    const pass = run.prompt('deslop');
    expect(pass).toContain(`- ${quotaDoc.path} (a doc): Refunds`);
    expect(pass).toContain(`- ${refundsSkill.path} (a skill): the whole file`);
  });

  test('the cold reader gets the skill\'s prompt and nothing else', async () => {
    const run = await stageRun({ scan: docScan, args: { resumeNotes: 'The quota doc moved.', resumeFrom: 'implement' } });
    expect(run.prompt('cold-read')).toBe(
      'Read /repo/.agents/skills/cold-read/references/cold-reader.md and follow it as your instructions.\n' +
        `The file: ${quotaDoc.path}\nIt is a: doc\nThe rules: /repo/.agents/skills/docs-writing/SKILL.md`,
    );
    expect(run.calls.find((c) => c.label === 'cold-read').opts).toMatchObject({ model: 'sonnet', agentType: 'general-purpose' });
  });

  test('the deslop agent writes its answers before the report, then fixes, deslops, runs the checks and commits', async () => {
    const run = await stageRun({ scan: docScan });
    const pass = run.prompt('deslop');
    const steps = ['Before you read the report, write your own answers', 'Act on the report', 'Deslop, as /repo/.agents/skills/deslop/SKILL.md says', 'run the repo\'s scripted docs checks', 'Then commit your changes'];
    const at = steps.map((step) => pass.indexOf(step));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(pass.indexOf('The cold reader\'s report:')).toBeGreaterThan(at[4]);
    expect(pass).toContain('Report: question 1 answered');
    expect(pass).toContain('/repo/.worktrees/quota-check/.build-feature/cold-answers.md');
    expect(pass).not.toContain(plan);
    expect(run.calls.find((c) => c.label === 'deslop').opts).toMatchObject({ model: 'sonnet', agentType: 'general-purpose' });
  });

  test('a doc whose read differs is reported, with its open items', async () => {
    const run = await stageRun({ scan: docScan, pass: differedOnce });
    expect(run.labels.filter((l) => l.includes('cold-read'))).toEqual(['cold-read']);
    expect(run.result).toMatchObject({
      status: 'ready',
      docCheck: {
        stillDiffer: ['docs/quota.md: Q1 differed'],
        openItems: ['Ask whether refunds count toward the quota.'],
      },
    });
  });

  test('a cold read with no report stops the run, with no tick', async () => {
    const run = await stageRun({ scan: docScan, reader: () => null });
    expect(run.labels).toContain('cold-read-retry');
    expect(run.labels).not.toContain('deslop');
    expect(run.result).toMatchObject({ status: 'failed', stage: 'doc-check' });
  });

  test('a deslop agent that skips a file stops the run, with no tick', async () => {
    const run = await stageRun({ scan: { ...docScan, docFiles: [quotaDoc, refundsSkill] }, pass: () => cleanPass([quotaDoc]) });
    expect(run.labels).not.toContain('open-pr');
    expect(run.result).toMatchObject({ status: 'failed', stage: 'doc-check' });
    expect(run.result.reason).toContain('refunds/SKILL.md');
  });

  test('a deslop agent whose hook fails stops the run before the PR', async () => {
    const run = await stageRun({ scan: docScan, pass: () => ({ ...differedOnce(), blockedReason: 'the prose hook failed' }) });
    expect(run.labels).not.toContain('open-pr');
    expect(run.result).toMatchObject({ status: 'failed', stage: 'doc-check', reason: 'the prose hook failed' });
  });

  test('more doc files than the cap stops the run before any doc agent', async () => {
    const docFiles = Array.from({ length: 21 }, (_, i) => ({ ...quotaDoc, path: `/repo/docs/page-${i}.md` }));
    const run = await stageRun({ scan: { ...docScan, docFiles } });
    expect(run.labels).toEqual(['implement', 'scan-repo']);
    expect(run.result).toMatchObject({ status: 'blocked', stage: 'doc-check' });
  });

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
});

describe('build-feature PR body ticks', () => {
  test('Deslop ticks the deslop commit, and Cold read the commit the cold reader read', async () => {
    const run = await stageRun({ scan: docScan, pass: differedOnce });
    const body = run.prompt('open-pr');
    expect(body).toContain('- [x] Deslop (sha-deslop)');
    expect(body).toContain('- [x] Cold read (read0001)');
    expect(run.result.docCheck.ticks).toEqual({ deslop: 'sha-deslop', coldRead: 'read0001' });
  });

  test('a repo whose template has no tick lines leaves them to the template', async () => {
    const run = await stageRun({ scan: { ...docScan, checkLines: false } });
    expect(run.labels).toContain('deslop');
    expect(run.prompt('open-pr')).not.toContain('- [x] Deslop');
    expect(run.prompt('open-pr')).toContain('Write the Checks section as the template says.');
  });

  test('a CI fix that changes a doc gets one deslop agent, moves the Deslop tick and leaves Cold read', async () => {
    const run = await stageRun({
      scan: { ...docScan, docFiles: [quotaDoc, refundsSkill] },
      ci: [
        { conclusion: 'red', failures: [{ check: 'docs', summary: 'a link is broken' }] },
        { conclusion: 'green', failures: [] },
      ],
      fix: () => ({ status: 'done', summary: 'Fixed the links.', docFilesChanged: [quotaDoc.path, refundsSkill.path] }),
    });
    expect(run.labels.filter((l) => l.startsWith('deslop-'))).toEqual(['deslop-ci-1']);
    const deslop = run.prompt('deslop-ci-1');
    expect(deslop).toContain('each section changed since commit sha-deslop');
    expect(deslop).toContain('bun x @zgeoff/chex prose docs/quota.md .agents/skills/refunds/SKILL.md');
    expect(deslop).toContain('push with');
    const retick = run.prompt('retick-ci-1');
    expect(retick).toContain('- [x] Deslop (sha-deslop-ci-1)');
    expect(retick).toContain('- [x] Cold read (read-deslop)');
    expect(retick).toContain('change only these two lines');
    expect(run.result).toMatchObject({
      status: 'ready',
      docCheck: { ticks: { deslop: 'sha-deslop-ci-1', coldRead: 'read-deslop' } },
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
    expect(run.labels.filter((l) => l.startsWith('retick-') || l.startsWith('deslop-'))).toEqual([]);
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

  test('an opener that returns no hashes gets its ticks checked against the branch', async () => {
    const run = await stageRun({ scan: docScan, openPrHashes: false });
    expect(run.labels).toContain('retick-open-pr');
    expect(run.prompt('retick-open-pr')).toContain('the newest commit with the recorded one');
  });
});

describe('build-feature verify stage', () => {
  const verifyDocScan = { ...docScan, verifySkill: '/repo/.agents/skills/verify/SKILL.md' };

  test('a repo with no verify skill skips the verify stage', async () => {
    const run = await stageRun();
    expect(run.labels.filter((l) => l.startsWith('verify-'))).toEqual([]);
    expect(run.result).toMatchObject({ verify: null });
  });

  test('a repo with a verify skill publishes the report after CI is green, then watches CI for the gate', async () => {
    const run = await stageRun({ scan: verifyScan, ci: [{ conclusion: 'green', failures: [] }, { conclusion: 'green', failures: [] }] });
    expect(run.labels).toEqual(['implement', 'scan-repo', 'open-pr', 'watch-ci-1', 'verify-1', 'watch-ci-2']);
    expect(run.prompt('watch-ci-1')).toContain('count it as passed');
    expect(run.prompt('watch-ci-2')).not.toContain('count it as passed');
    expect(run.prompt('verify-1')).toContain('Load the verify skill at /repo/.agents/skills/verify/SKILL.md');
    expect(run.prompt('verify-1')).not.toContain('--base');
    expect(run.result).toMatchObject({ status: 'ready', verify: { status: 'published', unverified: [], head: 'head-verify-1' } });
  });

  test('a changed feature with no verdict stops the run at the verify stage', async () => {
    const run = await stageRun({
      scan: verifyScan,
      verify: (label) => ({ ...publishedVerify(label), unverified: [{ feature: 'checkout', reason: 'the quota page 500s' }] }),
    });
    expect(run.labels).not.toContain('watch-ci-2');
    expect(run.result).toMatchObject({ status: 'blocked', stage: 'verify', pr: 'https://github.com/example/shop/pull/7' });
  });

  test('a CI fix before verify does not run verify again', async () => {
    const run = await stageRun({
      scan: verifyScan,
      ci: [
        { conclusion: 'red', failures: [{ check: 'test', summary: 'quota test failed' }] },
        { conclusion: 'green', failures: [] },
        { conclusion: 'green', failures: [] },
      ],
    });
    expect(run.labels).toEqual(['implement', 'scan-repo', 'open-pr', 'watch-ci-1', 'fix-ci-1', 'watch-ci-2', 'verify-1', 'watch-ci-3']);
  });

  test('a CI fix after verify rechecks only the features its diff touches, with the earlier verdicts', async () => {
    const run = await stageRun({
      scan: verifyScan,
      ci: [
        { conclusion: 'green', failures: [] },
        { conclusion: 'red', failures: [{ check: 'gate', summary: 'gate failed' }] },
        { conclusion: 'green', failures: [] },
      ],
      verify: (label) =>
        label === 'verify-1'
          ? { ...publishedVerify(label), verdicts: [{ feature: 'checkout', verdict: 'verified' }, { feature: 'refunds', verdict: 'verified' }] }
          : { ...publishedVerify(label), verdicts: [{ feature: 'checkout', verdict: 'verified again' }] },
    });
    expect(run.labels).toEqual(['implement', 'scan-repo', 'open-pr', 'watch-ci-1', 'verify-1', 'watch-ci-2', 'fix-ci-2', 'verify-3', 'watch-ci-3']);
    const rerun = run.prompt('verify-3');
    expect(rerun).toContain('bun verify report --base head-verify-1');
    expect(rerun).toContain('never run the whole journey set again');
    expect(rerun).toContain('"feature": "refunds"');
    expect(rerun).not.toContain('find that commit\'s copy');
    expect(run.result.verify.verdicts).toEqual([
      { feature: 'checkout', verdict: 'verified again' },
      { feature: 'refunds', verdict: 'verified' },
    ]);
  });

  test('a rebase after verify has the rerun trust only stale verdicts, with no report base', async () => {
    const run = await stageRun({
      scan: verifyScan,
      ci: [
        { conclusion: 'green', failures: [] },
        { conclusion: 'red', failures: [{ check: 'merge-conflict', summary: 'CONFLICTING' }] },
        { conclusion: 'green', failures: [] },
      ],
      fix: () => ({ status: 'done', summary: 'Rebased.', resolvedConflicts: true, docFilesChanged: [] }),
    });
    const rerun = run.prompt('verify-3');
    expect(rerun).toContain('check only the features whose verdict is now stale or missing');
    expect(rerun).not.toContain('--base');
    expect(rerun).toContain('"feature": "checkout"');
  });

  test('a rerun asks for no feature outside the fix', async () => {
    const run = await stageRun({
      scan: verifyScan,
      ci: [
        { conclusion: 'green', failures: [] },
        { conclusion: 'red', failures: [{ check: 'gate', summary: 'gate failed' }] },
        { conclusion: 'green', failures: [] },
      ],
    });
    expect(run.prompt('verify-1')).toContain('each feature the plan in .worktrees/quota-check/.build-feature/plan.md names');
    expect(run.prompt('verify-3')).not.toContain('each feature the plan');
    expect(run.prompt('verify-3')).not.toContain('each feature the branch changes');
  });

  test('CI after verify gets its own 2 fix rounds when CI was green before verify', async () => {
    const red = { conclusion: 'red', failures: [{ check: 'gate', summary: 'gate failed' }] };
    const run = await stageRun({ scan: verifyScan, ci: [{ conclusion: 'green', failures: [] }, red, red, red] });
    expect(run.labels.filter((l) => l.startsWith('fix-ci-'))).toEqual(['fix-ci-2', 'fix-ci-3']);
    expect(run.result).toMatchObject({ status: 'ci-failed' });
  });

  test('2 fixes before verify leave none for after it', async () => {
    const red = { conclusion: 'red', failures: [{ check: 'test', summary: 'quota test failed' }] };
    const run = await stageRun({ scan: verifyScan, ci: [red, red, { conclusion: 'green', failures: [] }, red] });
    expect(run.labels.filter((l) => l.startsWith('fix-ci-'))).toEqual(['fix-ci-1', 'fix-ci-2']);
    expect(run.result).toMatchObject({ status: 'ci-failed' });
  });

  test('a doc that verify adds first gets the whole doc check, which pushes, and the body gains its tick lines', async () => {
    const run = await stageRun({
      scan: verifyScan,
      verify: (label) => ({ ...publishedVerify(label), docFilesChanged: label === 'verify-1' ? [quotaDoc.path] : [] }),
    });
    expect(run.labels.filter((l) => l.startsWith('verify-1'))).toEqual(['verify-1', 'verify-1-cold-read', 'verify-1-deslop', 'verify-1-recheck']);
    expect(run.prompt('verify-1-deslop')).toContain('push with');
    expect(run.prompt('verify-1-deslop')).toContain('.build-feature/verify-1-cold-answers.md');
    expect(run.prompt('retick-verify-1')).toContain('when it has no Checks section, add one');
    expect(run.prompt('verify-1-recheck')).toContain('bun verify report --base head-verify-1');
    expect(run.result).toMatchObject({ status: 'ready', docCheck: { files: [quotaDoc.path] } });
  });

  test('a doc verify adds after a deletion-only branch gets a cold read', async () => {
    const run = await stageRun({
      scan: { ...verifyScan, deletedDocFiles: ['/repo/docs/old.md'] },
      verify: (label) => ({ ...publishedVerify(label), docFilesChanged: label === 'verify-1' ? [quotaDoc.path] : [] }),
    });
    expect(run.labels).toContain('verify-1-cold-read');
  });

  test('a verify run that pushes a doc and then blocks still moves the Deslop tick', async () => {
    const run = await stageRun({
      scan: verifyDocScan,
      verify: (label) => ({ ...publishedVerify(label), status: 'blocked', docFilesChanged: [quotaDoc.path], blockedReason: 'publish failed' }),
    });
    expect(run.prompt('retick-verify-1')).toContain('- [x] Deslop (sha-deslop-verify-1)');
    expect(run.result).toMatchObject({ status: 'blocked', stage: 'verify' });
  });

  test('a verify recheck that changes docs again stops the run at verify', async () => {
    const run = await stageRun({
      scan: verifyDocScan,
      verify: (label) => ({ ...publishedVerify(label), docFilesChanged: [quotaDoc.path] }),
    });
    expect(run.labels.filter((l) => l.startsWith('verify-1'))).toEqual(['verify-1', 'verify-1-recheck']);
    expect(run.labels).not.toContain('watch-ci-2');
    expect(run.result).toMatchObject({ status: 'blocked', stage: 'verify' });
  });

  test('more later doc changes than the cap stop the run', async () => {
    const paths = Array.from({ length: 21 }, (_, i) => `/repo/docs/page-${i}.md`);
    const run = await stageRun({
      scan: verifyDocScan,
      verify: (label) => ({ ...publishedVerify(label), docFilesChanged: paths }),
    });
    expect(run.labels.filter((l) => l.startsWith('deslop-verify'))).toEqual([]);
    expect(run.result).toMatchObject({ status: 'blocked', stage: 'doc-check' });
  });
});

describe('build-feature models', () => {
  test('each stage runs on its model', async () => {
    const run = await stageRun({
      scan: { ...docScan, verifySkill: '/repo/.agents/skills/verify/SKILL.md' },
      openPrHashes: false,
      ci: [
        { conclusion: 'green', failures: [] },
        { conclusion: 'red', failures: [{ check: 'docs', summary: 'a link is broken' }] },
        { conclusion: 'green', failures: [] },
      ],
      fix: () => ({ status: 'done', summary: 'Fixed the link.', docFilesChanged: [quotaDoc.path] }),
      args: { review: 'codex' },
    });
    const models = Object.fromEntries(run.calls.map((c) => [c.label, c.opts.model]));
    expect(models).toEqual({
      implement: 'sonnet',
      'codex-review': 'haiku',
      'scan-repo': 'haiku',
      'cold-read': 'sonnet',
      deslop: 'sonnet',
      'open-pr': 'sonnet',
      'retick-open-pr': 'haiku',
      'watch-ci-1': 'haiku',
      'verify-1': 'sonnet',
      'watch-ci-2': 'haiku',
      'fix-ci-2': 'sonnet',
      'deslop-ci-2': 'sonnet',
      'retick-ci-2': 'haiku',
      'verify-3': 'sonnet',
      'watch-ci-3': 'haiku',
    });
  });

  test('the review fixer stays on sonnet and the Opus fallback on opus', async () => {
    const run = await dryRun({ review: [quotaFinding] }, 'opus');
    const models = Object.fromEntries(run.calls.map((c) => [c.label, c.opts.model]));
    expect(models).toMatchObject({ 'opus-review': 'opus', 'fix-review-1': 'sonnet', 'opus-re-review-1': 'opus' });
  });
});

describe('build-feature resume', () => {
  // A run that reaches every stage: review, docs, the PR, CI, verify, a CI fix after verify.
  const fullRun = (args) =>
    stageRun({
      scan: { ...docScan, verifySkill: '/repo/.agents/skills/verify/SKILL.md' },
      ci: [
        { conclusion: 'green', failures: [] },
        { conclusion: 'red', failures: [{ check: 'docs', summary: 'a link is broken' }] },
        { conclusion: 'green', failures: [] },
      ],
      fix: () => ({ status: 'done', summary: 'Fixed the link.', docFilesChanged: [quotaDoc.path] }),
      args: { review: 'codex', ...args },
    });
  const keyOf = (call) => JSON.stringify({ prompt: call.prompt, opts: call.opts });
  const notesText = 'The refund rule changed: count a refund once.';
  // The label of the first agent each stage starts, in the full run.
  const firstOf = {
    implement: 'implement',
    review: 'codex-review',
    'doc-check': 'scan-repo',
    'open-pr': 'open-pr',
    'watch-ci': 'watch-ci-1',
    verify: 'verify-1',
  };

  test('two runs with the same args give every agent the same prompt and options', async () => {
    const first = await fullRun({});
    const second = await fullRun({});
    expect(second.calls.map(keyOf)).toEqual(first.calls.map(keyOf));
    expect(first.labels).toContain('verify-3');
  });

  test('only the implement stage holds the plan, and every later stage names the plan file', async () => {
    const run = await fullRun({});
    expect(run.calls.filter((c) => c.prompt.includes(plan)).map((c) => c.label)).toEqual(['implement']);
    expect(run.prompt('implement')).toContain('write the plan below to .worktrees/quota-check/.build-feature/plan.md, byte for byte');
    expect(run.prompt('implement')).toContain('rev-parse --git-common-dir)/info/exclude');
    for (const label of ['codex-review', 'fix-review-1', 'deslop', 'verify-1']) {
      if (run.labels.includes(label)) expect(run.prompt(label)).toContain('.worktrees/quota-check/.build-feature/plan.md');
    }
  });

  for (const stage of Object.keys(firstOf)) {
    test(`notes from ${stage} leave every earlier prompt unchanged and reach that stage and later ones`, async () => {
      const plain = await fullRun({});
      const resumed = await fullRun({ resumeNotes: notesText, resumeFrom: stage });
      expect(resumed.labels).toEqual(plain.labels);
      const from = plain.labels.indexOf(firstOf[stage]);
      expect(from).toBeGreaterThanOrEqual(0);
      expect(resumed.calls.slice(0, from).map(keyOf)).toEqual(plain.calls.slice(0, from).map(keyOf));
      const later = resumed.calls.slice(from).filter((c) => !/(^|-)cold-read(-retry)?$/.test(c.label));
      expect(later.filter((c) => !c.prompt.includes(notesText)).map((c) => c.label)).toEqual([]);
      expect(resumed.prompt('cold-read')).not.toContain(notesText);
    });
  }

  test('notes from a skipped review start at the next stage', async () => {
    const plain = await stageRun({ scan: docScan });
    const resumed = await stageRun({ scan: docScan, args: { resumeNotes: notesText, resumeFrom: 'review' } });
    expect(resumed.prompt('implement')).toBe(plain.prompt('implement'));
    expect(resumed.prompt('scan-repo')).toContain(notesText);
  });

  test('notes with no stage, or an unknown stage, stop the run at its argument check', async () => {
    await expect(stageRun({ args: { resumeNotes: notesText } })).rejects.toThrow('resumeNotes needs resumeFrom');
    await expect(stageRun({ args: { resumeNotes: notesText, resumeFrom: 'deploy' } })).rejects.toThrow('resumeFrom must be one of');
  });
});
