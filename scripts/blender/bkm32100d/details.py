"""Gate B: secondary hard-surface detail, glazing, lamps, signage and cabin depth."""
import math
from .geometry import box, cylinder, rod, mesh, xyz
from .materials import uv_rect
from .surfaces import front_z, fascia_panel, half_width


def quad(name, vertices, mat, parent, coll, rect=None):
    obj = mesh(name, vertices, [(0,1,2,3)], mat, parent, coll)
    if rect:
        uv_rect(obj, rect)
    return obj


def ring(name, center, radius, tube, mat, parent, coll, axis='z', segments=24):
    vertices, faces = [], []
    for i in range(segments):
        a = i*math.tau/segments
        for j in range(6):
            b = j*math.tau/6
            r = radius + math.cos(b)*tube
            p = (math.cos(a)*r, math.sin(a)*r, math.sin(b)*tube)
            if axis == 'x': p = (p[2],p[0],p[1])
            vertices.append(tuple(center[k]+p[k] for k in range(3)))
    for i in range(segments):
        for j in range(6):
            a=i*6+j;b=i*6+(j+1)%6;c=((i+1)%segments)*6+(j+1)%6;d=((i+1)%segments)*6+j
            faces.append((a,b,c,d))
    return mesh(name,vertices,faces,mat,parent,coll,smooth=True)


def build_details(cfg, mats, root, body, coll):
    # Separate transparent covers and internal lamps in the existing shaped recesses.
    for side in (-1,1):
        cover = next(o for o in coll.objects if o.name == f'headlamp-review-cover-{side}')
        cover.data.materials[0] = mats['lamp_glass']
        for vertex in cover.data.vertices: vertex.co.y -= .024
        for index in range(3):
            x, y = side*.88+(index-1)*.13, .63
            z = front_z(x,y)+.032
            cylinder(f'headlamp-reflector-{side}-{index}',.052,.013,(x,y,z),mats['metal'],body,coll,axis='z',segments=20)
            cylinder(f'headlamp-projector-{side}-{index}',.036,.017,(x,y,z+.009),mats['lamp'],body,coll,axis='z',segments=16)
        fascia_panel(f'front-indicator-housing-{side}',side*1.16,.095,.065,1.12,mats['amber'],body,coll,.025)
        for z in (-4.98,-1.65,1.70,3.96):
            box(f'side-marker-{side}-{z}',(.024,.065,.12),(side*1.288,.72,z),mats['amber'],body,coll,.012)
        # Panel recesses remain geometry; tiny printed service labels live in the atlas.
        for z0,z1,y0,y1 in [(-5.7,-5.05,.48,1.28),(-2.05,-.87,.50,1.30),(.92,2.25,.5,1.3)]:
            x=side*(half_width(.9)+.006)
            for a,b in [((x,y0,z0),(x,y1,z0)),((x,y1,z0),(x,y1,z1)),((x,y1,z1),(x,y0,z1)),((x,y0,z1),(x,y0,z0))]:
                rod(f'service-panel-seam-{side}-{z0}-{a}',a,b,.0035,mats['trim'],body,coll,segments=6)
            box(f'service-panel-handle-{side}-{z0}',(.012,.025,.11),(x,y1-.09,z1-.13),mats['metal'],body,coll,.004)
        for row in range(7):
            z=-6.039
            rod(f'rear-low-cooling-slot-{side}-{row}',(side*.46,.54+row*.058,z),(side*.89,.66+row*.058,z),.013,mats['trim'],body,coll,segments=6)
        for y in (2.72,2.92):
            cylinder(f'rear-top-marker-{side}-{y}',.033,.019,(side*1.12,y,-5.972),mats['brake'] if y>2.8 else mats['amber'],body,coll,axis='z',segments=12)
    # The orange display is an actual emissive PNG, with a curved face over the windshield.
    vertices = [(-.89,2.46,5.967),(.89,2.46,5.967),(.89,2.72,5.967),(-.89,2.72,5.967)]
    quad('display-front-emissive-face',vertices,mats['display'],body,coll,(0,1536,1024,256))
    quad('display-rear-emissive-face',[(-.47,2.30,-6.075),(-.85,2.30,-6.075),(-.85,2.60,-6.075),(-.47,2.60,-6.075)],mats['display'],body,coll,(1024,1536,512,256))
    quad('display-side-emissive-face',[(-1.304,2.48,-3.35),(-1.304,2.48,-1.95),(-1.304,2.69,-1.95),(-1.304,2.69,-3.35)],mats['display'],body,coll,(0,1536,1024,256))
    # Fleet number is its own small transparent material, allowing per-instance labels.
    for side in (-1,1):
        x=side*1.294
        vertices=[(x,1.17,3.82),(x,1.17,3.35),(x,1.36,3.35),(x,1.36,3.82)]
        if side<0: vertices=[(x,1.17,3.35),(x,1.17,3.82),(x,1.36,3.82),(x,1.36,3.35)]
        quad(f'fleet-number-side-{side}',vertices,mats['number'],body,coll,(0,0,2048,2048))
    vertices, faces = [], []
    for row in range(2):
        for column in range(13):
            x,y=.45+column/12*.54,.92+row*.155
            vertices.append((x,y,front_z(x,y)+.018))
            if row==0 and column<12: faces.append((column,column+1,column+14,column+13))
    obj=mesh('fleet-number-front',vertices,faces,mats['number'],body,coll)
    uv=obj.data.uv_layers.new(name='UVMap')
    for loop in obj.data.loops:
        index=loop.vertex_index
        uv.data[loop.index].uv=(index%13/12,index//13)
    quad('fleet-number-rear',[(-.43,1.39,-6.031),(-1.0,1.39,-6.031),(-1.0,1.59,-6.031),(-.43,1.59,-6.031)],mats['number'],body,coll,(0,0,2048,2048))
    # Fastener/return springs follow the named moving pole aim, never baked contact positions.
    for side_name in ('left','right'):
        aim=next(o for o in root.children_recursive if o.name==f'pole-{side_name}-aim')
        for sign in (-1,1):
            vertices,faces=[],[]
            for i in range(121):
                a=i*math.tau/12
                for j in range(5):
                    b=j*math.tau/5;r=.031+.006*math.cos(b)
                    vertices.append((sign*.085+math.cos(a)*r,.035+i/12*.012+.006*math.sin(b),math.sin(a)*r))
                if i<120:
                    for j in range(5):
                        k=i*5+j;n=i*5+(j+1)%5
                        faces.append((k,n,n+5,k+5))
            mesh(f'pole-return-spring-{side_name}-{sign}',vertices,faces,mats['metal'],aim,coll,smooth=True)
        ring(f'pole-base-bearing-{side_name}',(0,.018,0),.09,.014,mats['metal'],aim,coll,axis='z')
    for side in (-1,1):
        for index,z in enumerate((-4.0,-1.0,1.25,3.5)):
            if side<0 and abs(z)<.8: continue
            rod(f'cabin-stanchion-{side}-{index}',(side*.59,.37,z),(side*.59,2.55,z),.017,mats['threshold'],body,coll)
            ring(f'cabin-hanging-grip-{side}-{index}',(side*.60,2.30,z+.18),.065,.010,mats['threshold'],body,coll,axis='x',segments=16)
    ring('driver-steering-wheel',(.55,1.49,5.02),.17,.018,mats['trim'],body,coll)
    box('driver-seat-cushion',(.46,.13,.46),(.57,.87,4.51),mats['seat'],body,coll,.06)
    box('driver-seat-back',(.46,.59,.09),(.57,1.18,4.30),mats['seat'],body,coll,.04)
    for side_name in ('left','right'):
        for axle in ('front','rear'):
            spin=next(o for o in root.children_recursive if o.name==f'wheel-spin-{axle}-{side_name}')
            side=-1 if side_name=='left' else 1
            for i in range(10):
                a=i*math.tau/10
                cylinder(f'wheel-lug-{axle}-{side_name}-{i}',.012,.022,(side*.224,math.sin(a)*.155,math.cos(a)*.155),mats['metal'],spin,coll,axis='x',segments=6)
    # Roof control-box seams, fan grilles and cable runs stay in the native modular source.
    for z in (1.0,2.02,2.77):
        rod(f'roof-equipment-transverse-seam-{z}',(-.83,3.565,z),(.83,3.565,z),.004,mats['trim'],body,coll,segments=6)
    for side in (-1,1):
        box(f'roof-ventilator-frame-{side}',(.32,.05,.68),(side*.72,3.13,-2.62),mats['trim'],body,coll,.025)
        for row in range(9):
            box(f'roof-ventilator-fin-{side}-{row}',(.28,.024,.026),(side*.72,3.168,-2.90+row*.07),mats['metal'],body,coll,.003)
        for z in (-3.1,-4.3):
            rod(f'roof-cable-run-{side}-{z}',(side*.45,3.17,z),(side*.45,3.17,z-.8),.012,mats['rubber'],body,coll)
