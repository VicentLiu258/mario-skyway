#!/usr/bin/env python3
"""Behavioral tests for the Playables runtime packager (no browser required)."""
from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import zipfile

import package_playables as pack

UUID = '01234567-89ab-cdef-0123-456789abcdef'
OLD_PATH = f'assets/resources/native/01/{UUID}@a12b3.bin'
NEW_PATH = OLD_PATH.replace('@a12b3', '-a12b3')
APPLICATION = '''System.register([], function (_export) {
    var cc;
    function Application() {}
    Application.prototype.init = function (engine) {
        cc = engine;
        cc.game.onPostBaseInitDelegate.add(function () {});
    };
    return {setters: [], execute: function () {_export('Application', Application);}};
});'''


class BundleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / 'web'
        self.source.mkdir()
        files = {
            'index.html': f'<html><head><script src="{pack.SDK_URL}"></script><meta name="application-version" content="1.0.0"><link href="./style.css"></head><body><script src="./index.js"></script></body></html>',
            'index.js': 'System.import("./application.js");',
            'application.js': APPLICATION,
            'style.css': 'body {margin: 0}',
            'src/settings.json': json.dumps({'CocosEngine': '3.8.8', 'assets': {'server': '', 'remoteBundles': [], 'subpackages': []}}),
            'src/import-map.json': json.dumps({'imports': {'cc': './../cocos-js/cc.js'}}),
            'cocos-js/cc.js': '/* Runtime engine. */',
            'assets/resources/config.json': json.dumps({'uuids': ['a18RmbZnxBf4UYXR2bJha7@a12b3'], 'nativeBase': 'native'}),
            OLD_PATH: 'native geometry bytes',
            'src/chunks/bundle.js.map': 'source map',
            'cocos/source.ts': 'source code',
            'model.blend': 'source model',
        }
        for relative, text in files.items():
            file = self.source / relative
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(text)
        self.out = self.root / 'dist/playables'
        self.archive = self.root / 'dist/cloudpost-dash-playables.zip'
        self.report = self.root / 'dist/report.json'

    def tearDown(self) -> None:
        self.temp.cleanup()

    def package(self) -> dict:
        return pack.package_bundle(self.source, self.out, self.archive, self.report, '1.0.0')

    def test_native_redirect_preserves_uuid_and_original_build(self) -> None:
        before = (self.source / 'assets/resources/config.json').read_bytes()
        report = self.package()
        self.assertTrue(report['passed'])
        self.assertEqual(report['renamed_native_files'], 1)
        self.assertEqual(report['filename_redirects'], {OLD_PATH: NEW_PATH})
        self.assertFalse((self.out / OLD_PATH).exists())
        self.assertTrue((self.out / NEW_PATH).is_file())
        self.assertTrue((self.source / OLD_PATH).is_file())
        self.assertEqual((self.out / 'assets/resources/config.json').read_bytes(), before)
        self.assertIn('@a12b3', (self.out / 'assets/resources/config.json').read_text())
        self.assertEqual((self.source / 'application.js').read_text(), APPLICATION)
        self.assertFalse((self.out / 'src/chunks/bundle.js.map').exists())
        self.assertFalse((self.out / 'cocos/source.ts').exists())
        self.assertFalse((self.out / 'model.blend').exists())
        with zipfile.ZipFile(self.archive) as archive:
            self.assertIn('index.html', archive.namelist())
            self.assertIn(NEW_PATH, archive.namelist())
            self.assertEqual(archive.testzip(), None)
            self.assertEqual(set(archive.namelist()), set(report['sha256']))
            self.assertTrue(all(pack.valid_path(name) for name in archive.namelist()))
        self.assertEqual(json.loads(self.report.read_text())['zip_sha256'], report['zip_sha256'])
        old_hash = report['zip_sha256']
        self.assertEqual(self.package()['zip_sha256'], old_hash, 'identical runtime inputs produce the same ZIP')

    @unittest.skipUnless(shutil.which('node'), 'Node.js is needed to execute the generated Cocos application')
    def test_public_pipe_rewrites_only_final_mapped_urls(self) -> None:
        self.package()
        # Load the emitted System.register application with a minimal engine. This
        # verifies actual injected JavaScript, registration timing, and task shape.
        script = r'''
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const file = process.argv[1], oldPath = process.argv[2], newPath = process.argv[3];
let Application, pipe, order = [];
const System = {register(deps, factory) { factory((name, value) => { if (name === 'Application') Application = value; }).execute(); }};
vm.runInNewContext(fs.readFileSync(file, 'utf8'), {System});
const engine = {
  assetManager: {transformPipeline: {append(callback) {order.push('pipe'); pipe = callback;}}},
  game: {onPostBaseInitDelegate: {add() {order.push('game-init-hook');}}},
};
new Application().init(engine);
assert.deepEqual(order, ['pipe', 'game-init-hook']);
const uuid = '01234567-89ab-cdef-0123-456789abcdef@a12b3';
const urls = [oldPath, './' + oldPath, 'https://example.test/game/' + oldPath + '?v=4#mesh',
              'other/' + oldPath.replace('@a12b3', '@not-mapped'), 'prefix' + oldPath,
              'https://example.test/other@x.bin'];
const input = urls.map(url => ({url, uuid, options: {__isNative__: true}}));
const task = {input};
assert.equal(pipe(task), null);
assert.equal(task.output, input);
assert.deepEqual(input.map(item => item.url), [newPath, './' + newPath,
    'https://example.test/game/' + newPath + '?v=4#mesh', ...urls.slice(3)]);
assert.ok(input.every(item => item.uuid === uuid && item.options.__isNative__ === true));
'''
        result = subprocess.run(['node', '-e', script, str(self.out / 'application.js'), OLD_PATH, NEW_PATH], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_collision_without_replacing_last_valid_bundle(self) -> None:
        valid = self.package()
        (self.source / NEW_PATH).write_bytes(b'collision')
        with self.assertRaisesRegex(ValueError, 'collision'):
            self.package()
        self.assertEqual(json.loads(self.report.read_text())['zip_sha256'], valid['zip_sha256'])
        self.assertEqual((self.out / NEW_PATH).read_bytes(), b'native geometry bytes')

    def test_rejects_unknown_illegal_names_and_never_blindly_replaces_at(self) -> None:
        illegal = self.source / 'assets/resources/unknown@file.bin'
        illegal.write_bytes(b'unknown')
        with self.assertRaisesRegex(ValueError, 'Unsupported bundle path'):
            self.package()
        self.assertTrue(illegal.exists())
        for name in ['../escape.js', '/absolute.js', 'bad name.js', 'bad@name.bin', 'a//b.js', 'a/./b.js', 'a/../b.js', '非英文.js']:
            self.assertFalse(pack.valid_path(name), name)

    def test_requires_official_sdk_first_and_relative_entry_references(self) -> None:
        html = (self.source / 'index.html').read_text()
        (self.source / 'index.html').write_text(html.replace(f'<script src="{pack.SDK_URL}"></script>', ''))
        with self.assertRaisesRegex(ValueError, 'SDK must be the first'):
            self.package()
        (self.source / 'index.html').write_text(html.replace('./style.css', '/style.css'))
        with self.assertRaisesRegex(ValueError, 'Non-relative'):
            self.package()
        (self.source / 'index.html').write_text(html)
        (self.source / 'src/import-map.json').write_text(json.dumps({'imports': {'cc': 'https://other.test/cc.js'}}))
        with self.assertRaisesRegex(ValueError, 'Non-relative'):
            self.package()

    def test_rejects_stale_build_unsupported_engine_and_template(self) -> None:
        with self.assertRaisesRegex(ValueError, 'version'):
            pack.package_bundle(self.source, self.out, self.archive, self.report, '2.0.0')
        (self.source / 'src/settings.json').write_text(json.dumps({'CocosEngine': '3.9.0'}))
        with self.assertRaisesRegex(ValueError, '3.8.8 only'):
            self.package()
        (self.source / 'application.js').write_text('new engine template')
        with self.assertRaisesRegex(ValueError, 'Unsupported Cocos application template'):
            self.package()

    def test_rejects_remote_bundles_and_unsafe_outputs(self) -> None:
        (self.source / 'src/settings.json').write_text(json.dumps({'CocosEngine': '3.8.8', 'assets': {'remoteBundles': ['remote']}}))
        with self.assertRaisesRegex(ValueError, 'all game assets locally'):
            self.package()
        with self.assertRaisesRegex(ValueError, 'must be separate'):
            pack.package_bundle(self.source, self.source / 'output', self.archive, self.report)

    def test_enforces_size_and_count_limits(self) -> None:
        self.package()
        old_file_limit, old_total_limit, old_count_limit = pack.MAX_FILE, pack.MAX_TOTAL, pack.MAX_FILES
        try:
            pack.MAX_FILE = 1
            with self.assertRaisesRegex(ValueError, 'Individual file'):
                pack.validate_bundle(self.out)
            pack.MAX_FILE = old_file_limit
            pack.MAX_TOTAL = 1
            with self.assertRaisesRegex(ValueError, 'Total runtime'):
                pack.validate_bundle(self.out)
            pack.MAX_TOTAL = old_total_limit
            pack.MAX_FILES = 1
            with self.assertRaisesRegex(ValueError, 'maximum'):
                pack.validate_bundle(self.out)
        finally:
            pack.MAX_FILE, pack.MAX_TOTAL, pack.MAX_FILES = old_file_limit, old_total_limit, old_count_limit


if __name__ == '__main__':
    unittest.main(verbosity=2)
