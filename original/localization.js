/* Shared by the loading screen and Cocos HUD; no network or font dependencies. */
(function (host) {
  'use strict';
  var dictionary = {
    'CLOUDPOST DASH':'云邮远征', 'Cloudpost Dash':'云邮远征',
    'A SMALL PARCEL. A BIG ADVENTURE.':'小小包裹，大大冒险。',
    'FOUR COURIERS. SIX ROUTES. ONE SPECIAL DELIVERY.':'四位信使，六段旅程，一份特别的快递。',
    'Make every':'让每一次', 'delivery count.':'投递都精彩。',
    'Dash across sky gardens and starlit bridges.':'穿越空中花园与星光桥梁。',
    'Jump, slide, and collect stamps on a journey beyond the clouds.':'跳跃、滑行、收集邮票，开启云端旅程。',
    'CHOOSE A ROUTE / LATER ROUTES ARE HARDER':'选择路线 / 后面的关卡更有挑战',
    'DISTANCE':'距离','STAMPS':'邮票','HEARTS':'生命',
    'Bloomway':'繁花云径','Copperworks':'铜机工坊','Ember Ridge':'余烬山脊',
    'Frostpass':'冰霜隘口','Amber Dunes':'琥珀沙丘','Starbridge':'星光天桥',
    'Follow the stamps. Jump over the parcel walls.':'沿着邮票前进，跳过包裹墙。',
    'Slide under sorting beams. Dodge the cargo stacks.':'滑过分拣横梁，避开货物堆。',
    'Jump the heat vents. Read the jump-slide rhythm.':'跳过热气喷口，掌握跳跃与滑行的节奏。',
    'Weave through ice crystals and slide under bridges.':'穿梭冰晶之间，滑过低矮冰桥。',
    'Dodge the cacti. Ruin beams and steps alternate.':'避开仙人掌，交替应对遗迹横梁与台阶。',
    'The final delivery: fast jumps, slides, and lane changes.':'最后一程：快速跳跃、滑行与变道。',
    'Slide under blue sorting beams. Jump over heat vents.':'滑过蓝色分拣横梁，跳过热气喷口。',
    'Endless · faster pace':'无尽模式 · 更快节奏','Delivery ·':'投递模式 ·',
    'Start delivery':'出发投递','Gathering the crew…':'信使准备中…',
    'All-time best':'历史最高','Route best':'路线最高','Space to depart':'按空格键出发',
    'MEET YOUR COURIER':'选择你的信使','A different way to make the journey':'不同的伙伴，不同的冒险方式',
    'The all-round courier':'全能信使','The high jumper':'跳跃高手',
    'The quick collector':'敏捷收藏家','The sturdy explorer':'坚实探险家',
    'Recover one heart for every 30 stamps collected':'每收集 30 枚邮票恢复一颗生命',
    'Higher jumps and a little more time in the air':'跳得更高，滞空时间更长',
    'Faster lane changes and a wider stamp pickup range':'变道更快，邮票收集范围更大',
    'Four hearts with a steadier, slower lane change':'拥有四颗生命，变道更稳但速度稍慢',
    'Tap to retry':'点击重试','Arriving…':'正在赶来…',"'s perk":'的技能',
    'Pip':'皮普','Moss':'莫斯','Kite':'凯特','Rook':'鲁克',
    'TAKE A BREATH':'稍作休息','Your parcel can wait.':'包裹可以等一会儿。',
    'Resume delivery':'继续投递','Couriers & routes':'角色与路线',
    'DELIVERY COMPLETE':'投递完成','A LITTLE FURTHER NEXT TIME':'下次再前进一点',
    'Signed, sealed, delivered!':'包裹已签收！','Every route is a new start.':'每条路线，都是新的开始。',
    'Each heart adds 200 points. 60 stamps / no hits each add a star.':'每颗生命奖励 200 分；收集 60 枚邮票、无伤通关各加一星。',
    'Stamp chains reach 3× points. Skill dodges add 25 points.':'连续收集邮票最高获得 3 倍积分，技巧闪避奖励 25 分。',
    'Deliver again':'再次投递','Try the route again':'再试一次',
    'Toggle sound':'切换音效','Pause or resume':'暂停或继续',
    'Move left':'向左移动','Move right':'向右移动','Slide':'滑行','Jump':'跳跃',
    'LANES':'变道','SPACE':'空格','JUMP':'跳跃','SLIDE':'滑行','PAUSE':'暂停',
    'Endless route':'无尽路线',' m to delivery':' 米后完成投递',
    'points · chain ×':'分 · 连击 ×','Delivery goal:':'投递目标：',
    '✓ Delivery bonus claimed · +500':'✓ 已领取投递奖励 · +500 分',
    '✦ Boost ':'✦ 加速 ','◈ Shield ready':'◈ 护盾就绪',
    '↓ SLIDE BELOW':'↓ 滑行通过','↑ JUMP THE VENT':'↑ 跳过喷口','↔ SWITCH / ↑ JUMP':'↔ 变道 / ↑ 跳跃',
    '✦ Delivery boost · invincible for 6 seconds':'✦ 投递加速 · 无敌 6 秒',
    '◈ Parcel shield · blocks one hit':'◈ 包裹护盾 · 抵挡一次撞击',
    '♥ One heart restored':'♥ 恢复一颗生命','◈ Your shield blocked the hit':'◈ 护盾已抵挡撞击',
    'Delivery complete! +500 points and one heart':'投递目标达成！奖励 500 分与一颗生命',
    'Pip restocked · one heart restored':'皮普补给 · 恢复一颗生命',
    'Opening the sky routes…':'正在开启云端路线…','Preparing the sky routes…':'正在准备云端路线…',
    'Preparing Pip for the first delivery…':'正在为皮普准备首次投递…',
    'The connection was interrupted. Please try again.':'连接中断，请重试。',
    'Still loading on this connection…':'网络较慢，仍在加载中…',
    'Pip could not load. Please try again.':'皮普加载失败，请重试。',
    'Try again':'重试','Loading progress':'加载进度',
    'ROUTE':'路线','WORLD':'路线','skill dodges':'技巧闪避','star finish':'星通关',
    'stamps':'枚邮票','points':'分','hits':'次受伤'
  };
  var keys=Object.keys(dictionary).sort(function(a,b){return b.length-a.length;});
  var pattern=new RegExp(keys.map(function(k){return k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|'),'g');
  function language(tag){return typeof tag==='string'&&/^zh(?:-|$)/i.test(tag)?'zh':'en';}
  var platform=!!(host.ytgame&&host.ytgame.IN_PLAYABLES_ENV), selected='en', listeners=[];
  if(!platform){
    var saved;try{saved=host.localStorage.getItem('cloudpost-language');}catch(_){}
    selected=saved==='zh'||saved==='en'?saved:language(host.navigator&&host.navigator.language);
  }
  function translate(text){
    if(selected==='en')return text;
    return String(text).replace(pattern,function(key){return dictionary[key];})
      .replace(/(\d[\d,.]*) m\b/g,'$1 米').replace(/(\d+) s\b/g,'$1 秒');
  }
  function syncDocument(){if(host.document){host.document.documentElement.lang=selected==='zh'?'zh-CN':'en';host.document.title=selected==='zh'?'云邮远征 · Cloudpost Dash':'Cloudpost Dash';}}
  function set(next,persist){
    selected=language(next);syncDocument();
    if(persist!==false&&!platform){try{host.localStorage.setItem('cloudpost-language',selected);}catch(_){}}
    listeners.slice().forEach(function(fn){fn();});
  }
  function apply(root){
    if(!root||!host.document)return;
    var walker=host.document.createTreeWalker(root,4),node;
    while((node=walker.nextNode())){if(node.parentElement&&/^(SCRIPT|STYLE)$/.test(node.parentElement.tagName))continue;node.textContent=translate(node.textContent);}
    root.querySelectorAll('[aria-label]').forEach(function(el){el.setAttribute('aria-label',translate(el.getAttribute('aria-label')));});
    root.setAttribute('lang',selected==='zh'?'zh-CN':'en');
  }
  host.CloudpostI18n={get language(){return selected;},translate:translate,apply:apply,set:set,
    subscribe:function(fn){listeners.push(fn);return function(){listeners=listeners.filter(function(x){return x!==fn;});};}};
  syncDocument();
  // Playables requires its locale API exclusively: no browser locale or local storage.
  if(platform){Promise.resolve().then(function(){return host.ytgame.system.getLanguage();}).then(function(tag){set(tag,false);}).catch(function(){});}
})(typeof window!=='undefined'?window:globalThis);
