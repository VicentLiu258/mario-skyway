"""Blender 5.x: editable Mario toy model, rigid-part run animation and glTF export."""
import bpy, math, os, json
from mathutils import Vector
from math import radians as R

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name != 'Collection': bpy.data.collections.remove(c)
character = bpy.data.collections.get('Collection'); character.name = 'MARIO • Character'
stage = bpy.data.collections.new('STUDIO • Presentation'); bpy.context.scene.collection.children.link(stage)

def mat(name, hexcolor, rough=.4, metal=0):
    h=hexcolor.lstrip('#'); rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]; rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    return m
red=mat('Cap & shirt | vermilion','#E92332'); blue=mat('Overalls | cobalt','#154DAF')
skin=mat('Skin | peach','#F4B27A'); white=mat('Gloves & emblem | ivory','#FFF5E5')
hair=mat('Hair | cocoa','#3D180F'); black=mat('Mustache & pupils','#180C0B')
iris=mat('Iris | azure','#149DE5',.23); shoe=mat('Boot leather','#512510'); sole=mat('Soles','#28150F')
gold=mat('Gold details','#FFBC21',.27,.55); darkred=mat('Cap seam','#B51425')
green=mat('Pipe green','#27AC61'); pink=mat('Inner ears','#DE8759'); mouth=mat('Smile','#552119')

def move_collection(o, col):
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
def finish(o,name,material,parent=None,col=character):
    o.name=name; move_collection(o,col)
    if material: o.data.materials.append(material)
    if parent:
        world=o.matrix_world.copy(); o.parent=parent; o.matrix_world=world
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
    return o
def empty(name,loc,parent=None):
    o=bpy.data.objects.new(name,None); character.objects.link(o); o.location=loc; bpy.context.view_layer.update()
    if parent:
        world=o.matrix_world.copy(); o.parent=parent; o.matrix_world=world
    o.empty_display_size=.18; return o
def uv(name,loc,scale,material,parent=None,col=character,seg=28,rings=18):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc)
    o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,material,parent,col)
def box(name,loc,scale,material,parent=None,col=character,bevel=.08):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Soft tailored edges','BEVEL'); b.width=bevel; b.segments=3
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
        n=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=n.name)
    return finish(o,name,material,parent,col)
def cylinder(name,loc,radius,depth,material,parent=None,col=character):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=depth,location=loc)
    o=bpy.context.object; b=o.modifiers.new('Rounded rim','BEVEL'); b.width=.035; b.segments=3
    bpy.ops.object.modifier_apply(modifier=b.name)
    return finish(o,name,material,parent,col)
def line(name,points,radius,material,parent=None,col=character):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=12;c.bevel_depth=radius;c.bevel_resolution=3
    s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for b,p in zip(s.bezier_points,points):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);col.objects.link(o);c.materials.append(material)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
    if parent:
        w=o.matrix_world.copy();o.parent=parent;o.matrix_world=w
    return o

root=empty('Mario_Root',(0,0,0)); body=empty('Body',(0,0,1.38),root)
uv('Red shirt',(0,0,1.67),(.61,.37,.62),red,body)
uv('Overall seat',(0,-.015,1.23),(.58,.38,.51),blue,body)
box('Overall bib',(0,-.342,1.62),(.67,.105,.62),blue,body,bevel=.1)
for s in (-1,1):
    strap=box('Suspender '+str(s),(s*.36,-.306,1.92),(.16,.1,.59),blue,body,bevel=.045)
    strap.rotation_euler[1]=s*R(-7)
    uv('Brass button',(s*.34,-.418,1.76),(.09,.032,.09),gold,body)
    line('Back strap',[(s*.34,.31,1.4),(s*.33,.36,1.8),(s*.28,.24,2.1)],.066,blue,body)
    leg=empty('Leg_L' if s<0 else 'Leg_R',(s*.30,0,1.03),root)
    uv('Trouser leg',(s*.30,0,.69),(.265,.29,.46),blue,leg)
    uv('Boot sole',(s*.30,-.19,.12),(.30,.47,.12),sole,leg)
    uv('Leather boot',(s*.30,-.20,.25),(.30,.45,.23),shoe,leg)
    line('Boot seam',[(s*.30-.18,-.49,.30),(s*.30,-.57,.32),(s*.30+.18,-.49,.30)],.012,sole,leg)
    arm=empty('Arm_L' if s<0 else 'Arm_R',(s*.53,0,1.93),body)
    uv('Sleeve',(s*.68,-.01,1.70),(.25,.26,.38),red,arm)
    uv('Cuff',(s*.82,-.035,1.43),(.24,.23,.13),white,arm)
    uv('Glove palm',(s*.86,-.07,1.25),(.25,.235,.26),white,arm)
    uv('Glove thumb',(s*.68,-.22,1.28),(.13,.14,.18),white,arm)
    for j in (-1,0,1):
        line('Glove stitch',[(s*.86+j*.065,-.292,1.24),(s*.86+j*.065,-.304,1.34)],.009,sole,arm)

head=empty('Head',(0,0,2.25),body)
uv('Back hair',(0,.10,2.61),(.64,.46,.60),hair,head)
uv('Face',(0,-.085,2.62),(.61,.46,.60),skin,head)
uv('Chin',(0,-.30,2.34),(.42,.28,.28),skin,head)
for s in (-1,1):
    uv('Ear',(s*.60,-.005,2.60),(.18,.17,.25),skin,head)
    uv('Ear inner',(s*.69,-.118,2.60),(.07,.038,.13),pink,head)
    uv('Sideburn',(s*.52,-.13,2.66),(.12,.23,.27),hair,head)
    eye=uv('Eye white',(s*.235,-.475,2.83),(.17,.10,.235),white,head)
    uv('Blue iris',(s*.221,-.566,2.83),(.087,.034,.132),iris,head)
    uv('Pupil',(s*.216,-.596,2.83),(.045,.018,.086),black,head)
    uv('Eye glint',(s*.216-.023,-.615,2.879),(.022,.01,.031),white,head)
    line('Eyebrow',[(s*.09,-.49,3.03),(s*.23,-.51,3.085),(s*.38,-.46,3.03)],.055,hair,head)
line('Smile',[(-.24,-.52,2.35),(0,-.60,2.29),(.24,-.52,2.35)],.027,mouth,head)
uv('Smile tooth',(0,-.606,2.32),(.12,.018,.037),white,head)
for x,z,rz in [(-.34,2.49,.11),(-.22,2.46,.14),(-.075,2.44,.15),(.075,2.44,.15),(.22,2.46,.14),(.34,2.49,.11)]:
    uv('Mustache scallop',(x,-.555,z),(.125,.11,rz),black,head)
uv('Round nose',(0,-.63,2.65),(.25,.245,.215),skin,head)
uv('Cap crown',(0,.015,3.17),(.67,.49,.36),red,head)
uv('Cap band',(0,-.005,3.04),(.65,.455,.12),darkred,head)
uv('Cap visor',(0,-.435,3.075),(.63,.40,.09),red,head)
uv('White cap badge',(0,-.459,3.25),(.217,.042,.201),white,head)
line('M emblem',[(-.135,-.507,3.16),(-.10,-.514,3.34),(0,-.516,3.23),(.10,-.514,3.34),(.135,-.507,3.16)],.029,red,head)
line('Cap center seam',[(0,.45,3.22),(0,.18,3.51),(0,-.12,3.50)],.012,darkred,head)

# Consolidate meshes by rigid pivot and material: editable parts, inexpensive draw calls.
for pivot in [o for o in character.objects if o.type=='EMPTY']:
    buckets={}
    for o in list(pivot.children):
        if o.type=='MESH': buckets.setdefault(o.data.materials[0].name,[]).append(o)
    for material,objects in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
        objects[0].name=pivot.name+' • '+material

# glTF is Y-up and faces +Z. The game animates the named pivot nodes.
bpy.ops.object.select_all(action='DESELECT')
for o in character.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(BASE,'cocos/assets/resources/mario/Mario.gltf'),export_format='GLTF_SEPARATE',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(BASE,'blender/Mario.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)

# A looping, deliberately simple rigid-part run cycle in the editable Blender file.
for name,phase in [('Leg_L',0),('Leg_R',math.pi),('Arm_L',math.pi),('Arm_R',0)]:
    o=bpy.data.objects[name];o.rotation_mode='XYZ'
    for f in range(1,26,3):
        o.rotation_euler.x=math.sin((f-1)/24*math.tau+phase)*R(28 if 'Leg' in name else 32)
        o.keyframe_insert(data_path='rotation_euler',frame=f)
    if o.animation_data and o.animation_data.action: o.animation_data.action.name=name+' | Run loop'
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=25;scene.render.fps=30;scene.frame_set(1)

# Studio scene with a clean floating collectible plinth.
navy=mat('Studio | deep teal','#123E52'); disk=mat('Plinth | cream','#FFE5AC')
brick=mat('Brick | terracotta','#C2653D'); grout=mat('Brick grooves','#773923')
cyan=mat('Plinth edge','#2D7E8B'); cloud=mat('Clouds','#F1FAFF')
cylinder('Display plinth',(0,0,-.13),1.47,.26,disk,col=stage)
cylinder('Display rim',(0,0,-.27),1.53,.12,cyan,col=stage)
box('Studio floor',(0,0,-.39),(200,200,.1),navy,col=stage,bevel=0)
for x,y,z in [(1.6,.65,.25),(-1.7,1.0,.3)]:
    box('Floating brick',(x,y,z),(.67,.67,.65),brick,col=stage,bevel=.04)
    for zz in (-.1,.12):box('Brick mortar',(x,y-.34,z+zz),(.64,.01,.025),grout,col=stage,bevel=0)
    box('Brick join',(x+.12,y-.345,z+.23),(.025,.01,.18),grout,col=stage,bevel=0)
for i in range(3):
    o=cylinder('Floating gold coin',(-1.5-i*.12,-.1,1.55+i*.43),.23,.07,gold,col=stage);o.rotation_euler=(R(75),0,R(-15))
    ring=cylinder('Coin inset',o.location,.17,.075,disk,col=stage);ring.rotation_euler=o.rotation_euler
for x,y,z in [(1.65,.6,.75),(-1.8,1.4,.7)]:
    cylinder('Mushroom stalk',(x,y,z),.13,.36,white,col=stage)
    uv('Mushroom cap',(x,y,z+.19),(.4,.4,.22),red,col=stage)
    for dx,dy in [(-.14,-.16),(.17,-.12),(0,.18)]:uv('Mushroom spot',(x+dx,y+dy,z+.365),(.085,.085,.025),white,col=stage)

world=bpy.data.worlds.new('Studio World');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.32,.40,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.45
def area(name,loc,power,size,color):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;move_collection(o,stage)
    o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color
    o.rotation_euler=(Vector((0,0,1.6))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key | warm softbox',(-3,-4,7),650,5,(1,.83,.65))
area('Fill | sky',(4,-2,4),480,4,(.65,.83,1))
area('Rim | top',(1,4,6),900,3,(1,.94,.8))
bpy.ops.object.camera_add(location=(6.2,-12,6.3));cam=bpy.context.object;move_collection(cam,stage)
cam.rotation_euler=(Vector((0,0,1.65))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=6.4;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.render.filepath=os.path.join(BASE,'previews/Mario-studio.png')
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':a.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE,'blender/Mario.blend'))
stats={'meshes':sum(o.type=='MESH' for o in character.objects),'vertices':sum(len(o.data.vertices) for o in character.objects if o.type=='MESH'),'rig':'Rigid hierarchical pivots: Body, Head, Arm_L/R, Leg_L/R','forward':'glTF +Z; Blender -Y','height':3.55}
open(os.path.join(BASE,'blender/model-info.json'),'w').write(json.dumps(stats,indent=2))
bpy.ops.render.render(write_still=True)
print('MARIO_MODEL_COMPLETE',stats)
