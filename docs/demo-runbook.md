# Mews — admin-only demo runbook

Updated November 8, 2026. One administrator account, from the login screen through the complete rescue workflow. Allow **10–12 minutes** for the core story; the extensions cover the remaining admin tools. All rescue records, photos, messages, locations, and tracker activity are fictional.

## Start here

The local website is [http://127.0.0.1:5197/#login](http://127.0.0.1:5197/#login).

| Login field | Local demo value |
| --- | --- |
| Email | `admin@mangrovemews.demo` |
| Password | `SyntheticMiami2026!` |

Stay signed in as this account for the entire demonstration. Assigning a task to a fictional volunteer does not require switching accounts.

If the login screen detects an existing session, select **Sign out and start again**. This preserves the fictional database and takes you back to the beginning of the sign-in experience.

## Prepare before judges arrive

1. Keep the local server running. If the website is already open and works, do not start a second server.
2. If it is stopped, use the terminal commands below. Node.js 24 or newer is required.
3. Check that Field map loads Google Maps and that AI image comparison lists the fictional images. Keys are already in ignored local configuration; do not put them into slides or source code.
4. Run `MEWS_LOCAL_DEMO=1 node dev/prepare-admin-demo.mjs` from the repository root to add the complete fictional admin scenarios. It backs up the local database and preserves existing evidence and decisions.
5. Return to `#login` and sign out. Leave that screen open for the start of the demo.
6. Keep this runbook open separately. Use the saved image results for a predictable presentation; a new model call can take longer.

```sh
cd '/Users/sharan/Documents/Codex/2026-11-07/i-would-like-to-create-an/work/devday-hackathon-2026'
npm ci
MEWS_ENABLE_OPENAI=1 npm run dev:full
```

The last command enables the configured OpenAI integrations. Without its enable flag, local intake defaults to deterministic demo mode. This server stays on loopback; it is not the hosted Cloudflare app.

## Saved import files and complete rehearsal data

In **Chat imports & outbox**, use **Download full import pack**, **WhatsApp export · .txt**, or **SMS relay · .ndjson**. The ZIP includes nine source/replay files, their three original fictional photo attachments, and a manifest/instructions.

For an actual saved-file demonstration, download the WhatsApp file, go to **Care workspace → Intentional raw import → Choose synthetic text**, choose the saved `.txt`, inspect the populated text/source kind, then explicitly click **Import synthetic raw export**. Repeat with the `.ndjson` SMS file. Loading a file does not import it. Exact file repeats use a stable content-based batch ID and retain the prior import.

The preparation script supplies overdue/future/completed feedings, open/resolved care and TNR cases, assigned/blocked/completed search tasks, pending/replied clarifications, appointments, supply pledges/deliveries, open/closed handoffs, community leads, and pending/approved private photos. Seeded histories are labelled fictional ADMIN-DEMO scenarios. Existing actual vision results remain distinct. Running preparation again adds no duplicate rows.

## The core presentation

### 1. Log in and frame the problem — 45 seconds

**Click:** open `#login` → enter the admin email/password → **Sign in**. A local administrator demo card can fill the form; submit it yourself.

**Show:** the full login screen becomes the signed-in workspace, with the administrator account in the header.

**Say:** “A small rescue's cat updates arrive as messages, photos, and shared locations. Sorting them takes hours and urgent cases can disappear in chat. Mews turns those reports into a current census and a queue a person can act on. Every rescue record shown today is fictional.”

On narrow screens, open **Open navigation** to reach pages; on desktop use the grouped sidebar.

### 2. Establish the operating picture — 45 seconds

**Click:** **Care workspace**.

**Show:** Today’s operations, urgent groups, assignments/overdue feedings, and Team census. Scroll to a colony to show identified cats, fixed/TNR pending, care attention, and last feeder/time.

**Say:** “This is the admin's workday: urgent care first, then the tasks and feeding confirmations that need attention. A reported concern is not a veterinary diagnosis.”

The prepared rehearsal contains 18 fictional colonies and approximately 38 active/unmerged cats before further decisions. Counts are dynamic; use the visible current totals. An open review count is not a count of distinct injured cats.

### 3. Send a phone-sized report without retyping — 60 seconds

**Click:** **New field report**.

**Do:** keep the fictional photo/area, enter or retain a short made-up observation, choose a count, mark feeding confirmation and urgency where appropriate, then submit. Use the prefilled Poppy example for a consistent story.

**Show:** the successful delivery notice. Return to **Care workspace**, refresh if needed, and locate its source-linked report/care queue item. Open **Cat profiles & visits** and find Poppy to show the pending care source and history.

**Say:** “The feeder enters this once. The message, photo reference, broad shared area, count, feeding visit, and urgency travel together into the stored record.”

This is a responsive web report using fictional assets and broad demo areas, not a live SMS or GPS integration.

### 4. Bring a chat shift to life — 75 seconds

**Click:** **Chat imports & outbox** → **Live synthetic shift**.

**Set:**

| Control | Value |
| --- | --- |
| Demo scenario | Weekend dispatch · 72 reports / 18 colonies |
| Triage mode | Fast rules · no model call |
| Replay pace | Presentation · 1.5 seconds |

**Do:** **Start / resume**. Show several messages arriving, including a photo; use Accelerated pace for a larger portion if time permits. **Pause** before leaving.

**Show:** English, Spanish, Portuguese, and Haitian Creole messages; fictional reporter aliases; broad areas; stored/retained status. Return to Team census to connect the chat to the rescue’s records.

**Say:** “The same original source can arrive in a batch or in this paced replay. It stays one source, so replay does not inflate the census or create another model charge.”

Because this database is already seeded, many messages will say **Already stored**. That is the expected duplicate guard, not a broken importer. Do not promise new counts from replaying old evidence. Use a new phone report in step 3 to show a genuinely new submission.

### 5. Compare fictional photos, then show the human decision — 2 minutes

**Click:** **Photo match review** → choose **Guava candidate · Little Havana**.

**Show:** the staged second viewpoint and the Guava portrait, already paired. Point out the brown saddle markings, white nose blaze, different pose, and light. The staged-photo label explains that these new demo images supplement the original source text.

**Click:** **Analyze these two fictional photos** → **Open saved result for this pair**.

**Show:** actual saved `agent` evidence, per-feature similarity, visible agreements, differences, and limitations. If there is no saved result in a fresh database, check the fictional-image acknowledgement and choose **Compare actual photos** once.

**Say:** “The vision agent compares the image pixels and explains its evidence. These are uncalibrated similarity scores. The coordinator makes the identity decision.”

**Click:** **Open duplicate record review**. Select Guava's candidate again. Write your own reasoning before choosing a decision. To demonstrate the challenge's dedupe requirement, confirm the candidate-to-Guava merge only after checking the selected source and target; then show the updated canonical profile/census. The candidate becomes history under the canonical cat rather than another counted cat.

**Repeatability:** if Guava was already reviewed, use Coco's open review or the **Rehearse the comparison** gallery. Never merge unrelated cats merely to repeat the demonstration. The gallery always offers Marmalade, Guava, Coco, and a different-cats example; it never changes records.

**Optional contrast:** choose **Different cats · keep separate** → open its saved result to show why Poppy's calico patches and Marmalade's orange stripes contradict a match.

### 6. Inspect the cat, colony, and map — 90 seconds

**Click:** **Cat profiles & visits** → Guava or Poppy. Show name, coat/markings, estimated DOB, care/TNR/vaccination context, colony associations, timestamps, and feeder logs. Unknown fields stay unknown. Poppy’s **Open the source review** links back to the care evidence.

**Click:** **Field map**. Enable stored colonies, cat observations/tracker, weather, and active missing-cat search plans.

**Do:** **Follow Skipper**, **Pause simulated tracker**, then resume. Use **Show South Florida** to return to county coverage. Select a colony or cat and show its displayed radius.

**Do:** change **Viewing level** from Internal team to Sponsor, then Public, then back to Internal team. This previews audiences while you remain the admin.

**Say:** “The Google basemap is real. The cat anchors, radii, hazards, and moving Skipper tag are fictional demo context. Public areas are broader; private search plans are omitted. Weather helps plan safer checks, but it does not prove a cat's location.”

### 7. Turn a missing-cat lead into a reviewable plan — 90 seconds

**Click:** **Missing-cat cases** → select Tux's prepared Miami Beach case.

**Show:** description/photo context, last-seen area/time, manager-confirmed lifecycle, saved search zones, and field evidence history. An unsafe report has already excluded a zone in the prepared scenario.

**Do:** use the saved plan for timing. If demonstrating a new plan, choose **Update search plan with feedback** and wait for its mode/result before describing it.

**Click:** **Lost cat navigator** for the quick-query version. Use Tux, Miami Beach, its last-seen time, and markings; choose **Find likely search areas**. Inspect the evidence/reasons and access/safety reminders.

**Click:** **Field-search tasks**. Review the prepared assignment and its safety/access checklist. As admin, you can assign or inspect a task without logging in as its volunteer.

**Say:** “The agent combines database context, broad geography, and weather to suggest where a person could check. It does not track this missing animal or guarantee a search zone is safe. A coordinator checks access and assigns the work.”

### 8. End with documented outcomes — 60 seconds

**Click:** **Care outcomes & reports**.

**Set:** From date `2026-11-01`, Through date `2026-11-30` for the prepared data.

**Show:** TNR cases pending now, documented medical resolutions, and documented TNR completions. Select **Download outcomes CSV**.

**Say:** “This turns scattered updates into a report the rescue can actually hand to a sponsor or the city. A care appointment does not count as a resolved medical case; the outcome needs documented evidence.”

Finish on **Care workspace**, with its current queue and census. Stay in the admin account throughout.

## Optional admin feature stations

Use these after the core story, or to answer judges’ questions. Each is demonstrated from the same admin session.

| Feature | Exact path and action | What to demonstrate |
| --- | --- | --- |
| Raw WhatsApp/SMS import | Care workspace → Load WhatsApp fixture / Load SMS fixture → inspect text → Import synthetic raw export | Deliberate exports and intentional relays, traceable sources, no live chat scraping. Use only shipped or deliberately fictional inputs. |
| Clarification and uncertainty | Clarifications & routing → select an unmatched/uncertain report | Original count range/confidence preserved; request clarification and show the separate human verification. Threshold defaults to 0.75; a low-confidence proposal stays unmatched. |
| Global search | Search records → search Guava, Poppy, or a source phrase | Filters and links lead back to profiles, colonies, or source review. |
| Feeding schedule | Feeding schedule → choose stored colony/team member/time → create assignment | Missing confirmations, reassignment, and visit logs. Schedule a new fictional task; do not claim a real visit occurred. |
| Care appointments | Field coordination → Care appointments → fill cat/type/title/fictional clinic/area/time/assignee → Schedule fictional visit | Follow-up logistics and due state. A manager separately completes logistics; medical outcomes remain separate. |
| Supplies | Field coordination → Supply requests → request 6 bags, pledge an available quantity, inspect remaining | Pledges are bounded; admin confirms actual fictional delivery with evidence. |
| Handoff | Field coordination → Daily handoff → link a cat/colony, title, detail, priority, responsible person | Read acknowledgement differs from resolution. Admin closes only with an explanation. |
| My shift | My shift; optionally assign a new appointment/handoff to the admin first | Personal work exists alongside the manager's wider queue. No second account is needed. |
| Notifications | Header bell → open an item → Mark all loaded items read | Urgent review links and per-account persistent read state. These are in-app notices, not external SMS/email. |
| Private image storage | Private photo review → Prepare demo photo → upload → refresh → approve/reject | Browser re-encoding, private metadata/preview, and a recorded admin decision. Local adapter storage is active; hosted R2 is not verified. |
| Community signals | Community signals → load supplied fictional example → review/extract → save lead | Intentional redacted content becomes a reviewed lead; no Facebook/PawBoost scraping or automatic cat creation. |
| Evaluation | Agent evaluation → Run evaluation | Read the mode and expected/actual outcomes. Deterministic results do not prove model accuracy. |
| Preferences/profile | Header Appearance settings/account controls | Theme, layout, accessibility/reduced motion, and account context. Reduced motion pauses the simulated tracker. |
| Phone offline outbox | New field report → temporarily take browser offline → submit fictional report → restore service | Queued report retries while the app remains open and the original account is signed in. |
| Source outbox | Chat imports & outbox → Offline source outbox → load fixture → queue → Send now | Original source identity survives retry. This is browser-local delivery, not background service-worker sync. |

## Recovery during a live demo

| Symptom | What to do |
| --- | --- |
| Login says a session already exists | Sign out and start again. Database contents remain. |
| Page is unavailable | Check the terminal for the local server; start it once using the commands above. |
| You see “Already stored” in chat | Explain the replay guard. Submit a new fictional phone report to demonstrate a new write. |
| A duplicate review has disappeared | It was resolved. Use another open candidate or the repeatable gallery; do not recreate or merge unrelated records. |
| A model call is slow/unavailable | Use Open saved result for this pair. Do not invent a result or describe a fallback as live AI. |
| Google Maps is unavailable | Use the labelled synthetic preview for the workflow. Check browser key restrictions/API configuration later. |
| No outcomes in a report | Set the November 2026 date window; only documented outcomes contribute. |
| A search zone is absent | Check unsafe feedback or case status. Removed unsafe zones should stay excluded. |
| Changes do not appear immediately | Use the page's Refresh button. Keep the admin session active. |

## State and hosting notes

This is a persistent demo. Login/logout does not reset reports, human merges, tasks, photos, or outcomes. For most rehearsals, keeping history and using the repeatable gallery is preferable to resetting data. A database archive/reset is preparation work and should not be performed in front of judges.

The branch has passed 53 tests, the production build, and Worker packaging. The latest hosted attempt passed CI checks but failed Cloudflare D1 authorization. Show the working local site; do not present a planned hosted URL as deployed. See [hosted setup](hosted-demo-setup.md) for details.

The scorecard evaluates the hackathon demo without deducting points for the expected absence of field operation or a rescue pilot. See [the current regrade](feature-pass-8-regrade.md).
