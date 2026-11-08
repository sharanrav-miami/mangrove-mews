# Personal submission and demo setup

Repository: https://github.com/sharanrav-miami/mangrove-mews (private at the owner's request).

This independent repository preserves starter provenance and Git authorship. The original team remote is retained locally as `upstream`; new work is pushed to this repository's `main`. No deployment secrets were copied between repositories, and the current Cloudflare configuration does not target the former team's resources.

## Start from the login screen

Open http://127.0.0.1:5197/#login. Use `admin@mangrovemews.demo` and the local-only password `SyntheticMiami2026!`, or choose **Use admin demo account**, then **Sign in**.

Follow [the admin-only runbook](demo-runbook.md). It starts with login and stays in one account throughout the presentation.

## Reproduce on a fresh checkout

```sh
gh repo clone sharanrav-miami/mangrove-mews
cd mangrove-mews
npm ci
npm run dev:full
```

With the server running, use another terminal in the repository:

```sh
MEWS_LOCAL_DEMO=1 node dev/prepare-admin-demo.mjs
```

This imports missing fictional sources and adds complete admin scenarios. It creates a backup before changing an existing local demo. Repeat runs preserve previous evidence and decisions; no cats are automatically merged or marked missing/adopted.

Actual vision comparison requires an OpenAI key in an ignored local configuration file and startup with `MEWS_ENABLE_OPENAI=1 npm run dev:full`. The existing prepared local database has real saved Guava/Coco and Marmalade comparisons. Fresh checkouts do not invent or automatically precompute those results.

## Import files

Chat imports & outbox offers **Download full import pack**, WhatsApp `.txt`, SMS `.ndjson`, and larger shift files. The ZIP is `public/demo-data/mews-admin-demo-pack.zip`; it includes nine fixture/replay files, three original fictional source photos, and a manifest.

Use **Care workspace → Choose synthetic text** to load `.txt` or `.ndjson`, then explicitly import it. Re-selecting an identical file uses the same content-derived batch identity. Structured JSON belongs to the scripted replay, not the raw text importer.

## Verification

53 tests passed; TypeScript/production build and pinned Worker dry run passed. Browser checks verified admin login/logout, private-link return after sign-in, paired fictional photos, live saved Guava/Coco analysis, and reuse of a saved different-cats result.

Prepared admin examples include feeding schedules, care/TNR outcomes, search tasks, clarifications, missing leads, appointments, supplies/pledges, handoffs, community reviews, and private photos. All are fictional and labelled for rehearsal. Field operation and rescue-pilot readiness are outside the hackathon scoring scope.
