"""Export a temporary copy, keeping the editable source modular and all pivots intact."""
import json
import bpy
from mathutils import Vector


def export_glb(root, filepath, cfg, manifest_path):
    scene = bpy.context.scene
    temporary = bpy.data.collections.new('EXPORT_TEMPORARY')
    scene.collection.children.link(temporary)
    original = [root] + list(root.children_recursive)
    copies = {}
    for source in original:
        obj = source.copy()
        if source.data:
            obj.data = source.data.copy()
        temporary.objects.link(obj)
        copies[source] = obj
    for source, obj in copies.items():
        obj.parent = copies.get(source.parent)
        obj.name = '__EXPORT__' + source.name
    bpy.context.view_layer.update()
    # Apply bevels and join static meshes by parent + material. Dynamic empty
    # pivots remain explicit nodes; no optimizer may flatten those contracts.
    batches = {}
    for source, obj in copies.items():
        if obj.type != 'MESH':
            continue
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        material = obj.data.materials[0].name if obj.data.materials else 'none'
        batches.setdefault((obj.parent, material), []).append(obj)
    for (parent, material), batch in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in batch:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = batch[0]
        if len(batch) > 1:
            bpy.ops.object.join()
        batch[0].name = '__EXPORT__' + (parent.name.replace('__EXPORT__', '') if parent else 'root') + '--' + material
    # Original names must be restored verbatim in the GLB, not Blender's .001 suffixes.
    source_names = {}
    for source in original:
        source_names[source] = source.name
        source.name = '__SOURCE__' + source.name
    for obj in list(temporary.objects):
        obj.name = obj.name.replace('__EXPORT__', '')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in temporary.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = copies[root]
    filepath.parent.mkdir(parents=True, exist_ok=True)
    try:
        bpy.ops.export_scene.gltf(filepath=str(filepath), export_format='GLB', use_selection=True,
            export_yup=True, export_apply=True, export_extras=True, export_animations=False,
            export_cameras=False, export_lights=False, export_image_format='NONE',
            export_texcoords=False, export_materials='EXPORT')
        pivots = {}
        for obj in temporary.objects:
            if obj.type == 'EMPTY':
                p = obj.matrix_world.translation
                pivots[obj.name] = [round(p.x, 7), round(p.z, 7), round(-p.y, 7)]
        manifest = {'schemaVersion': 1, 'stage': cfg.get('stage', 'geometry-review'), 'model': cfg['model'],
                    'units': cfg['units'], 'runtimeAxes': cfg['runtimeAxes'], 'dimensions': cfg,
                    'pivots': pivots, 'textures': 0, 'movingParts': sorted(pivots)}
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    finally:
        for obj in list(temporary.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(temporary)
        for source, name in source_names.items():
            source.name = name
        bpy.ops.object.select_all(action='DESELECT')
        root.select_set(True)
        bpy.context.view_layer.objects.active = root
