"""Non-destructive master/gameplay/distant exports; named motion pivots survive every LOD."""
import json
import bpy

DISTANT_OMIT = ('pole-return-spring-', 'wheel-lug-', 'service-panel-', 'roof-equipment-transverse-seam-',
                'roof-ventilator-fin-', 'roof-cable-run-', 'cabin-', 'seat-', 'ceiling-', 'driver-',
                'rear-side-louver-', 'rear-radiator-slat-', 'rear-low-cooling-slot-')


def export_glb(root, filepath, cfg, manifest_path=None, levels=(1, 2)):
    temporary = bpy.data.collections.new('EXPORT_TEMPORARY')
    bpy.context.scene.collection.children.link(temporary)
    original = [root] + list(root.children_recursive)
    copies, source_names = {}, {}
    try:
        # One shared moving hierarchy. Only visual meshes have alternative LODs.
        for source in original:
            if source.type != 'EMPTY': continue
            obj = source.copy()
            temporary.objects.link(obj)
            copies[source] = obj
        for source, obj in copies.items():
            obj.parent = copies.get(source.parent)
            obj.name = '__EXPORT__' + source.name
        batches = {}
        for level in levels:
            for source in original:
                if source.type != 'MESH' or (level == 2 and source.name.startswith(DISTANT_OMIT)): continue
                obj = source.copy()
                obj.data = source.data.copy()
                temporary.objects.link(obj)
                obj.parent = copies[source.parent]
                obj['lod_level'] = level
                bpy.ops.object.select_all(action='DESELECT')
                obj.select_set(True)
                bpy.context.view_layer.objects.active = obj
                for modifier in list(obj.modifiers):
                    if modifier.type == 'BEVEL' and level > 0:
                        modifier.segments = 2 if level == 1 else 1
                    bpy.ops.object.modifier_apply(modifier=modifier.name)
                # Keep primary surfaces/UV graphics intact. Reduce rounded hardware only.
                if level > 0 and len(obj.data.polygons) > 90 and not source.name.startswith(('body-', 'front-', 'windshield-', 'roof-front-', 'roof-enclosed-', 'rear-continuous-', 'display-', 'fleet-')):
                    modifier = obj.modifiers.new('Export-only hardware simplification', 'DECIMATE')
                    modifier.ratio = .72 if level == 1 else .30
                    modifier.use_collapse_triangulate = True
                    bpy.ops.object.modifier_apply(modifier=modifier.name)
                material = obj.data.materials[0].name if obj.data.materials else 'none'
                batches.setdefault((obj.parent, material, level), []).append(obj)
        for (parent, material, level), batch in batches.items():
            bpy.ops.object.select_all(action='DESELECT')
            for obj in batch: obj.select_set(True)
            bpy.context.view_layer.objects.active = batch[0]
            if len(batch)>1: bpy.ops.object.join()
            batch[0].name = '__EXPORT__' + parent.name.replace('__EXPORT__','') + '--' + material + f'--lod{level}'
            batch[0]['lod_level'] = level
            # Explicit triangles give the exporter a portable tangent basis for normal maps.
            triangulate=batch[0].modifiers.new('Export-only triangulation','TRIANGULATE')
            bpy.ops.object.modifier_apply(modifier=triangulate.name)
        for source in original:
            source_names[source] = source.name
            source.name = '__SOURCE__' + source.name
        for obj in temporary.objects: obj.name = obj.name.replace('__EXPORT__','')
        bpy.ops.object.select_all(action='DESELECT')
        for obj in temporary.objects: obj.select_set(True)
        bpy.context.view_layer.objects.active = copies[root]
        filepath.parent.mkdir(parents=True,exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=str(filepath), export_format='GLB', use_selection=True,
            export_yup=True, export_apply=True, export_extras=True, export_animations=False,
            export_cameras=False, export_lights=False, export_image_format='AUTO',
            export_texcoords=True, export_tangents=True, export_materials='EXPORT')
        if manifest_path:
            pivots = {}
            for obj in temporary.objects:
                if obj.type == 'EMPTY':
                    p=obj.matrix_world.translation
                    pivots[obj.name]=[round(p.x,7),round(p.z,7),round(-p.y,7)]
            manifest={'schemaVersion':2,'stage':cfg['stage'],'model':cfg['model'],'units':cfg['units'],
                      'runtimeAxes':cfg['runtimeAxes'],'dimensions':cfg,'pivots':pivots,
                      'lodLevels':list(levels),'movingParts':sorted(pivots),
                      'poleContract':{'base':cfg['poleMount'],'length':7.8,'shaftLocalAxis':'+Y',
                                      'contactHeadOrigin':'solver endpoint','shaftFractions':[.56,.44]},
                      'textures':['livery-basecolor.png','surfaces-basecolor.png','surfaces-orm.png','surfaces-normal.png','fleet-number-2004.png']}
            manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
    finally:
        for obj in list(temporary.objects):
            data=obj.data
            bpy.data.objects.remove(obj,do_unlink=True)
            if data and data.users == 0 and isinstance(data,bpy.types.Mesh): bpy.data.meshes.remove(data)
        bpy.data.collections.remove(temporary)
        for source,name in source_names.items(): source.name=name
        bpy.ops.object.select_all(action='DESELECT')
        root.select_set(True)
        bpy.context.view_layer.objects.active=root


def export_variants(root, base, cfg):
    export_glb(root,base/'source/bkm32100d-lod0.raw.glb',cfg,levels=(0,))
    export_glb(root,base/'source/bkm32100d-lod2.raw.glb',cfg,levels=(2,))
    export_glb(root,base/'source/bkm32100d.raw.glb',cfg,base/'source/manifest.json',levels=(1,2))
