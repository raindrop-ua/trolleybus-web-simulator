"""UV-mapped PNG materials. Generated swatches + deterministic photographic livery.

No image is used to replace silhouette geometry. ORM/normal maps only add restrained grain.
"""
import bpy
import numpy as np
from .geometry import material


def image_file(base, filename, non_color=False):
    image = bpy.data.images.load(str(base / 'textures' / filename), check_existing=True)
    if non_color:
        image.colorspace_settings.name = 'Non-Color'
    image.pack()
    image.filepath = '//../textures/' + filename
    return image


def prepare_surface_maps(base):
    source = image_file(base, 'surfaces-basecolor.png')
    width, height = source.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    source.pixels.foreach_get(pixels)
    pixels = pixels.reshape((height, width, 4))
    luminance = pixels[:, :, :3].mean(axis=2)
    orm = np.ones_like(pixels)
    orm[:, :, 1], orm[:, :, 2] = .65, 0
    # Blender pixels are bottom-up: rubber/alloy occupy the bottom half.
    orm[:height//2, :width//2, 1] = .88
    orm[:height//2, width//2:, 1] = .44
    orm[:height//2, width//2:, 2] = .72
    orm[height//2:, :width//2, 1] = .38
    orm[height//2:, width//2:, 1] = .83
    orm[:, :, 1] += (luminance - .35) * .035
    dy, dx = np.gradient(luminance)
    strength = .25
    normal = np.ones_like(pixels)
    normal[:, :, 0], normal[:, :, 1] = .5 - dx * strength, .5 - dy * strength
    normal[:, :, 2] = 1
    for filename, data in [('surfaces-orm.png', orm), ('surfaces-normal.png', normal)]:
        image = bpy.data.images.new(filename, width, height, alpha=True)
        image.colorspace_settings.name = 'Non-Color'
        image.pixels.foreach_set(data.ravel())
        image.filepath_raw = str(base / 'textures' / filename)
        image.file_format = 'PNG'
        image.save()
        bpy.data.images.remove(image)


def texture_node(mat, image):
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image, node.interpolation, node.extension = image, 'Linear', 'EXTEND'
    return node


def create_materials(base):
    prepare_surface_maps(base)
    mats = {
        'paint': material('review-blue-body', '#ffffff', .38, .10),
        'trim': material('review-black-frames', '#17232c', .52),
        'glass': material('review-side-glass', '#294953', .24, .08, .57),
        'windshield': material('review-windshield', '#344c56', .21, .06, .43),
        'rubber': material('review-tire-rubber', '#ffffff', .88),
        'metal': material('review-wheel-and-hardware', '#ffffff', .44, .72),
        'floor': material('review-floor', '#646969', .9),
        'threshold': material('review-door-threshold', '#e2ba48', .55),
        'insulator': material('review-insulator', '#bfc7bd', .38),
        'seat': material('review-seat-blockout', '#ffffff', .83),
        'lamp': material('review-headlamp', '#f1ead3', .25, .05, emission=.8),
        'brake': material('review-brake-lamp', '#c12d26', .3, emission=.4),
        'amber': material('review-amber-lamp', '#cf7b26', .32),
        'contact': material('review-contact-status', '#9bbcb0', .5, emission=.2),
        'lamp_glass': material('vehicle-lamp-glass', '#dce4df', .16, .05, .24),
        'display': material('vehicle-destination-display', '#ffffff', .65, emission=1.25),
        'number': material('vehicle-fleet-number', '#ffffff', .65, alpha=.999),
    }
    livery = image_file(base, 'livery-basecolor.png')
    for key in ('paint', 'display'):
        mat = mats[key]
        node = texture_node(mat, livery)
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        mat.node_tree.links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
        if key == 'display':
            mat.node_tree.links.new(node.outputs['Color'], bsdf.inputs['Emission Color'])
    albedo = image_file(base, 'surfaces-basecolor.png')
    orm, normal = image_file(base, 'surfaces-orm.png', True), image_file(base, 'surfaces-normal.png', True)
    for key in ('rubber', 'metal', 'seat'):
        mat = mats[key]
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        shader = nodes.get('Principled BSDF')
        links.new(texture_node(mat, albedo).outputs['Color'], shader.inputs['Base Color'])
        separate = nodes.new('ShaderNodeSeparateColor')
        links.new(texture_node(mat, orm).outputs['Color'], separate.inputs['Color'])
        links.new(separate.outputs['Green'], shader.inputs['Roughness'])
        links.new(separate.outputs['Blue'], shader.inputs['Metallic'])
        bump = nodes.new('ShaderNodeNormalMap')
        bump.inputs['Strength'].default_value = .20
        links.new(texture_node(mat, normal).outputs['Color'], bump.inputs['Color'])
        links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    number = mats['number']
    node = texture_node(number, image_file(base, 'fleet-number-2004.png'))
    shader = number.node_tree.nodes.get('Principled BSDF')
    number.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
    number.node_tree.links.new(node.outputs['Alpha'], shader.inputs['Alpha'])
    return mats


def uv_rect(obj, rect):
    """Map a quad's vertex order (bottom-left, bottom-right, top-right, top-left)."""
    x, y, width, height = rect
    coords = [(x, y+height), (x+width, y+height), (x+width, y), (x, y)]
    layer = obj.data.uv_layers.new(name='UVMap')
    for loop in obj.data.loops:
        u, v = coords[loop.vertex_index % 4]
        layer.data[loop.index].uv = (u/2048, 1-v/2048)


def apply_uvs(root, body):
    bpy.context.view_layer.update()
    for obj in root.children_recursive:
        if obj.type != 'MESH' or obj.data.uv_layers or not obj.data.materials:
            continue
        name = obj.data.materials[0].name
        if name not in ('review-blue-body', 'review-tire-rubber', 'review-wheel-and-hardware', 'review-seat-blockout'):
            continue
        layer = obj.data.uv_layers.new(name='UVMap')
        transform = body.matrix_world.inverted() @ obj.matrix_world
        points = [v.co for v in obj.data.vertices]
        minimum = [min(p[i] for p in points) for i in range(3)]
        extent = [max(p[i] for p in points)-minimum[i] for i in range(3)]
        quadrant = {'review-seat-blockout': (.5,.5), 'review-tire-rubber': (0,0), 'review-wheel-and-hardware': (.5,0)}
        for face in obj.data.polygons:
            axes = sorted(range(3), key=lambda axis: abs(face.normal[axis]))[:2]
            for index in face.loop_indices:
                vertex = obj.data.vertices[obj.data.loops[index].vertex_index].co
                if name == 'review-blue-body':
                    p = transform @ vertex
                    x, y, z = p.x, p.z, -p.y
                    exterior_side = obj.name.startswith('body-side-') and face.normal.x * (1 if 'body-side-1-' in obj.name else -1) > .1
                    if exterior_side or 'roof-rear-low-fairing' in obj.name:
                        driver = x > 0
                        u = ((6-z) if driver else (z+6))/12
                        pixel_y = (512 if driver else 0) + max(4,min(508,(3.6-y)/3.3*512))
                        uv = (max(.002,min(.998,u)), 1-pixel_y/2048)
                    elif obj.name == 'front-continuous-sculpted-fascia':
                        uv = ((x+1.275)/2.55*.5, 1-(1024+(1.6-y)/1.3*512)/2048)
                    elif obj.name == 'rear-continuous-rounded-cap':
                        uv = (.5+(1.275-x)/2.55*.5, 1-(1024+(2.79-y)/2.44*512)/2048)
                    else:
                        uv = (.75 + x*.01, .96 + z*.001)
                else:
                    u0, v0 = quadrant[name]
                    uv = tuple((u0 if i == 0 else v0)+.015+.47*(vertex[axis]-minimum[axis])/max(.001,extent[axis]) for i,axis in enumerate(axes))
                layer.data[index].uv = uv
