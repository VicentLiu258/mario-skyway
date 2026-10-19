"""Original Cloudpost Dash cast. All geometry and materials are made here.

Run with Blender 3.6+ / 4.x: blender --background --python create_couriers.py
Blender front is -Y; glTF export converts it to +Z with +Y up. The seven
rigid pivots match the game's procedural run / jump / seated slide animation.
No external models, textures, fonts, or source character files are loaded.
"""
from pathlib import Path
import bpy
import json
import math
import sys
from mathutils import Vector

BASE = Path(__file__).resolve().parents[1]
EXPORT = BASE / 'cocos/assets/resources/couriers'
PREVIEWS = BASE / 'previews'
for folder in (EXPORT, PREVIEWS):
    folder.mkdir(parents=True, exist_ok=True)

PALETTES = {
    'Pip': {'main':'EF8A38', 'light':'FFE6B8', 'dark':'A4522B', 'accent':'2A868A', 'strap':'244B58', 'soft':'EDB5A1'},
    'Moss': {'main':'43AA91', 'light':'C7E9AE', 'dark':'24736C', 'accent':'EDBB4B', 'strap':'655344', 'soft':'EF9676'},
    'Kite': {'main':'5DAFDF', 'light':'E0F1F5', 'dark':'397CA9', 'accent':'F0A34D', 'strap':'344E77', 'soft':'B5D5EF'},
    'Rook': {'main':'8C79D6', 'light':'D8D2F1', 'dark':'514F87', 'accent':'72E4CA', 'strap':'303A57', 'soft':'B4A6E5'},
}

def color(hex_value):
    c = [int(hex_value[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(((v + .055)/1.055)**2.4 if v > .04045 else v/12.92 for v in c) + (1,)

def material(name, hex_value, metallic=0, rough=.48):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color(hex_value)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color(hex_value)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metallic
    return mat

def parent_world(obj, parent):
    if parent:
        matrix = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = matrix
    return obj

def pivot(name, loc, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = 'PLAIN_AXES'
    obj.empty_display_size = .14
    obj.location = loc
    bpy.context.view_layer.update()
    return parent_world(obj, parent)

def finish(obj, name, mat, parent):
    obj.name = name
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    bpy.context.view_layer.update()
    return parent_world(obj, parent)

def ellipsoid(name, loc, scale, mat, parent, angle=(0,0,0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    obj.rotation_euler = tuple(math.radians(v) for v in angle)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, parent)

def box(name, loc, scale, mat, parent, radius=.1, angle=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    obj.rotation_euler = tuple(math.radians(v) for v in angle)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
    bevel.width = radius
    bevel.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    weighted = obj.modifiers.new('Corner normals', 'WEIGHTED_NORMAL')
    weighted.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=weighted.name)
    return finish(obj, name, mat, parent)

def rod(name, start, end, width, mat, parent):
    mid = (Vector(start) + Vector(end)) / 2
    direction = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=width, depth=direction.length, location=mid)
    obj = bpy.context.object
    obj.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    return finish(obj, name, mat, parent)

def curve(name, pts, thickness, mat, parent):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = thickness
    data.bevel_resolution = 2
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(pts)-1)
    for p, co in zip(spline.bezier_points, pts):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    bpy.context.view_layer.update()
    return parent_world(obj, parent)

def eye(name, x, y, z, radius, palette, head, white=False):
    if white:
        ellipsoid(name+' sclera', (x,y,z), (radius*1.32,.066,radius*1.45), palette['ivory'], head)
        y -= .055
    ellipsoid(name+' pupil', (x,y,z), (radius*.62,.035,radius), palette['ink'], head)
    ellipsoid(name+' glint', (x-radius*.18,y-.033,z+radius*.32), (radius*.20,.013,radius*.26), palette['ivory'], head)

def mailbag(p, body, x=.36, y=.02, z=1.19, robot=False):
    # Original folded-envelope symbol, deliberately no letters or franchise marks.
    box('Courier satchel', (x,y,z), (.45,.43,.48), p['accent'], body, .09)
    box('Satchel flap', (x,y-.227,z+.08), (.40,.045,.22), p['light'], body, .055)
    curve('Envelope fold', [(x-.15,y-.254,z+.17),(x,y-.262,z+.055),(x+.15,y-.254,z+.17)], .014, p['strap'], body)
    ellipsoid('Satchel clasp', (x,y-.267,z-.005), (.04,.018,.04), p['strap'], body)
    # The strap follows the body so it cannot float during the seated slide.
    curve('Diagonal delivery strap', [(-.27,-.226,1.73),(-.06,-.321,1.5),(.18,-.328,1.23),(x,-.234,z+.17)], .037, p['strap'], body)

def build(name):
    p = {k:material(name+' / '+k,v, .25 if name=='Rook' and k in ('dark','main') else 0) for k,v in PALETTES[name].items()}
    p['ink'] = material(name+' / midnight','1A293E')
    p['ivory'] = material(name+' / highlight','FFFFFF', rough=.3)
    root = pivot(name+'_Root',(0,0,0))
    body = pivot('Body',(0,0,1.08),root)
    head = pivot('Head',(0,0,1.79),body)
    arms = {s:pivot('Arm_L' if s<0 else 'Arm_R',(s*.39,0,1.63),body) for s in (-1,1)}
    legs = {s:pivot('Leg_L' if s<0 else 'Leg_R',(s*.22,0,.82),root) for s in (-1,1)}
    if name == 'Pip':
        ellipsoid('Rabbit jacket torso',(0,.015,1.34),(.39,.27,.53),p['main'],body)
        ellipsoid('Warm cream chest',(0,-.245,1.39),(.26,.047,.31),p['light'],body)
        ellipsoid('Round tail',(0,.31,1.00),(.17,.17,.17),p['light'],body)
        ellipsoid('Rabbit head',(0,-.015,2.09),(.38,.30,.36),p['main'],head)
        ellipsoid('Soft muzzle',(0,-.283,1.99),(.25,.085,.15),p['light'],head)
        ellipsoid('Tiny nose',(0,-.372,2.08),(.063,.042,.048),p['dark'],head)
        curve('Rabbit smile',[(-.085,-.359,1.975),(0,-.377,1.95),(.085,-.359,1.975)],.012,p['dark'],head)
        for s in (-1,1):
            ellipsoid('Long listening ear',(s*.20,.003,2.59),(.12,.095,.43),p['main'],head,angle=(0,s*-11,0))
            ellipsoid('Velvet ear inset',(s*.20,-.077,2.62),(.057,.026,.29),p['soft'],head,angle=(0,s*-11,0))
            eye('Rabbit eye',s*.145,-.278,2.16,.070,p,head)
            ellipsoid('Rabbit sleeve',(s*.43,.004,1.45),(.145,.16,.29),p['accent'],arms[s])
            ellipsoid('Rabbit paw',(s*.46,-.04,1.15),(.13,.14,.16),p['main'],arms[s])
            ellipsoid('Rabbit leg',(s*.22,0,.58),(.14,.15,.32),p['main'],legs[s])
            ellipsoid('Long rabbit foot',(s*.23,-.13,.18),(.18,.32,.18),p['light'],legs[s])
            ellipsoid('Rabbit ankle cuff',(s*.22,0,.38),(.155,.16,.10),p['accent'],legs[s])
        mailbag(p,body,x=.35,z=1.14)
    elif name == 'Moss':
        ellipsoid('Frog pear body',(0,.015,1.30),(.40,.29,.50),p['main'],body)
        ellipsoid('Frog belly',(0,-.251,1.33),(.27,.05,.34),p['light'],body)
        ellipsoid('Broad frog face',(0,-.015,2.08),(.45,.29,.31),p['main'],head)
        ellipsoid('Frog throat',(0,-.235,1.91),(.30,.10,.12),p['light'],head)
        curve('Wide frog smile',[(-.28,-.278,2.04),(0,-.324,1.98),(.28,-.278,2.04)],.016,p['dark'],head)
        # Two tall eye lobes give Moss a distinct frog silhouette at runner distance.
        for s in (-1,1):
            ellipsoid('Raised frog eye',(s*.285,.001,2.44),(.19,.19,.245),p['main'],head)
            eye('Frog eye',s*.285,-.173,2.46,.108,p,head,white=True)
            ellipsoid('Cheek dot',(s*.30,-.253,2.08),(.055,.015,.035),p['soft'],head)
            ellipsoid('Frog arm',(s*.46,.018,1.38),(.12,.13,.30),p['main'],arms[s],angle=(0,s*-8,0))
            ellipsoid('Frog hand',(s*.50,-.05,1.10),(.15,.13,.10),p['light'],arms[s])
            for n in (-1,0,1):
                ellipsoid('Frog fingertip',(s*.50+n*.075,-.126,1.07),(.043,.07,.045),p['main'],arms[s])
            ellipsoid('Powerful frog thigh',(s*.23,.035,.66),(.19,.20,.28),p['dark'],legs[s])
            ellipsoid('Frog shin',(s*.23,-.008,.39),(.12,.12,.22),p['main'],legs[s])
            ellipsoid('Webbed foot',(s*.25,-.13,.145),(.23,.29,.145),p['light'],legs[s])
            for n in (-1,0,1):
                ellipsoid('Frog toe',(s*.25+n*.115,-.335,.105),(.072,.13,.08),p['main'],legs[s])
        curve('Light neck scarf',[(-.26,-.13,1.80),(0,-.255,1.76),(.25,-.14,1.80)],.068,p['soft'],body)
        box('Scarf tail',(-.28,.16,1.69),(.14,.30,.055),p['soft'],body,.025,angle=(0,-20,15))
        mailbag(p,body,x=.37,z=1.16)
    elif name == 'Kite':
        ellipsoid('Bird body',(0,.015,1.32),(.37,.28,.51),p['main'],body)
        ellipsoid('Bird breast',(0,-.25,1.35),(.27,.05,.35),p['light'],body)
        ellipsoid('Bird head',(0,-.01,2.10),(.365,.30,.355),p['main'],head)
        ellipsoid('Bird face patch',(0,-.263,2.10),(.26,.056,.24),p['light'],head)
        ellipsoid('Compact beak',(0,-.373,2.04),(.135,.16,.078),p['accent'],head)
        curve('Beak crease',[(-.107,-.426,2.035),(0,-.507,2.018),(.107,-.426,2.035)],.010,p['dark'],head)
        for s in (-1,1):
            eye('Bird eye',s*.14,-.318,2.20,.069,p,head)
            ellipsoid('Wing',(s*.44,.01,1.40),(.15,.19,.35),p['dark'],arms[s],angle=(0,s*12,0))
            for feather in range(3):
                ellipsoid('Wing feather',(s*(.40+feather*.048),-.12,1.23+feather*.015),(.04,.08,.17),p['main'],arms[s],angle=(0,s*12,0))
            rod('Bird leg',(s*.19,0,.83),(s*.19,-.01,.25),.075,p['accent'],legs[s])
            ellipsoid('Bird ankle',(s*.19,-.01,.27),(.105,.10,.12),p['accent'],legs[s])
            for n in (-1,0,1):
                ellipsoid('Bird toe',(s*.19+n*.075,-.14,.08),(.051,.24,.08),p['accent'],legs[s],angle=(0,0,n*10))
        for x,z in [(-.105,2.49),(.015,2.57),(.105,2.49)]:
            ellipsoid('Crest feather',(x,.045,z),(.06,.10,.18),p['dark'],head,angle=(-20,0,-x*80))
        for s in (-1,0,1):
            ellipsoid('Tail feather',(s*.10,.29,1.13),(.08,.18,.12),p['dark'],body,angle=(-22,0,s*12))
        mailbag(p,body,x=.33,z=1.13)
    else:
        box('Robot chest shell',(0,0,1.35),(.69,.49,.73),p['main'],body,.16)
        box('Robot chest inset',(0,-.258,1.39),(.43,.047,.41),p['strap'],body,.08)
        # Three original battery pips, no alphabetic character or brand emblem.
        for i in range(3):
            box('Charge pip',(-.12+i*.12,-.29,1.40),(.061,.024,.17),p['accent'],body,.022)
        rod('Neck socket',(0,0,1.66),(0,0,1.86),.13,p['dark'],body)
        box('Robot head',(0,0,2.13),(.77,.53,.58),p['main'],head,.17)
        box('Face screen',(0,-.284,2.15),(.59,.045,.32),p['strap'],head,.09)
        for s in (-1,1):
            box('Friendly LED eye',(s*.14,-.316,2.17),(.115,.018,.103),p['accent'],head,.034)
            rod('Ear hinge',(s*.35,0,2.12),(s*.45,0,2.12),.095,p['dark'],head)
            box('Ear receiver',(s*.45,0,2.12),(.12,.26,.24),p['light'],head,.05)
            ellipsoid('Shoulder joint',(s*.39,0,1.62),(.115,.115,.115),p['dark'],arms[s])
            box('Upper arm shell',(s*.46,0,1.42),(.20,.24,.34),p['light'],arms[s],.065)
            ellipsoid('Wrist joint',(s*.46,0,1.20),(.095,.095,.095),p['dark'],arms[s])
            box('Robot mitten',(s*.46,-.025,1.10),(.24,.25,.22),p['main'],arms[s],.07)
            ellipsoid('Hip bearing',(s*.22,0,.80),(.13,.13,.13),p['dark'],legs[s])
            box('Robot shin',(s*.22,.015,.53),(.23,.25,.40),p['light'],legs[s],.065)
            box('Robot foot',(s*.23,-.10,.15),(.32,.42,.30),p['dark'],legs[s],.095)
            box('Foot tread stripe',(s*.23,-.299,.15),(.22,.027,.06),p['accent'],legs[s],.018)
        rod('Antenna stem',(0,.03,2.40),(0,.03,2.64),.027,p['dark'],head)
        ellipsoid('Antenna beacon',(0,.03,2.69),(.075,.075,.075),p['accent'],head)
        box('Postal power pack',(0,.32,1.36),(.49,.25,.55),p['dark'],body,.10)
        box('Pack handle',(0,.33,1.68),(.27,.10,.10),p['light'],body,.04)
        mailbag(p,body,x=.38,z=1.14,robot=True)
    bpy.context.view_layer.update()
    # Consolidate each rigid part. Materials stay editable and no armature is needed.
    descendants = list(root.children_recursive)
    for parent in [root]+[o for o in descendants if o.type=='EMPTY']:
        meshes = [o for o in parent.children if o.type=='MESH']
        if not meshes:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in meshes:
            obj.select_set(True)
        bpy.context.view_layer.objects.active=meshes[0]
        bpy.ops.object.join()
        meshes[0].name=parent.name+' geometry'
    return root

def studio():
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=40
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1800
    scene.render.resolution_y=900
    scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    if scene.world is None:
        scene.world=bpy.data.worlds.new('Soft studio world')
    scene.world.color=(.3,.3,.3)
    ground=material('Studio / mist','E7ECF4',rough=.8)
    bpy.ops.mesh.primitive_plane_add(size=200)
    bpy.context.object.name='Studio floor (not exported)'
    bpy.context.object.data.materials.append(ground)
    for name,loc,power,size in [('Key',(-3,-6,9),1800,7),('Rim',(4,3,7),2200,6),('Fill',(6,-3,5),1300,6)]:
        data=bpy.data.lights.new(name,'AREA')
        data.energy=power
        data.shape='DISK'
        data.size=size
        light=bpy.data.objects.new(name,data)
        bpy.context.collection.objects.link(light)
        light.location=loc
        light.rotation_euler=(Vector((0,0,1.3))-light.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Studio camera')
    camera=bpy.data.objects.new('Studio camera',data)
    bpy.context.collection.objects.link(camera)
    camera.location=(4.2,-16,6.8)
    camera.rotation_euler=(Vector((0,0,1.4))-camera.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO'
    data.ortho_scale=12.8
    scene.camera=camera
    scene.render.image_settings.file_format='PNG'
    return scene

def render_slides(scene, info):
    """Exercise the same unscaled rigid slide pose as the Cocos controller."""
    for name in PALETTES:
        root=bpy.data.objects[name+'_Root']
        pivots={o.name.split('.')[0]:o for o in root.children_recursive if o.type=='EMPTY'}
        body=pivots['Body']
        body.location.z *= .50
        body.rotation_euler.x=math.radians(-82)
        pivots['Head'].rotation_euler.x=math.radians(8)
        for side,rx,rz in [('L',-86,-5),('R',-78,8)]:
            leg=pivots['Leg_'+side]
            leg.location.z *= 1-.48*(.8 if leg.location.z<.8 else 1)
            leg.rotation_euler=(math.radians(rx),math.radians(-rz),0)
            arm=pivots['Arm_'+side]
            arm.rotation_euler=(math.radians(22),math.radians(-14 if side=='L' else 14),0)
        bpy.context.view_layer.update()
        points=[o.matrix_world @ v.co for o in root.children_recursive if o.type=='MESH' for v in o.data.vertices]
        info[name]['slideHeight']=round(max(p.z for p in points),4)
        info[name]['slideFloorClearance']=round(min(p.z for p in points),4)
        assert info[name]['slideFloorClearance']>=-.03, (name,'slide intersects ground')
        assert all(tuple(o.scale)==(1,1,1) for o in [root]+list(pivots.values())), (name,'slide must not squash scale')
    for obj in bpy.data.objects:
        if obj.name.startswith('Studio label'):
            obj.location.z=2.25
    scene.camera.location=(4.2,-16,6.8)
    scene.camera.rotation_euler=(Vector((0,0,.8))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(PREVIEWS/'cloudpost-couriers-slide.png')
    bpy.ops.render.render(write_still=True)
    (BASE/'blender'/'couriers-info.json').write_text(json.dumps(info,indent=2)+'\n')

if '--poses-only' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(BASE/'blender'/'Cloudpost_Cast.blend'))
    render_slides(bpy.context.scene,json.loads((BASE/'blender'/'couriers-info.json').read_text()))
    print('SLIDE_POSES_VERIFIED',flush=True)
    raise SystemExit(0)

manifest={}
for name in PALETTES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    root=build(name)
    bpy.context.view_layer.update()
    objects=[root]+list(root.children_recursive)
    meshes=[o for o in objects if o.type=='MESH']
    points=[o.matrix_world @ Vector(corner) for o in meshes for corner in o.bound_box]
    minimum=[min(p[i] for p in points) for i in range(3)]
    maximum=[max(p[i] for p in points) for i in range(3)]
    manifest[name]={
        'vertices':sum(len(o.data.vertices) for o in meshes),
        'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),
        'meshes':len(meshes),
        'gltfBoundsMin':[round(minimum[0],4),round(minimum[2],4),round(-maximum[1],4)],
        'gltfBoundsMax':[round(maximum[0],4),round(maximum[2],4),round(-minimum[1],4)],
        'pivots':{o.name:[round(v,4) for v in (o.location.x,o.location.z,-o.location.y)] for o in objects if o.type=='EMPTY'},
        'forward':'+Z','up':'+Y','source':'Created from procedural primitives in create_couriers.py',
    }
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=root
    options={'use_selection':True,'export_animations':False,'export_cameras':False,'export_lights':False,'export_yup':True}
    bpy.ops.export_scene.gltf(filepath=str(EXPORT/(name+'.gltf')),export_format='GLTF_SEPARATE',**options)
    bpy.ops.export_scene.gltf(filepath=str(BASE/'blender'/(name+'.glb')),export_format='GLB',**options)
    scene=studio()
    scene.camera.location=(4,-7,4)
    scene.camera.rotation_euler=(Vector((0,0,1.4))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera.data.ortho_scale=4.4
    scene.render.resolution_x=1000
    scene.render.resolution_y=1000
    bpy.ops.wm.save_as_mainfile(filepath=str(BASE/'blender'/(name+'.blend')))
    print('CHARACTER_EXPORTED',name,manifest[name],flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
for i,name in enumerate(PALETTES):
    root=build(name)
    root.location.x=-4.05+i*2.7
    root.rotation_euler.z=math.radians(-8 if i==0 else 2 if i==1 else 7)
scene=studio()
labelmat=material('Studio / ink','34435F',rough=.8)
for i,name in enumerate(PALETTES):
    bpy.ops.object.text_add(location=(-4.05+i*2.7,-.65,3.38),rotation=(math.radians(74),0,0))
    text=bpy.context.object
    text.name='Studio label '+name
    text.data.body=name.upper()
    text.data.size=.27
    text.data.align_x='CENTER'
    text.data.extrude=.001
    text.data.materials.append(labelmat)
scene.render.filepath=str(PREVIEWS/'cloudpost-couriers.png')
bpy.ops.wm.save_as_mainfile(filepath=str(BASE/'blender'/'Cloudpost_Cast.blend'))
bpy.ops.render.render(write_still=True)
(BASE/'blender'/'couriers-info.json').write_text(json.dumps(manifest,indent=2)+'\n')
render_slides(scene,manifest)
print('COURIERS_COMPLETE',json.dumps(manifest),flush=True)
