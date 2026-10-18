"""Copy the verified Cocos build into the versioned static deployment folder."""
from pathlib import Path
import shutil, hashlib, json
base=Path(__file__).resolve().parents[1]
src=base/'cocos/build/web-desktop';dst=base/'web'
version=json.loads((base/'package.json').read_text())['version']
assert f'content="{version}"' in (src/'index.html').read_text(), 'Cocos build missing or stale'
files=[p for p in src.rglob('*') if p.is_file() and p.suffix!='.map' and p.name!='.DS_Store']
# web is generated exclusively by this script; replace old release files together.
if dst.exists():shutil.rmtree(dst)
dst.mkdir()
for p in files:
    out=dst/p.relative_to(src);out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,out)
manifest={str(p.relative_to(dst)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(dst.rglob('*')) if p.is_file()}
(base/'web-manifest.json').write_text(json.dumps({'version':version,'files':manifest},indent=2)+'\n')
print(f'Prepared {len(files)} runtime files for v{version}')
