# v0.1 verification

Checked locally on 24 October 2026 with Node 24.18, Vite 7.3.7, Three.js 0.186, React 19 and Vitest 4.1.12.

## Gate A silhouette pass — iteration 005

Blender 5.2.3 LTS produced the current native project, optimized GLB and nine full-resolution neutral clay renders. Iteration `004` records the initial body/roof surface pass; `005` fixes lamp housing intersections. The reference analysis and annotated comparison sheets live under `assets/vehicles/bkm32100d/review/gate-a/`. The source includes six primary photographs and two supplied overview sheets; contradictory mirrored doors and duplicated pole mechanisms in those sheets were not transferred.

The asset now uses a shared body envelope, swept front surfaces and panoramic glazing, a continuous rolled roof and closed tapered equipment housings. This pass preserves the existing axle, door, suspension and pole coordinates. No simulation, domain, world/route or contact-network source files changed. Detailed textures and later production gates remain deferred; visual approval of Gate A is pending.

The shipping GLB is **2,031,240 bytes**, with **51,100 triangles**, 58 mesh nodes, 90 total nodes, 14 materials and **zero textures**. Khronos validation reports zero errors, warnings, infos or hints. Production build, ESLint/boundaries and all **34 tests** pass, including the actual-GLB contract tests.

Chromium inspection covered the front, all open doors, a real simulated corner and the existing city follow camera. Across nine combined roll/pitch poses, pole-base agreement remained below `6e-10 m` and wheel-height error below `1e-8 m`. The corner snapshot retained both contacts at 1.76° body roll. The isolated vehicle submitted 109 draw calls including shadows. No browser errors or warnings were recorded.

A 180-frame city follow sample at a 1440 × 900 viewport and renderer pixel ratio 1.7 averaged 16.66 ms/frame (approximately 60 fps), with a 17.4 ms 95th percentile. Its final frame submitted 265 draw calls including shadows. This is a short local Chromium sample, not a hardware or cross-browser guarantee. Screenshots: `artifacts/gate-a-005-{front,doors,corner,city}.png`.

## Earlier Blender vehicle pipeline — geometry review

Blender 5.2.3 LTS generated the native `assets/vehicles/bkm32100d/source/bkm32100d.blend`, modular `bpy` source, packed reference photographs and three saved preview iterations. Every iteration includes front, passenger-side, rear and isometric PNG renders. Iteration `003` is the current geometry-review draft; detailed textures await approval.

The shipping GLB contains 48,860 triangles, 58 mesh nodes, 90 total nodes, 14 shared review materials and **zero textures**. It is approximately 2.15 MB. glTF Transform optimization retains every node name; Khronos validation reports zero errors, warnings, infos or hints. Static joining happens only in an export copy, preserving individual native objects and non-destructive bevels. The pipeline also exports directly from an edited blend without regenerating its geometry.

Four new tests parse the actual GLB and check simulation dimensions/hinges, pole endpoints under translated/yawed body roll and pitch, grounded wheels, independent fleet motion/materials, and disposal before load completion. Browser inspection verified the GLB in the existing city and opened all six door leaves. Across nine combined roll/pitch poses, roof-mount error was below `6e-10 m`; wheel-height error was below `1e-8 m`, consistent with GLB float32 serialization. An actual moving corner retained both pole contacts at 1.76° body roll. The isolated review frame submitted 109 draw calls including shadows.

Two forced context-loss/restoration cycles retained the same resource counts (208 geometries, 16 textures) with no browser errors or warnings. A 180-frame follow sample at 1200 × 796, device scale 2 and capped renderer pixel ratio 1.7 averaged 16.64 ms/frame (approximately 60 fps), with a 20.9 ms 95th percentile. Its final frame submitted 263 draw calls including shadows. This is a short local Chromium sample, not a hardware or cross-browser guarantee.

Both the generator pipeline and the edited-blend export pipeline completed successfully. Production preview served the GLB with HTTP 200, rendered the three-vehicle fleet without console errors/warnings, and omitted development hooks. Production build, ESLint/boundaries and all **34 tests** pass. Generated manifest JSON is excluded from source formatting checks; it is written by Blender.

The domain, simulation, world/route and overhead-contact files are unchanged by this migration. Earlier verification sections below describe the superseded procedural vehicle and its historical measurements.

## Earlier AKSM/BKM 32100D reference and PNG update

The model now follows the supplied 32100D photos with the front equipment cover fitted: a closed blue cowl, tall side roof fairings, deeper black V-mask, tighter wave pattern and violet rear ribbons. Wheel diameter is reduced from 1.12 m to 0.98 m, with matching rims, tire profiles and arches. These are photo-guided modelling proportions, not a claim of factory drawing accuracy.

All **30 tests**, the production build, ESLint, boundaries, formatting and diff checks pass. The new wheel-clearance test checks the actual faceted opening during combined maximum cornering roll and service acceleration/braking pitch. Both sides, front, open doors and a moving corner were inspected in Chromium. Pole mounts still align with the solver within `3e-15 m`, and road-relative wheel height within `3e-16 m`.

The final vehicle has 36,258 triangles and 102 mesh objects; its isolated view submits 169 draw calls including shadows. All three vehicles share one checked-in 1024² PNG (198 KiB), with individual 256 × 96 fleet-number textures. This replaces three separate 1024² atlases. Reference counting, repeated release and distinct fleet labels were checked. Two WebGL loss/restoration cycles retained identical renderer resource counts (20 textures), cleared the error UI and produced no console warnings or errors.

A 180-frame moving follow sample at 1200 × 796, device scale 2 and capped renderer pixel ratio 1.7 averaged 16.67 ms/frame (approximately 60 fps), with a 19.8 ms 95th percentile. Its final frame submitted 357 draw calls and 644,076 triangles including shadows. This remains a short local Chromium sample, not a hardware or cross-browser guarantee.

Production preview also passed: the bundled PNG returns HTTP 200 as `image/png`, decodes at 1024 × 1024, and the moving fleet/follow view renders without console errors or warnings. The development hook is absent. Screenshots: `artifacts/bkm32100d-{front,driver-side,doors-open,cornering,production-follow}.png`. The city is unchanged in this revision. Earlier verification and measurements follow.

## Earlier detailed vehicle and city update

The second photo-guided revision passes all **29 tests**, the production build, ESLint, architecture boundaries, formatting and diff checks. New layout checks enforce separation between the doors and wheel arches, a 0.98 m equipment bay behind the rear door, and agreement between the rendered axle spacing and the controller's wheelbase. The fleet test still completes three round trips per vehicle without contact loss, overlapping bodies or movement with open doors.

Chromium inspection at 1440 × 900 covered both sides, front and rear, open doors, a moving corner and the city overview/follow cameras. The equipment bay is solid above the waist, with service panels and ventilation; door leaves remain clear of its geometry. The front and rear lens textures emit light, and brake-lens intensity changes from 0.4 to 1.7 under deceleration. Across nine combined roll/pitch poses, rendered pole mounts agree with the contact solver within `3e-15 m`; all four wheel centres retain their road-relative height. The captured driving corner has 1.76° outward lean with both poles connected.

The model uses approximately 35,400 triangles, including wheels, poles and the selection ring. One 1024² atlas per fleet vehicle supplies labels, grilles, lamps and wheel detail; a shared 128-pixel PMREM environment supplies reflections without rendering scene probes every frame. An isolated front view submits 170 draw calls including the shadow pass. The city and roadside geometry use 46 mesh objects after batching (previously 491), retaining separate textured and transparent surfaces.

Equivalent moving follow-view samples before and after the revision used a 1200 × 796 viewport, device scale factor 2, the renderer's 1.7 pixel-ratio cap and 180 animation frames. Runs averaged approximately 16.67 ms per frame (60 fps); the 95th percentile was 17.7 ms before and 17.6–20.1 ms in the two post-change samples. The final follow frame submitted 360 draw calls and approximately 641,000 triangles, including shadow passes. These are short local Chromium samples, not a hardware or cross-browser performance guarantee.

Two forced WebGL context-loss/restoration cycles rebuilt the shared reflection map, cleared the graphics-error UI and restored identical renderer resource counts (19 textures). No console errors or warnings were recorded during those cycles.

The final production preview renders all three fleet vehicles and the updated city, with working follow/zoom controls and no browser console errors or warnings. The development hook and wire-debug control are absent. Its follow screenshot is `artifacts/detailed-production-follow.png`.

Current screenshots are `artifacts/detailed-trolleybus-{front,rear,side-open,driver-side,cornering}.png` and `artifacts/detailed-city-{follow,overview}.png`. They are local, ignored review artifacts.

## Earlier model and suspension update

The photo-guided model revision passes all **26 tests**, the production build, ESLint, architecture boundaries, formatting and diff checks. The fleet test still completes three round trips per vehicle without contact loss, overlapping bodies or movement with open doors.

Chromium inspection at 1440 × 900 covered front and rear views, open doors, an actual simulated corner and the city follow camera. The revised model has no console errors or warnings. Across nine combined roll/pitch poses, rendered pole mounts agree with the contact solver within `3e-15 m`; all four wheel centres retain their road-relative height. The captured driving corner has 1.76° outward lean with both poles connected. New screenshots are `artifacts/trolleybus-{front,rear,doors-open,cornering,in-city}.png`.

The sections below preserve the initial v0.1 verification and measurements.

## Automated checks

- `npm run typecheck`: passed.
- `npm run lint`: passed, including module-boundary checks.
- `npm test`: **23 tests passed** across three test files.
- `npm run build`: passed.
- `npm run format:check`: passed.

The fleet integration test samples every 1/60-second tick until all three vehicles have completed three round trips. All ten directional stops receive at least three visits from every vehicle. It measures real oriented 12 × 2.55 m footprints, door state, stop accuracy and both pole contacts.

| Measurement                            | Observed result |
| -------------------------------------- | --------------: |
| Simulated duration                     |      1,195.92 s |
| Maximum pole-length error              |    0.00000065 m |
| Head distance from sampled wire        |             0 m |
| Maximum contact-head movement per tick |         0.137 m |
| Maximum stop-position error            |         0.124 m |
| Overlapping body frames                |               0 |
| Moving with doors open                 |        0 frames |
| Contact failures on the normal route   |               0 |

Other tests cover path/wire arc lengths, articulation limits, lap wrap and segment transitions, switch connectivity, seeded repeatability, isolated snapshots, pause/resume, speed scaling, closely spaced followers and emergency braking after a deliberate contact failure. A render-adapter regression verifies that repeated pause synchronization at 120 and 144 Hz preserves accumulated simulation time.

## Browser checks

Playwright Chromium was used at 1440 × 960 and 390 × 844. The scene was visually inspected in overview, follow and contact-debug modes. The narrow viewport had no horizontal overflow or overlap between the playback and camera controls; desktop remains the intended target.

Verified interactions: fleet selection, direct mesh selection, double-click to follow, clicking without cancelling follow, dragging into free mode, overview reset, help, keyboard shortcuts, pause and 1×/2×/4× playback. A measured pause interval advanced simulation time by zero; a 1.2-second interval at 4× advanced it by approximately 4.85 simulated seconds.

Production preview at port 4173 rendered three vehicles with no browser console errors or warnings. The development debug control, panel and `window.__trolleybus` hook were absent. A short production follow-view sample measured approximately 60 animation frames per second, with a 17.6 ms 95th-percentile frame interval. This is a local sample, not a hardware or cross-browser performance guarantee; Firefox and Edge have not been checked.

Screenshots are saved locally under `artifacts/` (ignored by version control).

## Remaining limits

The circuit is compressed to approximately 756 m. The main passenger route traverses the scheduled main edge at the depot turnout; the alternate branch has geometry and a switch-selection contract but no passenger dispatch. Dynamics follow the road centreline. There is no free driving, electrical grid, traffic AI or passenger pathfinding.

Vite reports a bundle-size advisory for the approximately 911 kB JavaScript entry (254 kB gzip), chiefly the Three.js renderer and React. Production builds succeed. Splitting the application shell and renderer for caching is a useful delivery improvement for a later version.
