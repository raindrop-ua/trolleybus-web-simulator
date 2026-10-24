# Gates B–E — iteration 009

The user authorized the detail/material stages after the Gate A pass. This is a completed implementation and validation pass; visual judgement remains reviewable through the supplied renders rather than an automatic AAA-quality claim.

| Gate                    | Delivered                                                                                                                                       | Evidence                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| B — major details       | Lamp interiors/covers, front/rear/side displays, glazing/doors, service panels, cabin rails/grips, roof vents/pole springs and rear hardware    | Nine views in `../../previews/009/`; `comparison.png`; editable objects in the native master                            |
| C — materials           | Generated swatch source, readable authored livery, blue paint, controlled glass, upholstery/rubber/alloy, normal/ORM maps and emissive displays | Five embedded PNGs, UV checks and `../../textures/`; material comparison                                                |
| D — animation readiness | Separate named pivots for steering/spin, doors, mirrors, wipers, suspension, poles/heads/ropes; no baked pole contacts                          | Actual-GLB contract tests, exported manifest, open-door/corner browser captures                                         |
| E — runtime             | Optimized LOD1/2, shared textures, per-fleet numbers, context restoration and production integration                                            | Clean validation for all exports; 38 tests; local browser/performance evidence in `../../../../../docs/verification.md` |

LOD0: 68,884 triangles. LOD1: 48,710. LOD2: 22,963. The 7,780,416-byte gameplay bundle stores both runtime LODs with a shared rig/texture set. Native source simplification is non-destructive.

The vehicle's separate curb path moves 2.2 m toward stops. The original road/contact paths remain unchanged; the pole solver uses the actual offset pose. Boarding is stationary. A three-round-trip fleet test checks every 60 Hz contact step and physical vehicle overlap; extra tests check curb/furniture clearance.

Known limits: photo-guided cover radii/hidden mechanisms, simplified small graphics, static route destination, no weather-driven wipers or mirror folding. Collision/free driving remain outside this route-following simulator. The source swatches and graphics can be revised independently without rebuilding body shapes.
