"""Package immutable fictional import inputs and their original photo fixtures."""
from pathlib import Path
import hashlib, json, zipfile
root = Path(__file__).resolve().parents[1]
files = [*sorted((root / 'public/demo-data').glob('*.txt')), *sorted((root / 'public/demo-data').glob('*.ndjson')), *sorted((root / 'public/demo-data').glob('synthetic-*.json'))]
files += [root / 'public/demo-assets' / name for name in ['marmalade-orange-tabby.png','poppy-calico-limp.png','tux-missing-search.png']]
manifest = {'synthetic': True, 'provenance': 'Invented hackathon inputs. Original source files are packaged unchanged.', 'files': [{'path': str(p.relative_to(root / 'public')), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files], 'stagedPhotoCompanions': ['/demo-assets/'+name for name in ['guava-profile.png','guava-alternate.png','coco-profile.png','coco-alternate.png']], 'note': 'Photo companions are website assets, not original chat attachments. Structured JSON is for Live synthetic shift; raw importer takes .txt/.ndjson.'}
with zipfile.ZipFile(root / 'public/demo-data/mews-admin-demo-pack.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as pack:
    for path in files: pack.write(path,str(path.relative_to(root/'public')))
    pack.writestr('manifest.json',json.dumps(manifest,indent=2)+'\n')
print('Created', root / 'public/demo-data/mews-admin-demo-pack.zip')
