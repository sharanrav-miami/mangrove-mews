# Fictional photo-match demo

Added November 8, 2026. Four new AI-generated cat photos give Guava and Coco a reference portrait and a second viewpoint. They are staged companion evidence, not photos that were present in the original exported messages. Original fixture payloads, source identities, and previous human decisions are unchanged.

## Quick walkthrough

1. Open [Photo match review](http://127.0.0.1:5197/#matches) as admin or coordinator. Use the local accounts in the demo runbook.
2. Select **Guava candidate · Little Havana**. The staged second observation appears on the left and Guava's reference portrait on the right. Guava is preselected as the suggested target; the coordinator can change it.
3. Point out the brown saddle patches, white nose blaze, different pose, and different lighting. The original message remains underneath. Source triage scores are labelled separately from actual photo-analysis results.
4. Select **Analyze these two fictional photos**. Both images are preselected in AI image comparison; no images are automatically sent.
5. Use **Open saved result for this pair** for the prepared Guava/Coco evidence. In a fresh database, check the fictional-image acknowledgement and select **Compare actual photos**. The real vision agent receives the pixels and saves its visible-feature findings. Repeating the same pair reuses its saved comparison. Model scores are illustrative similarity evidence, not identity probabilities.
6. Return to Photo match review. Write your own reasoning before confirming a merge or keeping records separate. A merge changes the prepared canonical census and closes that review; do it only when you intend to demonstrate that state change.
7. Select **Coco candidate · Little River** for a second pair. Compare the ticked brown coat, light muzzle, and small pale rear toe. A feature hidden by pose or shadow calls for better evidence.

## Repeatable presentation examples

The **Rehearse the comparison** gallery remains available after duplicate reviews close:

- **Marmalade · two viewpoints:** original portrait and the alternate fictional view.
- **Guava · compare markings:** a portrait and a side view with the same intended fictional markings.
- **Coco · side view:** subtle coat/face/toe details under different lighting.
- **Different cats · keep separate:** Marmalade versus calico Poppy, showing why location proximity alone cannot establish identity.

Each example has full-photo links and **Compare this pair with the vision agent**, which preselects its two inputs. Saved comparisons display actual model output; no confidence scores are fabricated for the gallery. No gallery action changes a cat record.

## Asset provenance

| Cat | Reference | Second observation |
| --- | --- | --- |
| Guava | `public/demo-assets/guava-profile.png` | `public/demo-assets/guava-alternate.png` |
| Coco | `public/demo-assets/coco-profile.png` | `public/demo-assets/coco-alternate.png` |

Profiles were generated from invented descriptions. Each alternate was generated using its corresponding profile as a visual reference. All images depict fictional cats in generic tropical courtyards; no real rescue, person, address, or location is represented. The two viewpoints are intended as synthetic positive examples, not a real-world accuracy benchmark.

The backend image allowlist includes these four assets for actual pixel comparison. Canonical profile metadata uses the corresponding portrait/candidate photo. Other cats without dedicated images retain unknown photos rather than borrowing these cats' identities.

## This local rehearsal

Both new pairs completed actual OpenAI image comparisons in `agent` mode and are saved in the local database. Guava returned a possible-match suggestion with 0.92 overall visual similarity; Coco returned a possible-match suggestion with 0.90. These are example outputs, not accuracy measurements or identity probabilities. No cat was merged and no human evidence decision was submitted during this check. The existing Marmalade/Poppy different-features result also reopens without a new request.
