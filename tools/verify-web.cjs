const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'web-manifest.json'))),pkg=require('../package.json');
assert.equal(manifest.version,pkg.version,'release version');
for(const [file,sha] of Object.entries(manifest.files)){
 const data=fs.readFileSync(path.join(root,'web',file));
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'),sha,`stale or corrupt web file: ${file}`);
}
for(const file of ['index.html','application.js','src/settings.json','assets/resources/config.json'])assert.ok(manifest.files[file],`missing ${file}`);
const settings=JSON.parse(fs.readFileSync(path.join(root,'web/src/settings.json')));
assert.equal(settings.CocosEngine,'3.8.8');
assert.ok(fs.readFileSync(path.join(root,'web/index.html'),'utf8').includes(`content="${pkg.version}"`));
console.log(`Verified ${Object.keys(manifest.files).length} runtime files for Mario Skyway ${pkg.version}`);
if(fs.existsSync(path.join(root,'original/web-manifest.json'))){
 const original=JSON.parse(fs.readFileSync(path.join(root,'original/web-manifest.json')));
 assert.ok(manifest.files['cloudpost/index.html'],'original game demo must be deployed');
 assert.ok(fs.readFileSync(path.join(root,'web/cloudpost/index.html'),'utf8').includes(`content="${original.version}"`),'original demo version');
 const entry=fs.readFileSync(path.join(root,'web/cloudpost/index.html'),'utf8');
 assert.ok(!entry.includes('<script src="https://www.youtube.com'),'standalone startup cannot depend on YouTube connectivity');
 const release=entry.match(/<base href="\.\/releases\/([a-f0-9]{16})\/">/);
 assert.ok(release,'standalone assets must have versioned cache URLs');
 assert.ok(manifest.files[`cloudpost/releases/${release[1]}/index.js`],'current release exists');
 for(const file of Object.keys(manifest.files).filter(f=>f.startsWith('cloudpost/')))assert.ok(!file.includes('@'),'Playables demo uses legal asset filenames');
 console.log(`Cloudpost Dash ${original.version} demo included at /cloudpost/`);
}
