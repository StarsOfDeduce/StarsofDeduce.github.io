import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

const base = 'https://cmsgtio.account-subdomain.workers.dev';
const env = {
  OAUTH_CLIENT_ID: 'test-client',
  OAUTH_CLIENT_SECRET: 'test-secret',
  ORIGINS: 'starsofdeduce.github.io',
};

test('auth redirects to GitHub with a state cookie and the expected callback', async () => {
  const response = await worker.fetch(new Request(`${base}/auth?site_id=starsofdeduce.github.io&scope=repo`), env);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('location'));
  assert.equal(location.origin, 'https://github.com');
  assert.equal(location.searchParams.get('redirect_uri'), `${base}/callback`);
  assert.equal(location.searchParams.get('client_id'), env.OAUTH_CLIENT_ID);
  const state = location.searchParams.get('state');
  assert.ok(state);
  assert.match(response.headers.get('set-cookie'), new RegExp(`^state=${state};`));
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('callback rejects a missing state cookie before exchanging a code', async () => {
  const response = await worker.fetch(new Request(`${base}/callback?code=test-code&state=test-state`), env);
  assert.equal(response.status, 400);
  assert.match(await response.text(), /state 校验失败/);
});
