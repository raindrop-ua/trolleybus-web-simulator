# Trolleybus Miniature

A small autonomous trolleybus simulator inspired by Dnipro's blue route 6 vehicles. Three trolleybuses travel through a low-poly city, stop for passengers, turn at each terminal and keep both trolley poles on a paired overhead contact network.

Version **0.1.0** is an observation sandbox: select a vehicle, follow its journey or explore the whole miniature. The interface uses React and Zustand; the scene uses Three.js; the simulation is plain TypeScript and runs independently of both.

## Run locally

Use Node.js **22.12+ within 22.x, or 24+**, and npm.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite, normally `http://localhost:5173`. A desktop browser with WebGL support and a mouse or trackpad is the intended setup.

```sh
npm run build          # Type-check and produce dist/
npm run preview        # Serve the production build locally
npm run typecheck      # TypeScript checks
npm run test           # Headless domain/simulation tests
npm run lint           # ESLint and layer-boundary checks
npm run format:check   # Check source formatting
npm run format        # Apply Prettier formatting
```

## Docker deployment

The multi-stage image builds the app with Node.js 24 and npm, then serves `dist/`
with the Node.js `serve` static server as an unprivileged user on port **4200**
(`PORT` can override it). It includes an HTTP healthcheck.

```sh
docker build -t trolleybus .
docker run -d --name trolleybus --restart unless-stopped -p 127.0.0.1:4200:4200 trolleybus
```

Open `http://localhost:4200` to check the container. In **Dokploy**, select the
**Dockerfile** build type with `Dockerfile` at the repository root. Add the domain
`trolleybuses.antonsizov.rocks` with path `/` and container port **4200**, and enable
HTTPS. Point the domain's DNS record at your Dokploy server. Traefik handles
routing and TLS; Dokploy does not need a published host port for this app.

The app is hosted at the domain root, so Vite's default base path `/` applies.
The container serves HTTP; DNS and HTTPS are configured outside the image.

## Controls

| Input                     | Action                                                    |
| ------------------------- | --------------------------------------------------------- |
| Left drag                 | Orbit the camera                                          |
| Right drag                | Pan the camera                                            |
| Mouse wheel               | Zoom                                                      |
| `+` / `-`                 | Zoom in / out                                             |
| Click a trolleybus        | Select it                                                 |
| Double-click a trolleybus | Select and follow it                                      |
| `F`                       | Follow the selected trolleybus                            |
| `Esc`                     | Return to the overview                                    |
| `Space`                   | Pause / resume the simulation                             |
| `1`, `2`, `4`             | Set simulation speed to 1×, 2× or 4×                      |
| `D`                       | Toggle contact-network diagnostics in a development build |

Dragging the camera leaves follow mode. Pausing stops simulated time while camera navigation stays available. The on-screen controls also expose fleet selection, camera modes, playback and reset.

## What's in this version

- Three 12 m trolleybuses, fleet numbers **2001**, **2002** and **2003**, with animated wheels, steering, body suspension and three pairs of opening doors.
- A Blender-authored AKSM/BKM **32100D** with continuous body/roof transitions, panoramic windshield, closed cowl, detailed lamps, cabin handrails, service panels and rear equipment bay.
- Stylized PNG livery, emissive route displays and shared PBR atlases. LOD1/2 share one rig and texture set; the editable LOD0 stays in Blender. All vehicle meshes and UVs come from Blender. The city uses instanced façade, tree, car and street details.
- Smooth curb approaches: vehicles move 2.2 m toward each stop, board at rest and return to the lane. Wires follow their original path; fixed-length poles reach them from the actual offset body pose.
- Gentle outward body lean in corners, limited to **2.5°**, with a damped return to level. Wheels stay grounded and pole contact follows the sprung roof.
- Five named places served in both directions: Station, Central Square, University, Riverside and Park. These are **ten directional stop visits per round trip**.
- A directed road circuit made from arc-length sampled cubic Bézier segments, including terminal loops and slower curved sections.
- Autonomous acceleration, braking, bend anticipation and a following gap between trolleybuses.
- Arrival/departure events, planned times, measured timetable deviation and seeded passenger/dwell variation.
- Separate positive and negative wires, contact-segment IDs, a paired depot turnout and numeric contact diagnostics.
- Two **fixed 7.8 m poles per vehicle**. Contact points come from a geometric solver rather than a visual offset: the head lies on its assigned wire while remaining one pole length from its roof base.

The route is a deliberately compressed **approximately 756 m round trip**, rather than the original specification's kilometre-scale route. Vehicles retain metre-scale proportions. Travel times and timetables belong to this miniature; this is not a geographic reconstruction or a real service timetable.

Vehicle source: [native Blender project](assets/vehicles/bkm32100d/source/bkm32100d.blend). The modular `bpy` generator is under `scripts/blender/`; dimensions live in `assets/vehicles/bkm32100d/model.json`. Supplied reference photographs are packed into the native project and excluded from the GLB. Scenery remains procedural.

```sh
npm run vehicle:build -- --iteration 010   # Regenerate from bpy modules; save blend + 9 material views + optimized GLB
npm run vehicle:export -- --iteration 010  # Export manually edited blend; preserve geometry; render 9 views
npm run vehicle:optimize                   # Re-optimize/validate the latest raw GLBs only
npm run vehicle:textures                   # Rebuild authored PNG livery/labels
npm run vehicle:review -- --iteration 009 --materials # Current material comparison
npm run vehicle:review -- --iteration 005  # Create reference/comparison boards from a saved iteration
```

Use Blender 5.2+ (`BLENDER_BIN` can point to its executable). Native axes are Z-up / -Y-forward; exported axes are Y-up / +Z-forward. Current iteration `009` includes front/rear, both sides, isometric, two three-quarter and two close-up material renders. The [material comparison](assets/vehicles/bkm32100d/review/gates-b-e/comparison.html), [Gate A history](assets/vehicles/bkm32100d/review/gate-a/comparison.html) and [reference analysis](assets/vehicles/bkm32100d/review/gate-a/reference-analysis.md) document the pass. The supplied sheets contain contradictory doors/roof hardware; primary photographs take priority. See the [asset workflow and pivot contract](assets/vehicles/bkm32100d/README.md) before editing or exporting.

## Configuration and structure

Edit `src/data/world.ts` to change road control points and speed limits, stop locations/dwell times, fleet parameters, initial spacing, departure offsets and the start time. Coordinates are metres, time is seconds, speeds are metres per second and angles are radians. Local vehicle forward is `+z`, up is `+y` and passenger doors are on local `-x`.

```text
src/core/          Pure geometry and maths
src/domain/        Road, contact network, driver, vehicle dynamics and timetable
src/simulation/    Fixed-step clock, seeded randomness and fleet orchestration
src/data/          World definition
src/rendering/     Three.js scene, environment, cameras and vehicle visuals
src/state/         UI preferences and published simulation snapshots
src/app/           Application lifetime and input adapters
src/tests/         Geometry, contact, clock and fleet tests
```

See [docs/architecture.md](docs/architecture.md) for the module boundaries, contact solver and extension points.

Camera framing, lighting, the city seed and palette are configured in `src/data/presentation.ts`. The original implementation brief is preserved in [docs/specification.md](docs/specification.md); the current verification results are in [docs/verification.md](docs/verification.md).

## Development diagnostics

The contact debug view and the `D` shortcut are enabled only when `import.meta.env.DEV` is true. A development build also exposes `window.__trolleybus.snapshot()`, `window.__trolleybus.renderStats()` (draw calls, triangles, GPU resource counts and pixel ratio), and `window.__trolleybus.world` for inspection. Production builds do not install these debugging hooks.

Tests cover route continuity and arc-length sampling, paired contact geometry across repeated loops, unreachable-wire reporting, fixed-step timing, deterministic resets, stop/door sequencing, following gaps and timetable events. Run the scripts above to check the current checkout; browser behaviour and performance need their own visual checks.

## Current limits and next steps

Movement follows a route with smooth curb offsets at stops. Steering and suspension are modelled, but the vehicle is not a free-driving rigid body. Parked cars and people are scenery; there is no general traffic AI, collision solver, electrical power network, manual driving or mobile control scheme. Passenger counts change at stops without a pedestrian boarding simulation.

The depot turnout has real branch geometry and explicit route/current-actuation helpers. The v0.1 autonomous service stays on its scheduled main circuit; it does not dynamically dispatch vehicles onto the depot branch. Wire geometry is level at 6.2 m, without sag or pole flex. Contact failure records a diagnostic and brakes the affected vehicle; automatic rewiring is not implemented.

For v0.2, useful next steps are manual input through `DrivingController`, full branch-aware routing and switch operation, traffic interaction, an electrical supply model and larger route configurations. Touch controls and measured performance tuning can follow once those behaviours are settled.
