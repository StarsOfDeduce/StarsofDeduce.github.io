import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

const base = 'https://cms-oauth.example.test';
const env = {
  OAUTH_CLIENT_ID: 'test-client',
  OAUTH_CLIENT_SECRET: 'test-secret',
  ORIGINS: 'starsofdeduce.github.io',
};

test('auth redirects with a host-only cookie and ignores a requested broad scope', async () => {
  const response = await worker.fetch(new Request(`${base}/auth?site_id=starsofdeduce.github.io&scope=admin%3Aorg%20delete_repo`), env);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('location'));
  assert.equal(location.origin, 'https://github.com');
  assert.equal(location.searchParams.get('redirect_uri'), `${base}/callback`);
  assert.equal(location.searchParams.get('client_id'), env.OAUTH_CLIENT_ID);
  assert.equal(location.searchParams.get('scope'), 'public_repo');
  const state = location.searchParams.get('state');
  assert.ok(state);
  assert.match(response.headers.get('set-cookie'), new RegExp(`^__Host-cms-oauth-state=${state};`));
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('auth rejects an omitted site id', async () => {
  const response = await worker.fetch(new Request(`${base}/auth?scope=repo`), env);
  assert.equal(response.status, 400);
});

test('auth rejects wildcard-like and unlisted GitHub Pages hosts', async () => {
  const wildcardEnv = { ...env, ORIGINS: '*.github.io,starsofdeduce.github.io' };
  const unlisted = await worker.fetch(new Request(`${base}/auth?site_id=attacker.github.io`), wildcardEnv);
  const configured = await worker.fetch(new Request(`${base}/auth?site_id=starsofdeduce.github.io`), wildcardEnv);
  assert.equal(unlisted.status, 400);
  assert.equal(configured.status, 302);
});

test('callback rejects a missing state cookie before exchanging a code', async () => {
  const response = await worker.fetch(new Request(`${base}/callback?code=test-code&state=test-state`), env);
  assert.equal(response.status, 400);
  assert.match(await response.text(), /state 校验失败/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('successful callback returns the token only to the exact configured HTTPS origin', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: 'test-access-token' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  t.after(() => { globalThis.fetch = originalFetch; });

  const state = 'matching-state';
  const response = await worker.fetch(new Request(`${base}/callback?code=test-code&state=${state}`, {
    headers: { Cookie: `__Host-cms-oauth-state=${state}` },
  }), env);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(body, /https:\/\/starsofdeduce\.github\.io/);
  assert.doesNotMatch(body, /postMessage\([^)]*,\s*['"]\*['"]\)/);
  assert.match(body, /test-access-token/);
  assert.match(body, /setTimeout\(announce, 250\)/);
});

test('callback accepts GitHub form-encoded token responses', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('access_token=form-token&scope=public_repo&token_type=bearer', {
    status: 200,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  t.after(() => { globalThis.fetch = originalFetch; });

  const state = 'matching-state';
  const response = await worker.fetch(new Request(`${base}/callback?code=test-code&state=${state}`, {
    headers: { Cookie: `__Host-cms-oauth-state=${state}` },
  }), env);

  assert.equal(response.status, 200);
  assert.match(await response.text(), /form-token/);
});

test('callback reports a diagnostic id without exposing a malformed token response', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  let logEntry;
  globalThis.fetch = async () => new Response('{}', {
    status: 502,
    headers: { 'content-type': 'application/json' },
  });
  console.error = (...args) => { logEntry = args; };
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  });

  const state = 'matching-state';
  const response = await worker.fetch(new Request(`${base}/callback?code=test-code&state=${state}`, {
    headers: { Cookie: `__Host-cms-oauth-state=${state}` },
  }), env);
  const body = await response.text();

  assert.equal(response.status, 400);
  assert.match(body, /GitHub 返回 HTTP 502/);
  assert.match(body, /诊断编号/);
  assert.doesNotMatch(body, /未知错误/);
  assert.equal(logEntry[0], 'GitHub OAuth token exchange failed');
  assert.equal(logEntry[1].status, 502);
});
