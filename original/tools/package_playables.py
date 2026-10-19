#!/usr/bin/env python3
"""Package the Cocos 3.8.8 runtime for YouTube Playables without changing UUIDs.

The Cocos URL transformer creates native URLs from UUIDs, including @subasset
IDs. This packager renames only real files and appends a public transform pipe
that redirects their final URLs. It does not rewrite asset UUIDs/configuration.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import tempfile
from html.parser import HTMLParser
import zipfile

MIB = 1024 * 1024
MAX_FILES = 8000
MAX_TOTAL = 250 * MIB
MAX_FILE = 30 * MIB
SDK_URL = 'https://www.youtube.com/game_api/v1'
SAFE_SEGMENT = re.compile(r'^[A-Za-z0-9_.-]+$')
SUBASSET_NAME = re.compile(r'^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})@([A-Za-z0-9_-]+)((?:\.[A-Za-z0-9_-]+)+)$')
SOURCE_SUFFIXES = {'.map', '.ts', '.tsx', '.py', '.cjs', '.blend', '.blend1', '.fbx', '.meta', '.md', '.zip'}
IGNORED_NAMES = {'.DS_Store', '.git', '.vercel', 'node_modules', '__pycache__'}
REQUIRED_FILES = ('index.html', 'index.js', 'application.js', 'src/settings.json', 'src/import-map.json', 'assets/resources/config.json')
PATCH_MARKER = '/* Cloudpost Playables native filename redirects: Cocos public transformPipeline. */'


def valid_path(name: str) -> bool:
    path = PurePosixPath(name)
    return bool(name) and not path.is_absolute() and all(part not in {'.', '..'} and SAFE_SEGMENT.fullmatch(part) for part in name.split('/'))


def runtime_files(source: Path) -> list[Path]:
    result = []
    for file in sorted(source.rglob('*')):
        relative = file.relative_to(source)
        if any(part in IGNORED_NAMES for part in relative.parts) or file.suffix.lower() in SOURCE_SUFFIXES:
            continue
        if file.is_symlink():
            raise ValueError(f'Symlinks are not allowed in the runtime: {relative}')
        if file.is_file():
            result.append(file)
    return result


def create_mapping(source: Path, files: list[Path]) -> dict[str, str]:
    mapping = {}
    destinations = set()
    for file in files:
        relative = file.relative_to(source).as_posix()
        renamed = relative
        if not valid_path(relative):
            match = SUBASSET_NAME.fullmatch(file.name)
            if not match or any(not SAFE_SEGMENT.fullmatch(part) for part in PurePosixPath(relative).parts[:-1]):
                raise ValueError(f'Unsupported bundle path: {relative}')
            renamed = str(PurePosixPath(relative).with_name(f'{match[1]}-{match[2]}{match[3]}'))
            if not valid_path(renamed):
                raise ValueError(f'Unsafe rewritten bundle path: {renamed}')
            mapping[relative] = renamed
        if renamed in destinations:
            raise ValueError(f'Renamed file collision: {renamed}')
        destinations.add(renamed)
    return mapping


def redirect_script(mapping: dict[str, str]) -> str:
    """Return a pipe after Cocos' combine stage; only URL path suffixes change."""
    encoded = json.dumps(mapping, sort_keys=True, separators=(',', ':'))
    return f'''{PATCH_MARKER}
            var cloudpostNativePathMap = {encoded};
            cc.assetManager.transformPipeline.append(function (task) {{
              var items = task.output = task.input;
              for (var i = 0; i < items.length; i++) {{
                var item = items[i];
                if (!item || typeof item.url !== 'string') continue;
                var url = item.url;
                var query = url.search(/[?#]/);
                var path = query < 0 ? url : url.slice(0, query);
                var suffix = query < 0 ? '' : url.slice(query);
                for (var original in cloudpostNativePathMap) {{
                  if (!Object.prototype.hasOwnProperty.call(cloudpostNativePathMap, original)) continue;
                  var offset = path.length - original.length;
                  if (offset < 0 || (offset > 0 && path.charAt(offset - 1) !== '/')) continue;
                  if (path.slice(offset) !== original) continue;
                  item.url = path.slice(0, offset) + cloudpostNativePathMap[original] + suffix;
                  break;
                }}
              }}
              return null;
            }});'''


def patch_application(text: str, mapping: dict[str, str]) -> str:
    anchor = 'cc = engine;'
    if PATCH_MARKER in text:
        raise ValueError('Input already contains Playables filename redirects; use the original build')
    if text.count(anchor) != 1:
        raise ValueError('Unsupported Cocos application template: expected one cc = engine; initialization anchor')
    # Application.init runs before game.init. The asset manager's transformPipeline
    # is constructed at module load; game.init does not reset its public pipes.
    return text.replace(anchor, anchor + '\n            ' + redirect_script(mapping), 1)


class HtmlReferences(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.refs: list[str] = []
        self.scripts: list[str | None] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == 'script':
            self.scripts.append(values.get('src'))
        for field in ('src', 'href'):
            if values.get(field):
                self.refs.append(values[field])


def validate_relative_reference(value: str, label: str, base: Path, root: Path) -> None:
    if value.startswith('data:') or value.startswith('#'):
        return
    if value.startswith(('/', '\\')) or re.match(r'^[A-Za-z][A-Za-z0-9+.-]*:', value):
        raise ValueError(f'Non-relative game file reference in {label}: {value}')
    clean = value.split('?', 1)[0].split('#', 1)[0]
    target = (base / clean).resolve()
    if not target.is_relative_to(root.resolve()) or not target.is_file():
        raise ValueError(f'Missing or escaping game file reference in {label}: {value}')


def validate_bundle(directory: Path) -> dict:
    for name in REQUIRED_FILES:
        if not (directory / name).is_file():
            raise ValueError(f'Missing required runtime file: {name}')
    files = sorted(path for path in directory.rglob('*') if path.is_file())
    if len(files) > MAX_FILES:
        raise ValueError(f'Bundle has {len(files)} files; maximum is {MAX_FILES}')
    total = 0
    hashes = {}
    largest = []
    for file in files:
        relative = file.relative_to(directory).as_posix()
        if not valid_path(relative):
            raise ValueError(f'Illegal bundle path: {relative}')
        if file.suffix.lower() in SOURCE_SUFFIXES:
            raise ValueError(f'Non-runtime source file in bundle: {relative}')
        size = file.stat().st_size
        if size >= MAX_FILE:
            raise ValueError(f'Individual file must be less than 30 MiB: {relative}')
        total += size
        hashes[relative] = hashlib.sha256(file.read_bytes()).hexdigest()
        largest.append({'path': relative, 'bytes': size})
    if total >= MAX_TOTAL:
        raise ValueError('Total runtime size must be less than 250 MiB')
    html = HtmlReferences()
    html.feed((directory / 'index.html').read_text())
    if not html.scripts or html.scripts[0] != SDK_URL:
        raise ValueError('The official Playables SDK must be the first script in index.html')
    for reference in html.refs:
        if reference != SDK_URL:
            validate_relative_reference(reference, 'index.html', directory, directory)
    import_map = json.loads((directory / 'src/import-map.json').read_text())
    for reference in import_map.get('imports', {}).values():
        validate_relative_reference(reference, 'src/import-map.json', directory / 'src', directory)
    settings = json.loads((directory / 'src/settings.json').read_text())
    if settings.get('CocosEngine') != '3.8.8':
        raise ValueError('Filename pipe is verified for Cocos Creator 3.8.8 only')
    assets = settings.get('assets', {})
    if assets.get('server') or assets.get('remoteBundles') or assets.get('subpackages'):
        raise ValueError('Playables package must contain all game assets locally')
    return {'passed': True, 'file_count': len(files), 'runtime_bytes': total,
            'largest_files': sorted(largest, key=lambda item: item['bytes'], reverse=True)[:10],
            'sha256': hashes, 'engine': '3.8.8',
            'checks': {'root_index': True, 'legal_paths': True, 'no_sources_or_maps': True,
                       'file_count_at_most_8000': True, 'total_less_than_250_mib': True,
                       'each_file_less_than_30_mib': True, 'sdk_first': True,
                       'relative_entry_references': True, 'all_asset_bundles_local': True}}


def package_bundle(source: Path, directory: Path, archive: Path, report_path: Path, version: str | None = None) -> dict:
    source = source.resolve()
    directory, archive, report_path = directory.resolve(), archive.resolve(), report_path.resolve()
    if not source.is_dir():
        raise ValueError(f'Cocos runtime directory does not exist: {source}')
    if directory == source or directory.is_relative_to(source) or source.is_relative_to(directory):
        raise ValueError('Output and source runtime directories must be separate')
    if version and f'content="{version}"' not in (source / 'index.html').read_text():
        raise ValueError(f'Runtime index.html does not match release version {version}')
    directory.parent.mkdir(parents=True, exist_ok=True)
    archive.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    files = runtime_files(source)
    mapping = create_mapping(source, files)
    staging = Path(tempfile.mkdtemp(prefix='.playables-', dir=directory.parent))
    archive_temp = archive.with_name(archive.name + '.tmp')
    try:
        for file in files:
            relative = file.relative_to(source).as_posix()
            destination = staging / mapping.get(relative, relative)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file, destination)
        application = staging / 'application.js'
        application.write_text(patch_application(application.read_text(), mapping))
        # Keep original asset config UUIDs byte-for-byte. Runtime redirection alone
        # reconciles legal file names with Cocos' native UUID URL construction.
        for file in files:
            if file.name == 'config.json':
                relative = file.relative_to(source)
                if file.read_bytes() != (staging / relative).read_bytes():
                    raise ValueError(f'Asset config was unexpectedly modified: {relative}')
        report = validate_bundle(staging)
        with zipfile.ZipFile(archive_temp, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
            for file in sorted(path for path in staging.rglob('*') if path.is_file()):
                info = zipfile.ZipInfo(file.relative_to(staging).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                bundle.writestr(info, file.read_bytes(), compresslevel=9)
        with zipfile.ZipFile(archive_temp) as bundle:
            if bundle.testzip() is not None or len(bundle.infolist()) != report['file_count']:
                raise ValueError('ZIP integrity/file count validation failed')
        report.update({'game': 'Cloudpost Dash', 'version': version, 'zip_file': archive.name,
                       'zip_bytes': archive_temp.stat().st_size,
                       'zip_sha256': hashlib.sha256(archive_temp.read_bytes()).hexdigest(),
                       'all_content_compressed_less_than_30_mib': archive_temp.stat().st_size < 30 * MIB,
                       'renamed_native_files': len(mapping), 'filename_redirects': mapping,
                       'asset_configs_unchanged': True,
                       'runtime_browser_verification': 'Required separately; static validation does not certify runtime behavior.',
                       'requirements_source': 'https://developers.google.com/youtube/gaming/playables/certification/requirements_stability'})
        if directory.exists():
            shutil.rmtree(directory)
        os.replace(staging, directory)
        os.replace(archive_temp, archive)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        return report
    finally:
        if staging.exists():
            shutil.rmtree(staging)
        if archive_temp.exists():
            archive_temp.unlink()


def main() -> None:
    base = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=None, help='Default: original/web when present, otherwise the Cocos web-desktop build')
    options = parser.parse_args()
    source = options.source or (base / 'web' if (base / 'web').is_dir() else base / 'cocos/build/web-desktop')
    version = json.loads((base / 'package.json').read_text())['version']
    try:
        report = package_bundle(source, base / 'dist/playables', base / 'dist/cloudpost-dash-playables.zip', base / 'dist/report.json', version)
    except (ValueError, OSError, json.JSONDecodeError) as error:
        parser.exit(1, f'Playables packaging failed: {error}\n')
    print(f"Packaged {report['file_count']} runtime files; {report['runtime_bytes'] / MIB:.2f} MiB unpacked, {report['zip_bytes'] / MIB:.2f} MiB ZIP; {report['renamed_native_files']} native filename redirects. All static checks passed.")
    print(base / 'dist/cloudpost-dash-playables.zip')


if __name__ == '__main__':
    main()
