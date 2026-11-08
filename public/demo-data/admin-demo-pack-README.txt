MEWS ADMIN IMPORT PACK — ALL DATA IS FICTIONAL
Prepared November 8, 2026. No live chat, real cat, volunteer contact, or exact rescue location is included.

START HERE
1. Sign in to the local website as the demo admin.
2. Open Care workspace and find Intentional raw import.
3. Choose synthetic text, select mangrove-mews-whatsapp-export.txt.
4. Confirm Source kind is WhatsApp Export, inspect the loaded text, then Import synthetic raw export.
5. Repeat with sms-relay.ndjson (Source kind SMS relay).
6. Already-stored exports retain original evidence. Use a new fictional phone report to show a fresh write.

BIGGER SCENARIOS
- Follow-up .txt/.ndjson: 28 reports combined, eight broad areas.
- Weekend .txt/.ndjson: 72 reports combined, four languages, 18 fictional colony groups.
- Raw parsing understands established fixture descriptions; unfamiliar new cat names remain unmatched. This is intentional, not a promise to understand arbitrary chats.
- Structured .json files power the Live synthetic shift and preserve explicit identity proposals; do not upload them into the raw .txt/.ndjson importer.

PHOTOS
The demo-assets folder contains the three fictional source images referenced in the chat files. The importer accepts only allowlisted local fixture paths; it does not upload arbitrary chat attachments from this ZIP. Guava/Coco photo-review companions were added separately for rehearsal and are available in Photo match review on the website; they were not retroactively inserted into these original source messages.

PREPARE THE REST OF THE LOCAL WEBSITE
From the repository root, after starting dev:full:
  MEWS_LOCAL_DEMO=1 node dev/prepare-admin-demo.mjs
This creates an online SQLite backup, then adds missing sources from the three packs (existing legacy evidence is preserved without replay/reconciliation) and adds stable ADMIN-DEMO rows for appointments, supplies, handoffs, feeding assignments, care outcomes, clarifications, community leads, search tasks, pending missing leads, and private-photo examples. It does not erase data, change cat statuses, merge records, invent AI scores, or reset human decisions.

BOUNDARIES
No WhatsApp, SMS, Facebook, email, or other external message is sent. Do not use real chats or photos. Forecast/task history and documented outcomes labelled ADMIN-DEMO are staged fictional histories, not real field access verification or treatment. Live OpenAI comparisons remain separately labelled agent results. The local adapter persists state; login/logout is not a data reset.
