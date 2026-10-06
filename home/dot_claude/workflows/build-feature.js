export const meta = {
  name: 'build-feature',
  description:
    'Implement an agreed feature plan: sonnet builds on a worktree branch, Codex (or Opus) reviews the diff, a PR opens once clean, haiku watches CI and checks for a CodeRabbit review, with bounded fix loops at each gate',
  whenToUse:
    'After a feature plan has been agreed interactively. Load the build-feature skill first; it documents the args. Pass args: { plan: string, branch: string, base?: string, issue?: number, prNumber?: number, verifyCommands?: string[], review?: "codex" | "opus", grok?: boolean }. A run cannot pause for conversation, so bake every decision into the plan. Returns the PR URL on success, or a failure report with the branch left in place.',
  phases: [
    {
      title: 'Implement',
      detail: 'sonnet implements the plan in a worktree',
      model: 'sonnet',
    },
    {
      title: 'Review',
      detail: 'Codex (Opus fallback) reviews the diff; sonnet fixes blocking findings (max 2 rounds); optional Grok dissent',
    },
    {
      title: 'Open PR',
      detail: 'rebase onto the base branch, push, open (or ready) the PR',
    },
    {
      title: 'Watch CI',
      detail: 'haiku watches checks; sonnet fixes red CI (max 2 rounds); haiku checks for a CodeRabbit review',
      model: 'haiku',
    },
  ],
};

const MAX_FIX_ROUNDS = 2;
// codex review takes 3 to 9 minutes; past this, fall back to Opus.
const CODEX_TIMEOUT_SECONDS = 900;
const GROK_TIMEOUT_SECONDS = 600;
const CODERABBIT_WAIT_MINUTES = 10;

const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;

if (!parsedArgs || !parsedArgs.plan || !parsedArgs.branch) {
  throw new Error(
    'build-feature requires args: { plan: string, branch: string, base?: string, issue?: number, prNumber?: number, verifyCommands?: string[], review?: "codex" | "opus", grok?: boolean }',
  );
}

const { plan, branch, issue, prNumber, verifyCommands } = parsedArgs;
const base = parsedArgs.base || 'main';
const reviewer = parsedArgs.review || 'codex';
const runGrok = parsedArgs.grok === true;

if (reviewer !== 'codex' && reviewer !== 'opus') {
  throw new Error(`build-feature: review must be "codex" or "opus", got ${JSON.stringify(reviewer)}`);
}

const worktree = `.worktrees/${branch}`;

/**
 * Ground rules every agent that touches the repo must follow. Prepended to
 * each mutating prompt so fixer agents in later phases inherit the same
 * constraints as the implementer. Repo-specific setup comes from the repo's
 * own AGENTS.md and CLAUDE.md, never from this script.
 */
const REPO_RULES = `
Ground rules for working in this repo:
- Read AGENTS.md at the repo root (and any agent docs it points to) before writing code, and load the skills it names as required reading for this kind of work. Its rules are binding.
- Work ONLY inside the worktree at ${worktree}. Never commit on ${base}.
- Set the worktree up the way the repo's docs say: install its dependencies inside the worktree, and start any services its tests need.
- NEVER bypass git hooks (no --no-verify, no editing hook files). If a hook fails, fix the cause and re-commit.
- Use Conventional Commits${issue ? `, referencing the issue in the scope, e.g. \`feat(#${issue}): …\`` : ''}.
`;

const IMPLEMENT_SCHEMA = {
  type: 'object',
  required: ['status', 'summary', 'commits'],
  properties: {
    status: { enum: ['done', 'blocked'] },
    summary: {
      type: 'string',
      description: 'What was built, at PR-description altitude',
    },
    commits: {
      type: 'array',
      items: { type: 'string' },
      description: 'Commit subjects created',
    },
    blockedReason: {
      type: 'string',
      description: 'Only when status=blocked: what stopped progress and what is needed',
    },
  },
};

const FINDING = {
  type: 'object',
  required: ['file', 'severity', 'summary'],
  properties: {
    file: { type: 'string' },
    line: { type: 'integer' },
    severity: { enum: ['blocking', 'minor'] },
    summary: { type: 'string' },
    suggestedFix: { type: 'string' },
  },
};

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: { type: 'array', items: FINDING },
  },
};

const CODEX_REVIEW_SCHEMA = {
  type: 'object',
  required: ['ran', 'findings'],
  properties: {
    ran: {
      type: 'boolean',
      description: 'False when codex is missing, exits non-zero, times out, or returns no review',
    },
    failureReason: { type: 'string', description: 'Only when ran=false' },
    findings: { type: 'array', items: FINDING },
  },
};

const GROK_SCHEMA = {
  type: 'object',
  required: ['outcome', 'findings'],
  properties: {
    outcome: { enum: ['findings', 'none', 'timed-out', 'no-output', 'unavailable'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['summary'],
        properties: {
          file: { type: 'string' },
          scenario: { type: 'string', description: 'The input, sequence, or action that triggers it' },
          summary: { type: 'string' },
        },
      },
    },
  },
};

const FIX_SCHEMA = {
  type: 'object',
  required: ['status', 'summary'],
  properties: {
    status: { enum: ['done', 'blocked'] },
    summary: { type: 'string' },
    blockedReason: { type: 'string' },
    resolvedConflicts: {
      type: 'boolean',
      description: 'True when the fix involved resolving merge/rebase conflicts by hand',
    },
  },
};

const PR_SCHEMA = {
  type: 'object',
  required: ['url', 'number', 'resolvedConflicts'],
  properties: {
    url: { type: 'string' },
    number: { type: 'integer' },
    resolvedConflicts: {
      type: 'boolean',
      description: `True when the rebase onto origin/${base} hit conflicts that were resolved by hand`,
    },
  },
};

const CI_SCHEMA = {
  type: 'object',
  required: ['conclusion', 'failures'],
  properties: {
    conclusion: { enum: ['green', 'red'] },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        required: ['check', 'summary'],
        properties: {
          check: { type: 'string' },
          summary: { type: 'string' },
          logExcerpt: {
            type: 'string',
            description: 'The decisive lines from the failing log',
          },
        },
      },
    },
  },
};

const CODERABBIT_SCHEMA = {
  type: 'object',
  required: ['outcome', 'findings'],
  properties: {
    outcome: { enum: ['reviewed', 'rate-limited', 'not-reviewed', 'not-installed'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['summary'],
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          summary: { type: 'string' },
          url: { type: 'string' },
        },
      },
    },
  },
};

const CLASSIFY = `Classify each finding:
- blocking: correctness bugs, broken or missing tests for new behaviour, deviations from the plan, security problems, AGENTS.md violations that hooks/CI will not catch.
- minor: real but non-blocking improvements. Report them; they will be surfaced to the human reviewer, not fixed here.`;

const opusReviewPrompt = `You are reviewing an unpushed feature branch before it becomes a PR. Repo root is the current directory; the branch lives in the worktree at ${worktree}. Read AGENTS.md first and load the skills it names for code and tests; their conventions are binding, and convention violations that tooling cannot catch are in scope.

Review the full diff (\`git -C ${worktree} diff origin/${base}...HEAD\`) and read surrounding source where the diff alone is ambiguous. The plan this branch implements:

${plan}

${CLASSIFY}
Do not modify any files. No praise, no restating the diff.`;

const codexReviewPrompt = `Run a Codex review of the feature branch in the worktree at ${worktree} and return its findings. First run \`git -C ${worktree} fetch origin\` so origin/${base} is current. Do not review the code yourself and do not modify any files.

1. From inside the worktree, run: \`timeout ${CODEX_TIMEOUT_SECONDS} codex review --base origin/${base} < /dev/null > codex-review.out 2>&1\`, writing the output file to a scratch location outside the worktree. Run it in the background and wait for it; it takes 3 to 9 minutes. Stdin must come from /dev/null, or codex waits on it forever.
2. If \`codex\` is not installed, exits non-zero, hits the timeout, or prints no review, return ran=false with the reason and an empty findings list.
3. Otherwise return ran=true and map each Codex finding into the findings list, keeping its file and line.

The plan the branch implements, for judging severity:

${plan}

${CLASSIFY}`;

/**
 * One review pass with the configured routing. Codex runs first unless the
 * caller chose Opus; Opus covers any Codex failure. `prior` holds the
 * blocking findings a fixer has since addressed, for re-review rounds.
 */
async function reviewPass(label, prior) {
  const recheck = prior
    ? `\n\nA previous review round found these blocking findings, which a fixer has since addressed with new commits:\n\n${JSON.stringify(prior, null, 2)}\n\nVerify each is genuinely resolved and check the fix commits for new regressions. Return the full current findings list (unresolved findings stay blocking; genuinely fixed ones are dropped).`
    : '';
  if (reviewer === 'codex') {
    const codex = await agent(codexReviewPrompt + recheck, {
      label: `codex-${label}`,
      model: 'sonnet',
      schema: CODEX_REVIEW_SCHEMA,
      phase: 'Review',
    });
    if (codex && codex.ran) return { by: 'codex', findings: codex.findings };
    log(`Codex review unavailable (${codex ? codex.failureReason : 'agent died'}); falling back to Opus`);
  }
  const opus = await agent(opusReviewPrompt + recheck, {
    label: `opus-${label}`,
    model: 'opus',
    schema: REVIEW_SCHEMA,
    phase: 'Review',
  });
  return opus ? { by: 'opus', findings: opus.findings } : null;
}

phase('Implement');
const verifyGate =
  verifyCommands && verifyCommands.length > 0
    ? `\nThe affected-scope gates miss cross-cutting breakage. Before your final commit, additionally run each of these from the worktree and get it green:\n${verifyCommands.map((c) => `- \`${c}\``).join('\n')}\n`
    : '';
const impl = await agent(
  `You are implementing a feature that has already been planned and agreed. Follow the plan; do not redesign it. If the plan is wrong in a way you cannot resolve locally, stop and return status=blocked with the reason rather than improvising a different design.
${REPO_RULES}
Setup: from the repo root, fetch origin and create the worktree if it does not exist (\`git worktree add ${worktree} -b ${branch} origin/${base}\`; if the branch or worktree already exists, reuse it), then set it up as the repo's docs say.

The plan:

${plan}

Implement the plan completely, including tests for new behaviour. Commit in logical increments. Pre-commit hooks often only fix lint and format on staged files, which proves nothing about types or behaviour. Before your final commit, run the repo's typecheck and the tests your change affects, as its docs describe, and get them green: later stages expect a branch that already passes.
${verifyGate}
Do not push and do not open a PR; later stages handle that.`,
  { label: 'implement', model: 'sonnet', schema: IMPLEMENT_SCHEMA },
);

if (!impl)
  return {
    status: 'failed',
    stage: 'implement',
    branch,
    worktree,
    reason: 'implementer agent died or was skipped',
  };
if (impl.status === 'blocked') {
  return {
    status: 'blocked',
    stage: 'implement',
    branch,
    worktree,
    reason: impl.blockedReason,
  };
}
log(`Implemented: ${impl.summary}`);

phase('Review');
// Grok runs beside the review and never blocks: its result only reaches the
// PR body and the caller.
const grokRun = runGrok
  ? agent(
      `Ask Grok for dissent on the feature branch in the worktree at ${worktree}. Do not review the code yourself and do not modify any files.

1. Write the diff to a scratch file outside the worktree: \`git -C ${worktree} diff origin/${base}...HEAD > grok-diff.patch\`.
2. Run Grok read-only, in the background, with stdin from /dev/null:
   \`timeout ${GROK_TIMEOUT_SECONDS} grok -p "$(cat packet.md)" --permission-mode plan --tools read_file,grep,list_dir --deny 'mcp__*' --no-subagents --output-format plain --disable-web-search < /dev/null > grok.out\`
   where packet.md asks: "Read this diff (path to grok-diff.patch) in the repo at ${worktree}. Give a concrete input, sequence, or user action that causes data loss, an auth bypass, or a money error. Zero is a valid answer." Run it from inside the worktree.
3. Return outcome=findings with each concrete scenario, none when Grok answers that there are none, timed-out when the timeout fires, no-output when it ends with nothing, or unavailable when grok is not installed.`,
      { label: 'grok', model: 'haiku', schema: GROK_SCHEMA, phase: 'Review' },
    )
  : null;

let review = await reviewPass('review', null);
if (!review)
  return {
    status: 'failed',
    stage: 'review',
    branch,
    worktree,
    reason: 'review agent died or was skipped',
  };
const reviewedBy = new Set([review.by]);

let blocking = review.findings.filter((f) => f.severity === 'blocking');
for (let round = 1; blocking.length > 0 && round <= MAX_FIX_ROUNDS; round++) {
  log(`Review round ${round}: ${blocking.length} blocking finding(s), dispatching fixer`);
  const fix = await agent(
    `A reviewer found blocking problems on the feature branch in the worktree at ${worktree}. Fix exactly these findings — no drive-by refactors:
${REPO_RULES}
${JSON.stringify(blocking, null, 2)}

The plan the branch implements, for context:

${plan}

Commit the fixes (hooks must pass). Do not push.`,
    {
      label: `fix-review-${round}`,
      model: 'sonnet',
      schema: FIX_SCHEMA,
      phase: 'Review',
    },
  );
  if (!fix || fix.status === 'blocked') {
    return {
      status: 'blocked',
      stage: 'review-fix',
      branch,
      worktree,
      reason: fix ? fix.blockedReason : 'fixer agent died or was skipped',
      outstandingFindings: blocking,
    };
  }
  review = await reviewPass(`re-review-${round}`, blocking);
  if (!review)
    return {
      status: 'failed',
      stage: 'review',
      branch,
      worktree,
      reason: 're-review agent died or was skipped',
    };
  reviewedBy.add(review.by);
  blocking = review.findings.filter((f) => f.severity === 'blocking');
}

if (blocking.length > 0) {
  return {
    status: 'review-blocked',
    branch,
    worktree,
    reason: `blocking findings remain after ${MAX_FIX_ROUNDS} fix rounds`,
    outstandingFindings: blocking,
    minorFindings: review.findings.filter((f) => f.severity === 'minor'),
    reviewedBy: [...reviewedBy],
  };
}
const minorFindings = review.findings.filter((f) => f.severity === 'minor');
log(`Review clean by ${[...reviewedBy].join(' + ')} (${minorFindings.length} minor finding(s) noted)`);

const grok = grokRun ? await grokRun : null;
if (runGrok) log(`Grok: ${grok ? grok.outcome : 'agent died'}`);
const grokLine = !runGrok
  ? ''
  : !grok || grok.outcome === 'unavailable'
    ? ' Add one line to the end of the body: "Grok: not run (unavailable)."'
    : grok.outcome === 'timed-out'
      ? ' Add one line to the end of the body: "Grok timed out."'
      : grok.outcome === 'no-output'
        ? ' Add one line to the end of the body: "Grok returned no output."'
        : grok.outcome === 'none'
          ? ' Add one line to the end of the body: "Grok found no data-loss, auth-bypass, or money scenario."'
          : ` Add a short "Grok dissent" list at the end of the body with these scenarios, for the human reviewer: ${JSON.stringify(grok.findings)}`;

phase('Open PR');
const prBodySpec = `Write the PR body from the branch's actual final diff (\`git -C ${worktree} diff origin/${base}...HEAD\`) — do not paraphrase second-hand summaries — following the repo's PR template if it has one: condensed description (lead ≤2 sentences, one-line bullets, ≤150 words), no narrative about review rounds or fix history${issue ? `, starting with \`Closes #${issue}\`` : ''}.${grokLine} For orientation only, the implementer summarized the work as: ${impl.summary}`;
const prAction = prNumber
  ? `Update the existing PR #${prNumber}: refresh its body with \`gh pr edit ${prNumber}\` and mark it ready for review with \`gh pr ready ${prNumber}\`. Return its URL and number.`
  : `Open the PR with \`gh pr create --base ${base} --head ${branch}\`, title in Conventional Commits form${issue ? ` with the issue scope, e.g. \`feat(#${issue}): …\`` : ''}. Return the new PR's URL and number.`;
const pr = await agent(
  `Publish the reviewed feature branch in the worktree at ${worktree} as a PR against ${base}.

1. Bring the branch up to date: \`git -C ${worktree} fetch origin\` then \`git -C ${worktree} rebase origin/${base}\`. If the rebase hits conflicts, resolve them faithfully to both sides' intent (reinstall dependencies in the worktree if their manifests changed) and return resolvedConflicts=true; if it was clean or a no-op, return resolvedConflicts=false.
2. Push with \`git -C ${worktree} push -u origin ${branch}\`, adding \`--force-with-lease\` only if the rebase rewrote commits that were already pushed.
3. ${prAction}

${prBodySpec}`,
  {
    label: prNumber ? 'ready-pr' : 'open-pr',
    model: 'sonnet',
    schema: PR_SCHEMA,
  },
);
if (!pr)
  return {
    status: 'failed',
    stage: 'open-pr',
    branch,
    worktree,
    reason: 'PR agent died or was skipped',
  };
let rebaseConflicts = Boolean(pr.resolvedConflicts);
log(`${prNumber ? 'PR readied' : 'PR opened'}: ${pr.url}`);

const reviewSummary = {
  reviewedBy: [...reviewedBy],
  minorFindings,
  grok: grok ? { outcome: grok.outcome, findings: grok.findings } : runGrok ? { outcome: 'agent-died', findings: [] } : null,
};

phase('Watch CI');
for (let round = 0; ; round++) {
  const ci = await agent(
    `Watch CI for PR #${pr.number} in this repo until every check completes. Run \`gh pr checks ${pr.number} --watch\` with a 600000ms timeout; if the command times out while checks are still pending, simply run it again — loop until it exits on its own.

If \`gh pr checks\` reports no checks at all (it can exit immediately), do NOT assume green: run \`gh pr view ${pr.number} --json mergeable,mergeStateStatus\`. If the PR is CONFLICTING, return conclusion=red with a single failures entry using check "merge-conflict" and what gh reported as the summary. If it is mergeable and checks simply have not started yet, wait briefly and watch again. If the repo has no CI at all, return conclusion=green.

When all checks have completed: if everything passed, return conclusion=green with an empty failures array. If anything failed, pull the failing logs (\`gh run view <run-id> --log-failed\`, run ids via \`gh pr checks ${pr.number}\` / \`gh run list --branch ${branch}\`) and return one failures entry per failing check with the decisive log lines as the excerpt. Do not attempt any fixes.`,
    {
      label: `watch-ci-${round + 1}`,
      model: 'haiku',
      effort: 'low',
      schema: CI_SCHEMA,
      phase: 'Watch CI',
    },
  );
  if (!ci)
    return {
      status: 'failed',
      stage: 'watch-ci',
      branch,
      worktree,
      pr: pr.url,
      reason: 'CI watcher died or was skipped',
      ...reviewSummary,
    };

  if (ci.conclusion === 'green') break;
  if (round >= MAX_FIX_ROUNDS) {
    return {
      status: 'ci-failed',
      pr: pr.url,
      branch,
      worktree,
      reason: `CI still red after ${MAX_FIX_ROUNDS} fix rounds`,
      failures: ci.failures,
      rebaseConflicts,
      ...reviewSummary,
    };
  }

  log(
    `CI red (${ci.failures.map((f) => f.check).join(', ')}), dispatching fixer (round ${round + 1})`,
  );
  const fix = await agent(
    `CI is failing on PR #${pr.number} (branch ${branch}, worktree at ${worktree}). Diagnose and fix these failures — reproduce locally where possible before changing code, and fix causes, not symptoms:
${REPO_RULES}
${JSON.stringify(ci.failures, null, 2)}

If a failure's check is "merge-conflict", the branch has fallen behind ${base}: \`git -C ${worktree} fetch origin\`, rebase onto origin/${base}, resolve conflicts faithfully to both sides' intent (reinstall dependencies in the worktree if their manifests changed), push with \`--force-with-lease\` — that flag is allowed for this case ONLY — and return resolvedConflicts=true if you resolved conflicts by hand.

For every other failure, commit the fixes (hooks must pass) and push to the existing branch without force.`,
    {
      label: `fix-ci-${round + 1}`,
      model: 'sonnet',
      schema: FIX_SCHEMA,
      phase: 'Watch CI',
    },
  );
  if (!fix || fix.status === 'blocked') {
    return {
      status: 'blocked',
      stage: 'ci-fix',
      branch,
      worktree,
      pr: pr.url,
      reason: fix ? fix.blockedReason : 'CI fixer died or was skipped',
      failures: ci.failures,
      rebaseConflicts,
      ...reviewSummary,
    };
  }
  if (fix.resolvedConflicts) rebaseConflicts = true;
}

// CodeRabbit is advisory: its findings go back to the caller to answer, and a
// rate-limited or absent review never blocks.
const coderabbit = await agent(
  `Check PR #${pr.number} for a CodeRabbit review. Do not fix anything.

Read the PR's reviews and comments (\`gh pr view ${pr.number} --json reviews,comments\` and \`gh api repos/{owner}/{repo}/pulls/${pr.number}/comments\`), looking for the coderabbitai author. If CodeRabbit has not posted yet, wait and check again, for up to ${CODERABBIT_WAIT_MINUTES} minutes after the PR opened.

Return outcome=reviewed with each actionable finding (skip nits and praise), rate-limited when its comment says it is rate-limited or paused, not-reviewed when nothing arrived within ${CODERABBIT_WAIT_MINUTES} minutes, or not-installed when the repo shows no sign of CodeRabbit on this or recent PRs.`,
  {
    label: 'coderabbit',
    model: 'haiku',
    effort: 'low',
    schema: CODERABBIT_SCHEMA,
    phase: 'Watch CI',
  },
);
log(`CodeRabbit: ${coderabbit ? coderabbit.outcome : 'check failed'}`);

return {
  status: 'ready',
  pr: pr.url,
  branch,
  worktree,
  summary: impl.summary,
  rebaseConflicts,
  ...reviewSummary,
  coderabbit: coderabbit ? coderabbit : { outcome: 'check-failed', findings: [] },
};
