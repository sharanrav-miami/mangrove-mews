# Independent hosted demo setup

The personal Mangrove Mews repository is prepared for an optional isolated Cloudflare deployment. **No personal hosted Worker, D1 database, or R2 bucket is currently verified.** The local app remains the working demonstration.

The former team repository's credentials and resource bindings have not been copied into this repository. Previous team deployment attempts failed D1 management authorization; those historical runs do not establish access for the personal project.

## Configure the new repository explicitly

Set these encrypted Actions secrets in `sharanrav-miami/mangrove-mews` using the owner's chosen Cloudflare account:

- `CLOUDFLARE_ACCOUNT_ID` — the account to provision resources in.
- `CLOUDFLARE_API_TOKEN` — authorized for that account's Worker scripts, D1 management, private R2 management, and the account reads required by Wrangler.
- `MEWS_DEMO_USERS_JSON` — separate salted verifiers for high-entropy synthetic hosted access codes, prepared using the repository's hosted-seed tooling. Keep plaintext codes private.
- `MEWS_OPENAI_API_KEY` and `MEWS_GOOGLE_MAPS_BROWSER_KEY` — only if these integrations are explicitly configured for this repository. Do not copy another repository's credentials automatically.

Do not put credentials into Git, chat exports, or committed files. The local-only password in the runbook is not a hosted credential.

## Deploy after configuration

```sh
gh workflow run cloudflare.yml \
  --repo sharanrav-miami/mangrove-mews \
  --ref main \
  -f deploy_demo=true
```

Normal pushes run checks and do not publish. The optional script creates only `mangrove-mews-demo`, `mangrove-mews-demo-db`, and the private `mangrove-mews-demo-photos` bucket within the explicitly selected account. It applies migrations, imports the synthetic seed, refreshes census projections, and verifies the health/public-census endpoints before reporting a URL.

It does not deploy or alter the original team project. `wrangler.jsonc` contains a placeholder D1 ID for local packaging; use the generated dedicated configuration for the optional demo deployment.

## Verify a successful deployment

1. Open the returned URL and sign in using the private hosted access codes.
2. Check the stored census and denial of private routes for public/sponsor access.
3. Upload a fictional image and reload its protected preview to test R2 write/read.
4. Check a new actual image comparison and the configured Maps origin. Restrict the Maps browser key to approved referrers and APIs.
5. Reload from a second device to verify persistence. Only then describe the personal D1/R2 demo as hosted and verified.
