const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(require('path').join(__dirname,'../localization.js'),'utf8');
function make(tag,saved,blocked=false){
 const data=new Map(saved?[['cloudpost-language',saved]]:[]),w={navigator:{language:tag},document:{documentElement:{},title:''}};
 Object.defineProperty(w,'localStorage',{get(){if(blocked)throw Error('storage denied');return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};}});
 vm.runInNewContext(code,{window:w});return {w,locale:w.CloudpostI18n,data};
}
(async()=>{
 const zh=make('zh-CN');assert.equal(zh.locale.language,'zh');assert.equal(zh.w.document.documentElement.lang,'zh-CN');
 assert.equal(make('zh-TW').locale.language,'zh');assert.equal(make('de-DE').locale.language,'en');
 assert.equal(make('zh-CN','en').locale.language,'en');assert.equal(make('en-US','zh').locale.language,'zh');
 assert.equal(make('zh-CN','invalid').locale.language,'zh');assert.equal(make('zh-CN',null,true).locale.language,'zh');
 const samples={
 'Delivery goal: 12/60 stamps · 3/8 skill dodges':'投递目标： 12/60 枚邮票 · 3/8 技巧闪避',
 '2400 m to delivery':'2400 米后完成投递',
 '1,234 points · chain ×3':'1,234 分 · 连击 ×3',
 'WORLD 01 · Bloomway — Follow the stamps. Jump over the parcel walls.':'路线 01 · 繁花云径 — 沿着邮票前进，跳过包裹墙。',
 '✦ Boost 6 s':'✦ 加速 6 秒',
 'Pip restocked · one heart restored':'皮普补给 · 恢复一颗生命',
 'Preparing Pip for the first delivery…':'正在为皮普准备首次投递…',
 '↓ SLIDE BELOW · 25 m':'↓ 滑行通过 · 25 米',
 "Pip's perk":"皮普的技能"
 };
 for(const [en,cn]of Object.entries(samples))assert.equal(zh.locale.translate(en),cn,en);
 let events=0;const off=zh.locale.subscribe(()=>events++);zh.locale.set('en');assert.equal(events,1);assert.equal(zh.data.get('cloudpost-language'),'en');
 for(const en of Object.keys(samples))assert.equal(zh.locale.translate(en),en);
 off();zh.locale.set('zh');assert.equal(events,1);
 const w={ytgame:{IN_PLAYABLES_ENV:true,system:{getLanguage:async()=> 'zh-Hans'}}};
 Object.defineProperty(w,'navigator',{get(){throw Error('platform must not inspect browser locale');}});
 Object.defineProperty(w,'localStorage',{get(){throw Error('platform must not access localStorage');}});
 vm.runInNewContext(code,{window:w});await new Promise(r=>setImmediate(r));assert.equal(w.CloudpostI18n.language,'zh');
 console.log('PASS: locale detection, saved override, denied storage, dynamic HUD translations, reversible language choice, platform locale isolation.');
})();
