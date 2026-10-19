import { _decorator, Component, Node, Camera, Color, Vec3, Material, Mesh, MeshRenderer, primitives, utils, DirectionalLight, resources, Prefab, instantiate, input, Input, EventKeyboard, KeyCode, EventTouch, director, screen as gameScreen, Size } from 'cc';
import { LANE, jumpStep, hazardHit, pattern, CHARACTERS, WORLDS, WORLD_LENGTH, FINISH_DISTANCE, ROW_GAP, worldAt, runSpeed, comboMultiplier, SLIDE_DURATION, slideBlend, slidePose } from './RunnerRules';
import { PlayablesBridge } from './PlayablesBridge';
import { BrowserKeyboard, GameAction } from './BrowserKeyboard';
const { ccclass, property } = _decorator;
type Item = { node: Node; kind: string; lane: number; z: number; y: number; hit: boolean; action?: string };

@ccclass('CloudpostRunner')
export class CloudpostRunner extends Component {
    @property(Material) worldMaterial: Material|null=null;
    private cameraNode!: Node; private gameCamera!: Camera; private avatar!: Node; private model!: Node;
    private pivots: Record<string, Node> = {}; private rest: Record<string, Vec3> = {}; private materials: Record<string, Material> = {};
    private meshes: Record<string, Mesh> = {}; private items: Item[] = []; private tiles: Node[] = [];
    private scenery: Node[] = []; private hills:Node[]=[]; private sparks: {n:Node;t:number;v:Vec3;size?:number}[]=[];
    private state: 'loading'|'ready'|'running'|'paused'|'over'|'won' = 'loading';
    private lane=0; private x=0; private y=0; private vy=0; private time=0; private distance=0;
    private coins=0; private hearts=3; private best=0; private immune=0; private star=0;
    private nextRow=0; private rowIndex=0; private speed=10; private touch={x:0,y:0};
    private ui: HTMLElement|null=null; private audio: AudioContext|null=null; private muted=false;
    private loadError=''; private shadow!:Node; private heldKeys=new Set<number>();
    private loadingCrew=new Set<number>(); private failedCrew=new Set<number>(); private backgroundStarted=false;
    private browserKeyboard: BrowserKeyboard|null=null; private platform:PlayablesBridge|null=null; private platformReady=false; private assetsReady=false; private platformWasRunning=false;
    private selected=0; private startWorld=0; private endless=false; private currentWorld=-1;
    private prefabs:Record<string,Prefab>={}; private roads:Node[]=[]; private verges:Node[]=[];
    private garden:Node[]=[]; private factory:Node[]=[]; private castle:Node[]=[]; private floor!:Node;
    private slide=0; private shield=0; private chain=0; private chainTime=0; private coinScore=0;
    private dodges=0; private hits=0; private missionPaid=false; private notice=''; private noticeTime=0;
    private slideMix=0; private dustClock=0; private biomes:Node[][]=WORLDS.map(()=>[]);
    private jumpBuffer=0; private touchArmed=false;
    private get character(){return CHARACTERS[this.selected];}
    private get travelled(){return this.distance-this.startWorld*WORLD_LENGTH;}
    private get score(){return Math.floor(this.travelled)+this.coinScore;}
    private colors={cream:'#fff5da',grass:'#73bd68',edge:'#448d62',road:'#ead7aa',brick:'#c76b42',gold:'#ffc845',pipe:'#20a66c',dark:'#174b50'};

    start() {
        if(typeof window!=='undefined'){
            this.platform=new PlayablesBridge(window,undefined,{pause:this.platformPause,resume:this.platformResume,audioChange:this.syncAudio});
            void this.platform.initialize().then(()=>{this.platformReady=true;this.loadBest();this.completeLoading();});
        }else this.platformReady=true;
        this.createWorld(); this.createUI();
        if(typeof window!=='undefined'){this.onResize();window.addEventListener('resize',this.onResize);}
        if(typeof window!=='undefined'&&typeof document!=='undefined'){
            this.browserKeyboard=new BrowserKeyboard(window,document,this.onAction,this.onFocusLost,this.platform?.inPlayables||false);
        }else{
            input.on(Input.EventType.KEY_DOWN,this.onKey,this);input.on(Input.EventType.KEY_UP,this.onKeyUp,this);
        }
        input.on(Input.EventType.TOUCH_START,this.onTouchStart,this);
        input.on(Input.EventType.TOUCH_END,this.onTouchEnd,this);
        input.on(Input.EventType.TOUCH_CANCEL,this.onTouchCancel,this);
        if(typeof document!=='undefined'&&!this.platform?.inPlayables)document.addEventListener('visibilitychange',this.onVisibility);
        this.bootProgress('Preparing Pip for the first delivery…',70);
        this.loadCourier(0);
    }
    private bootProgress(label:string,progress:number){
        if(typeof window!=='undefined')(window as any).cloudpostBoot?.(label,progress);
    }
    private loadCourier(index:number,done?:()=>void){
        const c=CHARACTERS[index];
        if(this.prefabs[c.id]){done?.();return;}
        if(this.loadingCrew.has(index))return;
        this.loadingCrew.add(index);this.failedCrew.delete(index);
        resources.load(c.path,Prefab,(finished,total)=>{
            if(index===0)this.bootProgress('Preparing Pip for the first delivery…',70+Math.round(25*finished/Math.max(1,total)));
        },(err,prefab)=>{
            if(!this.isValid)return;
            this.loadingCrew.delete(index);
            if(err){
                this.failedCrew.add(index);
                if(index===0){
                    this.loadError='Pip could not load. Please try again.';
                    if(typeof window!=='undefined')(window as any).cloudpostBootError?.();
                }
                console.error('Character import failed',c.path,err);
            }else{
                this.prefabs[c.id]=prefab;
                if(index===0){this.assetsReady=true;this.completeLoading();}
            }
            // Background completion must not rebuild controls or steal focus mid-run.
            if(this.state==='ready'||this.state==='loading')this.refreshUI(false);
            done?.();
        });
    }
    private loadRemainingCrew(index=1){
        if(index<CHARACTERS.length)this.loadCourier(index,()=>this.loadRemainingCrew(index+1));
    }
    private completeLoading(){
        if(!this.assetsReady||!this.platformReady||this.platform?.paused||this.state!=='loading')return;
        this.selectCharacter(0);this.applyWorld(0);this.state='ready';
        if(typeof document!=='undefined')document.getElementById('boot-splash')?.remove();
        this.loadBest();this.refreshUI();this.platform?.firstFrameReady();this.platform?.gameReady();
        if(this.ui&&typeof performance!=='undefined')this.ui.dataset.readyMs=performance.now().toFixed(0);
        // Pip alone unlocks play. Load the remaining couriers one at a time after
        // the first usable menu has rendered, avoiding contention on slow links.
        if(!this.backgroundStarted){this.backgroundStarted=true;this.scheduleOnce(()=>this.loadRemainingCrew(),.1);}
    }
    private platformPause=()=>{
        this.platformWasRunning=this.state==='running';if(this.platformWasRunning)this.state='paused';
        this.touchArmed=false;this.heldKeys.clear();this.browserKeyboard?.reset();
        this.refreshUI(false);void this.audio?.suspend().catch(()=>{});director.pause();
    };
    private platformResume=()=>{
        director.resume();if(this.platformWasRunning&&this.state==='paused')this.state='running';
        this.platformWasRunning=false;this.syncAudio();this.completeLoading();this.refreshUI();
    };
    private syncAudio=()=>{
        if(!this.audio)return;
        if(this.muted||this.platform?.paused||this.platform?.audioEnabled===false)void this.audio.suspend().catch(()=>{});
        else void this.audio.resume().catch(()=>{});
    };
    // Web Desktop embeds a fixed-size frame. Keep its physical render size in sync
    // with the fullscreen CSS container, including browser panel resizing.
    private onResize=()=>{gameScreen.windowSize=new Size(window.innerWidth*gameScreen.devicePixelRatio,window.innerHeight*gameScreen.devicePixelRatio);};
    private selectCharacter(index:number){
        if(!this.prefabs[CHARACTERS[index].id])return;
        this.selected=index;if(this.model)this.model.destroy();this.pivots={};this.rest={};this.slideMix=0;
        const prefab=this.prefabs[this.character.id];if(!prefab)return;
        this.model=instantiate(prefab);this.model.parent=this.avatar;this.model.setScale(.64,.64,.64);
        const walk=(n:Node)=>{if(['Arm_L','Arm_R','Leg_L','Leg_R','Body','Head'].includes(n.name)){this.pivots[n.name]=n;this.rest[n.name]=new Vec3(n.position.x,n.position.y,n.position.z);}n.children.forEach(walk);};walk(this.model);
        this.refreshUI();
    }
    private tell(text:string){this.notice=text;this.noticeTime=3.5;}
    private applyWorld(index:number){
        this.currentWorld=index;const w=WORLDS[index];
        this.gameCamera.clearColor=new Color().fromHEX(w.sky);
        const scene=director.getScene();if(scene)scene.globals.fog.fogColor=new Color().fromHEX(w.sky);
        for(const n of this.roads)n.getComponent(MeshRenderer)?.setMaterial(this.material(w.road),0);
        for(const n of this.verges)n.getComponent(MeshRenderer)?.setMaterial(this.material(w.grass),0);
        this.floor.getComponent(MeshRenderer)?.setMaterial(this.material(w.grass),0);
        this.garden.forEach(n=>n.active=index===0);this.factory.forEach(n=>n.active=index===1);this.castle.forEach(n=>n.active=index===2);
        this.biomes.forEach((group,i)=>group.forEach(n=>n.active=index===i));
        if(this.state==='running')this.sound('level');
        this.tell('WORLD 0'+(index+1)+' · '+w.name+' — '+w.hint);
    }

    private material(hex:string):Material {
        if(this.materials[hex])return this.materials[hex];
        const m=new Material();m.copy(this.worldMaterial!);
        m.setProperty('mainColor',new Color().fromHEX(hex));m.setProperty('roughness',.82);m.setProperty('metallic',0);
        this.materials[hex]=m;return m;
    }
    private shape(kind:string,parent:Node,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string):Node {
        const n=new Node(kind);n.parent=parent;n.setPosition(x,y,z);n.setScale(sx,sy,sz);
        if(!this.meshes[kind])this.meshes[kind]=utils.createMesh(kind==='sphere'?primitives.sphere(.5,{segments:16}):kind==='cylinder'?primitives.cylinder(.5,.5,1,{radialSegments:24}):primitives.box());
        const r=n.addComponent(MeshRenderer);r.mesh=this.meshes[kind];r.setMaterial(this.material(color),0);return n;
    }
    private group(name:string,parent=this.node):Node {const n=new Node(name);n.parent=parent;return n;}
    private createWorld(){
        this.cameraNode=this.group('Camera');const camera=this.cameraNode.addComponent(Camera);this.gameCamera=camera;
        camera.clearColor=new Color(171,218,224,255);camera.far=160;camera.near=.1;camera.fov=48;
        this.cameraNode.setPosition(8,5.5,12);this.cameraNode.lookAt(new Vec3(0,1,-4));
        const sun=this.group('Sun');sun.setRotationFromEuler(-48,-35,0);const light=sun.addComponent(DirectionalLight);light.color=new Color(255,241,215);light.illuminance=65000;
        this.floor=this.shape('box',this.node,0,-1.7,-30,250,.3,250,'#8ecba4');
        for(let i=0;i<14;i++){
            const tile=this.group('Track segment');tile.setPosition(0,0,12-i*9);this.tiles.push(tile);
            this.roads.push(this.shape('box',tile,0,-.32,0,8.3,.62,9,this.colors.road));
            for(const side of [-1,1]){
                this.verges.push(this.shape('box',tile,side*5.05,-.28,0,1.8,.7,9,this.colors.grass));
                this.shape('box',tile,side*4.15,.04,0,.14,.16,9,this.colors.cream);
            }
            for(const x of [-1.2,1.2])this.shape('box',tile,x,.011,0,.055,.018,5,'#d8c290');
            this.shape('box',tile,0,.013,-4.4,8.1,.02,.04,'#dbc798');
        }
        for(let i=0;i<22;i++){
            const n=this.group('Garden scenery');n.setPosition((i%2?1:-1)*(7+(i%4)*1.9),0,10-i*5.6);this.scenery.push(n);
            const decor=this.group('Garden',n);this.garden.push(decor);
            if(i%3===0)this.waypost(decor,1.2+(i%4)*.2);
            else if(i%3===1){this.shape('cylinder',decor,0,.7,0,.4,1.4,.4,'#a27545');this.shape('sphere',decor,0,2,0,2.3,3,2.3,i%2?'#399467':'#55a777');}
            else{this.shape('sphere',decor,0,.3,0,2.3,1.5,1.5,'#5eae71');this.shape('sphere',decor,.9,.4,0,1.6,1.9,1.4,'#73bd68');}
            const f=this.group('Pipe works',n);this.factory.push(f);
            this.shape('cylinder',f,0,1.4,0,1.7,2.8,1.7,i%2?'#367b7c':'#d8ae55');
            this.shape('cylinder',f,0,2.8,0,2,.3,2,'#c7e5d9');
            const c=this.group('Castle tower',n);this.castle.push(c);
            this.shape('box',c,0,1.6,0,2.3,3.2,2.3,'#5b526b');
            for(const dx of [-.8,0,.8])this.shape('box',c,dx,3.4,0,.55,.5,2.3,'#75667d');
            this.shape('box',c,0,2,1.17,.48,.85,.04,'#ffc273');
            const snow=this.group('Snow valley',n);this.biomes[3].push(snow);
            this.shape('cylinder',snow,0,1,0,.35,2,.35,'#8eabae');
            for(let tier=0;tier<3;tier++)this.shape('sphere',snow,0,1.5+tier*.7,0,2.5-tier*.6,1.2,2.5-tier*.6,'#e5f4f5');
            const dune=this.group('Desert ruins',n);this.biomes[4].push(dune);
            this.shape('box',dune,0,1.8,0,1,3.6,1,'#c29158');this.shape('box',dune,0,3.5,0,1.6,.4,1.5,'#ecd3a0');
            this.shape('sphere',dune,1,.15,1,2.8,.65,2.3,'#e6ba7c');
            const star=this.group('Star beacons',n);this.biomes[5].push(star);
            this.shape('cylinder',star,0,1.1,0,.25,2.2,.25,'#77719c');
            const gem=this.shape('box',star,0,2.5,0,.85,.85,.55,'#ffe4a0');gem.setRotationFromEuler(0,25,45);
            this.shape('sphere',star,0,.1,0,1.8,.3,1.8,'#c2bce5');
        }
        for(let i=0;i<12;i++){
            const n=this.group('Distant hills');this.hills.push(n);n.setPosition((i%2?1:-1)*(18+i*1.4),1,-20-i*7);
            this.shape('sphere',n,0,0,0,14,10+(i%4)*4,10,i%2?'#8bc8ae':'#9ed0b9');
        }
        for(let i=0;i<9;i++){
            const n=this.group('Cloud');n.setPosition((i-4)*9,13+i%3*2,-38-i%4*9);
            for(let j=0;j<3;j++)this.shape('sphere',n,j*1.6,Math.sin(j)*.6,0,3.4,1.7,1.5,'#f5f7e9');
        }
        this.avatar=this.group('Player');this.shadow=this.shape('sphere',this.node,0,.03,0,1.25,.025,.9,'#a8a07b');
    }
    private waypost(n:Node,s:number){
        this.shape('box',n,0,s*.7,0,.22,s*1.4,.22,'#8c795b');
        const mail=this.shape('box',n,0,s*1.25,0,s*1.25,s*.72,s*.6,'#e4a55e');
        this.shape('box',n,0,s*1.3,s*.31,s*.65,s*.11,.03,'#fff3db');
        const pennant=this.shape('box',n,s*.39,s*1.86,0,s*.72,s*.36,.05,'#47948b');
        pennant.setRotationFromEuler(0,0,12);
    }
    private obstacle(kind:string,lane:number,z:number){
        const n=this.group(kind);n.setPosition(lane*LANE,0,z);
        if(kind==='ice'){
            for(const x of [-.35,.28]){const crystal=this.shape('box',n,x,.48,0,.62,.96,.8,'#80cee9');crystal.setRotationFromEuler(0,18,x*20);this.shape('box',n,x,.56,.42,.12,.55,.025,'#e9fbff');}
        } else if(kind==='cactus'){
            this.shape('cylinder',n,0,.8,0,.7,1.6,.7,'#43866a');
            for(const side of [-1,1]){this.shape('box',n,side*.4,.8,0,.5,.22,.38,'#5a9e76');this.shape('cylinder',n,side*.61,1.08,0,.28,.65,.28,'#5a9e76');}
        } else if(kind==='cargo'){
            this.shape('box',n,0,.78,0,1.15,1.56,1.15,'#5b9290');
            for(const y of [.2,.8,1.38])this.shape('box',n,0,y,.59,1.18,.08,.035,'#dce9d6');
            this.shape('box',n,.24,1.08,.61,.36,.3,.025,'#ffe9ad');
        } else if(kind==='drone'){
            this.shape('box',n,0,.5,0,1.05,.65,.8,'#738f9b');
            this.shape('sphere',n,0,.55,.44,.38,.38,.08,'#fff3c0');
            this.shape('sphere',n,0,.55,.49,.15,.15,.035,'#2f6570');
            for(const side of [-1,1]){this.shape('box',n,side*.7,.52,0,.65,.1,.45,'#b3c6c5');this.shape('cylinder',n,side*.6,.14,0,.22,.18,.22,'#526571');}
        } else if(kind==='gate'){
            for(const side of [-1,1])this.shape('box',n,side*.97,1.3,0,.13,2.6,.4,'#286980');
            this.shape('box',n,0,1.8,0,2.05,.78,.48,'#418dac');
            for(const x of [-.66,0,.66]){const stripe=this.shape('box',n,x,1.8,.25,.19,.77,.025,'#f9e8a6');stripe.setRotationFromEuler(0,0,-20);}
        } else if(kind==='fire'){
            this.shape('box',n,0,.23,0,1.9,.46,.5,'#6b4f54');
            for(const x of [-.65,0,.65]){this.shape('sphere',n,x,.62,0,.46,.95,.42,'#ed7640');this.shape('sphere',n,x,.65,.21,.20,.6,.08,'#ffe38b');}
        } else {
            this.shape('box',n,0,.48,0,1.22,.96,1.12,this.colors.brick);
            for(const y of [.24,.65])this.shape('box',n,0,y,.568,1.22,.035,.015,'#f5b47e');
            for(const x of [-.3,.3])this.shape('box',n,x,.45,.57,.035,.36,.015,'#f5b47e');
            for(const x of [-.52,.52])for(const y of [.1,.86])this.shape('sphere',n,x,y,.578,.06,.06,.025,'#8b472f');
        }
        if(kind==='gate'||kind==='fire'){
            // Ground chevrons stay with their row: an advance cue, including on small screens.
            const marker=this.group('Approach cue',n);marker.setPosition(0,.035,4);
            for(const side of [-1,1]){const a=this.shape('box',marker,side*.18,0,0,.09,.025,.65,kind==='gate'?'#287fa4':'#ed6546');a.setRotationFromEuler(0,side*38,0);}
        }
        this.items.push({node:n,kind,lane,z,y:0,hit:false});
    }
    private coin(lane:number,z:number,y=1.05,kind='coin'){
        const n=this.group(kind);n.setPosition(lane*LANE,y,z);
        const c=this.shape('cylinder',n,0,0,0,kind==='star'?.85:.58,.13,kind==='star'?.85:.58,kind==='shield'?'#66d9e5':kind==='heart'?'#ff7472':kind==='star'?'#fff1a1':this.colors.gold);c.setRotationFromEuler(90,0,0);
        for(const side of [-1,1]){const fold=this.shape('box',n,side*.09,.03,.085,.025,.24,.035,'#fff5d1');fold.setRotationFromEuler(0,0,side*48);}
        if(kind==='star')for(const s of [-1,1]){const p=this.shape('box',n,s*.37,0,0,.3,.2,.15,'#fff1a1');p.setRotationFromEuler(0,0,s*35);}
        this.items.push({node:n,kind,lane,z,y,hit:false});
    }
    private spawnRow(index:number,z:number){
        const d=this.distance-z,w=worldAt(d,this.endless);
        if(!this.endless&&d>FINISH_DISTANCE-12)return;
        const p=pattern(index,w);
        for(const lane of p.lanes)this.obstacle(p.kind,lane,z);
        if(p.bonus){
            for(const lane of [-1,0,1])for(let i=0;i<6;i++)this.coin(lane,z+5-i*1.5);
            this.coin(0,z-5,1.2,index%20===9?'shield':'star');
            if(w>0)this.coin(-1,z-7,1.05,'heart');
        }else{
            for(let i=0;i<5;i++)this.coin(p.safe,z+3-i*1.5,p.action==='jump'?1.3+Math.sin(i/4*Math.PI)*1.7:p.action==='slide'?.5:1.05);
            if(p.kind==='drone')for(let i=0;i<3;i++)this.coin(p.lanes[0],z+1.5-i*1.5,1.8+Math.sin(i/2*Math.PI));
        }
    }
    private begin=()=>{
        if(this.state==='loading'||this.platform?.paused)return;
        for(const e of this.items)e.node.destroy();this.items=[];
        for(const p of this.sparks)p.n.destroy();this.sparks=[];
        this.distance=this.startWorld*WORLD_LENGTH;this.coins=0;this.hearts=this.character.hearts;this.lane=0;this.x=0;this.y=0;this.vy=0;this.immune=0;this.star=0;this.time=0;this.rowIndex=this.startWorld*20;this.speed=runSpeed(this.distance,this.endless);
        this.slide=0;this.slideMix=0;this.dustClock=0;this.shield=0;this.chain=0;this.chainTime=0;this.coinScore=0;this.dodges=0;this.hits=0;this.missionPaid=false;this.jumpBuffer=0;
        this.applyWorld(this.startWorld);this.loadBest();
        this.nextRow=-24;while(this.nextRow>-104){this.spawnRow(this.rowIndex++,this.nextRow);this.nextRow-=ROW_GAP;}
        this.tiles.forEach((n,i)=>n.setPosition(0,0,12-i*9));
        // Accept movement immediately without the menu camera clipping an outer lane.
        const compact=typeof window!=='undefined'&&window.innerWidth<500;
        this.gameCamera.fov=compact?52:48;
        this.cameraNode.setPosition(0,compact?8.2:6.8,compact?16:10.8);
        this.cameraNode.lookAt(new Vec3(0,.7,-12));
        this.avatar.setPosition(0,0,0);this.avatar.setScale(1,1,1);this.avatar.setRotationFromEuler(0,180,0);
        this.state='running';this.initAudio();this.sound('start');this.refreshUI();
    };
    private jump(){
        if(['ready','over','won'].includes(this.state)){this.begin();return;}
        if(this.state==='running'){this.slide=0;this.jumpBuffer=.14;if(this.y===0)this.launchJump();}
    }
    private launchJump(){this.vy=this.character.jump;this.y=.001;this.jumpBuffer=0;this.sound('jump');}
    private duck(){if(this.state==='running'&&this.y<.05&&this.slide===0){this.slide=SLIDE_DURATION;this.jumpBuffer=0;this.sound('slide');}}
    private menu=()=>{for(const i of this.items)i.node.destroy();this.items=[];this.state='ready';this.slide=0;this.star=0;this.shield=0;this.noticeTime=0;this.model.active=true;this.applyWorld(this.startWorld);this.refreshUI();};
    private shift(dir:number){if(this.state==='running')this.lane=Math.max(-1,Math.min(1,this.lane+dir));}
    private pause=()=>{if(this.platform?.paused)return;if(this.state==='running')this.state='paused';else if(this.state==='paused')this.state='running';this.refreshUI();};
    private onFocusLost=()=>{this.touchArmed=false;this.heldKeys.clear();this.browserKeyboard?.reset();if(this.platform?.inPlayables)return;if(this.state==='running'){this.state='paused';this.refreshUI(false);}};
    private onVisibility=()=>{if(document.hidden)this.onFocusLost();else{this.heldKeys.clear();this.browserKeyboard?.reset();}};
    private onAction=(action:GameAction)=>{
        if(this.platform?.paused)return;
        if(action==='left')this.shift(-1);
        else if(action==='right')this.shift(1);
        else if(action==='jump')this.jump();
        else if(action==='slide')this.duck();
        else if(action==='pause')this.pause();
        else if(action==='start'&&(['ready','over','won'].includes(this.state)))this.begin();
        this.refreshHUD();
    };
    private onKeyUp(e:EventKeyboard){this.heldKeys.delete(e.keyCode);}
    private onKey(e:EventKeyboard){
        if(this.heldKeys.has(e.keyCode))return;this.heldKeys.add(e.keyCode);
        if(e.keyCode===KeyCode.ARROW_LEFT||e.keyCode===KeyCode.KEY_A)this.shift(-1);
        if(e.keyCode===KeyCode.ARROW_RIGHT||e.keyCode===KeyCode.KEY_D)this.shift(1);
        if([KeyCode.SPACE,KeyCode.ARROW_UP,KeyCode.KEY_W].includes(e.keyCode))this.jump();
        if([KeyCode.ARROW_DOWN,KeyCode.KEY_S].includes(e.keyCode))this.duck();
        if([KeyCode.KEY_P,KeyCode.ESCAPE].includes(e.keyCode))this.pause();
        if(e.keyCode===KeyCode.ENTER&&(['ready','over','won'].includes(this.state)))this.begin();
    }
    private onTouchCancel(){this.touchArmed=false;}
    private onTouchStart(e:EventTouch){this.touchArmed=true;const p=e.getLocation();this.touch={x:p.x,y:p.y};}
    private onTouchEnd(e:EventTouch){if(!this.touchArmed)return;this.touchArmed=false;const p=e.getLocation();const dx=p.x-this.touch.x,dy=p.y-this.touch.y;if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy))this.shift(Math.sign(dx));else if(dy < -25)this.duck();else if(dy>25||Math.abs(dx)<20)this.jump();}
    private animateCharacter(dt:number,running:boolean,idle:boolean){
        if(this.state==='paused')return;
            this.slideMix=idle?0:slideBlend(this.slideMix,this.slide>0,dt);
            const pose=slidePose(this.slideMix);
            for(const name of ['Body','Head','Arm_L','Arm_R','Leg_L','Leg_R']){
                const p=this.pivots[name],base=this.rest[name];if(!p||!base)continue;
                const swing=(running?Math.sin(this.time*13+(name==='Arm_R'||name==='Leg_L'?0:Math.PI))*32:Math.sin(this.time*2)*3)*(1-this.slideMix);
                let rx=0,rz=0,drop=0;
                if(name==='Body'){rx=pose.body;drop=base.y*pose.bodyDrop;}
                else if(name==='Head')rx=pose.head;
                else if(name.startsWith('Leg')){rx=swing+(name==='Leg_L'?pose.leftLeg:pose.rightLeg);drop=base.y*pose.legDrop*(base.y<.8?.8:1);rz=(name==='Leg_L'?-5:8)*this.slideMix;}
                else{rx=swing+pose.arm;rz=(name==='Arm_L'?1:-1)*pose.spread;}
                p.setPosition(base.x,base.y-drop,base.z);p.setRotationFromEuler(rx,0,rz);
            }
    }
    update(delta:number){
        if(this.platform?.paused)return;
        const dt=Math.min(delta,.05);
        if(this.state!=='paused')this.time+=dt;
        if(this.model){
            const running=this.state==='running',idle=this.state==='ready'||this.state==='loading';
            this.scenery.forEach(n=>n.active=!idle);this.hills.forEach(n=>n.active=!idle);
            const compact=typeof window!=='undefined'&&window.innerWidth<500;const size=idle?(compact?1.1:1.45):1;
            this.avatar.setRotationFromEuler(0,idle?18:180+32*this.slideMix,0);this.avatar.setScale(size,size,size);if(idle)this.avatar.setPosition(compact?.45:.9,0,0);
            this.animateCharacter(dt,running,idle);
            this.gameCamera.fov=compact&&!idle?52:48;
            const target=idle?new Vec3(6.5,4,8):new Vec3(this.x*.13,compact?8.2:6.8,compact?16:10.8);
            const pos=new Vec3();Vec3.lerp(pos,this.cameraNode.position,target,Math.min(1,dt*3));this.cameraNode.setPosition(pos);
            this.cameraNode.lookAt(idle?new Vec3(compact?-.8:-1.2,compact?1.8:1,0):new Vec3(this.x*.08,.7,-12));
        }
        if(this.state==='running'){
            this.speed=runSpeed(this.distance,this.endless);const move=this.speed*dt;this.distance+=move;
            const world=worldAt(this.distance,this.endless);if(world!==this.currentWorld)this.applyWorld(world);
            if(!this.endless&&this.distance>=FINISH_DISTANCE){this.distance=FINISH_DISTANCE;this.finish(true);return;}
            this.x+=(this.lane*LANE-this.x)*Math.min(1,dt*this.character.turn);[this.y,this.vy]=jumpStep(this.y,this.vy,dt);
            this.slide=Math.max(0,this.slide-dt);this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);if(this.y===0&&this.jumpBuffer>0)this.launchJump();
            this.chainTime=Math.max(0,this.chainTime-dt);if(this.chainTime===0)this.chain=0;this.noticeTime=Math.max(0,this.noticeTime-dt);
            this.immune=Math.max(0,this.immune-dt);this.star=Math.max(0,this.star-dt);
            this.avatar.setPosition(this.x,this.y+(this.y===0?Math.abs(Math.sin(this.time*13))*.055*(1-this.slideMix):0),0);
            if(this.slide>0){this.dustClock-=dt;if(this.dustClock<=0){this.dustClock=.055;this.skidDust();}}
            if(this.model)this.model.active=this.immune===0||Math.floor(this.immune*12)%2===0;
            this.shadow.setPosition(this.x,.03,0);this.shadow.setScale(1.25-this.y*.15,.025,.9-this.y*.1);
            for(const n of this.tiles){let z=n.position.z+move;if(z>21)z-=126;n.setPosition(0,0,z);}
            for(const n of this.scenery){let z=n.position.z+move;if(z>20)z-=123.2;n.setPosition(n.position.x,0,z);}
            this.nextRow+=move;while(this.nextRow>-104){this.spawnRow(this.rowIndex++,this.nextRow);this.nextRow-=ROW_GAP;}
            for(const item of this.items){
                item.z+=move;item.node.setPosition(item.lane*LANE,item.y,item.z);
                if(['coin','star','shield','heart'].includes(item.kind)){
                    item.node.setRotationFromEuler(0,this.time*130+item.z*8,0);
                    if(!item.hit&&Math.abs(this.x-item.lane*LANE)<(item.kind==='coin'?this.character.magnet:.8)&&Math.abs(item.z)<.85&&Math.abs(this.y+(this.slide>0?.5:1)-item.y)<1){
                        item.hit=true;item.node.active=false;
                        if(item.kind==='star'){this.star=6;this.sound('star');this.tell('✦ Delivery boost · invincible for 6 seconds');}
                        else if(item.kind==='shield'){this.shield=1;this.sound('star');this.tell('◈ Parcel shield · blocks one hit');}
                        else if(item.kind==='heart'){this.hearts=Math.min(this.character.hearts,this.hearts+1);this.sound('coin');this.tell('♥ One heart restored');}
                        else this.collectCoin();
                        this.burst(item.lane*LANE,item.y,0,'#ffda66',5);
                    }
                }else if(!item.hit&&hazardHit(item.kind,this.x,this.y,item.lane,item.z,this.slide>0)){
                    if(item.kind==='drone'&&this.vy<0&&this.y>.47){item.hit=true;item.node.active=false;this.vy=7;for(let n=0;n<3;n++)this.collectCoin();this.burst(this.x,.5,0,'#e9bb77',8);}
                    else if(this.star>0){item.hit=true;item.node.active=false;this.burst(this.x,1,0,'#ffda66',8);}
                    else if(this.immune===0){item.hit=true;this.chain=0;this.chainTime=0;if(this.shield){this.shield=0;this.tell('◈ Your shield blocked the hit');}else{this.hearts--;this.hits++;}this.immune=1.4;this.sound('hit');this.burst(this.x,1,0,'#ed6255',8);if(this.hearts<=0){this.finish(false);break;}}
                }
            }
            for(const item of this.items)if(!item.hit&&!['coin','star','shield','heart'].includes(item.kind)&&item.z>.85){
                item.hit=true;if(Math.abs(this.x-item.lane*LANE)<.78){this.dodges++;this.coinScore+=25;this.sound('dodge');}
            }
            if(!this.missionPaid&&this.coins>=60&&this.dodges>=8){this.missionPaid=true;this.coinScore+=500;this.hearts=Math.min(this.character.hearts,this.hearts+1);this.tell('Delivery complete! +500 points and one heart');this.sound('star');}
            this.items=this.items.filter(e=>{if(e.z>15){e.node.destroy();return false;}return true;});
            this.refreshHUD();
        }
        if(this.state!=='paused')this.sparks=this.sparks.filter(p=>{p.t-=dt;if(p.t<=0){p.n.destroy();return false;}p.v.y-=dt*9;p.n.setPosition(p.n.position.x+p.v.x*dt,p.n.position.y+p.v.y*dt,p.n.position.z+p.v.z*dt);p.n.setScale(p.t*(p.size||.2),p.t*(p.size||.2),p.t*(p.size||.2));return true;});
    }
    private skidDust(){for(const side of [-1,1]){const n=this.shape('sphere',this.node,this.x+side*.35,.13,.5,.15,.15,.15,WORLDS[this.currentWorld].road);this.sparks.push({n,t:.35,size:.65,v:new Vec3(side*.7,.7,5)});}}
    private burst(x:number,y:number,z:number,c:string,count:number){for(let i=0;i<count;i++){const n=this.shape('box',this.node,x,y,z,.14,.14,.14,c);this.sparks.push({n,t:.6,v:new Vec3(Math.sin(i*2.4)*3,2+Math.random()*3,Math.cos(i*2.4)*2)});}}
    private collectCoin(){
        this.coins++;this.chain++;this.chainTime=3;this.coinScore+=10*comboMultiplier(this.chain);this.sound('coin');
        if(this.character.id==='Pip'&&this.coins%30===0){this.hearts=Math.min(this.character.hearts,this.hearts+1);this.tell('Pip restocked · one heart restored');}
    }
    private recordKey(){return 'cloudpost-v1-'+(this.endless?'endless':'campaign')+'-'+this.startWorld;}
    private loadBest(){this.best=this.platform?.getBest(this.recordKey())||0;}
    private finish(won=false){this.state=won?'won':'over';if(this.model)this.model.active=true;this.slide=0;
        if(won){this.coinScore+=this.hearts*200;this.sound('win');}this.best=Math.max(this.best,this.score);
        void this.platform?.recordBest(this.recordKey(),this.score).then(()=>this.refreshHUD());this.refreshUI();}
    private initAudio(){try{if(!this.audio)this.audio=new(window.AudioContext||(window as any).webkitAudioContext)();this.syncAudio();}catch{}}
    private sound(kind:string){
        if(!this.audio||this.muted||this.platform?.paused||this.platform?.audioEnabled===false)return;const audio=this.audio;
        if(kind==='slide'){
            const length=Math.floor(audio.sampleRate*.42),buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);
            for(let i=0;i<length;i++)data[i]=(Math.random()*2-1);
            const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type='bandpass';filter.Q.value=.65;
            const t=audio.currentTime;filter.frequency.setValueAtTime(1700,t);filter.frequency.exponentialRampToValueAtTime(260,t+.4);
            gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(.13,t+.035);gain.gain.exponentialRampToValueAtTime(.001,t+.42);
            source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(t);source.stop(t+.43);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};return;
        }
        const notes:Record<string,number[]>={coin:[880,1320],jump:[330,660],hit:[180,95],star:[523,659,784,1047],start:[392,523,659],dodge:[784,1047],level:[523,784,1047,1319],win:[523,659,784,1047,784,1047,1568]};
        for(const [i,hz]of(notes[kind]||[]).entries()){
            const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.value=hz;o.connect(g);g.connect(audio.destination);
            const t=audio.currentTime+i*.07;g.gain.setValueAtTime(kind==='dodge'?.025:.055,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.start(t);o.stop(t+.16);o.onended=()=>{o.disconnect();g.disconnect();};
        }
    }
    private createUI(){
        if(typeof document==='undefined')return;
        const style=document.createElement('style');style.id='cloudpost-style';style.textContent=`
        *{box-sizing:border-box}html,body{margin:0;overflow:hidden;background:#abdae0!important}body>.header,body>p.footer{display:none}#GameDiv{position:fixed!important;inset:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}#GameDiv,#Cocos3dGameContainer,canvas{width:100%!important;height:100%!important}
        #cloudpost-ui{position:fixed;inset:0;z-index:50;pointer-events:none;font-family:Inter,'Avenir Next','PingFang SC',system-ui,sans-serif;color:#194b4d;text-align:left}
        #cloudpost-ui button{pointer-events:auto;cursor:pointer;font:inherit;border:0;transition:transform .15s,background .15s}#cloudpost-ui button:hover{transform:translateY(-2px)}#cloudpost-ui button:focus-visible{outline:3px solid #ffca51;outline-offset:3px}#cloudpost-ui button:disabled{opacity:.5;cursor:wait}
        .topbar{position:absolute;top:24px;left:32px;right:32px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{display:flex;gap:10px;align-items:center;font-size:15px;font-weight:850;letter-spacing:.06em}.badge{background:#4c8e86;color:#fff9e8;display:grid;place-items:center;width:38px;height:38px;border-radius:13px;font-size:24px;box-shadow:0 4px 0 #316962}.brand small{display:block;font-size:9px;letter-spacing:.12em;margin-top:5px}.stats{display:flex;gap:8px}.stat{background:#fff8e9e8;backdrop-filter:blur(10px);border:1px solid #fff9;padding:9px 16px;border-radius:16px;min-width:100px}.stat small{font-size:9px;letter-spacing:.10em;display:block;opacity:.65;font-weight:700}.stat b{display:block;font-size:23px;line-height:1.15;margin-top:3px;font-variant-numeric:tabular-nums}.stat b em{font-size:12px;font-style:normal;margin-left:4px}.actions{display:flex;gap:8px}.iconbtn{width:40px;height:40px;background:#fff8e9ed;border-radius:50%;color:#194b4d;font-size:18px!important}
        .hero{position:absolute;left:5%;top:15%;width:395px;max-width:51vw}.eyebrow{font-size:10px;letter-spacing:.15em;font-weight:850;margin-bottom:12px}.hero h1{font-size:clamp(35px,4.2vw,54px);line-height:1.08;letter-spacing:-.055em;margin:0 0 16px;font-weight:900}.hero h1 span{display:block;color:#dc8753}.hero p{font-size:13px;line-height:1.8;margin:0 0 20px;max-width:340px;color:#355f5c}.primary{background:#dc8753;color:#fff8e8;border-radius:15px;padding:15px 25px;font-weight:800!important;font-size:15px!important;box-shadow:0 4px 0 #b66a3f}.primary span{margin-left:24px}.subnote{text-shadow:0 1px 5px #fff8e9;font-size:10px;margin-top:14px;color:#416961}.select-label{font-size:10px;font-weight:800;letter-spacing:.08em;margin:13px 0 7px}.world-select{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.mode-select{display:flex;gap:6px}.world-select button,.mode-select button{border-radius:11px;padding:10px 11px;color:#345a59;background:#fff9e8d9;font-size:11px!important;font-weight:750!important}.world-select button[aria-pressed=true],.mode-select button[aria-pressed=true]{background:#194b4d;color:#fff7e5}.world-select small{display:block;font-size:8px;opacity:.7;margin-bottom:3px}.mode-select{margin:10px 0 17px}.mode-select button{padding:8px 13px;font-size:10px!important}.world-description{text-shadow:0 1px 5px #fff8e9;font-size:10px;line-height:1.6;margin-top:8px;color:#315c58}
        .roster{position:absolute;left:5%;right:5%;bottom:87px}.roster-title{color:#143f40;text-shadow:0 1px 5px #fff8e9;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-size:11px;font-weight:800;letter-spacing:.04em}.roster-title small{font-weight:500;opacity:.7}.character-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.character{background:#fff8e9e8;border:2px solid transparent!important;border-radius:17px;padding:14px 12px;color:#315a56;display:flex;align-items:center;gap:10px;text-align:left;min-width:0}.character[aria-pressed=true]{border-color:var(--accent)!important;background:#fff9e9;box-shadow:0 6px 22px #174b5014}.avatar-icon{flex-shrink:0;width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:var(--accent);color:white;font-size:20px;font-weight:900}.character strong{font-size:13px;display:block}.character small{display:block;font-size:9px;margin-top:4px;opacity:.7}.skill-note{margin-top:10px;font-size:11px;padding:9px 14px;border-radius:12px;display:inline-block;background:#fff7e6e0}.preview-label{padding:12px 16px;border-radius:15px;background:#fff8e9cc;position:absolute;right:8%;top:26%;text-align:right}.preview-label b{display:block;font-size:22px;margin:5px 0}.preview-label small{font-size:10px;letter-spacing:.15em}
        .stagebar{position:absolute;top:105px;left:32px;right:32px;border-radius:14px;background:#fff8e9e8;padding:11px 15px;display:flex;gap:16px;align-items:center;font-size:11px}.stagebar b{white-space:nowrap}.track{flex:1;height:5px;border-radius:5px;background:#194b4d22;overflow:hidden}.track i{display:block;height:100%;background:#dc8753;width:0;transition:width .2s}.stagebar small{font-size:10px;white-space:nowrap}.notice{position:absolute;top:155px;left:50%;transform:translateX(-50%);padding:9px 17px;border-radius:13px;background:#fff7e6ee;font-size:11px;max-width:90%;text-align:center;line-height:1.6;width:max-content}.cue{position:absolute;top:210px;left:50%;transform:translateX(-50%);background:#194b4ded;color:#fff7df;font-weight:800;font-size:15px;border-radius:15px;padding:10px 20px}.mission{position:absolute;left:32px;bottom:95px;background:#fff8e9e8;border-radius:15px;padding:11px 15px;font-size:10px;line-height:1.9}.mission b{font-size:12px}.power{position:absolute;right:32px;bottom:95px;background:#fff0bded;border-radius:15px;padding:10px 16px;font-size:11px;font-weight:800;line-height:1.9;text-align:right}
        .footer{position:absolute;bottom:22px;left:32px;right:32px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#365f5d}.keys{display:flex;gap:14px;background:#fff7e6e0;padding:12px 17px;border-radius:13px;backdrop-filter:blur(10px)}kbd{font:inherit;font-weight:800;background:#fffaf0;padding:3px 5px;border-radius:4px;box-shadow:0 2px 0 #d5d7c7;margin-right:4px}.note{font-size:9px;letter-spacing:.06em}.centerback{position:absolute;inset:0;display:grid;place-items:center;background:#174b5044;backdrop-filter:blur(7px);pointer-events:auto}.card{width:430px;max-width:90vw;max-height:90vh;overflow:auto;background:#fff7e5;border-radius:26px;padding:32px;text-align:center;box-shadow:0 25px 80px #174b5033}.card h2{font-size:31px;letter-spacing:-.04em;margin:10px 0 15px}.card p{font-size:12px;color:#5c7771;line-height:1.8}.result{font-size:62px;font-weight:900;color:#dc8753;letter-spacing:-.06em}.result small{font-size:13px;letter-spacing:0;color:#55756c}.resultrow{display:flex;justify-content:center;gap:20px;margin:15px 0 22px;font-size:12px}.secondary{background:#e2e7d7;color:#315c54;padding:12px 20px;border-radius:12px;margin-top:14px;font-size:12px!important}.result-stars{font-size:28px;color:#cc9633;letter-spacing:6px;margin:12px}.mobile-controls{display:none;position:absolute;bottom:73px;left:18px;right:18px;justify-content:space-between;pointer-events:none}.mobile-controls button{width:53px;height:53px;border-radius:18px;background:#fff7e5ed;color:#194b4d;font-size:22px!important}.mobile-controls div{display:flex;gap:8px}.mobile-controls button small{font-size:9px;display:block}.hidden{display:none!important}
        @media(max-width:900px){.topbar{left:20px;right:20px;top:20px;flex-wrap:wrap}.brand{font-size:12px}.brand small{font-size:8px}.stats{order:3;width:100%;justify-content:center;margin-top:5px}.stat{min-width:98px;padding:7px 14px}.stat b{font-size:21px}.hero{top:20%;width:340px}.hero p{margin-bottom:8px}.hero h1{margin-bottom:10px}.hero h1{font-size:40px}.hero p{font-size:12px;max-width:260px}.stagebar{top:145px;left:20px;right:20px}.notice{top:193px}.cue{top:245px}.character{padding:12px 9px;gap:7px}.character strong{font-size:12px}.avatar-icon{width:28px;height:28px;font-size:18px}.preview-label{top:23%;right:6%}.mobile-controls{display:flex}.mission{bottom:137px;left:20px}.power{bottom:137px;right:20px}.footer{left:20px;right:20px;bottom:20px}.keys{gap:12px;font-size:9px;padding:10px 12px}.note{display:none}}
        @media(max-width:520px){.hero{left:20px;top:155px;max-width:calc(100vw - 40px);width:calc(100vw - 40px)}.hero h1{font-size:31px;margin-bottom:9px}.hero h1 span{display:inline;margin-left:8px}.hero p{display:none}.eyebrow{font-size:8px;margin-bottom:9px}.world-select button{padding:8px 10px;flex:1}.world-description{max-width:220px;font-size:9px}.mode-select{margin:8px 0 12px}.hero .primary{padding:12px 19px;font-size:13px!important}.subnote{text-shadow:0 1px 5px #fff8e9;font-size:9px;margin-top:10px}.roster{left:20px;right:20px;bottom:73px}.character-grid{grid-template-columns:repeat(2,1fr);gap:7px}.character{padding:10px}.roster-title{font-size:10px;margin-bottom:7px}.roster-title small{display:none}.skill-note{font-size:9px;display:block;padding:8px 10px;margin-top:7px}.preview-label{display:none}.stagebar{gap:8px;font-size:10px;padding:10px}.stagebar small{font-size:9px}.mission{font-size:9px;padding:9px 11px;max-width:calc(100vw - 190px)}.power{font-size:10px;max-width:145px;padding:9px 11px}.footer{left:14px;right:14px}.keys{gap:8px;font-size:8px;width:100%;justify-content:center;padding:10px 6px}.notice{font-size:10px}.cue{font-size:13px}.stat{min-width:94px}.stat b{font-size:19px}}
        @media(max-height:800px) and (min-width:521px){.hero{top:125px}.hero h1{font-size:34px}.hero p{display:none}.roster{bottom:65px}.character{padding:8px}.skill-note{padding:5px 10px}.preview-label{top:29%}}
        @media(max-height:760px) and (max-width:520px){.hero{top:145px}.hero h1{font-size:24px;margin-bottom:6px}.eyebrow{display:none}.world-select button{padding:6px 7px}.mode-select{margin:6px 0 9px}.hero .primary{padding:9px 16px}.world-description{display:none}.roster{bottom:61px}.character{padding:7px}.roster-title{margin-bottom:5px}.skill-note{padding:5px 8px}.select-label{margin-top:8px}.subnote{display:none}.footer{bottom:14px}}
        @media(max-height:540px) and (min-width:521px){.topbar{top:12px;left:20px;right:20px;flex-wrap:nowrap;gap:8px}.brand{font-size:11px}.brand small{font-size:7px}.badge{width:29px;height:29px;font-size:20px}.stats{order:0;width:auto;margin:0;gap:5px}.stat{min-width:72px;padding:5px 9px}.stat b{font-size:17px}.stat small{font-size:7px}.iconbtn{width:31px;height:31px}.hero{left:3%;top:80px;width:46%;max-width:46vw}.hero .eyebrow,.hero p,.hero .world-description,.hero .subnote,.hero .select-label{display:none}.hero h1{font-size:24px;line-height:1.05;margin-bottom:9px}.hero h1 span{display:inline;margin-left:7px}.world-select button{padding:6px 7px;font-size:10px!important}.world-select small{font-size:7px}.mode-select{margin:6px 0 9px}.mode-select button{padding:6px 9px}.hero .primary{padding:10px 16px;font-size:12px!important}.roster{left:auto;right:3%;width:43%;bottom:16px}.roster-title{font-size:9px;margin-bottom:5px}.roster-title small{display:none}.character-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.character{padding:7px;gap:6px}.avatar-icon{width:23px;height:23px;font-size:14px}.character strong{font-size:11px}.character small{font-size:8px}.skill-note{font-size:8px;padding:5px 7px;margin-top:5px}.footer{display:none}.stagebar{top:67px;left:20px;right:20px;padding:7px 12px}.notice{top:105px;font-size:9px;padding:6px 12px}.cue{top:143px;font-size:11px;padding:7px 12px}.mobile-controls{bottom:12px}.mobile-controls button{width:42px;height:42px;border-radius:12px}.mission,.power{bottom:66px;font-size:8px;padding:6px 10px}.mission b{font-size:10px}.card{padding:18px}.card h2{font-size:24px}.result{font-size:43px}.resultrow{margin:8px 0 12px}.card p{font-size:10px}.secondary{margin-top:8px}.result-stars{margin:6px;font-size:23px}}
        `;document.head.appendChild(style);this.ui=document.createElement('div');this.ui.id='cloudpost-ui';document.body.appendChild(this.ui);this.refreshUI();
    }
    private refreshUI(focusCanvas=true){
        if(!this.ui)return;this.ui.dataset.state=this.state;this.ui.dataset.version='1.0.1';
        const ready=this.state==='ready'||this.state==='loading',over=this.state==='over'||this.state==='won',won=this.state==='won';
        const c=this.character,world=WORLDS[this.startWorld],stars=1+(this.coins>=60?1:0)+(this.hits===0?1:0);
        this.ui.innerHTML=`<header class="topbar"><div class="brand"><div class="badge">◇</div><div>CLOUDPOST DASH<small>A SMALL PARCEL. A BIG ADVENTURE.</small></div></div><div class="stats"><div class="stat"><small>DISTANCE</small><b id="distance">0<em>m</em></b></div><div class="stat"><small>STAMPS</small><b id="coins" style="color:#bf811e">0</b></div><div class="stat"><small>HEARTS</small><b id="hearts" style="color:#dc8753;font-size:19px">♥ ♥ ♥</b></div></div><div class="actions">${this.platform?.inPlayables?'':`<button class="iconbtn" id="sound" aria-label="Toggle sound">${this.muted?'♫̸':'♫'}</button>`}<button class="iconbtn ${ready||over?'hidden':''}" id="pause" aria-label="Pause or resume">${this.state==='paused'?'▶':'Ⅱ'}</button></div></header>
        ${ready?`<section class="hero"><div class="eyebrow">FOUR COURIERS. SIX ROUTES. ONE SPECIAL DELIVERY.</div><h1>Make every<span>delivery count.</span></h1><p>Dash across sky gardens and starlit bridges.<br>Jump, slide, and collect stamps on a journey beyond the clouds.</p><div class="select-label">CHOOSE A ROUTE / LATER ROUTES ARE HARDER</div><div class="world-select">${WORLDS.map((w,i)=>`<button id="world-${i}" aria-pressed="${i===this.startWorld}"><small>ROUTE 0${i+1} · ${'★'.repeat(Math.min(3,Math.ceil((i+1)/2)))}</small>${w.name}</button>`).join('')}</div><div class="world-description">${world.hint}</div><div class="mode-select"><button id="campaign" aria-pressed="${!this.endless}">Delivery · ${FINISH_DISTANCE-this.startWorld*WORLD_LENGTH} m</button><button id="endless" aria-pressed="${this.endless}">Endless · faster pace</button></div><button class="primary" id="start" ${this.state==='loading'?'disabled':''}>${this.loadError||(this.state==='loading'?'Gathering the crew…':'Start delivery')}<span>↗</span></button><div class="subnote">All-time best ${this.platform?.globalBest||0} · Route best ${this.best.toLocaleString()} · Space to depart</div></section><section class="roster"><div class="roster-title">MEET YOUR COURIER <small>A different way to make the journey</small></div><div class="character-grid">${CHARACTERS.map((ch,i)=>`<button class="character" id="character-${i}" style="--accent:${ch.color}" aria-pressed="${i===this.selected}" ${this.state==='loading'||(!this.prefabs[ch.id]&&!this.failedCrew.has(i))?'disabled':''}><span class="avatar-icon">${ch.badge}</span><span><strong>${ch.name}</strong><small>${this.failedCrew.has(i)?'Tap to retry':this.prefabs[ch.id]?ch.tag:'Arriving…'}</small></span></button>`).join('')}</div><div class="skill-note"><b>${c.name}'s perk</b> · ${c.skill}</div></section>`:`<div class="stagebar"><b id="stage-name"></b><div class="track"><i id="progress"></i></div><small id="stage-distance"></small></div><div id="notice" role="status" class="notice hidden"></div><div id="cue" class="cue hidden"></div><div class="mission"><b id="score"></b><br><span id="mission"></span></div><div id="power" class="power"></div>`}
        ${this.state==='paused'?`<div class="centerback"><section class="card"><div class="eyebrow">TAKE A BREATH</div><h2>Your parcel can wait.</h2><p>${c.name} · ${WORLDS[Math.max(0,this.currentWorld)].name}<br>Slide under blue sorting beams. Jump over heat vents.</p><button class="primary" id="resume">Resume delivery <span>↗</span></button><br><button class="secondary" id="menu">Couriers & routes</button></section></div>`:''}
        ${over?`<div class="centerback"><section class="card"><div class="eyebrow">${won?'DELIVERY COMPLETE':'A LITTLE FURTHER NEXT TIME'}</div><h2>${won?'Signed, sealed, delivered!':'Every route is a new start.'}</h2>${won?`<div class="result-stars" aria-label="${stars} star finish">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</div>`:''}<div class="result">${this.score}<small> points</small></div><div class="resultrow"><span>${Math.floor(this.travelled)} m</span><span>${this.coins} stamps</span><span>Route best ${this.best}</span></div><p>${c.name} · ${this.dodges} skill dodges · ${this.hits} hits<br>All-time best ${Math.max(this.platform?.globalBest||0,this.score)} points<br>${won?'Each heart adds 200 points. 60 stamps / no hits each add a star.':'Stamp chains reach 3× points. Skill dodges add 25 points.'}</p><button class="primary" id="restart">${won?'Deliver again':'Try the route again'} <span>↗</span></button><br><button class="secondary" id="menu">Couriers & routes</button></section></div>`:''}
        <div class="mobile-controls ${this.state!=='running'?'hidden':''}"><div><button id="left" aria-label="Move left">←</button><button id="right" aria-label="Move right">→</button></div><div><button id="slide" aria-label="Slide">↓<small>SLIDE</small></button><button id="jump" aria-label="Jump">↑<small>JUMP</small></button></div></div>
        <footer class="footer"><div class="keys"><span><kbd>← →</kbd>LANES</span><span><kbd>SPACE</kbd>JUMP</span><span><kbd>↓ / S</kbd>SLIDE</span><span><kbd>P</kbd>PAUSE</span></div><div class="note">AIBOOMPROMPT · CLOUDPOST DASH</div></footer>`;
        const bind=(id:string,fn:()=>void)=>this.ui?.querySelector('#'+id)?.addEventListener('click',e=>{e.stopPropagation();if(this.platform?.paused)return;fn();this.browserKeyboard?.focusCanvas();});
        bind('start',this.begin);bind('restart',this.begin);bind('resume',this.pause);bind('pause',this.pause);bind('menu',this.menu);
        bind('sound',()=>{this.muted=!this.muted;this.syncAudio();this.refreshUI();});bind('left',()=>this.shift(-1));bind('right',()=>this.shift(1));bind('jump',()=>this.jump());bind('slide',()=>this.duck());
        CHARACTERS.forEach((_,i)=>bind('character-'+i,()=>{if(this.failedCrew.has(i)){this.loadCourier(i);this.refreshUI(false);}else this.selectCharacter(i);}));
        WORLDS.forEach((_,i)=>bind('world-'+i,()=>{this.startWorld=i;this.applyWorld(i);this.loadBest();this.refreshUI();}));
        bind('campaign',()=>{this.endless=false;this.loadBest();this.refreshUI();});bind('endless',()=>{this.endless=true;this.loadBest();this.refreshUI();});
        this.refreshHUD();if(focusCanvas)this.browserKeyboard?.focusCanvas();
    }
    private refreshHUD(){
        if(!this.ui)return;const u=this.ui;
        u.dataset.slidePose=this.slideMix.toFixed(3);u.dataset.lane=String(this.lane);u.dataset.height=this.y.toFixed(3);u.dataset.slide=this.slide.toFixed(2);
        u.dataset.character=this.character.id;u.dataset.world=String(this.currentWorld);u.dataset.distance=this.distance.toFixed(1);u.dataset.speed=this.speed.toFixed(1);u.dataset.hearts=String(this.hearts);u.dataset.shield=String(this.shield);
        const set=(id:string,value:string)=>{const el=u.querySelector('#'+id);if(el&&el.textContent!==value)el.textContent=value;};
        const ready=this.state==='ready'||this.state==='loading';
        set('distance',(ready?'0':String(Math.floor(this.travelled)))+' m');set('coins',(ready?0:this.coins).toString().padStart(2,'0'));
        set('hearts','♥ '.repeat(ready?this.character.hearts:this.hearts)+'♡ '.repeat(ready?0:this.character.hearts-this.hearts));
        set('stage-name','0'+(this.currentWorld+1)+' · '+WORLDS[Math.max(0,this.currentWorld)].name);
        const progress=u.querySelector<HTMLElement>('#progress');if(progress)progress.style.width=(this.state==='won'?100:this.distance%WORLD_LENGTH/WORLD_LENGTH*100)+'%';
        set('stage-distance',this.endless?'Endless route':Math.max(0,Math.ceil(FINISH_DISTANCE-this.distance))+' m to delivery');
        set('score',this.score.toLocaleString()+' points · chain ×'+comboMultiplier(this.chain));
        set('mission',this.missionPaid?'✓ Delivery bonus claimed · +500':`Delivery goal: ${Math.min(this.coins,60)}/60 stamps · ${Math.min(this.dodges,8)}/8 skill dodges`);
        set('power',this.star>0?'✦ Boost '+Math.ceil(this.star)+' s':this.shield?'◈ Shield ready':this.character.name+' · '+this.character.tag);
        const notice=u.querySelector('#notice');if(notice){notice.classList.toggle('hidden',this.noticeTime<=0);set('notice',this.notice);}
        const next=this.items.filter(i=>!i.hit&&i.lane===this.lane&&i.z<0&&i.z>-30&&!['coin','star','shield','heart'].includes(i.kind)).sort((a,b)=>b.z-a.z)[0];
        const cue=u.querySelector('#cue');if(cue){cue.classList.toggle('hidden',!next||this.state!=='running');set('cue',next?((next.kind==='gate'?'↓ SLIDE BELOW':next.kind==='fire'?'↑ JUMP THE VENT':'↔ SWITCH / ↑ JUMP')+' · '+Math.max(0,Math.ceil(-next.z))+' m'):'');}
    }
    onDestroy(){if(typeof window!=='undefined')window.removeEventListener('resize',this.onResize);this.platform?.dispose();this.browserKeyboard?.destroy();input.off(Input.EventType.KEY_DOWN,this.onKey,this);input.off(Input.EventType.KEY_UP,this.onKeyUp,this);input.off(Input.EventType.TOUCH_START,this.onTouchStart,this);input.off(Input.EventType.TOUCH_END,this.onTouchEnd,this);input.off(Input.EventType.TOUCH_CANCEL,this.onTouchCancel,this);if(typeof document!=='undefined'){document.removeEventListener('visibilitychange',this.onVisibility);document.getElementById('cloudpost-style')?.remove();}this.ui?.remove();void this.audio?.close();Object.values(this.materials).forEach(m=>m.destroy());Object.values(this.meshes).forEach(m=>m.destroy());}
}
