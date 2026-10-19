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
console.log(`Verified ${Object.keys(manifest.files).length} runtime files for Cloudpost Dash ${pkg.version}`);
