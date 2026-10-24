"""Export an already-edited .blend without regenerating or replacing its geometry."""
import argparse
import json
from pathlib import Path
import sys
import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(SCRIPT_DIR))
from bkm32100d.export import export_variants
from bkm32100d.preview import existing_cameras, render_previews

parser = argparse.ArgumentParser()
parser.add_argument('--iteration', required=True)
parser.add_argument('--quick', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if not args.iteration.replace('-', '').replace('_', '').isalnum():
    raise ValueError('Iteration must be a simple identifier')
base = ROOT / 'assets/vehicles/bkm32100d'
cfg = json.loads((base / 'model.json').read_text())
root = bpy.data.objects.get('bkm32100d')
if not root:
    raise ValueError('Open the native bkm32100d.blend source before exporting.')
bpy.context.scene['iteration'] = args.iteration
root['asset_version'] = args.iteration
export_variants(root, base, cfg)
render_previews(existing_cameras(), base / 'previews' / args.iteration, args.quick, clay=False)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
