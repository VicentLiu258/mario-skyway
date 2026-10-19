"""Create a separate editable-source delivery; never use it as the runtime upload."""
from pathlib import Path
import json,zipfile
base=Path(__file__).resolve().parents[1]
version=json.loads((base/'package.json').read_text())['version']
out=base.parent.parent/f'CloudpostDash-完整工程-v{version}.zip'
excluded={'library','temp','local','profiles','build','dist','node_modules','.git','.vercel','__pycache__'}
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted(base.rglob('*')):
        relative=p.relative_to(base)
        if not p.is_file() or excluded.intersection(relative.parts) or p.suffix in {'.log','.pyc','.blend1','.zip'} or p.name in {'.DS_Store','information.json'}:continue
        z.write(p,Path('CloudpostDash')/relative)
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    assert 'CloudpostDash/blender/Pip.blend' in z.namelist()
print(f'{out}\nZIP integrity passed; {out.stat().st_size/1024/1024:.2f} MiB')
