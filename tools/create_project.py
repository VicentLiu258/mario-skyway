import json, pathlib, uuid, base64
P=pathlib.Path(__file__).resolve().parents[1]/'cocos'
def write(p,data):
    p=P/p;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data,ensure_ascii=False,indent=2))
uid='53ac2605-7f61-48f3-9ff7-852cc75b9750';sceneuid='3954b46a-4d9d-4d65-9c76-9e7ae53d305c'
h=uid.replace('-','');compressed=h[:5]+base64.b64encode(bytes.fromhex(h[5:]+'0')).decode()[:18]
# Cocos UUID compression keeps five hex digits then packs groups of three nibbles.
b64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
compressed=h[:5]+''.join(b64[int(h[i:i+3],16)>>6]+b64[int(h[i:i+3],16)&63] for i in range(5,32,3))
write(pathlib.Path('package.json'),{'name':'mario-skyway-run','uuid':str(uuid.uuid4()),'version':'1.1.0','creator':{'version':'3.8.8'}})
write(pathlib.Path('tsconfig.json'),{'extends':'./temp/tsconfig.cocos.json','compilerOptions':{'strict':False,'lib':['ES2020','DOM'],'skipLibCheck':True}})
write(pathlib.Path('assets/scripts/MarioRunner.ts.meta'),{'ver':'4.0.24','importer':'typescript','imported':True,'uuid':uid,'files':[],'subMetas':{},'userData':{}})
scene=[{'__type__':'cc.SceneAsset','_name':'Skyway','_objFlags':0,'_native':'','scene':{'__id__':1}},
 {'__type__':'cc.Scene','_name':'Skyway','_objFlags':0,'_parent':None,'_children':[{'__id__':2}],'_active':True,'_components':[],'_prefab':None,'autoReleaseAssets':False,'_globals':{'__id__':4},'_id':sceneuid},
 {'__type__':'cc.Node','_name':'MarioRunner','_objFlags':0,'_parent':{'__id__':1},'_children':[],'_active':True,'_components':[{'__id__':3}],'_prefab':None,'_lpos':{'__type__':'cc.Vec3','x':0,'y':0,'z':0},'_lrot':{'__type__':'cc.Quat','x':0,'y':0,'z':0,'w':1},'_lscale':{'__type__':'cc.Vec3','x':1,'y':1,'z':1},'_layer':1073741824,'_mobility':0,'_id':'runner-root'},
 {'__type__':compressed,'_name':'','_objFlags':0,'node':{'__id__':2},'_enabled':True,'__prefab':None,'_id':'runner-component','worldMaterial':{'__uuid__':'c23b5101-07ce-4876-95ed-9cc51dce1c84','__expectedType__':'cc.Material'}},
 {'__type__':'cc.SceneGlobals','ambient':{'__id__':5},'shadows':{'__id__':6},'_skybox':{'__id__':7},'fog':{'__id__':8}},
 {'__type__':'cc.AmbientInfo','_skyColorHDR':{'__type__':'cc.Vec4','x':.75,'y':.85,'z':1,'w':1},'_skyColorLDR':{'__type__':'cc.Vec4','x':.75,'y':.85,'z':1,'w':1},'_skyIllumHDR':20000,'_skyIllumLDR':20000,'_groundAlbedoHDR':{'__type__':'cc.Vec4','x':.55,'y':.52,'z':.42,'w':1},'_groundAlbedoLDR':{'__type__':'cc.Vec4','x':.55,'y':.52,'z':.42,'w':1}},
 {'__type__':'cc.ShadowsInfo','_enabled':False,'_type':0},
 {'__type__':'cc.SkyboxInfo','_enabled':False,'_useIBL':False,'_isRGBE':False},
 {'__type__':'cc.FogInfo','_enabled':True,'_type':0,'_fogColor':{'__type__':'cc.Color','r':171,'g':218,'b':224,'a':255},'_fogStart':35,'_fogEnd':110,'_fogDensity':.01}]
write(pathlib.Path('assets/scenes/Skyway.scene'),scene)
write(pathlib.Path('assets/scenes/Skyway.scene.meta'),{'ver':'1.1.50','importer':'scene','imported':True,'uuid':sceneuid,'files':['.json'],'subMetas':{},'userData':{}})
write(pathlib.Path('settings/v2/packages/project.json'),{'__version__':'1.0.6','general':{'designResolution':{'width':1280,'height':800,'fitWidth':True,'fitHeight':False}}})
write(pathlib.Path('build-config.json'),{'name':'MarioSkyway','platform':'web-desktop','buildPath':'project://build','outputName':'web-desktop','startScene':sceneuid,'scenes':[{'url':'db://assets/scenes/Skyway.scene','uuid':sceneuid}],'debug':False,'md5Cache':False,'sourceMaps':True,'packages':{'web-desktop':{'resolution':{'width':1280,'height':800},'polyfills':{'asyncFunctions':True}}}})
print('Created Cocos 3.8.8 project; component',compressed)
