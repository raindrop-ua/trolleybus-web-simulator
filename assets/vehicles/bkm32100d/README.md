# BKM / AKSM 32100D — stylized Blender asset

This editable Blender source follows the supplied photographs, with Gate A clay history and a Gates B–E detail/material/runtime pass. The master carries fleet number 2004. Runtime instances replace its small number texture with their own fleet ID. Materials are stylized and lighting is dynamic; factory-drawing or AAA production accuracy is not claimed.

## Files

- `source/bkm32100d.blend`: editable LOD0 master, modular objects, named pivots, packed PNGs/references and nine review cameras.
- `model.json`: provisional photo-guided dimensions and the mechanical integration contract.
- `references/`: six primary photographs and two supporting design sheets. Real photos take priority over contradictory sheet details.
- `previews/009`: current nine material renders: front/rear, both sides, elevated isometric, front/rear three-quarter and front/roof close-ups.
- `previews/005`: Gate A clay views. Iterations `006–008` preserve material/detail corrections.
- `review/gate-a/`: annotated sources and clay comparisons.
- `review/gates-b-e/`: current comparisons and quality-gate evidence.
- `textures/`: generated swatch source, editable SVG livery sources and PNG base-color/normal/ORM maps.
- `source/*.raw.glb`: unoptimized export copies.
- `source/manifest.json`: axes, moving pivots, pole metadata and authoring configuration.
- `source/export-report.json`: exact current counts, image budgets and Khronos validation results for all exports.
- `exports/bkm32100d-lod0.glb`, `exports/bkm32100d-lod2.glb`: standalone presentation/distant exports.
- Shipping asset: `src/rendering/vehicles/assets/bkm32100d.glb` from the repository root. It shares one moving hierarchy and texture set across LOD1/2 meshes.

## Generate and export

From the repository root with Node and Blender 5.2+:

```sh
npm run vehicle:textures                      # Rebuild readable PNG livery/labels
npm run vehicle:build -- --iteration 010       # Generate native master, PBR maps, LOD exports and 9 material renders
npm run vehicle:review -- --iteration 009 --materials
```

`BLENDER_BIN` overrides Blender's location; `CHROME_BIN` overrides Chrome/Chromium for graphic/comparison PNGs. The generated swatch source is checked in; rebuilding does not call an image-generation API. `materials.py` processes the normalized swatches into restrained normal/ORM maps. The SVG graphic sources preserve exact text instead of relying on generated lettering.

Use `--quick` for draft previews and a new iteration ID for every major revision. `--skip-renders` is reserved for generator maintenance. Source references and studio objects never enter the GLB. The PNG comparison script only crops/layouts source photos; it does not retouch them or claim exact orthographic alignment.

To export manual Blender edits without rebuilding geometry:

```sh
npm run vehicle:export -- --iteration 010
```

This exports all LOD variants and saves nine material previews. `vehicle:build` intentionally regenerates geometry and replaces manual modelling edits. `vehicle:optimize` only reprocesses existing raw exports.

## Export and LOD strategy

The native 68,884-triangle master stays editable. Temporary copies apply bevels, reduce hardware and batch meshes by parent/material/LOD. LOD1 is 48,710 triangles; LOD2 is 22,963 triangles, omitting tiny cabin/fastener/spring details while retaining silhouette, windows, doors and contact rig. Static joining and simplification never alter native objects.

The runtime bundle contains both LODs and one shared moving hierarchy. The orthographic camera chooses detail by projected size with 95/120 px hysteresis. Door/steering/spin/pole pivots remain stable while visibility switches. Standalone exports are also provided for inspection/reuse.

Export copies are explicitly triangulated and supply tangents for normal maps. glTF Transform preserves all names and Khronos material extensions, deduplicates/prunes and removes unused tangents. Khronos errors/warnings, missing UVs and image dimensions above 2K fail the pipeline. The current GLB uses no compression decoder.

## PNG materials

- `livery-basecolor.png` (2048²): blue paint, white wave, violet rear accents, simplified municipal/accessibility graphics and emissive route displays.
- `surfaces-basecolor.png` (1024²): normalized generated upholstery, rubber and alloy swatches.
- `surfaces-normal.png` / `surfaces-orm.png` (1024²): subtle grain, roughness and metallic response. AO is neutral; directional shadows are not baked into the body.
- `fleet-number-2004.png` (256 × 128): master fleet label. The game substitutes one small transparent canvas per vehicle ID.

Five PNGs are embedded. Estimated RGBA texture allocation including mipmaps is 37.5 MiB for the shared set, plus 0.17 MiB per fleet label. All other images and geometry are shared across vehicles. The adapter clones materials, owns per-instance number textures and releases embedded textures/image bitmaps with the final shared lease.

Paint has controlled gloss and fine color variation; glass has moderate transparency/reflection and actual cabin geometry behind it. Major shapes, lamp housings, recesses and panel seams are geometry. Printed graphics and micrograin use UV-mapped images. Internal body faces use plain paint, so exterior lettering does not appear mirrored inside the cabin.

## Authoring modules

`geometry.py` provides primitives; `surfaces.py` owns the continuous body/front/roof envelope; `body.py` assembles glazing/panels; `roof.py` owns closed equipment housings; `running_gear.py` owns wheel/door/pole/cabin assemblies; `details.py` adds lamp internals, markers, service details, grips and springs; `materials.py` owns UVs and PNG materials; `preview.py` owns studio/cameras; `export.py` owns temporary LOD copies.

Collections separate rig, body, roof, wheels, doors, poles and cabin. `90_REFERENCE_PHOTOS__NOT_EXPORTED` packs the eight source images. `99_REVIEW_STUDIO__NOT_EXPORTED` contains the studio and nine cameras. `START_HERE.md` is embedded in the blend.

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

`src/tests/vehicle-asset.test.ts` parses the actual GLB and verifies PNG packaging, node names, hinges, combined roll/pitch alignment, wheel grounding, independent fleet animation, LOD switching and disposal before loading completes. Body geometry and UVs belong in Blender; do not rebuild them in Three.js.

## Known limits

Cover radii and hidden battery/pole mechanisms are photo-guided estimates. Municipal graphics are simplified and route text is static. Wiper/mirror pivots are ready for animation, but weather and mirror folding are not simulated. LOD2 intentionally removes small cabin/hardware detail. Local browser checks establish behavior, not universal performance or visual approval.
