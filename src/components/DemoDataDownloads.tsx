import { Download, FileText } from "lucide-react";

export function DemoDataDownloads() {
  return <section className="panel demo-data-downloads" aria-labelledby="demo-download-title">
    <header className="panel-heading"><div><p className="eyebrow">Fictional inputs you can keep</p><h2 id="demo-download-title">Download the demo files</h2></div><Download size={20}/></header>
    <p>Save a chat export, then use <a href="#overview">Care workspace → Choose synthetic text</a> to demonstrate an intentional file import. Every person, cat, message, and shared area is invented.</p>
    <div className="shared-actions"><a className="primary-button" href="/demo-data/mews-admin-demo-pack.zip" download><Download size={16}/>Download full import pack</a><a className="secondary-button" href="/demo-data/mangrove-mews-whatsapp-export.txt" download><FileText size={16}/>WhatsApp export · .txt</a><a className="secondary-button" href="/demo-data/sms-relay.ndjson" download><FileText size={16}/>SMS relay · .ndjson</a></div>
    <details><summary>More fictional shifts and formats</summary><div className="shared-actions"><a className="secondary-button" href="/demo-data/synthetic-weekend-whatsapp.txt" download>Weekend WhatsApp · 36 source messages</a><a className="secondary-button" href="/demo-data/synthetic-weekend-sms.ndjson" download>Weekend SMS · 36 source messages</a><a className="secondary-button" href="/demo-data/synthetic-weekend-shift.json" download>Structured 72-report replay · JSON</a><a className="secondary-button" href="/demo-data/admin-demo-pack-README.txt" download>Import instructions</a></div></details>
    <p className="source-note">The raw importer accepts .txt and .ndjson. Structured JSON is the source for the scripted Live synthetic shift. Raw parsing supports the established fixture vocabulary; unfamiliar names stay unmatched for review. The ZIP contains the original chat attachments, not real chat access or automatically scraped data.</p>
  </section>;
}
