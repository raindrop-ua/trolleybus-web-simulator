"""Repeatable geometry-review cameras and studio; excluded from runtime GLB."""
import bpy
from mathutils import Vector
from .geometry import mesh, material, xyz


CAMERA_SPECS = [
    ('front', (0, 3.0, 24), (0, 3.0, 0), 7.3, (1100, 1300)),
    ('side', (-24, 3.0, -.9), (0, 3.0, -.9), 17.5, (1800, 800)),
    ('rear', (0, 3.0, -24), (0, 3.0, 0), 7.3, (1100, 1300)),
    ('isometric', (-15, 10, 19), (0, 2.65, -.6), 16.8, (1500, 1050)),
    ('right', (24, 3.0, -.9), (0, 3.0, -.9), 17.5, (1800, 800)),
    ('front-three-quarter', (-13, 4.8, 19), (0, 2.5, -.4), 16.5, (1500, 1000)),
    ('rear-three-quarter', (-14, 6.5, -19), (0, 2.6, -.8), 16.5, (1500, 1000)),
    ('front-detail', (-4.2, 3.8, 16), (0, 1.95, 5.45), 5.6, (1200, 1100)),
    ('roof-detail', (-9, 12, 12), (0, 3.3, 1.0), 11.3, (1500, 1050)),
]


def build_studio(coll):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 6
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'AgX'
    scene.world.color = (.4, .4, .4)
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value = (.62, .67, .71, 1)
    scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value = .6
    ground = material('studio-ground', '#c4ccd1', .9)
    mesh('studio-ground', [(-100, -.015, -100), (100, -.015, -100),
                          (100, -.015, 100), (-100, -.015, 100)], [(0, 3, 2, 1)], ground, None, coll)
    for name, location, energy, size in [('key', (-6, 10, 9), 2100, 8), ('fill', (7, 6, 3), 1400, 7), ('rim', (0, 9, -8), 1900, 6)]:
        data = bpy.data.lights.new('studio-' + name, 'AREA')
        data.energy, data.shape, data.size = energy, 'DISK', size
        obj = bpy.data.objects.new('studio-' + name, data)
        coll.objects.link(obj)
        obj.location = xyz(location)
        obj.rotation_euler = (Vector(xyz((0, 1.6, 0))) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    cameras = {}
    for name, location, target, scale, resolution in CAMERA_SPECS:
        data = bpy.data.cameras.new('review-' + name)
        data.type, data.ortho_scale, data.lens = 'ORTHO', scale, 50
        obj = bpy.data.objects.new('review-' + name, data)
        coll.objects.link(obj)
        obj.location = xyz(location)
        obj.rotation_euler = (Vector(xyz(target)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
        obj['preview_resolution'] = list(resolution)
        cameras[name] = (obj, resolution)
    scene.camera = cameras['isometric'][0]
    return cameras


def existing_cameras():
    defaults = {name: resolution for name, _, _, _, resolution in CAMERA_SPECS}
    return {name: (bpy.data.objects['review-' + name], tuple(bpy.data.objects['review-' + name].get('preview_resolution', size)))
            for name, size in defaults.items()}


def clay_materials():
    """Temporary neutral material IDs. Export/native materials are restored afterwards."""
    saved = []
    for mat in bpy.data.materials:
        if not mat.name.startswith('review-') or not mat.use_nodes:
            continue
        shader = mat.node_tree.nodes.get('Principled BSDF')
        names = ['Base Color', 'Roughness', 'Metallic', 'Emission Strength']
        values = {name: tuple(shader.inputs[name].default_value) if name == 'Base Color'
                  else shader.inputs[name].default_value for name in names}
        saved.append((mat, tuple(mat.diffuse_color), values))
        value = .43
        if 'glass' in mat.name or 'windshield' in mat.name:
            value = .075
        elif 'black' in mat.name or 'rubber' in mat.name:
            value = .035
        elif 'seat' in mat.name or 'floor' in mat.name:
            value = .14
        shader.inputs['Base Color'].default_value = (value, value, value, values['Base Color'][3])
        shader.inputs['Roughness'].default_value = .62
        shader.inputs['Metallic'].default_value = 0
        shader.inputs['Emission Strength'].default_value = 0
        mat.diffuse_color = shader.inputs['Base Color'].default_value
    return saved


def render_previews(cameras, output, quick=False, clay=True):
    output.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    if quick:
        scene.cycles.samples = 12
    saved = clay_materials() if clay else []
    try:
        for name, (camera, resolution) in cameras.items():
            scene.camera = camera
            scene.render.resolution_x, scene.render.resolution_y = resolution
            scene.render.resolution_percentage = 65 if quick else 100
            scene.render.filepath = str(output / f'{name}.png')
            bpy.ops.render.render(write_still=True)
            print(f'PREVIEW_COMPLETE {name}', flush=True)
    finally:
        for mat, diffuse, values in saved:
            mat.diffuse_color = diffuse
            shader = mat.node_tree.nodes.get('Principled BSDF')
            for name, value in values.items():
                shader.inputs[name].default_value = value
    scene.camera = cameras['isometric'][0]
