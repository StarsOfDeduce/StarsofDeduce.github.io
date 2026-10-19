# Vendored browser dependencies

The website keeps security-sensitive browser dependencies in this repository instead of loading moving `@latest` targets at runtime.

| File | Upstream source | SHA-256 |
|---|---|---|
| `js/vendor/purify-3.4.17.min.js` | `https://unpkg.com/dompurify@3.4.17/dist/purify.min.js` | `cd37898f9782adf54820c413191b5691803f0f137c799d6edcfd38523b4c2c31` |
| `admin/vendor/sveltia-cms-0.248.0.js` | `https://unpkg.com/@sveltia/cms@0.248.0/dist/sveltia-cms.js` | `215afa31ef30b2673d3a5806f96bd63be5ef3b7d2ff4957a1c8c186bbeaf27c5` |

When updating either file, review the upstream release, replace the pinned file, update the HTML reference when the filename changes, and record the new hash here.
