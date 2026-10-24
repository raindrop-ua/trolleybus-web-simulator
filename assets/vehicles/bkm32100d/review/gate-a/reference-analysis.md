# Gate A — reference analysis and silhouette checklist

Scope: silhouette and main surface transitions, integrated into the existing game. Gate B fine-detail work, Gate C texture/livery production and LOD variants are later decisions. No claim of AAA-quality or factory blueprint accuracy is made.

## Source priority

1. Real photographs of 2004 with the front cover fitted: `00013495.jpg`, `00024661.jpg`, `00098245.jpg`, `00100179.jpg`, `00108977.jpg`.
2. Rear photograph `00097061.jpg` for the service compartment, rear corners, ladder and pole hardware.
3. Supplied design sheets for a readable overview of recurring shapes. These contain conflicting/generated details, so they are not orthographic engineering drawings.

## Photograph observations

| Source         | Reliable geometric evidence                                                                                      | Limits                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 00013495       | Closed blue front cover, rounded brow corners, broad windshield, low black V, small wheels, doorless driver side | Front three-quarter perspective compresses wheelbase                                               |
| 00024661       | Three passenger door pairs, curved nose, long raised mid/front roof volume                                       | Distant image; small mechanical parts uncertain                                                    |
| 00097061       | Large enclosed rear service bay; rounded rear upper corners; central ladder; stacked lamps                       | Elevated cornering pose; rear axle/roof distances foreshortened                                    |
| 00098245       | Front width/height balance, rounded upper glazing corners, fitted front cowl                                     | Perspective and road slope; not a measured elevation                                               |
| 00100179       | Continuous driver-side glass band, roof equipment steps, wheel size, sculpted front fascia                       | Near side larger than far side; no direct orthographic measurements                                |
| 00108977       | Front silhouette, black V, cowl-to-brow transition in soft light                                                 | Distant, low-light view                                                                            |
| design-sheet-1 | Multiple views highlight body curvature, cowl and rear mass                                                      | Both side views show doors; pole hardware/top view inconsistent                                    |
| design-sheet-2 | Broad glazing and blended roof cover; useful overall silhouette                                                  | Driver side repeats passenger doors; top view duplicates pole bases; graphics/numbers inconsistent |

## Gate A modelling targets

- Provisional scale: 12 m body length and 2.55 m width. Preserve existing six-metre axle spacing, 0.49 m tire radius and door/pole motion contracts.
- A continuous rounded body envelope with a subtle belly, rolled roof shoulders and a swept front corner return.
- A broad panoramic windshield with rounded upper corners; no detached rectangular header blocks or exposed gap beneath the cowl.
- Low, sculpted blue front fascia with a black V transition and recognizable paired lamp recesses.
- Closed front cover with a low crown; raised, enclosed equipment masses blended into long side fairings. Avoid the previous open bathtub silhouette.
- Continuous side glazing, three double-leaf passenger doors on -X only, and a substantial closed rear bay.
- Grounded tires, believable front/rear overhangs, rounded rear corners and a central rear service mass.
- Existing moving pivots remain independent; the simulation owns all pole articulation.

## Uncertainty kept explicit

The photographs do not establish exact factory height, roof-module interior layout, cover radii, seam positions or hidden battery arrangement. These remain editable visual estimates. Existing axle and pole coordinates are integration contracts, not newly inferred manufacturer specifications. No mirrored doors or duplicate pole assemblies are copied from the generated sheets.

## Review evidence

Iteration `004` recorded the initial surface pass; `005` corrected lamp housings intersecting the swept nose. The current native project and shipping GLB are `005`. Nine full-resolution neutral clay views and the photo/render comparison board accompany it. The game uses simple blue/black material IDs and soft existing city lighting, with zero vehicle image textures.

The shipping model contains 51,100 triangles and is 2,031,240 bytes. Khronos validation reports no errors or warnings. Browser inspection covered front, all open doors, a simulated corner and the city follow view. All 34 tests pass, including actual-GLB motion/pivot contracts. Gate A acceptance remains a visual review of the silhouette; automated export and runtime tests establish compatibility, not visual approval.
