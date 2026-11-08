# Infrastructure for the personal Mews repository

The working demo is local: React/Vite, the Worker API adapted to loopback, SQLite, and private local image objects. It runs at http://127.0.0.1:5197/ with `npm run dev:full`.

## Independent Cloudflare configuration

This repository no longer targets the team repository's Cloudflare account, Worker, or database. `wrangler.jsonc` uses the name `mangrove-mews`, and its all-zero database ID is an explicit placeholder for packaging checks, not a usable remote binding.

The optional dedicated demo deployment creates:

| Resource | Name |
| --- | --- |
| Worker | `mangrove-mews-demo` |
| D1 | `mangrove-mews-demo-db` |
| Private R2 bucket | `mangrove-mews-demo-photos` |

The script requires `CLOUDFLARE_ACCOUNT_ID` for the owner's chosen account and `CLOUDFLARE_API_TOKEN` with appropriate D1/R2/Worker management access. No account is inferred from the former project. The new repository starts without deployment secrets.

Pushes to `main` run build, tests, Storybook, and Worker packaging only. Deployment requires an explicit workflow dispatch with `deploy_demo=true` after configuring this repository. See [hosted setup](hosted-demo-setup.md).

The public health endpoint is `/api/health`; a successful database check returns `ok: true`, `service: "mangrove-mews"`, and `database: "connected"`. Packaging alone does not verify remote storage.
