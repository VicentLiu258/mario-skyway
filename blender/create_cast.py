"""Build three editable companion models from the same rigid-part art pipeline."""
import pathlib, json
SOURCE = pathlib.Path(__file__).with_name('create_mario.py').read_text()
BASE = pathlib.Path(__file__).resolve().parents[1]
PREFIX = SOURCE.split('# Consolidate meshes')[0]
HELPERS = PREFIX.split("root=empty('Mario_Root'")[0]
TOAD = '''
root=empty('Toad_Root',(0,0,0));body=empty('Body',(0,0,1.1),root)
uv('Cream trousers',(0,0,.82),(.48,.32,.48),white,body)
uv('Torso',(0,0,1.3),(.42,.28,.45),skin,body)
for s in (-1,1):
    uv('Blue vest',(s*.30,-.10,1.36),(.18,.27,.40),blue,body)
    line('Gold vest edge',[(s*.20,-.335,1.05),(s*.18,-.34,1.4),(s*.23,-.27,1.65)],.035,gold,body)
    leg=empty('Leg_L' if s<0 else 'Leg_R',(s*.25,0,.6),root)
    uv('Boot',(s*.26,-.10,.22),(.28,.39,.23),shoe,leg)
    arm=empty('Arm_L' if s<0 else 'Arm_R',(s*.43,0,1.5),body)
    uv('Arm',(s*.53,0,1.25),(.16,.19,.30),skin,arm)
    uv('Hand',(s*.60,-.06,1.04),(.19,.19,.20),skin,arm)
head=empty('Head',(0,0,1.7),body)
uv('Face',(0,-.03,1.91),(.49,.38,.47),skin,head)
for s in (-1,1):
    uv('Eye',(s*.17,-.389,1.99),(.055,.026,.12),black,head)
    uv('Eye glint',(s*.17-.014,-.414,2.035),(.016,.009,.027),white,head)
line('Smile',[(-.11,-.391,1.78),(0,-.408,1.74),(.11,-.391,1.78)],.018,mouth,head)
uv('Mushroom cap',(0,.015,2.67),(.91,.73,.65),white,head)
uv('Front red spot',(0,-.669,2.80),(.29,.075,.31),red,head)
uv('Back red spot',(0,.694,2.80),(.29,.075,.31),red,head)
for s in (-1,1):uv('Side red spot',(s*.80,.02,2.78),(.09,.28,.29),red,head)
uv('Top red spot',(0,0,3.27),(.27,.28,.05),red,head)
'''
variants = {
 'Luigi': PREFIX.replace("'#E92332'","'#26A94C'").replace("'#B51425'","'#157235'").replace("'Mario_Root'","'Luigi_Root'").replace("[(-.135,-.507,3.16),(-.10,-.514,3.34),(0,-.516,3.23),(.10,-.514,3.34),(.135,-.507,3.16)]", "[(-.08,-.514,3.35),(-.08,-.516,3.16),(.11,-.507,3.16)]") + '\nroot.scale=(.88,.92,1.13)\n',
 'Wario': PREFIX.replace("'#E92332'","'#F5CF24'").replace("'#B51425'","'#C38F17'").replace("'#154DAF'","'#7543A3'").replace("'#F4B27A'","'#F2AD8D'").replace("'Mario_Root'","'Wario_Root'").replace("[(-.135,-.507,3.16),(-.10,-.514,3.34),(0,-.516,3.23),(.10,-.514,3.34),(.135,-.507,3.16)]", "[(-.15,-.507,3.35),(-.09,-.514,3.16),(0,-.516,3.27),(.09,-.514,3.16),(.15,-.507,3.35)]").replace("],.029,red,head)","],.029,blue,head)") + '\nroot.scale=(1.18,1.08,1.02)\n',
 'Toad': HELPERS + TOAD,
}
manifest={}
for name, code in variants.items():
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=False)
    ns={'__file__':str(BASE/'blender/create_mario.py')};exec(compile(code, name, 'exec'),ns)
    bpy=ns['bpy'];character=ns['character'];character.name=name+' • Character'
    for pivot in [o for o in character.objects if o.type=='EMPTY']:
        buckets={}
        for o in list(pivot.children):
            if o.type=='MESH':buckets.setdefault(o.data.materials[0].name,[]).append(o)
        for material,objects in buckets.items():
            bpy.ops.object.select_all(action='DESELECT')
            for o in objects:o.select_set(True)
            bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=pivot.name+' • '+material
    bpy.ops.object.select_all(action='DESELECT')
    for o in character.objects:o.select_set(True)
    out=BASE/'cocos/assets/resources/characters';out.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out/(name+'.gltf')),export_format='GLTF_SEPARATE',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
    bpy.ops.export_scene.gltf(filepath=str(BASE/'blender'/(name+'.glb')),export_format='GLB',use_selection=True,export_animations=False)
    bpy.ops.wm.save_as_mainfile(filepath=str(BASE/'blender'/(name+'.blend')))
    manifest[name]={'meshes':sum(o.type=='MESH' for o in character.objects),'vertices':sum(len(o.data.vertices) for o in character.objects if o.type=='MESH')}
(BASE/'blender/cast-info.json').write_text(json.dumps(manifest,indent=2));print('CAST_COMPLETE',manifest)
