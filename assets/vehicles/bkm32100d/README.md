# BKM / AKSM 32100D — geometry review

This is an editable Blender source asset based on the supplied photographs. Geometry approval is pending. Materials only distinguish paint, glass, rubber and metal. No detailed textures, livery graphics or baked shading are included in the shipping GLB.

## Files

- `source/bkm32100d.blend`: native project with modular objects, named pivots, packed photographs and review cameras.
- `model.json`: authoring dimensions and mechanical layout. Values are photo-guided modelling proportions; they are not a factory blueprint.
- `references/`: the six supplied reference images, also packed into the blend.
- `previews/001`, `002`, `003`: saved front, side, rear and isometric review images for each iteration. `003` is current.
- `source/bkm32100d.raw.glb`: unoptimized Blender export.
- `source/manifest.json`: exported world-space pivot positions and authoring configuration.
- `source/export-report.json`: optimized GLB size, geometry counts and Khronos validation results.
- `../../../src/rendering/vehicles/assets/bkm32100d.glb`: shipping asset (path relative to repository root is `src/rendering/vehicles/assets/bkm32100d.glb`).

## Generate and export

Run from the repository root with Blender 5.2+ and Node installed:

```sh
npm run vehicle:build -- --iteration 004
```

The command runs `scripts/blender/generate_trolleybus.py` in background Blender, builds the native project, saves all four preview renders, exports a temporary copy, batches static meshes by parent/material, then runs glTF Transform deduplication/pruning and the Khronos validator. Named motion nodes are never flattened. Optimization fails if node names change, textures are introduced, or validation reports errors/warnings. No compression decoder is required by the current GLB.

Set `BLENDER_BIN` when Blender is not in a standard macOS or Linux location. `--quick` makes lower-resolution preview renders for draft work. Give every major iteration a new ID; the preview directories preserve visual history. `--skip-renders` is reserved for generator maintenance, not major geometry revisions.

To edit directly in Blender, open `source/bkm32100d.blend`, edit the objects, save, then run:

```sh
npm run vehicle:export -- --iteration 005
```

This opens the existing blend and exports it **without regenerating geometry**. It renders all four views and updates the GLB and validation report. Re-running `vehicle:build` intentionally replaces manual edits with generated geometry.

## Modules and collections

`geometry.py` supplies `bpy` primitives; `body.py` builds panels, glazing and fascia; `roof.py` builds the closed cowl and equipment fairings; `running_gear.py` builds wheels, doors, poles and interior blockout; `preview.py` owns the studio/cameras; `export.py` owns a temporary export copy. The native source keeps individual objects and non-destructive bevels. Static joining happens only in that export copy.

Native collections separate rig, body/glazing, roof, wheels, doors, poles and interior. Collection `90_REFERENCE_PHOTOS__NOT_EXPORTED` contains packed photo empties; enable its viewport visibility to inspect them. Collection `99_REVIEW_STUDIO__NOT_EXPORTED` contains ground, lights and four cameras. Neither collection is exported. `START_HERE.md` is embedded in the blend.

## Runtime pivot contract

Units are metres. The `bpy` helper coordinates are `(cross-width, up, forward)`; they convert to native Blender `(X, -forward, Z)`. The glTF exporter converts this to Three.js `(X, up, +Z)`. Passenger doors are on -X. Exported static transforms are normalized; intentional unit-length shaft/rope scale belongs to their motion nodes.

| Node                                                | Origin and role                                              |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `bkm32100d`                                         | Fixed asset root, identity transform.                        |
| `chassis`                                           | Road position/yaw; parent of wheels and suspended body.      |
| `body-suspension`                                   | `(0, 0.8, 0)`, pitch/roll pivot.                             |
| `body-shell`                                        | Local `(0, -0.8, 0)`, body geometry in metre coordinates.    |
| `wheel-steer-{front,rear}-{left,right}`             | Axle/wheel centre; front steering about Y.                   |
| `wheel-spin-{front,rear}-{left,right}`              | Wheel centre; spin about X using distance / radius.          |
| `door-{front,middle,rear}-{forward,rearward}-pivot` | Hinge at each leaf edge, Y rotation; closed angle is zero.   |
| `wiper-{left,right}-pivot`                          | Wiper arm base; retained for future animation.               |
| `mirror-{left,right}-pivot`                         | Mirror-arm attachment; retained separately.                  |
| `pole-{left,right}-aim`                             | World contact base, local +Y shaft axis.                     |
| `pole-{left,right}-shaft-{lower,upper}`             | Unit-length shaft sections, base origins, stretched along Y. |
| `pole-{left,right}-contact-head`                    | Solver's world contact head.                                 |
| `pole-{left,right}-retrieval-rope`                  | World drum origin, unit +Y rope stretches toward the head.   |

The existing contact solver supplies pole bases and heads. GLB geometry does not drive physics. Wheels remain on the chassis, doors and roof remain on the suspended body, and poles/ropes are updated in world coordinates. The adapter caches the latest snapshot during asynchronous loading, shares immutable GLB geometry, clones motion nodes/materials per vehicle and reference-counts the shared template. Load errors reach the existing error UI.

`src/tests/vehicle-asset.test.ts` parses the actual GLB and verifies dimensions, node names, hinges, combined roll/pitch alignment, wheel grounding, door/spin independence and disposal before loading completes. The route/fleet/contact tests remain in place. After geometry approval, add UVs and materials in Blender and extend this pipeline; do not rebuild body meshes in Three.js.
