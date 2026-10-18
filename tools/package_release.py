"""Package editable sources and the verified Web build, without editor caches."""
from pathlib import Path
import zipfile, shutil, json
base=Path(__file__).resolve().parents[1]
version=json.loads((base/'cocos/package.json').read_text())['version']
index=base/'cocos/build/web-desktop/index.html'
assert index.exists() and f'content="{version}"' in index.read_text(), 'Build missing or outdated'
for name in ['Mario','Luigi','Wario','Toad']:
    assert (base/'blender'/f'{name}.blend').exists()
    assert (base/'blender'/f'{name}.glb').exists()
out=base.parent/f'MarioParkour-交付包-v{version}.zip'
exclude={'library','temp','local','profiles','__pycache__','.git','.vercel','node_modules'}
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted(base.rglob('*')):
        rel=p.relative_to(base)
        if not p.is_file() or exclude.intersection(rel.parts) or p.suffix in {'.log','.blend1','.pyc'} or p.name=='.DS_Store':continue
        z.write(p,Path(base.name)/rel)
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    assert version.encode() in z.read('MarioParkour/cocos/build/web-desktop/index.html')
    print(f'{out}\n{len(z.namelist())} files; {out.stat().st_size/1024/1024:.2f} MB; ZIP integrity passed')
shutil.copy2(out,base.parent/'MarioParkour-交付包.zip')
