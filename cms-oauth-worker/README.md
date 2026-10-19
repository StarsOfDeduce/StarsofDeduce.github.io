# CMS OAuth 网关（Cloudflare Worker）

给 Sveltia / Decap CMS 用的 GitHub 登录网关。**只需一个 Cloudflare Worker 即可，无需任何其他服务器。**
部署后把 `admin/config.yml` 的 `backend.base_url` 指向它，后台的 "Sign in" 就能用 GitHub 一键登录。

> 本目录只含配置与代码，**没有任何密钥**。密钥在 Cloudflare 的环境变量里，绝不出现在公开仓库。

## 你需要的三样东西

1. 一个 Cloudflare Worker（托管本网关）
2. 一个 GitHub OAuth App（在 GitHub 设置里创建）
3. 把 `admin/config.yml` 的 `base_url` 改成你的 Worker 地址（我来改也行）

---

## 步骤一：部署 Worker（约 3 分钟）

1. 打开 [Cloudflare 控制台](https://dash.cloudflare.com/) → 用 GitHub 登录（若无账号则注册，免费）
2. 左侧 **Workers & Pages** → **Create** → **Worker**
   - 现有 Worker 名称：`cmsgtio`，地址为 `https://cmsgtio.account-subdomain.workers.dev`
   - 点 **Deploy** 部署
3. 部署后点 **Edit code** → 清空默认内容，把本目录的 [`index.js`](./index.js) 全选粘贴进去 → **Deploy**
4. 记下你的 Worker 地址，形如：
   ```
   https://starsofdeduce-cms-oauth.<你的子域>.workers.dev
   ```

## 步骤二：注册 GitHub OAuth App（约 2 分钟）

1. GitHub 右上角头像 → **Settings** → 左侧最下 **Developer settings** → **OAuth Apps** → **New OAuth App**
2. 填写：
   - **Application name**：`StarsofDeduce CMS`
   - **Homepage URL**：`https://starsofdeduce.github.io`
   - **Authorization callback URL**：`https://cmsgtio.account-subdomain.workers.dev/callback`
     - ⚠️ 必须和步骤一的地址**完全一致**（结尾 `/callback`，不要带多余斜杠）
3. 点 **Register application**
4. 记下 **Client ID**；点 **Generate a new client secret** 记下 **Client Secret**（只显示一次）

## 步骤三：把密钥配进 Worker（约 2 分钟）

回到 Cloudflare 你的 Worker → **Settings** → **Variables and Secrets**：

| 变量名 | 类型 | 值 |
|---|---|---|
| `OAUTH_CLIENT_ID` | Variable | 步骤二的 Client ID |
| `OAUTH_CLIENT_SECRET` | Secret | 步骤二的 Client Secret |
| `ORIGINS` | Variable | `starsofdeduce.github.io` |

保存后 **Deploy** 一次让配置生效。

## 步骤四：接通 CMS

把 `admin/config.yml` 的 `backend` 段改为：

```yaml
backend:
  name: github
  repo: StarsofDeduce/StarsofDeduce.github.io
  branch: main
  base_url: https://<你的worker地址>
  auth_endpoint: auth
  auth_scope: public_repo
```

然后打开 `https://starsofdeduce.github.io/admin/` 点 **Sign in** 即可用 GitHub 一键登录。

> 不想自己改？把 Worker 地址发我就行，我来改 `config.yml` 并推送。

---

## 说明与排错

- **原理解析**：点击登录 → 弹窗到 `你的worker/auth` → 跳 GitHub 授权 → 你在 GitHub 批准 → GitHub 回调 `你的worker/callback` → Worker 用 `Client Secret` 换取 token → 通过 `postMessage` 把 token 弹回 CMS。**Client Secret 只在 Worker 服务器端，绝不进公开仓库。**
- **ORIGINS 白名单**：只填写精确主机名，例如 `starsofdeduce.github.io`。代码不接受 `*.github.io` 等通配符、协议或路径。
- **最小权限**：Worker 会忽略请求参数中的 `scope`，固定请求 `public_repo`，避免 CMS 获得私有仓库权限。
- **state 校验**：`/auth` 会设置 Cookie，`/callback` 会用它校验 state，防 CSRF。更新本目录代码后要重新部署 Worker，仓库提交本身不会更新 Worker。
- **禁止缓存**：授权页和回调页均返回 `Cache-Control: no-store`，并设置 CSP、禁止嵌入和严格来源策略。
- **Invalid Redirect URI**：检查 GitHub OAuth App（当前授权页显示 `PageOAuth`）中的 **Authorization callback URL** 是否与 `https://cmsgtio.account-subdomain.workers.dev/callback` 完全一致。若你更改的是另一个 OAuth App，此错误仍会出现。
- **登录后所有提交都以你的 GitHub 身份直接 commit 到仓库。**
- 若登录弹窗报错，不要刷新 `/callback?code=...` 页面（GitHub 授权码只能使用一次）；关闭弹窗后从后台重新登录。页面会显示诊断编号，Worker 后台 **Logs** 会记录对应的 HTTP 状态和错误类型，但不会记录令牌或 Client Secret。
- **不要使用宽权限令牌作为备选方案**：若必须使用个人访问令牌，应选择 fine-grained token，并仅授权博客仓库和必要操作。

## 用 wrangler CLI（可选）

如果你本机有 Node，也可用命令行部署：

```bash
npm i -g wrangler
cd cms-oauth-worker
wrangler login
wrangler deploy
wrangler secret put OAUTH_CLIENT_ID
wrangler secret put OAUTH_CLIENT_SECRET
```

`wrangler.toml` 的名称已设为现有 Worker 的 `cmsgtio`。首次使用命令行部署前，请确认登录的是拥有该 Worker 的 Cloudflare 账号。
