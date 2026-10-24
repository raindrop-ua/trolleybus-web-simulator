"""Blender entry point: generate native source, export GLB and render every major iteration.

blender --background --python scripts/blender/generate_trolleybus.py -- --iteration 001
"""
import argparse
import json
from pathlib import Path
import sys
import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(SCRIPT_DIR))
from bkm32100d.geometry import collection, empty
from bkm32100d.materials import create_materials, apply_uvs
from bkm32100d.details import build_details
from bkm32100d.body import build_body
from bkm32100d.roof import build_roof
from bkm32100d.running_gear import build_wheels, build_doors, build_poles, build_interior
from bkm32100d.preview import build_studio, render_previews
from bkm32100d.export import export_variants


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--iteration', required=True)
    parser.add_argument('--quick', action='store_true')
    parser.add_argument('--skip-renders', action='store_true', help='Export-only maintenance; major iterations must render all views.')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if not args.iteration.replace('-', '').replace('_', '').isalnum():
        raise ValueError('Iteration must be a simple identifier')
    base = ROOT / 'assets/vehicles/bkm32100d'
    cfg = json.loads((base / 'model.json').read_text())
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene['model_stage'] = 'Gates B-E: details, PNG materials, pivots and browser LODs.'
    bpy.context.scene['iteration'] = args.iteration
    mats = create_materials(base)
    rig_coll, body_coll, roof_coll = collection('00_VEHICLE_RIG'), collection('10_BODY_AND_GLAZING'), collection('20_ROOF_EQUIPMENT')
    wheel_coll, door_coll, pole_coll = collection('30_WHEELS'), collection('40_DOORS'), collection('50_CONTACT_POLES')
    interior_coll = collection('60_INTERIOR_BLOCKOUT')
    root = empty('bkm32100d', None, rig_coll)
    root['asset_version'] = args.iteration
    root['geometry_review'] = False
    chassis = empty('chassis', root, rig_coll)
    suspension = empty('body-suspension', chassis, rig_coll, (0, cfg['suspensionPivotHeight'], 0))
    suspension['pivot_role'] = 'sprung body pitch and roll; wheels stay on chassis'
    body = empty('body-shell', suspension, rig_coll, (0, -cfg['suspensionPivotHeight'], 0))
    build_body(cfg, mats, body, body_coll)
    build_roof(cfg, mats, body, roof_coll)
    build_wheels(cfg, mats, chassis, wheel_coll)
    build_doors(cfg, mats, body, door_coll)
    build_poles(cfg, mats, root, pole_coll)
    build_interior(cfg, mats, body, interior_coll)
    build_details(cfg, mats, root, body, body_coll)
    apply_uvs(root, body)
    # Pack supplied photos into the native project, never export them into GLB.
    refs = collection('90_REFERENCE_PHOTOS__NOT_EXPORTED')
    refs.hide_render = True
    refs.hide_viewport = True
    for index, filename in enumerate(cfg['referenceFiles']):
        image = bpy.data.images.load(str(base / 'references' / filename), check_existing=True)
        image.pack()
        image.filepath = '//../references/' + filename
        obj = bpy.data.objects.new('reference-' + Path(filename).stem, None)
        obj.empty_display_type, obj.data, obj.empty_display_size = 'IMAGE', image, 8
        obj.location = (index * 9, 15, 4)
        refs.objects.link(obj)
    studio = collection('99_REVIEW_STUDIO__NOT_EXPORTED')
    cameras = build_studio(studio)
    bpy.context.view_layer.update()
    export_variants(root, base, cfg)
    notes = bpy.data.texts.new('START_HERE.md')
    notes.write('AKSM / BKM 32100D — STYLIZED PRODUCTION ASSET\n\n'
                'Source: scripts/blender/bkm32100d/*.py; dimensions: assets/vehicles/bkm32100d/model.json\n'
                'Native Blender: Z up, -Y forward. GLB/Three.js: Y up, +Z forward. Units: metres.\n'
                'Named empty pivots drive wheels, doors, wipers and poles. Do not flatten their hierarchy.\n'
                'References are packed in collection 90; studio/cameras are excluded from GLB.\n'
                'Packed PNG materials + readable livery; generated source retained under textures/.\n'
                'Native LOD0 remains editable. LOD1/2 are built only in temporary export copies.\n')
    for area in bpy.context.screen.areas if bpy.context.screen else []:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_distance = 17
            area.spaces.active.region_3d.view_location = (0, 0, 1.8)
            area.spaces.active.shading.type = 'MATERIAL'
    blend = base / 'source/bkm32100d.blend'
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    print('BLEND_AND_GLB_COMPLETE', flush=True)
    if not args.skip_renders:
        render_previews(cameras, base / 'previews' / args.iteration, args.quick, clay=False)
        bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    print('ASSET_ITERATION_COMPLETE ' + args.iteration, flush=True)


if __name__ == '__main__':
    main()
