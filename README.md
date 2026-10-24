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
- Photo-guided AKSM/BKM **32100D** bodywork: closed blue front equipment cover, high side roof fairings, a curved nose with the black V-shaped mask, a 0.98 m rear electrical bay, 0.98 m diameter tires with rear dual wheels, service hatches, pole springs and retrieval ropes. White waves and violet rear ribbons follow the Dnipro references.
- One shared **1024 × 1024 PNG** supplies grilles, lamp reflectors, panel hardware, displays and markings; only individual fleet numbers use small generated textures. Paint and glass use one small prefiltered reflection map; the city stays more restrained, with instanced façade, tree, car and street details.
- Gentle outward body lean in corners, limited to **2.5°**, with a damped return to level. Wheels stay grounded and pole contact follows the sprung roof.
- Five named places served in both directions: Station, Central Square, University, Riverside and Park. These are **ten directional stop visits per round trip**.
- A directed road circuit made from arc-length sampled cubic Bézier segments, including terminal loops and slower curved sections.
- Autonomous acceleration, braking, bend anticipation and a following gap between trolleybuses.
- Arrival/departure events, planned times, measured timetable deviation and seeded passenger/dwell variation.
- Separate positive and negative wires, contact-segment IDs, a paired depot turnout and numeric contact diagnostics.
- Two **fixed 7.8 m poles per vehicle**. Contact points come from a geometric solver rather than a visual offset: the head lies on its assigned wire while remaining one pole length from its roof base.

The route is a deliberately compressed **approximately 756 m round trip**, rather than the original specification's kilometre-scale route. Vehicles retain metre-scale proportions. Travel times and timetables belong to this miniature; this is not a geographic reconstruction or a real service timetable.

Vehicle and scenery geometry is procedural. The supplied photos guide the 32100D silhouette and livery; they are not loaded as scene assets. Vehicle surface artwork is stored in `src/rendering/vehicles/assets/bkm32100d-surface-atlas.png`. To regenerate that PNG after editing `scripts/vehicle-atlas-painter.ts`, run `node scripts/export-vehicle-atlas.mjs` with local Chrome/Chromium installed (or set `CHROME_BIN`). This offline artwork code is excluded from the application bundle.

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

Movement is constrained to the road's centreline. Steering and suspension are modelled, but the vehicle is not a free-driving rigid body. Parked cars and people are scenery; there is no general traffic AI, collision solver, electrical power network, manual driving or mobile control scheme. Passenger counts change at stops without a pedestrian boarding simulation.

The depot turnout has real branch geometry and explicit route/current-actuation helpers. The v0.1 autonomous service stays on its scheduled main circuit; it does not dynamically dispatch vehicles onto the depot branch. Wire geometry is level at 6.2 m, without sag or pole flex. Contact failure records a diagnostic and brakes the affected vehicle; automatic rewiring is not implemented.

For v0.2, useful next steps are manual input through `DrivingController`, full branch-aware routing and switch operation, traffic interaction, an electrical supply model and larger route configurations. Touch controls and measured performance tuning can follow once those behaviours are settled.
