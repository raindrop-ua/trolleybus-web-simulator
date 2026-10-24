# v0.1 verification

Checked locally on 24 October 2026 with Node 24.18, Vite 7.3.7, Three.js 0.186, React 19 and Vitest 4.1.12.

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

Vite reports a bundle-size advisory for the approximately 875 kB JavaScript entry (242 kB gzip), chiefly the Three.js renderer and React. Production builds succeed. Splitting the application shell and renderer for caching is a useful delivery improvement for a later version.
