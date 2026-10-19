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
shutil.copy2(base/'THIRD_PARTY_LICENSES.txt',dst/'THIRD_PARTY_LICENSES.txt')
# The HTML already draws our visible first frame. Do not hold game readiness
# behind the builder's additional 2-second canvas splash and embedded PNG.
settings_path=dst/'src/settings.json'
settings=json.loads(settings_path.read_text())
settings['splashScreen']={'totalTime':0}
settings_path.write_text(json.dumps(settings,separators=(',',':')))
# Start fetching the engine in parallel with the small SystemJS boot chain.
# These are preload hints only; the SDK still executes before any game code.
imports=json.loads((dst/'src/import-map.json').read_text())['imports']
engine=imports['cc'].removeprefix('../').removeprefix('./../')
html=(dst/'index.html').read_text()
assert '<!-- cloudpost-language -->' in html
html=html.replace('<!-- cloudpost-language -->','<script>\n'+(base/'localization.js').read_text()+'\n</script>')
html=html.replace('</head>',f'    <link rel="preload" href="./{engine}" as="script">\n  </head>')
(dst/'index.html').write_text(html)
# Surface loader failures instead of leaving an unchanging splash forever.
entry=dst/'index.js'
entry.write_text(entry.read_text().replace('console.error(err);', 'console.error(err); if (window.cloudpostBootError) window.cloudpostBootError();'))
application=dst/'application.js'
application.write_text(application.read_text().replace('cc = engine;', "cc = engine;\n            if (window.cloudpostBoot) window.cloudpostBoot('Preparing the sky routes…', 45);"))
manifest={str(p.relative_to(dst)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(dst.rglob('*')) if p.is_file()}
(base/'web-manifest.json').write_text(json.dumps({'version':version,'files':manifest},indent=2)+'\n')
print(f'Prepared {len(manifest)} runtime files for v{version}')
