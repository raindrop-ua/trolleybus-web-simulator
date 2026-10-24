# Architecture

The simulation owns behaviour and produces snapshots. The renderer consumes those snapshots. React and Zustand handle the interface and user intentions; neither is a dependency of the road geometry, contact solver, vehicle dynamics or simulation clock.

## Dependency boundaries

| Layer        | Responsibility                                                | Main modules                                                                                |
| ------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `core`       | Renderer-independent vectors, scalar maths and cubic curves   | `CubicBezier`, vector/scalar helpers                                                        |
| `domain`     | Roads, wires, driving decisions, dynamics and schedules       | `RoadNetwork`, `OverheadContactNetwork`, `AutonomousDriver`, `VehicleDynamics`, `Timetable` |
| `simulation` | Time, fleet runtime, stop phases, events and seeded variation | `SimulationClock`, `SimulationEngine`, `SeededRandom`                                       |
| `data`       | Construct one complete `WorldDefinition`                      | `createWorldDefinition`, `ROAD_DEFINITIONS`                                                 |
| `rendering`  | Scene geometry, materials, cameras, picking and diagnostics   | `SceneRenderer`, `CameraRig`, `OverheadScene`, `createTrolleybus`                           |
| `state`      | UI state and periodically published snapshots                 | `useUIStore`                                                                                |
| `app`        | Construct the engine/scene and connect controls to them       | `bootstrap`, `world`                                                                        |

`scripts/check-boundaries.mjs`, run by `npm run lint`, rejects React, Three.js, Zustand and presentation imports in `core`, `domain` and `simulation`. It also rejects domain/simulation imports in `core`. Domain contracts are plain TypeScript interfaces in `src/domain/types.ts`.

## World data and units

`src/data/world.ts` defines a closed, directed circuit from cubic Bézier segments. Each segment has an ID and speed limit. `RoadNetwork` computes segment lengths and exposes `sample(distance)`, returning position, tangent, yaw, curvature and segment ID. Route distance wraps at the end of the circuit; a vehicle's total distance remains unwrapped so lap boundaries do not reset its progression.

The configured circuit is approximately **756 m per round trip**, compressed from the kilometre-scale route in the specification. It has outbound and inbound carriageways, a loop at each end, five physical places and ten directional stop records. Three vehicles start approximately one third of a route apart, with staggered release times. This is a miniature layout, not surveyed Dnipro geography.

Positions and distances are metres; velocities are metres per second; accelerations are metres per second squared; times are seconds; angles are radians. World `+y` is up. Vehicle local `+z` points forward and doors occupy local `-x`.

`WorldDefinition` contains the road, independent contact-network contract, stops, vehicle configurations, scene bounds and simulation start time. This is the main seam for another route or fleet. Visual city composition remains in `rendering/environment`; changing road data substantially also requires reviewing that scenery layout.

`src/data/presentation.ts` holds camera defaults, lighting, city randomness, tree count and building palette. The close orthographic follow view uses a distant camera position to keep nearby tall buildings in front of its near plane.

## Driving and vehicle dynamics

`DrivingController.update(context, dt)` returns a normalized `DrivingCommand`: traction, braking, steering and a door request. `AutonomousDriver` implements this contract. It uses the current road limit, upcoming curvature, distance to the next stop, departure permission and the nearest leader on the directed circuit.

`RoadAwareness.observeRoad` supplies the look-ahead information. The driver reduces target speed before bends and uses a conservative stopping envelope, including response time, before stops or a leading trolleybus. All leader observations in one tick are collected before any vehicle advances, avoiding an update-order advantage.

`integrateVehicleDynamics` consumes the command and configuration. It limits longitudinal jerk, integrates speed and distance, rate-limits steering and evolves independent damped roll/pitch states. The bus's road position and yaw still come from the sampled route: steering is a visual/dynamic response to path curvature, rather than free lateral vehicle integration. A future human controller can implement the same command boundary, but free driving also needs a different position integrator.

Body roll follows lateral acceleration (`speed² × curvature`), leans outward, and is limited to 2.5°. Near-critical damping gives a smooth return to level on straight sections and at rest. Positive curvature turns toward vehicle-local `+x`; positive roll shifts the roof toward `-x`. The body rolls and pitches around a shared pivot 0.8 m above the road, while the chassis and wheels stay grounded.

The engine owns the stop-operation state machine:

```text
waiting → driving ↔ braking → doors-opening → dwelling → doors-closing → driving
                                      contact failure → disconnected
```

Vehicles complete their stop at rest, animate the door transition and dwell before continuing. Passenger counts and additional dwell variation come from `SeededRandom`. `Timetable` estimates an unimpeded baseline by running the same driver/dynamics model. Actual arrival/departure times are recorded separately, so delays do not rewrite their planned times.

## Fixed simulation time

`SimulationClock` accumulates real elapsed time and advances the engine in **1/60 s ticks**, with 1×, 2× and 4× playback. Pausing discards the partial accumulator. Real frame deltas are capped at 0.25 s and catch-up is bounded at 60 ticks per frame, preventing a suspended tab from causing an unlimited update loop.

`SimulationEngine` can run without a browser using `step(dt)` or `advance(realDeltaSeconds)`. `snapshot()` copies public vehicle/contact/event data instead of exposing mutable runtime objects. Resetting with the same seed recreates the same initial state and future random sequence.

`bootstrap` owns the browser lifetime. Its animation callback advances the engine, feeds the latest snapshot to `SceneRenderer` and publishes interface snapshots about every 100 ms. Interface render frequency does not select the physics timestep. Disposal removes keyboard listeners, the animation loop, camera controls, resize observation and renderer resources.

## Contact network and fixed-length poles

`OverheadContactNetwork` builds independent positive and negative wire paths above the route. The current wire height is 6.2 m; each polarity is offset 0.35 m from the route centreline. A separate arc-length lookup for each offset curve avoids treating road metres as wire metres, especially around terminal loops.

Wire segments store directed graph IDs, start/end nodes, polarity and outgoing edges. The depot turnout supplies a diverging cubic branch for each polarity, connected to the main circuit at both ends. `ContactSwitch` helpers select the scheduled branch or choose an alternate edge from a traction/coasting input. The v0.1 service follows the main circuit: these helpers and branch geometry are extension points, not a running electrical-switch simulation.

`VehicleGeometry` shares plain-number mount coordinates (`x = ±0.38`, `y = 3.43`, `z = -0.65`) and the body suspension pivot between the contact solver and renderer. The mounts sit just aft of the roof centre. `calculatePoleBase` applies roll and then pitch around that pivot, followed by chassis yaw. `solvePoleContact` intersects the assigned wire with a sphere centred at that base and radius **7.8 m**. It chooses the trailing intersection and follows a continuous, unwrapped wire distance through segment and lap transitions.

The solver first attempts a temporally coherent numerical update. A local bracketing search and bisection provide recovery for initialization or larger movement. It returns the base/head positions, wire distance and segment ID, connection state, length error, wire error and an optional diagnostic. A reachable head is sampled from the wire itself; the pole length is not adjusted to force a connection.

If no valid contact exists, the returned head stays exactly one pole length from its base, visibly away from the wire. `SimulationEngine` records the failure and uses the normal finite-jerk emergency braking path. It does not silently reconnect the vehicle or resume service.

## Rendering and interface

`SceneRenderer` owns the WebGL scene, lighting, resize handling and raycast selection. `CameraRig` owns an orthographic camera with overview, follow and free navigation. Camera movement does not change simulation time or vehicle state.

`createTrolleybus(id, environment?)` returns `group`, `update(snapshot, selected, elapsed)` and `dispose()`. Its chassis follows the sampled world position/yaw, wheels rotate from travelled distance and front wheels follow steering. The body separately pitches and rolls, while door leaves use the snapshot's opening fraction. Pole shafts and contact heads consume the solver's world-coordinate endpoints in a separate group. Retrieval ropes connect those moving poles to body-local drums. Static opaque meshes and explicitly mergeable atlas decals are batched by material and shadow flags.

`bodyGeometry` builds extruded longitudinal profiles and faceted front surfaces. Both skirts have real wheel openings with suspension clearance, and passenger-side glazing and framing stop at each door aperture. The roof fairings leave the shared pole mounts exposed. `VehicleGeometry` also supplies axle positions and wheel radius; the world configuration derives its wheelbase from those same axle positions. Static batches separate indexed and non-indexed geometries before merging.

`DOOR_LAYOUT` supplies per-door widths and centres, including a narrower rear door. The rear electrical compartment occupies `z = -6…-5.02`, leaving 0.98 m after that door. The 6 m wheelbase and door/arch clearances are verified against these shared dimensions.

`vehicleTextures` generates one 1024 × 1024 atlas per fleet number; opaque surfaces, transparent markings, emissive lamp lenses and unlit displays share its texture with remapped UVs. Brake-lens emission follows the braking state. `vehicleEnvironment` captures one 128 px PMREM reflection map at scene construction, shared by the three vehicles and disposed with the renderer. On WebGL context loss the old target is released; restoration regenerates it and replaces material references. It is not a live reflection probe; there is no transmission pass or postprocessing chain. Flat glazing uses one transparent pass and does not cast opaque shadows over the cabin.

City repetition uses instancing. `mergeStaticEnvironment` bakes remaining untextured static meshes into vertex-colour batches while preserving material shading and shadow flags. Textured surfaces, glass and instanced meshes remain separate. Scenery surface textures are 128 px and share materials; discarded source geometry/materials are released after batching. Scene cleanup disposes geometry, textures, materials, instance buffers and the fleet reflection target.

Vehicles, buildings, trees, furniture, parked cars and canvas text textures are created procedurally. The supplied photographs and concept sheet inform the visual direction. No reference image is needed at runtime.

`useUIStore` stores selected vehicle, camera/playback preferences, help/fleet visibility, diagnostics visibility and the latest published snapshot. Application adapters turn those intentions into engine or camera calls. The renderer does not mutate simulation snapshots.

Contact debugging is gated by `import.meta.env.DEV` in the app adapter. `D` and the diagnostic view are development-only. `window.__trolleybus` exposes snapshot/world inspection and renderer statistics only in development and is removed during cleanup.

## Verification and extension points

`src/tests/geometry.test.ts` exercises road continuity, distance sampling, both wire paths, repeated fixed-pole contact sweeps, switch topology and impossible-contact reporting. `src/tests/simulation.test.ts` exercises dynamics, command bounds, clock behaviour, deterministic snapshots/resets, doors, repeated stop visits, following gaps and timetable event differences. These are headless tests; browser interaction, appearance and frame rate require separate checks.

For v0.2, the existing boundaries support a manual `DrivingController`, additional world definitions and richer service scheduling. Full branch-aware route traversal, electrical supply/current behaviour and general traffic interaction need explicit new domain models. Mobile input and pedestrian boarding are also outside the current implementation.
