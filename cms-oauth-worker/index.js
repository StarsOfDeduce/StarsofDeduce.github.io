/**
 * GitHub OAuth gateway for Sveltia / Decap CMS on GitHub Pages.
 *
 * Deploy as a Cloudflare Worker. This file contains NO secrets — set them as Worker
 * environment variables:
 *   OAUTH_CLIENT_ID      -> your GitHub OAuth App client id
 *   OAUTH_CLIENT_SECRET  -> your GitHub OAuth App client secret
 *   ORIGINS              -> comma-separated exact site hosts, e.g. "starsofdeduce.github.io"
 *
 * Protocol (matches Sveltia's `authorize()` in src/.../shared/auth.js):
 *   GET /auth      The CMS openAuth popup to this URL. We redirect to GitHub's authorize
 *                  page. A `state` cookie guards /callback against CSRF.
 *   GET /callback  GitHub redirects here with ?code&state. We exchange `code` for a token
 *                  via GitHub, then serve a page that handshakes (`authorizing:github`) and
 *                  posts back `authorization:github:success:{"token":...}` to the CMS.
 *
 * Flow after GitHub:  popup -> "authorizing:github" -> CMS echoes it back -> popup posts token.
 */

const GITHUB = {
  authorize: 'https://github.com/login/oauth/authorize',
  token: 'https://github.com/login/oauth/access_token',
};

/** Parse ORIGINS as exact HTTPS hostnames. Wildcards and URL components are rejected. */
function exactHosts(raw) {
  return [...new Set((raw || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host))
  )];
}

const exactOrigins = (hosts) => hosts.map((host) => `https://${host}`);

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const pageShell = (title, bodyFactory, extraSetCookie = '') => {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const body = typeof bodyFactory === 'function' ? bodyFactory(nonce) : bodyFactory;
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy': `default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'`,
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    ...(extraSetCookie ? { 'set-cookie': extraSetCookie } : {}),
  };

  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title>
<style nonce="${nonce}">
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;background:#0a0d14;color:#e5e7eb}
  .card{max-width:420px;margin:24px;padding:36px 32px;text-align:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;backdrop-filter:blur(16px)}
  .dot{width:9px;height:9px;border-radius:50%;background:#00f2fe;box-shadow:0 0 12px #00f2fe;display:inline-block;margin-bottom:8px;animation:p 1.2s ease-in-out infinite alternate}
  @keyframes p{from{opacity:.4}to{opacity:1}}
  h1{font-size:1.25rem;margin:8px 0;font-weight:700}
  p{color:#9ca3af;font-size:.9rem;line-height:1.6;margin:0}
  .err{color:#f87171}
</style></head><body><div class="card"><span class="dot"></span>${body}</div></body></html>`,
    { status: title.startsWith('错误') ? 400 : 200, headers },
  );
};

const stateCookieName = '__Host-cms-oauth-state';
const clear = `${stateCookieName}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;

/**
 * The window that GitHub just redirected to (the popup). Handshakes with the CMS, then
 * posts the token back. Mirrors vencax/netlify-cms-github-oauth-provider login_script.js.
 */
function authPage(provider, content, allowedOrigins, extraSetCookie) {
  const originsJson = JSON.stringify(allowedOrigins);
  const providerJson = JSON.stringify(provider);
  const payloadJson = JSON.stringify(JSON.stringify(content)).replaceAll('<', '\\u003c');
  return pageShell('授权成功', (nonce) => `
  <h1>授权成功，即将返回后台…</h1>
  <p>若窗口未自动关闭，可直接关闭本窗口。</p>
  <script nonce="${nonce}">
    (function () {
      var allowed = ${originsJson};
      var provider = ${providerJson};
      var payload = ${payloadJson};
      if (!window.opener) { return; }
      var posted = false;
      var attempts = 0;
      // Repeat the announcement briefly so a slow CMS tab cannot miss the handshake.
      function announce() {
        if (posted || attempts >= 40) { return; }
        attempts += 1;
        allowed.forEach(function (origin) {
          try { window.opener.postMessage('authorizing:' + provider, origin); } catch (e) {}
        });
        setTimeout(announce, 250);
      }
      window.addEventListener('message', function (e) {
        if (posted) { return; }
        if (e.source !== window.opener || e.data !== 'authorizing:' + provider || !allowed.includes(e.origin)) { return; }
        posted = true;
        window.opener.postMessage('authorization:' + provider + ':success:' + payload, e.origin);
        setTimeout(function () { window.close(); }, 300);
      });
      announce();
    })();
  </script>`, extraSetCookie);
}

function errorPage(message, extraSetCookie) {
  const body = `<h1 class="err">授权失败</h1><p>${escapeHTML(message)}<br>请关闭本窗口，再从博客后台重新登录。</p>`;
  return pageShell('错误', body, extraSetCookie);
}

/**
 * GitHub normally honours Accept: application/json, but accepting its documented
 * form-encoded fallback avoids turning a useful OAuth error into "unknown error".
 */
function parseTokenResponse(raw, contentType) {
  if (!raw) return {};

  if (contentType.includes('application/json') || raw.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  return Object.fromEntries(new URLSearchParams(raw));
}

const safeOAuthError = (token, status) => {
  const description = typeof token.error_description === 'string' ? token.error_description : '';
  const code = typeof token.error === 'string' ? token.error : '';
  return description || code || `GitHub 返回 HTTP ${status}`;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const base = url.origin; // e.g. https://starsofdeduce-cms-oauth.xxx.workers.dev
    const hosts = exactHosts(env.ORIGINS);
    const origins = exactOrigins(hosts);

    // ---- Start the OAuth flow (the popup URL) ----
    if (pathname === '/auth') {
      const siteId = url.searchParams.get('site_id') || '';
      // Require an exact configured site. Do not accept wildcard or omitted origins.
      if (!siteId || !hosts.includes(siteId.toLowerCase())) {
        return errorPage('该站点未在 ORIGINS 白名单内。', '');
      }
      if (!env.OAUTH_CLIENT_ID) return errorPage('缺少 OAUTH_CLIENT_ID 配置。', '');
      if (!env.OAUTH_CLIENT_SECRET) return errorPage('缺少 OAUTH_CLIENT_SECRET 配置。', '');

      const state = crypto.randomUUID();
      const authUrl = new URL(GITHUB.authorize);
      authUrl.searchParams.set('client_id', env.OAUTH_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', `${base}/callback`);
      // This public blog only needs write access to public repositories.
      authUrl.searchParams.set('scope', 'public_repo');
      authUrl.searchParams.set('state', state);

      return new Response(null, {
        status: 302,
        headers: {
          Location: authUrl.toString(),
          'Set-Cookie': `${stateCookieName}=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ---- GitHub redirects here ----
    if (pathname === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const cookie = request.headers.get('Cookie') || '';
      const gotState = (cookie.match(new RegExp(`(?:^|;\\s*)${stateCookieName}=([^;]+)`)) || [])[1];

      if (!code) return errorPage('GitHub 未返回授权码。', clear);
      if (!gotState || gotState !== state) {
        return errorPage('state 校验失败（可能为 CSRF），请重试。', clear);
      }

      const tokenRes = await fetch(GITHUB.token, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: env.OAUTH_CLIENT_ID,
          client_secret: env.OAUTH_CLIENT_SECRET,
          code,
          redirect_uri: `${base}/callback`,
        }),
      });

      const responseType = tokenRes.headers.get('content-type') || '';
      const token = parseTokenResponse(await tokenRes.text(), responseType);
      const content = tokenRes.ok && typeof token.access_token === 'string' && token.access_token
        ? { token: token.access_token, provider: 'github' }
        : null;

      if (!content) {
        const requestId = crypto.randomUUID();
        const responseKeys = Object.keys(token).filter((key) => !['access_token', 'refresh_token'].includes(key));
        console.error('GitHub OAuth token exchange failed', {
          requestId,
          status: tokenRes.status,
          contentType: responseType.split(';', 1)[0],
          error: typeof token.error === 'string' ? token.error : null,
          responseKeys,
        });
        return errorPage(
          `GitHub 令牌交换失败：${safeOAuthError(token, tokenRes.status)}（诊断编号：${requestId}）`,
          clear,
        );
      }

      return authPage('github', content, origins, clear);
    }

    return new Response(
      'GitHub OAuth gateway for Sveltia CMS. Ready — use /auth to begin.',
      { status: 200, headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' } },
    );
  },
};
