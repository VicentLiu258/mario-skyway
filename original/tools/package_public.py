#!/usr/bin/env python3
"""Publish the standalone web entry without the platform-only blocking SDK.

The Playables ZIP remains SDK-first. All public runtime URLs live under a
content-addressed directory, so long-lived caching cannot mix game versions.
"""
import argparse
import hashlib
from pathlib import Path
import shutil
import tempfile

SDK_TAG = '<script src="https://www.youtube.com/game_api/v1"></script>'


def publish(source: Path, destination: Path) -> str:
    html = (source / 'index.html').read_text()
    if html.count(SDK_TAG) != 1:
        raise ValueError('Expected exactly one platform SDK tag in the candidate')
    html = html.replace(SDK_TAG, '<meta name="distribution" content="standalone-web">')
    digest = hashlib.sha256()
    for file in sorted(p for p in source.rglob('*') if p.is_file()):
        digest.update(file.relative_to(source).as_posix().encode() + b'\0')
        digest.update(html.encode() if file.name == 'index.html' else file.read_bytes())
    revision = digest.hexdigest()[:16]
    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='.cloudpost-public-', dir=destination.parent))
    try:
        release = staging / 'releases' / revision
        shutil.copytree(source, release)
        (release / 'index.html').write_text(html)
        entry = html.replace('<head>', f'<head>\n    <base href="./releases/{revision}/">', 1)
        (staging / 'index.html').write_text(entry)
        # Keep one prior revision so a tab open during deployment can finish its
        # deferred character downloads. Never carry the legacy blocking entry.
        previous = destination / 'releases'
        if previous.is_dir():
            candidates = sorted((p for p in previous.iterdir() if p.is_dir() and p.name != revision), key=lambda p: p.stat().st_mtime, reverse=True)
            for old in candidates[:1]:
                shutil.copytree(old, staging / 'releases' / old.name)
        if destination.exists():
            shutil.rmtree(destination)
        shutil.move(str(staging), str(destination))
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    print(f'Standalone web release {revision}: no external startup requests')
    return revision


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--destination', type=Path, required=True)
    args = parser.parse_args()
    publish(args.source.resolve(), args.destination.resolve())
