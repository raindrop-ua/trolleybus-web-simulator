"""Repeatable geometry-review cameras and studio; excluded from runtime GLB."""
import bpy
from mathutils import Vector
from .geometry import box, material, xyz


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
    box('studio-ground', (200, .05, 200), (0, -.04, 0), ground, None, coll)
    for name, location, energy, size in [('key', (-6, 10, 9), 2100, 8), ('fill', (7, 6, 3), 1400, 7), ('rim', (0, 9, -8), 1900, 6)]:
        data = bpy.data.lights.new('studio-' + name, 'AREA')
        data.energy, data.shape, data.size = energy, 'DISK', size
        obj = bpy.data.objects.new('studio-' + name, data)
        coll.objects.link(obj)
        obj.location = xyz(location)
        obj.rotation_euler = (Vector(xyz((0, 1.6, 0))) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    cameras = {}
    for name, location, target, scale, resolution in [
        ('front', (0, 3.0, 24), (0, 3.0, 0), 7.3, (1100, 1300)),
        ('side', (-24, 3.0, -.9), (0, 3.0, -.9), 17.5, (1800, 800)),
        ('rear', (0, 3.0, -24), (0, 3.0, 0), 7.3, (1100, 1300)),
        ('isometric', (-15, 10, 19), (0, 2.65, -.6), 16.8, (1500, 1050)),
    ]:
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
    defaults = {'front': (1100, 1300), 'side': (1800, 800), 'rear': (1100, 1300), 'isometric': (1500, 1050)}
    return {name: (bpy.data.objects['review-' + name], tuple(bpy.data.objects['review-' + name].get('preview_resolution', size)))
            for name, size in defaults.items()}


def render_previews(cameras, output, quick=False):
    output.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    if quick:
        scene.cycles.samples = 12
    for name, (camera, resolution) in cameras.items():
        scene.camera = camera
        scene.render.resolution_x, scene.render.resolution_y = resolution
        scene.render.resolution_percentage = 65 if quick else 100
        scene.render.filepath = str(output / f'{name}.png')
        bpy.ops.render.render(write_still=True)
        print(f'PREVIEW_COMPLETE {name}', flush=True)
    scene.camera = cameras['isometric'][0]
