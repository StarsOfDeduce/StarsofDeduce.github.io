# Vendored browser dependencies

The website keeps security-sensitive browser dependencies in this repository instead of loading moving `@latest` targets at runtime.

| File | Upstream source | SHA-256 |
|---|---|---|
| `js/vendor/purify-3.4.17.min.js` | `https://unpkg.com/dompurify@3.4.17/dist/purify.min.js` | `cd37898f9782adf54820c413191b5691803f0f137c799d6edcfd38523b4c2c31` |
| `admin/vendor/sveltia-cms-0.248.0.js` | `https://unpkg.com/@sveltia/cms@0.248.0/dist/sveltia-cms.js` (font URLs rewritten to the local files below) | `206e748406fa73bdb5a5b8968e07c37d1fc53d42338c2c43c53d5c26c073f8cd` |
| `admin/vendor/fonts/source-sans-3-vf-5.3.1-latin-wght-normal.woff2` | `https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3:vf@5.3.1/latin-wght-normal.woff2` | `19143dca075972bc84e3fd9eab7416dd40cc565dccb2435a044bdfabe060c7d5` |
| `admin/vendor/fonts/noto-mono-5.3.0-latin-400-normal.woff2` | `https://cdn.jsdelivr.net/fontsource/fonts/noto-mono@5.3.0/latin-400-normal.woff2` | `2787a2983d94072a2c6262b1992a2642519800a889bd90ca1042d04a89852d58` |
| `admin/vendor/fonts/material-symbols-outlined-vf-5.3.9-latin-wght-normal.woff2` | `https://cdn.jsdelivr.net/fontsource/fonts/material-symbols-outlined:vf@5.3.9/latin-wght-normal.woff2` | `4c3d64af8aaefc068020112f7c84f00a9f567c6059aeb539d74417cfaccbccaf` |

When updating a dependency, review the upstream release, replace the pinned file, preserve the local font URL rewrites where applicable, update the HTML cache-busting reference, and record the new hash here.
