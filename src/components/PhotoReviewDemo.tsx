import { useState } from "react";

export const REVIEW_PHOTOS: Record<string, { profile: string; field: string; target: string }> = {
  "CAT-02-ALT": { profile: "/demo-assets/marmalade-orange-tabby.png", field: "/demo-assets/marmalade-alternate-view.png", target: "CAT-02" },
  "CAT-W-GUAVA-ALT": { profile: "/demo-assets/guava-profile.png", field: "/demo-assets/guava-alternate.png", target: "CAT-W-GUAVA" },
  "CAT-W-COCO-ALT": { profile: "/demo-assets/coco-profile.png", field: "/demo-assets/coco-alternate.png", target: "CAT-W-COCO" },
};
const examples = [
  { title: "Marmalade · two viewpoints", left: REVIEW_PHOTOS["CAT-02-ALT"].profile, right: REVIEW_PHOTOS["CAT-02-ALT"].field, hint: "Compare the white chin, tabby stripes, and ear details across different angles. Matching traits support a review, never an automatic merge." },
  { title: "Guava · compare markings", left: REVIEW_PHOTOS["CAT-W-GUAVA-ALT"].profile, right: REVIEW_PHOTOS["CAT-W-GUAVA-ALT"].field, hint: "Look for the brown saddle patches and white nose blaze. The second fictional volunteer sees a different angle; check which markings are actually visible." },
  { title: "Coco · side view", left: REVIEW_PHOTOS["CAT-W-COCO-ALT"].profile, right: REVIEW_PHOTOS["CAT-W-COCO-ALT"].field, hint: "Compare the ticked coat and light muzzle. If the pale rear toe is hidden, request a better photo instead of treating an unseen feature as a contradiction." },
  { title: "Different cats · keep separate", left: "/demo-assets/marmalade-orange-tabby.png", right: "/demo-assets/poppy-calico-limp.png", hint: "Orange tabby stripes and calico patches are visibly different. Demonstrate why a nearby report alone is not enough to merge two cats." },
];
export function prepareVisionPair(left: string, right: string) {
  sessionStorage.setItem("mews-vision-pair", JSON.stringify(["fixture:" + left, "fixture:" + right]));
}
export function PhotoReviewDemo({ canAnalyze }: { canAnalyze: boolean }) {
  const [index, setIndex] = useState(0);
  const example = examples[index];
  return <section className="photo-demo-gallery" aria-labelledby="photo-demo-title">
    <header><p className="eyebrow">Ready-to-show fictional photo pairs</p><h3 id="photo-demo-title">Rehearse the comparison</h3><p>AI-generated cats, staged for the hackathon. These examples stay available after a duplicate review is resolved.</p></header>
    <div className="photo-demo-tabs" aria-label="Fictional photo scenarios">{examples.map((item, i) => <button type="button" className="secondary-button" aria-pressed={index === i} onClick={() => setIndex(i)} key={item.title}>{item.title}</button>)}</div>
    <div className="photo-compare">{[[example.left, "Reference portrait"], [example.right, "Second fictional observation"]].map(([path, label]) => <figure key={label}><img loading="lazy" src={path} alt={`${example.title}: ${label.toLowerCase()}, fictional cat`} width={640} height={640}/><figcaption>{label} · staged demo image <a href={path} target="_blank" rel="noreferrer">View full photo</a></figcaption></figure>)}</div>
    <p className="photo-demo-hint">{example.hint}</p>
    {canAnalyze && <a className="secondary-button" href="#vision" onClick={() => prepareVisionPair(example.left, example.right)}>Compare this pair with the vision agent</a>}
    <p className="photo-demo-caption">Opening the agent selects these photos. Sending them requires the acknowledgement and Compare button on the next screen. Source records and human decisions are preserved.</p>
  </section>;
}
