/**
 * GitHub OAuth gateway for Sveltia / Decap CMS on GitHub Pages.
 *
 * Deploy as a Cloudflare Worker. This file contains NO secrets — set them as Worker
 * environment variables:
 *   OAUTH_CLIENT_ID      -> your GitHub OAuth App client id
 *   OAUTH_CLIENT_SECRET  -> your GitHub OAuth App client secret
 *   ORIGINS              -> comma-separated allowed site hosts, e.g. "starsofdeduce.github.io"
 *                          (wildcards supported: "*.github.io")
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

/** Parse the ORIGINS variable into hostname regex matchers. */
function hostPatterns(raw) {
  return (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => {
      const re = p
        .split('')
        .map((ch) => {
          if (ch === '*') return '.*';
          if (ch === '.') return '\\.';
          return /[a-zA-Z0-9-]/.test(ch) ? ch : `\\${ch}`;
        })
        .join('');
      return new RegExp(`^${re}$`, 'i');
    });
}

function hostName(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

function allowedHost(host, patterns) {
  return patterns.some((re) => re.test(host));
}

const pageShell = (title, body, extraSetCookie = '') =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;background:#0a0d14;color:#e5e7eb}
  .card{max-width:420px;margin:24px;padding:36px 32px;text-align:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;backdrop-filter:blur(16px)}
  .dot{width:9px;height:9px;border-radius:50%;background:#00f2fe;box-shadow:0 0 12px #00f2fe;display:inline-block;margin-bottom:8px;animation:p 1.2s ease-in-out infinite alternate}
  @keyframes p{from{opacity:.4}to{opacity:1}}
  h1{font-size:1.25rem;margin:8px 0;font-weight:700}
  p{color:#9ca3af;font-size:.9rem;line-height:1.6;margin:0}
  .err{color:#f87171}
</style></head><body><div class="card"><span class="dot"></span>${body}</div></body></html>`,
    { status: title.startsWith('错误') ? 400 : 200, headers: { 'content-type': 'text/html; charset=utf-8', ...(extraSetCookie ? { 'set-cookie': extraSetCookie } : {}) } },
  );

const clear = 'state=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0';

/**
 * The window that GitHub just redirected to (the popup). Handshakes with the CMS, then
 * posts the token back. Mirrors vencax/netlify-cms-github-oauth-provider login_script.js.
 */
function authPage(provider, content, allowedHosts, extraSetCookie) {
  const originsJson = JSON.stringify(allowedHosts);
  const payload = JSON.stringify(content);
  const body = `
  <h1>授权成功，即将返回后台…</h1>
  <p>若窗口未自动关闭，可直接关闭本窗口。</p>
  <script>
    (function () {
      var allowed = ${originsJson};
      function hostAllowed(origin) {
        var h;
        try { h = new URL(origin).hostname; } catch (e) { return false; }
        return allowed.some(function (p) {
          try { return new RegExp('^' + p.replace(/\\./g, '\\\\.').replace('\\*', '.*') + '$', 'i').test(h); } catch (e) { return false; }
        });
      }
      if (!window.opener) { return; }
      var posted = false;
      // Handshake: tell the CMS we are authorising
      try { window.opener.postMessage('authorizing:${provider}', '*'); } catch (e) {}
      window.addEventListener('message', function (e) {
        if (posted) { return; }
        if (e.source !== window.opener || e.data !== 'authorizing:${provider}' || !hostAllowed(e.origin)) { return; }
        posted = true;
        window.opener.postMessage('authorization:${provider}:success:${payload}', e.origin);
        setTimeout(function () { window.close(); }, 300);
      });
    })();
  </script>`;
  return pageShell('授权成功', body, extraSetCookie);
}

function errorPage(message, extraSetCookie) {
  const body = `<h1 class="err">授权失败</h1><p>${message}<br>请刷新页面重试。</p>`;
  return pageShell('错误', body, extraSetCookie);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const base = url.origin; // e.g. https://starsofdeduce-cms-oauth.xxx.workers.dev
    const patterns = hostPatterns(env.ORIGINS);

    // ---- Start the OAuth flow (the popup URL) ----
    if (pathname === '/auth') {
      const siteId = url.searchParams.get('site_id') || '';
      const scope = url.searchParams.get('scope') || 'repo';
      // Only allow a site we recognise to start this flow.
      if (siteId && !allowedHost(siteId, patterns)) {
        return errorPage('该站点未在 ORIGINS 白名单内。', '');
      }
      if (!env.OAUTH_CLIENT_ID) return errorPage('缺少 OAUTH_CLIENT_ID 配置。', '');

      const state = crypto.randomUUID();
      const authUrl = new URL(GITHUB.authorize);
      authUrl.searchParams.set('client_id', env.OAUTH_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', `${base}/callback`);
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('state', state);

      return new Response(null, {
        status: 302,
        headers: {
          Location: authUrl.toString(),
          'Set-Cookie': `state=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ---- GitHub redirects here ----
    if (pathname === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const cookie = request.headers.get('Cookie') || '';
      const gotState = (cookie.match(/(?:^|;\s*)state=([^;]+)/) || [])[1];

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
          grant_type: 'authorization_code',
        }),
      });

      const token = await tokenRes.json();
      const content = token.access_token
        ? { token: token.access_token, provider: 'github' }
        : null;

      if (!content) {
        return errorPage(
          `GitHub 令牌交换失败：${token.error_description || token.error || '未知错误'}`,
          clear,
        );
      }

      // Allowed CMS hosts (matches e.origin) -> postMessage target origin whitelist.
      const allowedHosts = (env.ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
      return authPage('github', content, allowedHosts, clear);
    }

    return new Response(
      'GitHub OAuth gateway for Sveltia CMS. Ready — use /auth to begin.',
      { status: 200 },
    );
  },
};
