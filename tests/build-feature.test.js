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
  return new AsyncFunction('args', 'agent', 'log', 'phase', body);
}

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

/**
 * Runs the workflow against stub agents. `reviews` maps a review label to the
 * findings it returns; a label it doesn't name returns no findings.
 */
async function dryRun(reviews) {
  const calls = [];
  const trace = [];
  const agent = async (prompt, opts) => {
    calls.push({ label: opts.label, prompt });
    trace.push(`agent ${opts.label}`);
    if (opts.label === 'implement') return { status: 'done', summary: 'Adds a quota check.', commits: [] };
    if (opts.label.startsWith('codex-')) {
      return { ran: true, findings: reviews[opts.label.slice('codex-'.length)] || [] };
    }
    if (opts.label.startsWith('fix-') || opts.label.startsWith('redesign-')) {
      return { status: 'done', summary: 'Fixed.' };
    }
    if (opts.label === 'open-pr') {
      return { url: 'https://github.com/example/shop/pull/7', number: 7, resolvedConflicts: false };
    }
    if (opts.label.startsWith('watch-ci-')) return { conclusion: 'green', failures: [] };
    throw new Error(`unexpected agent ${opts.label}`);
  };
  const result = await loadWorkflow()(
    { plan: 'Add a quota check to checkout.', branch: 'quota-check' },
    agent,
    (line) => trace.push(`log   ${line}`),
    () => {},
  );
  return { result, calls, trace, labels: calls.map((c) => c.label) };
}

describe('build-feature review loop', () => {
  test('a finding that survives 2 patch rounds gets a redesign round', async () => {
    const run = await dryRun({
      review: [quotaFinding],
      're-review-1': [quotaFinding],
      're-review-2': [quotaFinding],
    });
    if (process.env.DRY_RUN) console.log([...run.trace, `status ${run.result.status}`].join('\n'));
    expect(run.labels).toEqual([
      'implement',
      'codex-review',
      'fix-review-1',
      'codex-re-review-1',
      'fix-review-2',
      'codex-re-review-2',
      'redesign-review',
      'codex-re-review-redesign',
      'open-pr',
      'watch-ci-1',
    ]);
    expect(run.result).toMatchObject({ status: 'ready', redesigned: true });
    const redesign = run.calls.find((c) => c.label === 'redesign-review').prompt;
    expect(redesign).toContain('Do not patch it again.');
    expect(redesign).toContain('src/quota.ts');
  });

  test('review-blocked after the redesign round still lists the findings', async () => {
    const run = await dryRun({
      review: [quotaFinding],
      're-review-1': [quotaFinding],
      're-review-2': [quotaFinding],
      're-review-redesign': [quotaFinding],
    });
    expect(run.result).toMatchObject({
      status: 'review-blocked',
      reason: 'blocking findings remain after 2 fix rounds and a redesign round',
      outstandingFindings: [quotaFinding],
      redesigned: true,
    });
  });

  test('a finding in logic patched only once ends without a redesign', async () => {
    const run = await dryRun({
      review: [quotaFinding],
      're-review-1': [labelFinding],
      're-review-2': [labelFinding],
    });
    expect(run.labels).not.toContain('redesign-review');
    expect(run.result).toMatchObject({
      status: 'review-blocked',
      reason: 'blocking findings remain after 2 fix rounds',
      redesigned: false,
    });
  });

  test('each fixer holds the whole diff to the cited rule', async () => {
    const run = await dryRun({ review: [quotaFinding], 're-review-1': [quotaFinding], 're-review-2': [quotaFinding] });
    for (const label of ['fix-review-1', 'fix-review-2', 'redesign-review']) {
      const prompt = run.calls.find((c) => c.label === label).prompt;
      expect(prompt).toContain('re-read the rule it cites');
      expect(prompt).toContain('search the whole PR diff');
      expect(prompt).toContain('Hold new code, tests included, to every rule.');
      expect(prompt).toContain('A round limit is never a reason to skip a fix');
    }
  });
});
