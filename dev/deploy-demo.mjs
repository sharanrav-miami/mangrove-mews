/** Dedicated synthetic deployment. Never mutates the team's release resources. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildDemoSeed, hostedSnapshotRefresh } from './seed-hosted-demo.mjs';

const root = process.cwd();
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error('CLOUDFLARE_API_TOKEN is required; use the repository deployment workflow.');
const original = JSON.parse(await readFile(resolve(root, 'wrangler.jsonc'), 'utf8'));
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!/^[a-f0-9]{32}$/i.test(account ?? "")) throw new Error("Set CLOUDFLARE_ACCOUNT_ID for your own Cloudflare account before deploying.");
const workerName = 'mangrove-mews-demo';
const databaseName = 'mangrove-mews-demo-db';
const bucketName = 'mangrove-mews-demo-photos';
const state = resolve(root, '.wrangler/hosted-demo');
await mkdir(state, { recursive: true });
async function api(path, options = {}, missing = false) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {
    ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json();
  if (missing && response.status === 404) return null;
  if (!response.ok || body.success === false) throw new Error(`Cloudflare ${path}: ${body.errors?.map(item => `${item.code}: ${item.message}`).join('; ') || response.status}`);
  return body.result;
}
function wrangler(args, input) {
  const result = spawnSync('npx', ['--yes', 'wrangler@4.158.0', ...args], {
    cwd: root, env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
    input, encoding: 'utf8', stdio: input ? ['pipe', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.status !== 0) {
    // Secret operations deliberately never echo their input or output.
    if (!input) throw new Error(`Wrangler ${args[0]} failed (${result.status}).`);
    throw new Error(`Wrangler secret operation failed (${result.status}); inspect Cloudflare permissions.`);
  }
}
wrangler(['whoami']);
const databases = await api('/d1/database?name='+encodeURIComponent(databaseName)+'&per_page=100');
let database = databases.find(item => item.name === databaseName);
if (!database) database = await api('/d1/database', { method: 'POST', body: JSON.stringify({ name: databaseName, primary_location_hint: 'enam' }) });
const bucket = await api(`/r2/buckets/${bucketName}`, {}, true);
if (!bucket) await api('/r2/buckets', { method: 'POST', body: JSON.stringify({ name: bucketName, locationHint: 'enam' }) });
const subdomain = await api('/workers/subdomain');
if (!subdomain?.subdomain) throw new Error('The account must have a workers.dev subdomain.');
const origin = `https://${workerName}.${subdomain.subdomain}.workers.dev`;
const configPath = resolve(state, 'wrangler.json');
await writeFile(configPath, JSON.stringify({
  name: workerName, account_id: account, main: resolve(root, 'worker/index.js'),
  compatibility_date: original.compatibility_date, compatibility_flags: ['nodejs_compat'], workers_dev: true,
  assets: { ...original.assets, directory: resolve(root, 'dist') },
  d1_databases: [{ binding: 'DB', database_name: databaseName, database_id: database.uuid, migrations_dir: resolve(root, 'migrations') }],
  r2_buckets: [{ binding: 'PHOTOS', bucket_name: bucketName }],
  vars: { APP_ORIGIN: origin, SYNTHETIC_HOSTED_DEMO: 'true' },
}, null, 2));
wrangler(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', configPath]);
const seedPath = resolve(state, 'synthetic-seed.sql');
await writeFile(seedPath, await buildDemoSeed(process.env.MEWS_DEMO_USERS_JSON));
wrangler(['d1', 'execute', 'DB', '--remote', '--file', seedPath, '--config', configPath]);
await api(`/d1/database/${database.uuid}/query`,{method:'POST',body:JSON.stringify(hostedSnapshotRefresh())});
wrangler(['deploy', '--config', configPath]);
const secrets = { OPENAI_API_KEY: process.env.MEWS_OPENAI_API_KEY, GOOGLE_MAPS_BROWSER_KEY: process.env.MEWS_GOOGLE_MAPS_BROWSER_KEY };
for (const [name, value] of Object.entries(secrets)) {
  if (value) wrangler(['secret', 'put', name, '--config', configPath], value);
}
const health = await fetch(`${origin}/api/health`);
if (!health.ok || !(await health.json()).ok) throw new Error('Hosted database health check failed.');
const census = await fetch(`${origin}/api/public/census`);
if (!census.ok) throw new Error('Hosted public census is unavailable.');
await writeFile(resolve(state, 'deployment.json'), JSON.stringify({ url: origin, worker: workerName, database: databaseName, bucket: bucketName, verifiedAt: new Date().toISOString() }, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, `### Synthetic Mews demo\n\n[Open the hosted app](${origin})\n\nDedicated D1: ${databaseName}. Private R2: ${bucketName}. Release resources were not changed.\n`, { flag: 'a' });
console.log(JSON.stringify({ deployed: origin, database: databaseName, privateBucket: bucketName }));
