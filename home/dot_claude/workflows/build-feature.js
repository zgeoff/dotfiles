export const meta = {
  name: 'build-feature',
  description:
    'Implement an agreed feature plan: sonnet builds on a worktree branch, Codex or Opus reviews the diff when asked, fresh agents deslop and cold-read the changed docs, a PR opens once clean, the repo verify steps publish their report, haiku watches CI, with bounded fix loops at each gate',
  whenToUse:
    'After a feature plan has been agreed interactively. Load the build-feature skill first; it documents the args. Pass args: { plan: string, branch: string, base?: string, issue?: number, prNumber?: number, verifyCommands?: string[], review?: "none" | "codex" | "opus" }. A run cannot pause for conversation, so bake every decision into the plan. Returns the PR URL on success, or a failure report with the branch left in place.',
  phases: [
    {
      title: 'Implement',
      detail: 'sonnet implements the plan in a worktree',
      model: 'sonnet',
    },
    {
      title: 'Review',
      detail:
        'Skipped when review is "none"; otherwise Codex (Opus fallback) reviews the diff and sonnet fixes blocking findings (max 2 rounds)',
    },
    {
      title: 'Doc check',
      detail:
        'Skipped when the branch changes no doc or skill file; otherwise fresh sonnet agents cold-read each one once, fix what the read found, then deslop it once',
      model: 'sonnet',
    },
    {
      title: 'Open PR',
      detail: 'rebase onto the base branch, push, open (or ready) the PR, tick the Deslop and Cold read lines',
    },
    {
      title: 'Verify',
      detail: 'Skipped when the repo has no verify skill; otherwise sonnet runs its verify steps and publishes the report to the PR',
      model: 'sonnet',
    },
    {
      title: 'Watch CI',
      detail: 'haiku watches checks; sonnet fixes red CI (max 2 rounds)',
      model: 'haiku',
    },
  ],
};

const MAX_FIX_ROUNDS = 2;
// A Codex review takes 3 to 9 minutes; past this, fall back to Opus.
const CODEX_TIMEOUT_SECONDS = 900;
// Each doc file costs at most 6 agents; past this many files the run stops
// before the doc check, so the run stays far under the 1000-agent cap.
const MAX_DOC_FILES = 20;

const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;

if (!parsedArgs || !parsedArgs.plan || !parsedArgs.branch) {
  throw new Error(
    'build-feature requires args: { plan: string, branch: string, base?: string, issue?: number, prNumber?: number, verifyCommands?: string[], review?: "none" | "codex" | "opus" }',
  );
}

const { plan, branch, issue, prNumber, verifyCommands } = parsedArgs;
const base = parsedArgs.base || 'main';
const reviewer = parsedArgs.review || 'none';

if (reviewer !== 'none' && reviewer !== 'codex' && reviewer !== 'opus') {
  throw new Error(`build-feature: review must be "none", "codex" or "opus", got ${JSON.stringify(reviewer)}`);
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
- Set the worktree up the way the repo's docs say: install its dependencies inside the worktree, and start any services its tests need.
- NEVER bypass git hooks (no --no-verify, no editing hook files). If a hook fails, fix the cause and re-commit.
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
    deslopCommit: {
      type: 'string',
      description: 'Only when the body ticks a Deslop line: the short hash it names',
    },
    coldReadCommit: {
      type: 'string',
      description: 'Only when the body ticks a Cold read line: the short hash it names',
    },
  },
};

const DOC_FILE = {
  type: 'object',
  required: ['path', 'kind', 'sections'],
  properties: {
    path: { type: 'string', description: 'Absolute path, inside the worktree' },
    kind: { enum: ['doc', 'skill'], description: 'As step 3 of the cold-read skill\'s "Run it" decides' },
    sections: {
      type: 'array',
      items: { type: 'string' },
      description: 'Each heading whose section the branch adds or changes; ["the whole file"] for a new file',
    },
  },
};

const SCAN_SCHEMA = {
  type: 'object',
  required: ['worktreePath', 'head', 'docRule', 'docFiles', 'checkLines', 'verifySkill'],
  properties: {
    worktreePath: { type: 'string', description: 'Absolute path of the worktree' },
    head: { type: 'string', description: 'Short hash of the worktree HEAD' },
    docRule: {
      type: 'string',
      description: 'The rule that decides which files count as docs, such as the pathspecs, and where the repo states it',
    },
    docFiles: { type: 'array', items: DOC_FILE },
    deletedDocFiles: {
      type: 'array',
      items: { type: 'string' },
      description: 'Each doc or skill file, by the same rule, that the branch deletes',
    },
    deslopSkillDir: { type: 'string', description: 'Absolute folder of the deslop SKILL.md; empty when none' },
    coldReadSkillDir: { type: 'string', description: 'Absolute folder of the cold-read SKILL.md; empty when none' },
    rulesFiles: {
      type: 'array',
      items: { type: 'string' },
      description: 'Absolute path of each rules file a cold reader gets',
    },
    checkLines: {
      type: 'boolean',
      description: 'True when the PR template has the "- [x] Deslop (<sha>)" and "- [x] Cold read (<sha>)" lines',
    },
    verifySkill: {
      type: 'string',
      description: 'Absolute path of the repo verify SKILL.md; empty when the repo has no verify skill',
    },
  },
};

const DOC_EDIT_SCHEMA = {
  type: 'object',
  required: ['changed', 'summary'],
  properties: {
    changed: { type: 'boolean', description: 'True when the file differs from its committed copy' },
    summary: { type: 'string' },
  },
};

const ANSWERS_SCHEMA = {
  type: 'object',
  required: ['answers'],
  properties: {
    answers: { type: 'string', description: 'Your answer to each question, numbered as the questions are' },
  },
};

const COMPARE_SCHEMA = {
  type: 'object',
  required: ['clean', 'changedFiles', 'changedSections', 'differences'],
  properties: {
    clean: {
      type: 'boolean',
      description: "True when every answer matched yours and the reader found no contradiction",
    },
    changedFiles: {
      type: 'array',
      items: { type: 'string' },
      description: 'Absolute path of each file you edited',
    },
    changedSections: {
      type: 'array',
      items: { type: 'string' },
      description: 'Each heading of the doc file whose section you redrafted',
    },
    differences: {
      type: 'array',
      items: { type: 'string' },
      description: 'Each answer that differed, or contradiction found, with the fix you made',
    },
    openItems: {
      type: 'array',
      items: { type: 'string' },
      description: 'Each question for the user, rule you added, or check you skipped',
    },
  },
};

const COMMIT_SCHEMA = {
  type: 'object',
  required: ['committed', 'head'],
  properties: {
    committed: { type: 'boolean' },
    head: { type: 'string', description: 'Short hash of HEAD after the commit, or of HEAD when nothing changed' },
    blockedReason: { type: 'string', description: 'Only when a hook failed and you could not fix its cause' },
  },
};

const RETICK_SCHEMA = {
  type: 'object',
  required: ['deslopCommit', 'coldReadCommit'],
  properties: {
    deslopCommit: { type: 'string' },
    coldReadCommit: { type: 'string' },
  },
};

const DOC_FILES_CHANGED = {
  type: 'array',
  items: { type: 'string' },
  description: 'Each doc or skill file, by the doc rule in the prompt, that your commits changed, as an absolute path',
};

const CI_FIX_SCHEMA = {
  ...FIX_SCHEMA,
  properties: { ...FIX_SCHEMA.properties, docFilesChanged: DOC_FILES_CHANGED },
};

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['status', 'unverified'],
  properties: {
    status: {
      enum: ['published', 'blocked'],
      description: 'published once the report is in the PR description',
    },
    unverified: {
      type: 'array',
      items: {
        type: 'object',
        required: ['feature', 'reason'],
        properties: { feature: { type: 'string' }, reason: { type: 'string' } },
      },
      description: 'Each changed feature with no current verdict, with the end state you expected and what you got',
    },
    docFilesChanged: DOC_FILES_CHANGED,
    blockedReason: { type: 'string' },
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

/**
 * How a fixer handles review findings, in the same words as the delivery
 * brief, so a finding's whole class lands in one round.
 */
const FIX_RULES = `For each finding, re-read the rule it cites (AGENTS.md, a skill it names, or the plan), search the whole PR diff (\`git -C ${worktree} diff origin/${base}...HEAD\`) for other breaks of that rule, and fix all of them. Hold new code, tests included, to every rule. Fix all of it in one round of commits. A round limit is never a reason to skip a fix or to leave a finding in the branch's own code for a follow-up. Change nothing the findings and their rules don't reach.`;

const CLASSIFY = `Classify each finding:
- blocking: correctness bugs, broken or missing tests for new behaviour, deviations from the plan, security problems, AGENTS.md violations that hooks/CI will not catch.
- minor: real but non-blocking improvements. Report them; they will be surfaced to the human reviewer, not fixed here.`;

const opusReviewPrompt = `You are reviewing an unpushed feature branch before it becomes a PR. Repo root is the current directory; the branch lives in the worktree at ${worktree}. Read AGENTS.md first and load the skills it names for code and tests; their conventions are binding, and convention violations that tooling cannot catch are in scope.

Review the full diff (\`git -C ${worktree} diff origin/${base}...HEAD\`) and read surrounding source where the diff alone is ambiguous. The plan this branch implements:

${plan}

${CLASSIFY}
Do not modify any files. No praise, no restating the diff.`;

const codexReviewPrompt = `Get a Codex review of the feature branch in the worktree at ${worktree}, and return its findings. Do not review the code yourself, and do not modify any files.

1. Load the \`second-opinion\` skill, and write the prompt for a review as its "Write the prompt" and "Ask for a reply shape" sections say. First run \`git -C ${worktree} fetch origin\`, so origin/${base} is current. The diff command for the prompt is \`git diff origin/${base}...HEAD\`. The rules to paste come from the repo's AGENTS.md and the skills it names, for the files the diff touches. The plan below says what the change is for. When a previous round's findings are listed at the end, ask Codex to check only those fixes, and to raise no new findings.
2. From inside the worktree, run the Codex command from the skill's commands reference, wrapped in \`timeout ${CODEX_TIMEOUT_SECONDS}\`, with the prompt and reply files in a scratch folder outside the worktree. Run it in the background and wait for it.
3. If \`codex\` is not installed, exits non-zero, hits the timeout, or writes no reply, return ran=false with the reason and an empty findings list. Don't fall back to another model yourself: the workflow does that.
4. Otherwise return ran=true, and map each Codex finding into the findings list, keeping its file and line. Skip the skill's "After the answer" steps: a later stage fixes the findings.

The plan the branch implements:

${plan}

${CLASSIFY}`;

/**
 * One review pass with the configured routing. Codex runs first unless the
 * caller chose Opus; Opus covers any Codex failure. `prior` holds the
 * blocking findings a fixer has since addressed, for re-review rounds.
 */
async function reviewPass(label, prior) {
  const recheck = prior
    ? `\n\nA previous review round found these blocking findings, which a fixer has since addressed with new commits:\n\n${JSON.stringify(prior, null, 2)}\n\nCheck only these listed fixes: verify each is genuinely resolved. Return only the findings that are still open (they stay blocking; genuinely fixed ones are dropped). Raise no new findings.`
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

function buildReviewFixPrompt(blocking) {
  return `A reviewer found blocking problems on the feature branch in the worktree at ${worktree}. Fix these findings:
${REPO_RULES}
${JSON.stringify(blocking, null, 2)}

${FIX_RULES}

The plan the branch implements, for context:

${plan}

Commit the fixes (hooks must pass). Do not push.`;
}

/**
 * The review gate: one review, then a bounded number of fix and re-check
 * rounds. Returns `{ stop }` with the run's result when the run ends here, or
 * `{ summary }` with who reviewed and the minor findings once the branch is clean.
 */
async function runReviewGate() {
  let review = await reviewPass('review', null);
  if (!review)
    return {
      stop: {
        status: 'failed',
        stage: 'review',
        branch,
        worktree,
        reason: 'review agent died or was skipped',
      },
    };
  const reviewedBy = new Set([review.by]);
  const firstReview = review;

  let blocking = review.findings.filter((f) => f.severity === 'blocking');
  for (let round = 1; blocking.length > 0 && round <= MAX_FIX_ROUNDS; round++) {
    log(`Review round ${round}: ${blocking.length} blocking finding(s), dispatching fixer`);
    const fix = await agent(buildReviewFixPrompt(blocking), {
      label: `fix-review-${round}`,
      model: 'sonnet',
      schema: FIX_SCHEMA,
      phase: 'Review',
    });
    if (!fix || fix.status === 'blocked') {
      return {
        stop: {
          status: 'blocked',
          stage: 'review-fix',
          branch,
          worktree,
          reason: fix ? fix.blockedReason : 'fixer agent died or was skipped',
          outstandingFindings: blocking,
        },
      };
    }
    review = await reviewPass(`re-review-${round}`, blocking);
    if (!review)
      return {
        stop: {
          status: 'failed',
          stage: 'review',
          branch,
          worktree,
          reason: 're-review agent died or was skipped',
        },
      };
    reviewedBy.add(review.by);
    blocking = review.findings.filter((f) => f.severity === 'blocking');
  }

  // A re-review returns only the still-open listed findings, so the first
  // review's minor findings carry forward into the report.
  const minorFindings = firstReview.findings.filter((f) => f.severity === 'minor');
  if (review !== firstReview) minorFindings.push(...review.findings.filter((f) => f.severity === 'minor'));

  if (blocking.length > 0) {
    return {
      stop: {
        status: 'review-blocked',
        branch,
        worktree,
        reason: `blocking findings remain after ${MAX_FIX_ROUNDS} fix rounds`,
        outstandingFindings: blocking,
        minorFindings,
        reviewedBy: [...reviewedBy],
      },
    };
  }
  log(`Review clean by ${[...reviewedBy].join(' + ')} (${minorFindings.length} minor finding(s) noted)`);
  return { summary: { reviewedBy: [...reviewedBy], minorFindings } };
}

/**
 * Finds what the doc check and the verify stage need, since the script can't
 * read the repo: the changed doc files by the repo's own rule, the skills that
 * check them, the PR template's tick lines, and the verify skill.
 */
const scanPrompt = `Scout the feature branch in the worktree at ${worktree} for two later stages. Change no file.

1. Run \`git -C ${worktree} fetch origin\`, then list the files the branch adds or changes: \`git -C ${worktree} diff --name-only --diff-filter=d origin/${base}...HEAD\`.
2. Decide which of them count as doc or skill files, by the repo's own rule. Read the rule from the repo: the PR template's Checks section, the repo's docs-writing and project-docs-writing skills, its deslop and cold-read skills, and its docs-check script. When the repo runs the chex docs checks (\`@zgeoff/chex\`, or a \`check:docs\` script), count at least every file the chex pr-body check counts: the pathspecs in the \`if [ "$#" -eq 0 ]\` block of chex's \`src/docs/check-prose.sh\` (each README.md outside .claude/ and .agents/, Markdown under docs/, each results.md, and skill Markdown under .agents/skills/, .claude/skills/, skills/ and sync/skills/). A narrower list fails that check. Return the rule you used as docRule, in a form a later agent can apply to a file list. Return each doc file the branch deletes in deletedDocFiles: chex counts a deletion too (\`git -C ${worktree} diff --name-only --diff-filter=D origin/${base}...HEAD\`). For each other doc file, return its absolute path, whether it is a skill (anything an agent reads to do its work, such as a SKILL.md, a reference, a brief or AGENTS.md) or a doc, and each heading whose section the branch adds or changes (\`git -C ${worktree} diff origin/${base}...HEAD -- <file>\`), or ["the whole file"] for a new file.
3. Find the deslop and cold-read skills: the folder holding each one's SKILL.md, from the worktree's \`.agents/skills/\` or \`.claude/skills/\` first, else from where your agent loads skills, such as \`~/.claude/skills/\`. Return absolute paths, with symlinks resolved, or an empty string when a skill is missing. Collect the rules files the cold-read skill's "Run it" step 2 names, as absolute paths.
4. Return checkLines=true when the repo's PR template (such as \`.github/PULL_REQUEST_TEMPLATE.md\`) holds the lines \`- [x] Deslop (<sha>)\` and \`- [x] Cold read (<sha>)\`, in its text or its comments.
5. Find the repo's verify skill, by its own instructions: AGENTS.md or CLAUDE.md, or a \`.agents/skills/verify/\` or \`.claude/skills/verify/\` folder in the worktree. Return the absolute path of its SKILL.md, or an empty string when the repo has none.
6. Return the absolute path of the worktree, and the short hash of its HEAD.`;

/**
 * Where the commits the PR body ticks stand. `deslop` moves to each later
 * commit that a deslop checked; `coldRead` stays on the commit the cold
 * read read, which chex accepts after later doc commits.
 */
function chooseTicks(readHead, finalHead) {
  return { deslop: finalHead, coldRead: readHead };
}

function moveDeslopTick(ticks, head) {
  return ticks ? { ...ticks, deslop: head } : ticks;
}

function relativeTo(root, path) {
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

function shortName(path) {
  return path.split('/').filter(Boolean).slice(-2).join('/');
}

/**
 * One fresh agent deslops the sections with the skill's prompt, and rereads
 * its own edits and runs the prose check itself, as the deslop skill says.
 * Returns false when the agent died.
 */
async function deslopFile(scan, file, sections, label) {
  const rel = relativeTo(scan.worktreePath, file.path);
  const result = await agent(
    `Read ${scan.deslopSkillDir}/SKILL.md and follow it as your instructions.
The text: ${file.path}
It is a: ${file.kind}
Deslop these sections: ${sections.join('; ')}

When you are done, reread your own edits, as the "Text you wrote" section of the skill says: revert any change that changes a fact, breaks a format, cuts a rule's reason, or renames a term a check or script depends on. Then run the prose check from the worktree root, \`cd ${scan.worktreePath} && bun x @zgeoff/chex prose ${rel}\`, and fix each failure in the file. When chex can't run, skip it and say so in the summary.

Edit only ${file.path}, and never commit: other agents edit other files in this worktree at the same time. Return changed=true when the file differs from its committed copy.`,
    { label, model: 'sonnet', agentType: 'general-purpose', schema: DOC_EDIT_SCHEMA, phase: 'Doc check' },
  );
  return result !== null;
}

async function commitDocs(scan, files, message, label, push) {
  const pushStep = push ? ` Then push with \`git -C ${scan.worktreePath} push\`, without force.` : '';
  return agent(
    `Commit the uncommitted changes to these files in the worktree at ${scan.worktreePath}, and to no other file:
${files.map((f) => `- ${f}`).join('\n')}
${REPO_RULES}
Use the commit message \`${message}\`. When none of the files has a change, make no commit.${pushStep} Return committed, and the short hash of HEAD afterwards.`,
    { label, model: 'sonnet', effort: 'low', schema: COMMIT_SCHEMA, phase: 'Doc check' },
  );
}

/**
 * The doc check: the scripted checks, one cold read of each changed doc file
 * with a fix pass, then one deslop of the sections the branch changed and the
 * cold read redrafted, with the scripted checks again, and a commit after each
 * step. Files run side by side and only a commit step commits, so no two
 * agents commit in one worktree at once. Returns `{ stop }` or `{ docCheck }`.
 */
async function runScriptedChecks(scan, files, label) {
  return agent(
    `Run the repo's scripted docs checks from the root of the worktree at ${scan.worktreePath}, as step 1 of "Run it" in ${scan.coldReadSkillDir}/SKILL.md says: the checks a \`check:docs\` script lists when the repo has one, else \`bun x @zgeoff/chex prose length links readmes skill\`. Fix each failure in these files, and in no other file:
${files.map((f) => `- ${f}`).join('\n')}
Never commit. When a check can't run, say so in the summary, and name each failure in another file there too.`,
    { label, model: 'sonnet', effort: 'low', schema: DOC_EDIT_SCHEMA, phase: 'Doc check' },
  );
}

async function runDocCheck(scan, tag = '') {
  const files = scan.docFiles;
  const stop = (reason) => ({ stop: { status: 'failed', stage: 'doc-check', branch, worktree, reason } });
  const allPaths = files.map((f) => f.path);

  if (!(await runScriptedChecks(scan, allPaths, `${tag}docs-checks-before`))) return stop('the docs-checks agent died or was skipped');
  let commit = await commitDocs(scan, allPaths, 'docs: pass the docs checks', `${tag}commit-checks`, false);
  if (!commit) return stop('commit agent died or was skipped');
  if (commit.blockedReason) return stop(commit.blockedReason);
  // The cold reader reads this commit.
  const readHead = commit.head;

  // The author writes its answers before any reader starts.
  const answers = await parallel(
    files.map((file, i) => () =>
      agent(
        `You wrote ${file.path} (a ${file.kind}) on the feature branch in the worktree at ${scan.worktreePath}, for the plan below. Before a cold reader reads it, write your own answers, as steps 3 and 4 of "Run it" in ${scan.coldReadSkillDir}/SKILL.md say: answer each question in ${scan.coldReadSkillDir}/references/cold-reader.md#the-questions for a ${file.kind}, with what the file is meant to tell a reader. Write "doesn't apply" where that skill says to. Spawn nothing and edit no file.

The plan:

${plan}`,
        { label: `${tag}cold-answers-${i + 1}`, model: 'sonnet', schema: ANSWERS_SCHEMA, phase: 'Doc check' },
      ),
    ),
  );
  if (answers.some((a) => !a)) return stop('an answers agent died or was skipped');

  const state = files.map(() => ({ clean: false, sections: new Set(), differences: [], openItems: [], failed: null }));
  // Every reader finishes before any compare agent edits a file, since a
  // changed doc can be another reader's rules file.
  const reports = {};
  const readSettled = await parallel(
    files.map((file, i) => async () => {
      const readerPrompt = `Read ${scan.coldReadSkillDir}/references/cold-reader.md and follow it as your instructions.
The file: ${file.path}
It is a: ${file.kind}
The rules: ${scan.rulesFiles.join('\n')}`;
      const readerOpts = { model: 'sonnet', agentType: 'general-purpose', phase: 'Doc check' };
      // A read with no report doesn't count, so a fresh reader gets one more try.
      let report = await agent(readerPrompt, { ...readerOpts, label: `${tag}cold-read-${i + 1}` });
      if (report === null) report = await agent(readerPrompt, { ...readerOpts, label: `${tag}cold-read-${i + 1}-retry` });
      if (report === null) {
        state[i].failed = `the cold read of ${shortName(file.path)}: no cold reader returned a report`;
        return true;
      }
      reports[i] = report;
      return true;
    }),
  );
  const changed = new Set();
  const compareSettled = await parallel(
    files.map((file, i) => i).filter((i) => reports[i] !== undefined).map((i) => async () => {
      const file = files[i];
      const compare = await agent(
        `You wrote ${file.path} (a ${file.kind}) on the feature branch in the worktree at ${scan.worktreePath}. A cold reader with none of your context read it and reported:

${reports[i]}

Your answers, written before the read:

${answers[i].answers}

Act on the report as "Act on it" in ${scan.coldReadSkillDir}/SKILL.md says: compare each answer with yours, and fix the file for each finding. Redraft each section a fix lands in. Close every question yourself where that skill says to. Write into openItems each question only the user can answer, each check you skipped, and each fix that belongs in a rules file or any file other than this one, with the text you would write: other agents are editing those files now, so leave them alone. Don't deslop yet: a later agent does.

Edit only ${file.path}, and never commit: other agents edit other files in this worktree at the same time. Return clean=true only when every answer matched yours and the reader found no contradiction.`,
        { label: `${tag}cold-compare-${i + 1}`, model: 'sonnet', schema: COMPARE_SCHEMA, phase: 'Doc check' },
      );
      if (!compare) {
        state[i].failed = `the cold read of ${shortName(file.path)}: the compare agent died`;
        return true;
      }
      state[i].clean = compare.clean;
      state[i].differences = compare.clean ? [] : compare.differences;
      state[i].openItems.push(...(compare.openItems || []));
      for (const s of compare.changedSections) state[i].sections.add(s);
      // A compare agent edits only its own file.
      if (compare.changedFiles.length > 0) changed.add(file.path);
      return true;
    }),
  );
  // A read that never finished leaves no tick to stand on.
  const failed = state.map((st) => st.failed).filter(Boolean);
  if ([...readSettled, ...compareSettled].some((x) => !x)) failed.push('the cold read: an agent threw');
  if (failed.length > 0) return stop(failed.join('; '));
  if (changed.size > 0) {
    commit = await commitDocs(scan, [...changed], 'docs: fix what the cold read found', `${tag}commit-cold-read`, false);
    if (!commit) return stop('commit agent died or was skipped');
    if (commit.blockedReason) return stop(commit.blockedReason);
  }

  // The cold-read skill's last step: deslop the sections the branch changed
  // and each section the cold read redrafted.
  const deslopped = await parallel(
    files.map((file, i) => () => deslopFile(scan, file, [...file.sections, ...state[i].sections], `${tag}deslop-${i + 1}`)),
  );
  if (deslopped.some((ok) => !ok)) return stop('a deslop agent died or was skipped');
  // The cold-read skill's step 4 ends with the scripted checks again.
  if (!(await runScriptedChecks(scan, allPaths, `${tag}docs-checks-after`))) return stop('the docs-checks agent died or was skipped');
  commit = await commitDocs(scan, allPaths, 'docs: deslop the changed docs', `${tag}commit-deslop`, false);
  if (!commit) return stop('commit agent died or was skipped');
  if (commit.blockedReason) return stop(commit.blockedReason);

  const stillDiffer = files.flatMap((file, i) =>
    state[i].clean ? [] : state[i].differences.map((d) => `${shortName(file.path)}: ${d}`),
  );
  const openItems = files.flatMap((file, i) => state[i].openItems.map((o) => `${shortName(file.path)}: ${o}`));
  return {
    docCheck: {
      files: allPaths,
      ticks: chooseTicks(readHead, commit.head),
      stillDiffer,
      openItems,
    },
  };
}

/**
 * Edits only the Deslop and Cold read lines of the live PR body, so the
 * published verify report and CI's chex tick stay as they are.
 */
/**
 * How an agent finds a recorded commit's copy after a rebase. A conflict
 * resolution changes the patch, so the patch ID alone can miss it.
 */
const COPY_RULE = `Look in \`git -C ${worktree} log origin/${base}..HEAD\` for the commit whose \`git patch-id --stable\` matches the recorded one's (\`git -C ${worktree} show <old> | git patch-id --stable\`). When none matches, take the newest commit with the recorded one's subject. When none has that subject either, take the newest commit that changes a doc or skill file (\`git -C ${worktree} rev-list -1 origin/${base}..HEAD -- <the doc files>\`), or HEAD when none does. Every hash you write must be in \`git -C ${worktree} log origin/${base}..HEAD\`.`;

async function retick(prRef, prRepo, ticks, rebased, label) {
  const mapping = rebased
    ? ` The branch was rebased since these commits were recorded, so first find each one's copy, and write the copies' short hashes. ${COPY_RULE}`
    : '';
  return agent(
    `Update the Checks lines of PR #${prRef} in ${prRepo}. Pass \`-R ${prRepo}\` to every \`gh\` command. Read the live body with \`gh pr view ${prRef} -R ${prRepo} --json body -q .body\`, and change only these two lines:
- [x] Deslop (${ticks.deslop})
- [x] Cold read (${ticks.coldRead})
${mapping}
Replace the existing Deslop and Cold read lines in place. When the body has no such lines, add them to its Checks section, and when it has no Checks section, add one where the repo's PR template puts it, with the template's other lines, such as \`- [ ] chex\`. Leave every other line as it is, including the report between the \`wringer:report\` markers and the chex line. Hold the body in a file only this run uses, made with \`mktemp\`, and write it with \`gh pr edit ${prRef} -R ${prRepo} --body-file <file>\`. Return the two hashes the body now names.`,
    { label, model: 'sonnet', effort: 'low', schema: RETICK_SCHEMA, phase: 'Watch CI' },
  );
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

let reviewSummary = { reviewedBy: [], minorFindings: [] };
if (reviewer === 'none') {
  log('Review skipped: review is "none"');
} else {
  phase('Review');
  const gate = await runReviewGate();
  if (gate.stop) return gate.stop;
  reviewSummary = gate.summary;
}

phase('Doc check');
const scan = await agent(scanPrompt, { label: 'scan-repo', model: 'sonnet', effort: 'low', schema: SCAN_SCHEMA, phase: 'Doc check' });
if (!scan)
  return {
    status: 'failed',
    stage: 'scan',
    branch,
    worktree,
    reason: 'scout agent died or was skipped',
    ...reviewSummary,
  };

let docCheck = null;
const docSkillsFound = Boolean(scan.deslopSkillDir && scan.coldReadSkillDir);
const deletedDocs = scan.deletedDocFiles || [];
if (scan.docFiles.length === 0 && deletedDocs.length === 0) {
  log('Doc check skipped: the branch changes no doc or skill file');
} else if (scan.docFiles.length === 0) {
  // chex counts a deleted doc, so the body still needs its tick lines. No
  // text is left to deslop or read, so both name the branch's HEAD.
  log(`Doc check skipped: the branch only deletes ${deletedDocs.length} doc file(s)`);
  docCheck = { files: [], ticks: chooseTicks(scan.head, scan.head), stillDiffer: [], openItems: [] };
} else if (!docSkillsFound) {
  return {
    status: 'blocked',
    stage: 'doc-check',
    branch,
    worktree,
    reason: 'the branch changes doc files, but the scout found no deslop or cold-read skill to check them with',
    ...reviewSummary,
  };
} else if (scan.docFiles.length > MAX_DOC_FILES) {
  return {
    status: 'blocked',
    stage: 'doc-check',
    branch,
    worktree,
    reason: `the branch changes ${scan.docFiles.length} doc files, over the doc check's cap of ${MAX_DOC_FILES}; split the PR or run deslop and cold-read by hand`,
    ...reviewSummary,
  };
} else {
  log(`Doc check: ${scan.docFiles.length} doc file(s)`);
  const result = await runDocCheck(scan);
  if (result.stop) return { ...result.stop, ...reviewSummary };
  docCheck = result.docCheck;
  log(
    `Doc check done: Deslop at ${docCheck.ticks.deslop}, Cold read at ${docCheck.ticks.coldRead}, ${docCheck.stillDiffer.length} difference(s) left`,
  );
}
let ticks = docCheck ? docCheck.ticks : null;
// A later doc check, for a doc that only a later commit adds, turns the ticks on.
const tickLinesOn = () => Boolean(ticks && scan.checkLines);
const tickLines = tickLinesOn();
let verifyResult = null;

/** The fields every later result carries. */
function extras() {
  return {
    ...reviewSummary,
    docCheck: docCheck ? { ...docCheck, ticks } : null,
    verify: verifyResult,
  };
}

phase('Open PR');
let checksSpec;
if (tickLines) {
  checksSpec = `The branch changes doc or skill files, and a doc check ran on them. In the template's Checks section, keep its other lines, such as \`- [ ] chex\` (CI ticks it), and write these two lines, each naming the short hash of the branch's copy of the commit:
- [x] Deslop (${ticks.deslop})
- [x] Cold read (${ticks.coldRead})
When the rebase in step 1 rewrote commits, find each commit's copy as follows. ${COPY_RULE} Return the two hashes you wrote as deslopCommit and coldReadCommit, always.`;
} else if (scan.docFiles.length === 0) {
  checksSpec = `The branch changes no doc or skill file: write the Checks section as the template says for that case.`;
} else {
  checksSpec = `Write the Checks section as the template says.`;
}
const verifySpec = scan.verifySkill
  ? 'Leave the Verification section as the template gives it, markers and all: a later stage publishes the verify report into it.'
  : 'The repo has no verify skill: write the Verification section, when the template has one, as the template says for that case.';
const prBodySpec = `Write the PR body from the repo's PR template and the branch's actual final diff (\`git -C ${worktree} diff origin/${base}...HEAD\`) — do not paraphrase second-hand summaries${issue ? `, starting with \`Closes #${issue}\`` : ''}. Hold the body in a file only this run uses: create it with \`mktemp\` and pass it with \`--body-file\`. Never write it to a fixed path such as \`/tmp/body.md\`: other runs write there at the same time, and a PR can get another run's body.

${checksSpec}

${verifySpec}

For orientation only, the implementer summarized the work as: ${impl.summary}`;
const prAction = prNumber
  ? `Update the existing PR #${prNumber}: refresh its body with \`gh pr edit ${prNumber}\` and mark it ready for review with \`gh pr ready ${prNumber}\`. Return its URL and number.`
  : `Open the PR with \`gh pr create --base ${base} --head ${branch}\`. Return the new PR's URL and number.`;
// gh picks its repo from the shell's folder, which can be another checkout.
const ghFromWorktree = `Run each \`gh\` command from inside the worktree (\`cd ${worktree} && gh ...\`), so gh resolves the worktree's repo and not the folder your shell starts in.`;
const pr = await agent(
  `Publish the feature branch in the worktree at ${worktree} as a PR against ${base}.

1. Bring the branch up to date: \`git -C ${worktree} fetch origin\` then \`git -C ${worktree} rebase origin/${base}\`. If the rebase hits conflicts, resolve them faithfully to both sides' intent (reinstall dependencies in the worktree if their manifests changed) and return resolvedConflicts=true; if it was clean or a no-op, return resolvedConflicts=false.
2. Push with \`git -C ${worktree} push -u origin ${branch}\`, adding \`--force-with-lease\` only if the rebase rewrote commits that were already pushed.
3. ${prAction} ${ghFromWorktree}

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

// Every later gh call names the PR's repo, since the agent's shell starts in
// the session's folder, which can be another repo's checkout.
const prRepoMatch = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/.exec(pr.url || '');
if (!prRepoMatch)
  return {
    status: 'failed',
    stage: 'open-pr',
    branch,
    worktree,
    pr: pr.url,
    reason: `PR URL ${JSON.stringify(pr.url)} does not name a GitHub repo`,
  };
const prRepo = prRepoMatch[1];
// Without the hashes the body named, the ticks may name pre-rebase commits.
let ticksUnconfirmed = false;
if (tickLines && pr.deslopCommit && pr.coldReadCommit) {
  ticks = { deslop: pr.deslopCommit, coldRead: pr.coldReadCommit };
} else if (tickLines) {
  ticksUnconfirmed = true;
}

const docRuleLine = `The doc rule, which decides which files count as doc or skill files: ${scan.docRule}`;

/**
 * Keeps the doc ticks true after a later push. A doc file that a later commit
 * changed gets a deslop again, and the Deslop tick moves to that
 * commit; when no doc check ran yet, the file gets the whole doc check. A
 * rebase rewrote every commit, so both ticks move to their copies. Returns
 * `{ stop }` with the run's result, or `{ pushed }`.
 */
async function followDocChanges(docFilesChanged, rebased, tag) {
  const paths = docFilesChanged || [];
  const halt = (status, reason) => ({ stop: { status, stage: 'doc-check', branch, worktree, pr: pr.url, reason, ...extras() } });
  if (paths.length > 0 && !docSkillsFound)
    return halt('blocked', 'a later commit changes doc files, but the scout found no deslop or cold-read skill');
  if (paths.length > MAX_DOC_FILES)
    return halt('blocked', `a later commit changes ${paths.length} doc files, over the doc check's cap of ${MAX_DOC_FILES}`);
  const known = new Map(scan.docFiles.map((f) => [f.path, f]));
  const changed = paths.map(
    (path) => known.get(path) || { path, kind: path.includes('/skills/') ? 'skill' : 'doc', sections: ['the whole file'] },
  );
  let moved = false;
  // A record from a deletion-only branch read no text, so it counts as none.
  if (changed.length > 0 && (!docCheck || docCheck.files.length === 0)) {
    log(`${tag}: ${changed.length} doc file(s) changed after the scout, running the doc check on them`);
    const result = await runDocCheck({ ...scan, docFiles: changed }, `${tag}-`);
    if (result.stop) return { stop: { ...result.stop, pr: pr.url, ...extras() } };
    const push = await commitDocs(scan, changed.map((f) => f.path), 'docs: deslop the later doc changes', `push-docs-${tag}`, true);
    if (!push || push.blockedReason) return halt('blocked', push ? push.blockedReason : 'push agent died or was skipped');
    docCheck = result.docCheck;
    ticks = docCheck.ticks;
    moved = true;
  } else if (changed.length > 0) {
    log(`${tag}: ${changed.length} doc file(s) changed after the doc check, deslopping them again`);
    const sinceRef = ticks.deslop;
    const ok = await parallel(
      changed.map((file, i) => () =>
        deslopFile(
          scan,
          file,
          [`each section changed since commit ${sinceRef} (\`git -C ${scan.worktreePath} diff ${sinceRef} -- ${file.path}\`)`],
          `deslop-${tag}-${i + 1}`,
        ),
      ),
    );
    if (ok.some((x) => !x)) return halt('failed', 'a deslop agent died or was skipped');
    const commit = await commitDocs(scan, changed.map((f) => f.path), 'docs: deslop the later doc changes', `commit-deslop-${tag}`, true);
    if (!commit || commit.blockedReason) return halt('blocked', commit ? commit.blockedReason : 'commit agent died or was skipped');
    ticks = moveDeslopTick(ticks, commit.head);
    moved = true;
  }
  if (tickLinesOn() && (moved || rebased || ticksUnconfirmed)) {
    const updated = await retick(pr.number, prRepo, ticks, rebased || ticksUnconfirmed, `retick-${tag}`);
    if (!updated) return halt('failed', 'retick agent died or was skipped');
    ticks = { deslop: updated.deslopCommit, coldRead: updated.coldReadCommit };
    ticksUnconfirmed = false;
  }
  return { pushed: moved };
}

/**
 * Runs the repo's verify steps and publishes the report into the PR. A rerun
 * after a CI fix checks only the verdicts that went stale or missing. When the
 * doc follow-up pushes after a publish, one recheck refreshes the verdicts its
 * edits made stale.
 */
async function runVerify(round, recheck = false) {
  const rerun =
    round > 1 || recheck
      ? '\n\nA previous run published a report, and commits have been pushed since. Check only the features whose verdict is now stale or missing, then publish again.'
      : '';
  const label = recheck ? `verify-${round}-recheck` : `verify-${round}`;
  const v = await agent(
    `Run the repo's verify steps for PR #${pr.number} in ${prRepo}, from the worktree at ${scan.worktreePath}. Load the verify skill at ${scan.verifySkill} and follow it: check each feature the branch changes, and each feature the plan names, record each verdict, then publish the report into PR #${pr.number} as the skill says. Run each command from inside the worktree, and pass \`-R ${prRepo}\` to every \`gh\` command.${rerun}
${REPO_RULES}
When the skill says to fix the app's code, fix it, commit (hooks must pass), and push without force. Never print a token or a secret.

${docRuleLine}
Return docFilesChanged for your commits, and each changed feature left with no current verdict in unverified. Return status=blocked with the reason when you could not publish.

The plan the branch implements, for context:

${plan}`,
    { label, model: 'sonnet', schema: VERIFY_SCHEMA, phase: 'Verify' },
  );
  if (!v) return { stop: { status: 'failed', stage: 'verify', branch, worktree, pr: pr.url, reason: 'verify agent died or was skipped', ...extras() } };
  verifyResult = { status: v.status, unverified: v.unverified };
  // Its pushed doc commits need their ticks moved, even when it blocks.
  const followed = await followDocChanges(v.docFilesChanged, false, label);
  if (followed.stop) return followed;
  if (v.status === 'blocked' || v.unverified.length > 0) {
    return {
      stop: {
        status: 'blocked',
        stage: 'verify',
        branch,
        worktree,
        pr: pr.url,
        reason: v.status === 'blocked' ? v.blockedReason : `${v.unverified.length} changed feature(s) have no verdict`,
        ...extras(),
      },
    };
  }
  if (followed.pushed && recheck) {
    return {
      stop: {
        status: 'blocked',
        stage: 'verify',
        branch,
        worktree,
        pr: pr.url,
        reason: 'the verify recheck changed docs again, and the deslop push after it may have made a verdict stale',
        ...extras(),
      },
    };
  }
  if (followed.pushed) return runVerify(round, true);
  return {};
}

// The open-PR agent didn't confirm the hashes it ticked, so check them now.
if (ticksUnconfirmed) {
  const confirmed = await followDocChanges([], true, 'open-pr');
  if (confirmed.stop) return confirmed.stop;
}

if (scan.verifySkill) {
  phase('Verify');
  const verified = await runVerify(1);
  if (verified.stop) return verified.stop;
  log(`Verify report published to ${pr.url}`);
} else {
  log('Verify skipped: the repo has no verify skill');
}

phase('Watch CI');
for (let round = 0; ; round++) {
  const ci = await agent(
    `Watch CI for PR #${pr.number} in ${prRepo} until every check completes. Pass \`-R ${prRepo}\` to every \`gh\` command: your shell may start in another repo's folder. Run \`gh pr checks ${pr.number} -R ${prRepo} --watch\` with a 600000ms timeout; if the command times out while checks are still pending, simply run it again — loop until it exits on its own.

If \`gh pr checks\` reports no checks at all (it can exit immediately), do NOT assume green: run \`gh pr view ${pr.number} -R ${prRepo} --json mergeable,mergeStateStatus\`. If the PR is CONFLICTING, return conclusion=red with a single failures entry using check "merge-conflict" and what gh reported as the summary. If it is mergeable and checks simply have not started yet, wait briefly and watch again. If the repo has no CI at all, return conclusion=green.

When all checks have completed: if everything passed, return conclusion=green with an empty failures array. If anything failed, pull the failing logs (\`gh run view <run-id> -R ${prRepo} --log-failed\`, run ids via \`gh pr checks ${pr.number} -R ${prRepo}\` / \`gh run list -R ${prRepo} --branch ${branch}\`) and return one failures entry per failing check with the decisive log lines as the excerpt. Do not attempt any fixes.`,
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
      ...extras(),
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
      ...extras(),
    };
  }

  log(
    `CI red (${ci.failures.map((f) => f.check).join(', ')}), dispatching fixer (round ${round + 1})`,
  );
  const fix = await agent(
    `CI is failing on PR #${pr.number} in ${prRepo} (branch ${branch}, worktree at ${worktree}). Pass \`-R ${prRepo}\` to every \`gh\` command, such as \`gh run view <run-id> -R ${prRepo} --log-failed\`: your shell may start in another repo's folder. Diagnose and fix these failures — reproduce locally where possible before changing code, and fix causes, not symptoms:
${REPO_RULES}
${JSON.stringify(ci.failures, null, 2)}

If a failure's check is "merge-conflict", the branch has fallen behind ${base}: \`git -C ${worktree} fetch origin\`, rebase onto origin/${base}, resolve conflicts faithfully to both sides' intent (reinstall dependencies in the worktree if their manifests changed), push with \`--force-with-lease\` — that flag is allowed for this case ONLY — and return resolvedConflicts=true if you resolved conflicts by hand.

For every other failure, commit the fixes (hooks must pass) and push to the existing branch without force.

${docRuleLine}
Return docFilesChanged for your commits.`,
    {
      label: `fix-ci-${round + 1}`,
      model: 'sonnet',
      schema: CI_FIX_SCHEMA,
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
      ...extras(),
    };
  }
  if (fix.resolvedConflicts) rebaseConflicts = true;
  const rebased = ci.failures.some((f) => f.check === 'merge-conflict');
  const followed = await followDocChanges(fix.docFilesChanged, rebased, `ci-${round + 1}`);
  if (followed.stop) return { ...followed.stop, rebaseConflicts };
  if (scan.verifySkill) {
    const verified = await runVerify(round + 2);
    if (verified.stop) return { ...verified.stop, rebaseConflicts };
  }
}

return {
  status: 'ready',
  pr: pr.url,
  branch,
  worktree,
  summary: impl.summary,
  rebaseConflicts,
  ...extras(),
};
