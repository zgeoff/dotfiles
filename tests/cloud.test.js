import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { formatMarkdown, main, opCommandFor, parseOptions, readToken } from '../home/dot_local/bin/executable_cloud';

const cliPath = join(import.meta.dir, '../home/dot_local/bin/executable_cloud');
const shippedConfigPath = join(import.meta.dir, '../home/dot_config/cloud/create_cli.toml');

// fixtures live in the repo's ignored .scratch/, not the system temp folder
const scratch = join(import.meta.dir, `../.scratch/cloud-test-${process.pid}`);
mkdirSync(scratch, { recursive: true });

const now = Date.parse('2026-03-01T12:00:00.000Z');
const day = 86_400_000;
const token = 'test-token-ab12cd34';

// Invented uploads in the shape the service's contract returns.
const upload = (id, overrides = {}) => ({
  id,
  url: `https://files.example.test/${id}/${overrides.filename ?? 'kite.png'}`,
  filename: 'kite.png',
  contentType: 'image/png',
  size: 2048,
  sha256: 'f'.repeat(64),
  createdAt: '2026-02-28T09:00:00.000Z',
  uploader: 'owner',
  label: null,
  link: null,
  expiresAt: new Date(now + 7 * day).toISOString(),
  ...overrides,
});

// A stand-in for the files API: records each request and answers in the contract's shapes.
const requests = [];
let listed = [];
const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const url = new URL(request.url);
    const record = {
      method: request.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      authorization: request.headers.get('authorization'),
    };
    requests.push(record);

    if (record.authorization !== `Bearer ${token}`) {
      return Response.json({ code: 'UNAUTHORIZED', status: 401, message: 'a valid bearer token is required' }, { status: 401 });
    }
    if (request.method === 'POST' && url.pathname === '/api/files') {
      const form = await request.formData();
      const file = form.get('file');
      record.form = { ...Object.fromEntries([...form].filter(([name]) => name !== 'file')), fileText: await file.text() };
      return Response.json(
        upload('Up0000000000000000000a', {
          filename: form.get('filename'),
          label: form.get('label') ?? null,
          link: form.get('link') ?? null,
          size: file.size,
        }),
        { status: 201 },
      );
    }
    if (request.method === 'GET' && url.pathname === '/api/files') {
      return Response.json(listed);
    }
    const match = url.pathname.match(/^\/api\/files\/([^/]+)(\/expire)?$/);
    if (match?.[1] === 'Missing000000000000000') {
      return Response.json({ code: 'NOT_FOUND', status: 404, message: 'no upload has that id' }, { status: 404 });
    }
    if (request.method === 'POST' && match?.[2]) {
      record.body = await request.json();
      const expiresAt = record.body.expires === 'never' ? null : '2026-12-01T00:00:00.000Z';
      return Response.json(upload(match[1], { expiresAt }));
    }
    if (request.method === 'GET' && match) {
      return Response.json(upload(match[1], { label: 'kite over the bay', link: 'https://example.test/pull/7' }));
    }
    if (request.method === 'DELETE' && match) {
      return Response.json({ id: match[1] });
    }
    return new Response('NOT_FOUND', { status: 404 });
  },
});

afterAll(() => {
  server.stop(true);
  rmSync(scratch, { recursive: true, force: true });
  // .scratch/ goes too when this run made it and nothing else is in it
  if (readdirSync(dirname(scratch)).length === 0) {
    rmdirSync(dirname(scratch));
  }
});

beforeEach(() => {
  requests.length = 0;
  listed = [];
});

// Runs the CLI in process against the stand-in. The env is built from scratch, so the machine's
// own CLOUD_FILES_TOKEN or config never leaks in; op answers from the opTokens map, and only the
// commands in onPath are found on PATH.
async function cloud(args, { env = {}, opTokens = {}, onPath = [] } = {}) {
  const out = [];
  const err = [];
  const opCalls = [];
  const code = await main(args, {
    env: {
      CLOUD_FILES_URL: server.url.href,
      CLOUD_CLI_CONFIG: join(scratch, 'absent.toml'),
      CLOUD_FILES_TOKEN: token,
      ...env,
    },
    runOp: async (command, ref) => {
      opCalls.push(`${command} read ${ref}`);
      return opTokens[ref] ?? '';
    },
    which: (command) => (onPath.includes(command) ? `/stand-in/${command}` : null),
    log: (line) => out.push(line),
    logError: (line) => err.push(line),
    now: () => now,
  });
  return { code, out: out.join('\n'), err: err.join('\n'), opCalls };
}

function fixture(name, text) {
  const path = join(scratch, name);
  writeFileSync(path, text);
  return path;
}

describe('cloud up', () => {
  test('uploads the file with a default 7-day expiry and prints the URL', async () => {
    const path = fixture('kite.png', 'not really a png');
    const { code, out } = await cloud(['up', path]);

    expect(code).toBe(0);
    expect(out).toBe('https://files.example.test/Up0000000000000000000a/kite.png');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      path: '/api/files',
      authorization: `Bearer ${token}`,
      form: { filename: 'kite.png', expires: '7d', fileText: 'not really a png' },
    });
    expect(requests[0].form).not.toContainKeys(['label', 'link']);
  });

  test('sends --expires, --label and --link, in either option form', async () => {
    const path = fixture('lighthouse.png', 'beam');
    await cloud(['up', '--expires', '30d', path, '--label=lighthouse at dusk', '--link', 'https://example.test/pull/42']);

    expect(requests[0].form).toMatchObject({
      filename: 'lighthouse.png',
      expires: '30d',
      label: 'lighthouse at dusk',
      link: 'https://example.test/pull/42',
    });
  });

  test('--md prints a Markdown image line with the label, or the filename, as alt text', async () => {
    const path = fixture('kite.png', 'kite');
    const labelled = await cloud(['up', path, '--md', '--label', 'kite [draft]']);
    const plain = await cloud(['up', path, '--md']);

    expect(labelled.out).toBe('![kite \\[draft\\]](https://files.example.test/Up0000000000000000000a/kite.png)');
    expect(plain.out).toBe('![kite.png](https://files.example.test/Up0000000000000000000a/kite.png)');
  });

  test('a missing file, a missing argument or an unknown option sends nothing', async () => {
    const missing = await cloud(['up', join(scratch, 'nothing-here.png')]);
    const bare = await cloud(['up']);
    const unknown = await cloud(['up', fixture('kite.png', 'kite'), '--public']);
    const empty = await cloud(['up', fixture('kite.png', 'kite'), '--label']);

    expect([missing.code, bare.code, unknown.code, empty.code]).toEqual([1, 1, 1, 1]);
    expect(missing.err).toContain('no file at');
    expect(bare.err).toContain('usage: cloud up <file>');
    expect(unknown.err).toContain('unknown option --public');
    expect(empty.err).toContain('--label takes a value');
    expect(requests).toEqual([]);
  });
});

describe('cloud ls', () => {
  const fresh = upload('Fresh00000000000000000', { label: 'harbour map' });
  const stale = upload('Stale00000000000000000', { filename: 'old.gif', expiresAt: new Date(now - 2 * day).toISOString() });

  test('lists the live uploads without asking for expired ones', async () => {
    listed = [fresh];
    const { code, out } = await cloud(['ls']);

    expect(code).toBe(0);
    expect(requests[0]).toMatchObject({ method: 'GET', path: '/api/files', query: { includeExpired: 'false' } });
    expect(out).toContain('Fresh00000000000000000');
    expect(out).toContain('in 7d');
    expect(out).toContain('harbour map');
  });

  test('--all asks for expired uploads too and shows both', async () => {
    listed = [fresh, stale];
    const { out } = await cloud(['ls', '--all']);

    expect(requests[0].query).toEqual({ includeExpired: 'true' });
    expect(out).toContain('Fresh00000000000000000');
    expect(out).toContain('Stale00000000000000000');
    expect(out).toContain('expired 2d ago');
  });

  test('--expired shows only the expired uploads', async () => {
    listed = [fresh, stale];
    const { out } = await cloud(['ls', '--expired']);

    expect(requests[0].query).toEqual({ includeExpired: 'true' });
    expect(out).toContain('Stale00000000000000000');
    expect(out).not.toContain('Fresh00000000000000000');
  });

  test('an empty list says so', async () => {
    const { code, out } = await cloud(['ls']);

    expect(code).toBe(0);
    expect(out).toBe('no upload');
  });
});

describe('cloud expire, rm and info', () => {
  test('expire posts the new expiry and prints it', async () => {
    const never = await cloud(['expire', 'Kite000000000000000000', 'never']);
    const dated = await cloud(['expire', 'Kite000000000000000000', '2026-12-01']);

    expect(requests.map(({ method, path, body }) => ({ method, path, body }))).toEqual([
      { method: 'POST', path: '/api/files/Kite000000000000000000/expire', body: { expires: 'never' } },
      { method: 'POST', path: '/api/files/Kite000000000000000000/expire', body: { expires: '2026-12-01' } },
    ]);
    expect(never.out).toBe('Kite000000000000000000  expires never');
    expect(dated.out).toContain('expires 2026-12-01T00:00:00.000Z');
  });

  test('rm deletes the upload', async () => {
    const { code, out } = await cloud(['rm', 'Kite000000000000000000']);

    expect(code).toBe(0);
    expect(requests[0]).toMatchObject({ method: 'DELETE', path: '/api/files/Kite000000000000000000' });
    expect(out).toBe('removed Kite000000000000000000');
  });

  test('info shows every field of the upload', async () => {
    const { code, out } = await cloud(['info', 'Kite000000000000000000']);

    expect(code).toBe(0);
    expect(requests[0]).toMatchObject({ method: 'GET', path: '/api/files/Kite000000000000000000' });
    for (const text of ['https://files.example.test/Kite000000000000000000/kite.png', 'image/png', 'kite over the bay', 'https://example.test/pull/7', 'by owner']) {
      expect(out).toContain(text);
    }
  });

  test("the service's error message is shown, with the status", async () => {
    const { code, err } = await cloud(['info', 'Missing000000000000000']);

    expect(code).toBe(1);
    expect(err).toContain('GET /files/Missing000000000000000 failed (404): no upload has that id');
  });

  test('an id is one path segment, so a slash in it cannot reach another route', async () => {
    await cloud(['rm', 'Kite/expire']);

    expect(requests[0].path).toBe('/api/files/Kite%2Fexpire');
  });

  test('a missing id or expiry sends nothing', async () => {
    const results = [await cloud(['rm']), await cloud(['info']), await cloud(['expire', 'Kite000000000000000000'])];

    expect(results.map((result) => result.code)).toEqual([1, 1, 1]);
    expect(requests).toEqual([]);
  });
});

describe('cloud token', () => {
  const configPath = join(scratch, 'cli.toml');
  writeFileSync(configPath, 'token_ref = "op://vault-a/files-token/credential"\n');

  test('CLOUD_FILES_TOKEN wins, and op is not run', async () => {
    const { code, opCalls } = await cloud(['ls'], { env: { CLOUD_CLI_CONFIG: configPath } });

    expect(code).toBe(0);
    expect(opCalls).toEqual([]);
    expect(requests[0].authorization).toBe(`Bearer ${token}`);
  });

  test('with a service-account token, op reads the reference in the config, even when op-win is there', async () => {
    const { code, opCalls } = await cloud(['ls'], {
      env: { CLOUD_CLI_CONFIG: configPath, CLOUD_FILES_TOKEN: '', OP_SERVICE_ACCOUNT_TOKEN: 'ops_stand-in' },
      opTokens: { 'op://vault-a/files-token/credential': token },
      onPath: ['op', 'op-win'],
    });

    expect(code).toBe(0);
    expect(opCalls).toEqual(['op read op://vault-a/files-token/credential']);
    expect(requests[0].authorization).toBe(`Bearer ${token}`);
  });

  test('without a service-account token, op-win reads the reference in the config', async () => {
    const { code, opCalls } = await cloud(['ls'], {
      env: { CLOUD_CLI_CONFIG: configPath, CLOUD_FILES_TOKEN: '' },
      opTokens: { 'op://vault-a/files-token/credential': token },
      onPath: ['op', 'op-win'],
    });

    expect(code).toBe(0);
    expect(opCalls).toEqual(['op-win read op://vault-a/files-token/credential']);
    expect(requests[0].authorization).toBe(`Bearer ${token}`);
  });

  test('opCommandFor picks op for a service account or a Connect server, op-win otherwise, op without op-win', () => {
    const both = (command) => ['op', 'op-win'].includes(command);
    const opOnly = (command) => command === 'op';

    expect(opCommandFor({ OP_SERVICE_ACCOUNT_TOKEN: 'ops_stand-in' }, both)).toBe('op');
    expect(opCommandFor({ OP_CONNECT_HOST: 'http://connect.example.test' }, both)).toBe('op');
    expect(opCommandFor({}, both)).toBe('op-win');
    expect(opCommandFor({ OP_SERVICE_ACCOUNT_TOKEN: '' }, both)).toBe('op-win');
    expect(opCommandFor({}, opOnly)).toBe('op');
  });

  test('with neither, the error says how to create the config and nothing is sent', async () => {
    const { code, err, opCalls } = await cloud(['ls'], { env: { CLOUD_FILES_TOKEN: '' } });

    expect(code).toBe(1);
    expect(err).toContain('CLOUD_FILES_TOKEN is not set and there is no config');
    expect(err).toContain('chezmoi apply');
    expect(opCalls).toEqual([]);
    expect(requests).toEqual([]);
  });

  test('a config without token_ref, or an empty op answer, is refused', async () => {
    const noRef = fixture('no-ref.toml', 'url = "https://files.example.test"\n');

    await expect(readToken({ env: {}, configPath: noRef, config: { url: 'x' } })).rejects.toThrow('has no token_ref');
    await expect(
      readToken({ env: {}, configPath, config: { tokenRef: 'op://vault-a/x/y' }, runOp: async () => '' }),
    ).rejects.toThrow('op read op://vault-a/x/y gave an empty token');
  });

  test('the token is never a flag', async () => {
    const { code, err } = await cloud(['up', fixture('kite.png', 'kite'), '--token', 'flag-token-x1']);

    expect(code).toBe(1);
    expect(err).toContain('unknown option --token');
    expect(requests).toEqual([]);
  });

  test('the token appears in no output, even on a 401', async () => {
    const path = fixture('kite.png', 'kite');
    const wrong = 'wrong-token-zz99';
    const results = [await cloud(['up', path]), await cloud(['ls'], { env: { CLOUD_FILES_TOKEN: wrong } })];

    expect(results[1].code).toBe(1);
    expect(results[1].err).toContain('failed (401): a valid bearer token is required');
    for (const { out, err } of results) {
      expect(`${out}${err}`).not.toContain(token);
      expect(`${out}${err}`).not.toContain(wrong);
    }
  });
});

// The real CLI in a child process, with HOME and PATH built from scratch: HOME holds only the
// shipped config, and PATH holds only stand-in op and op-win scripts, so no real 1Password CLI runs.
// Each stand-in logs its call and prints the token; the one that must not run prints a wrong token.
describe('cloud token from the shell, with stand-in op and op-win', () => {
  const home = join(scratch, 'shell-home');
  const bin = join(scratch, 'shell-bin');
  const workdir = join(scratch, 'shell-work');
  const callLog = join(scratch, 'op-calls.log');
  mkdirSync(join(home, '.config/cloud'), { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(workdir, { recursive: true });
  writeFileSync(join(home, '.config/cloud/cli.toml'), readFileSync(shippedConfigPath));
  for (const name of ['op', 'op-win']) {
    // op-win is op.exe under WSL, so its stand-in ends the token with \r\n
    const ending = name === 'op-win' ? '\\r\\n' : '\\n';
    writeFileSync(
      join(bin, name),
      `#!/bin/sh\nprintf '%s %s\\n' "${name}" "$*" >> "$CALL_LOG"\nprintf '%s${ending}' "$${name === 'op' ? 'OP' : 'OP_WIN'}_STAND_IN_TOKEN"\n`,
    );
    chmodSync(join(bin, name), 0o755);
  }

  // async, since a synchronous spawn would block the stand-in server in this process
  async function shell(env) {
    rmSync(callLog, { force: true });
    const proc = Bun.spawn([process.execPath, cliPath, 'ls'], {
      cwd: workdir,
      env: { HOME: home, PATH: bin, NO_COLOR: '1', CLOUD_FILES_URL: server.url.href, CALL_LOG: callLog, ...env },
      stdout: 'ignore',
      stderr: 'pipe',
    });
    const [err, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
    const calls = readFileSync(callLog, 'utf8').trim().split('\n');
    return { code, err, calls };
  }

  test('with no service-account token, the token comes through op-win from the shipped reference', async () => {
    const { code, err, calls } = await shell({ OP_WIN_STAND_IN_TOKEN: token, OP_STAND_IN_TOKEN: 'wrong-op-token-zz11' });

    expect(err).toBe('');
    expect(code).toBe(0);
    expect(calls).toEqual(['op-win read op://cloud/files-owner-token/credential']);
    expect(requests.map((request) => request.authorization)).toEqual([`Bearer ${token}`]);
  });

  test('with a service-account token, the token comes through op', async () => {
    const { code, err, calls } = await shell({
      OP_SERVICE_ACCOUNT_TOKEN: 'ops_stand-in',
      OP_STAND_IN_TOKEN: token,
      OP_WIN_STAND_IN_TOKEN: 'wrong-op-win-token-zz22',
    });

    expect(err).toBe('');
    expect(code).toBe(0);
    expect(calls).toEqual(['op read op://cloud/files-owner-token/credential']);
    expect(requests.map((request) => request.authorization)).toEqual([`Bearer ${token}`]);
  });

  test('no token reaches the disk: the shipped config holds only a reference, and the CLI writes no file', async () => {
    const shipped = Bun.TOML.parse(readFileSync(shippedConfigPath, 'utf8'));
    expect(Object.keys(shipped)).toEqual(['token_ref']);
    expect(shipped.token_ref).toBe('op://cloud/files-owner-token/credential');

    const before = readdirSync(home, { recursive: true }).sort();
    await shell({ OP_WIN_STAND_IN_TOKEN: token });
    await shell({ OP_SERVICE_ACCOUNT_TOKEN: 'ops_stand-in', OP_STAND_IN_TOKEN: token });

    expect(readdirSync(home, { recursive: true }).sort()).toEqual(before);
    expect(readdirSync(workdir)).toEqual([]);
    for (const name of before) {
      const path = join(home, name);
      if (!statSync(path).isDirectory()) {
        expect(readFileSync(path, 'utf8')).not.toContain(token);
      }
    }
    expect(readFileSync(callLog, 'utf8')).not.toContain(token);
  });
});

describe('cloud help', () => {
  test('documents each command and how to create the config', () => {
    const proc = Bun.spawnSync(['bun', cliPath, 'help'], {
      env: { ...process.env, NO_COLOR: '1', CLOUD_CLI_CONFIG: join(scratch, 'absent.toml') },
    });
    const text = proc.stdout.toString();

    expect(proc.exitCode).toBe(0);
    for (const usage of ['cloud up <file>', '--expires', '--label', '--link', '--md', 'cloud ls [--all] [--expired]', 'cloud expire <id>', 'cloud rm <id>', 'cloud info <id>']) {
      expect(text).toContain(usage);
    }
    expect(text).toContain('CLOUD_FILES_TOKEN');
    expect(text).toContain('(missing)');
    expect(text).toContain('chezmoi apply');
    expect(text).toContain('token_ref = "op://cloud/files-owner-token/credential"');
    expect(text).toContain('op-win');
  });

  test('an unknown command prints the help to stderr and exits 2', async () => {
    const { code, err } = await cloud(['upload']);

    expect(code).toBe(2);
    expect(err).toContain('unknown command upload');
    expect(err).toContain('cloud rm <id>');
  });

  test('a name that every object inherits is an unknown command too', async () => {
    for (const name of ['toString', 'constructor', '__proto__']) {
      const { code, err } = await cloud([name]);

      expect(code).toBe(2);
      expect(err).toContain(`unknown command ${name}`);
    }
  });

  test('<command> --help prints its usage', async () => {
    const { code, out } = await cloud(['up', '--help']);

    expect(code).toBe(0);
    expect(out).toStartWith('usage: cloud up <file>');
  });

  test('-h after -- is a file name, not a request for help', async () => {
    const { code, err } = await cloud(['up', '--', '-h']);

    expect(code).toBe(1);
    expect(err).toContain('no file at -h');
  });
});

describe('cloud helpers', () => {
  test('formatMarkdown keeps a newline out of the alt text', () => {
    expect(formatMarkdown(upload('A', { label: 'two\nlines' }))).toBe('![two lines](https://files.example.test/A/kite.png)');
  });

  test('formatMarkdown percent-encodes a parenthesis, which would end the link early', () => {
    expect(formatMarkdown(upload('A', { filename: 'chart).png', url: 'https://files.example.test/A/chart(1).png' }))).toBe(
      '![chart).png](https://files.example.test/A/chart%281%29.png)',
    );
  });

  test('parseOptions takes -- as the end of options', () => {
    expect(parseOptions(['--', '--odd-name.png'], { usage: 'x' }).positionals).toEqual(['--odd-name.png']);
  });
});
