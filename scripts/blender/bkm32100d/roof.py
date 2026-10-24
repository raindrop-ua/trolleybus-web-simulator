"""Closed front cowl, battery-equipment fairings and exposed pole pedestals."""
import math
from .geometry import mesh, profile, box, cylinder, rod


def build_roof(cfg, mats, parent, coll):
    sections = [
        (3.56, 1.07, 3.10, 3.25), (3.82, 1.16, 3.14, 3.36),
        (4.18, 1.20, 3.15, 3.395), (4.90, 1.20, 3.14, 3.39),
        (5.28, 1.18, 3.11, 3.34), (5.65, 1.14, 3.06, 3.25),
        (5.90, 1.11, 3.015, 3.13), (6.025, 1.075, 2.99, 3.055),
    ]
    columns, vertices, faces = 24, [], []
    for z, half, edge, crown in sections:
        for column in range(columns + 1):
            u = column / columns * 2 - 1
            vertices.append((u * half, edge + (crown - edge) * math.sqrt(max(0, 1 - u ** 4)), z))
    for row in range(len(sections) - 1):
        for column in range(columns):
            a = row * (columns + 1) + column
            faces.append((a, a + columns + 1, a + columns + 2, a + 1))
    for row in (0, len(sections) - 1):
        center = len(vertices)
        vertices.append((0, 2.99, sections[row][0]))
        for column in range(columns):
            a = row * (columns + 1) + column
            faces.append((center, a, a + 1) if row == 0 else (center, a + 1, a))
    for column in (0, columns):
        for row in range(len(sections) - 1):
            a, b = row * (columns + 1) + column, (row + 1) * (columns + 1) + column
            c = len(vertices)
            vertices += [(vertices[a][0], 2.99, vertices[a][2]), (vertices[b][0], 2.99, vertices[b][2])]
            faces.append((a, c, c + 1, b) if column == 0 else (a, b, c + 1, c))
    mesh('roof-front-closed-cowl', vertices, faces, mats['paint'], parent, coll, smooth=True)
    for index, (z, y) in enumerate(((5.28, 3.344), (5.44, 3.309))):
        box(f'roof-cowl-vent-{index}', (.62, .008, .025), (0, y, z), mats['trim'], parent, coll, .004)
    for side in (-1, 1):
        profile(f'roof-high-battery-fairing-{side}', [(-1.62, 3.06), (3.63, 3.06),
                (3.45, 3.38), (3.21, 3.42), (3.02, 3.63), (2.80, 3.61),
                (-1.17, 3.59), (-1.40, 3.42)], .16, side * 1.075, mats['paint'], parent, coll, .045)
        profile(f'roof-rear-low-fairing-{side}', [(-5.67, 3.04), (-1.8, 3.04), (-1.94, 3.22), (-5.36, 3.22)],
                .15, side * 1.07, mats['paint'], parent, coll, .025)
    box('roof-battery-enclosure', (1.85, .22, 3.29), (0, 3.24, 1.68), mats['paint'], parent, coll, .065)
    for index, z in enumerate((-4.75, -2.65)):
        box(f'roof-service-hatch-{index}', (.86, .06, .76), (0, 3.11, z), mats['metal'], parent, coll, .028)
    mount = cfg['poleMount']
    z = mount['longitudinal']
    box('roof-pole-base-plate', (1.46, .10, 1.13), (0, 3.18, z - .12), mats['trim'], parent, coll)
    for side in (-1, 1):
        x = side * mount['halfSpacing']
        cylinder(f'pole-insulator-{side}', .13, .16, (x, 3.29, z), mats['insulator'], parent, coll)
        for row in range(4):
            cylinder(f'pole-insulator-rib-{side}-{row}', .16, .014, (x, 3.23 + row * .033, z), mats['insulator'], parent, coll)
        box(f'pole-swivel-pedestal-{side}', (.20, .10, .38), (x, 3.38, z), mats['metal'], parent, coll)
        for row, zz in enumerate((-5.5, -3.85, -2.2)):
            rod(f'rear-roof-rack-upright-{side}-{row}', (side * .84, 3.13, zz), (side * .84, 3.32, zz),
                .019, mats['metal'], parent, coll)
        rod(f'rear-roof-rack-rail-{side}', (side * .84, 3.32, -5.5), (side * .84, 3.32, -2.2),
            .019, mats['metal'], parent, coll)
