"""Body envelope, glazing and front/rear fascia. No detailed texture artwork."""
import math
from .geometry import box, mesh, profile, rod, empty


def build_body(cfg, mats, parent, coll):
    paint, trim, glass = mats['paint'], mats['trim'], mats['glass']
    axles = (cfg['rearAxle'], cfg['frontAxle'])
    doors = sorted(cfg['doors'], key=lambda d: d['center'])
    for side in (-1, 1):
        spans = [(-5.77, 5.60)] if side == 1 else []
        if side == -1:
            previous = -5.77
            for door in doors:
                spans.append((previous, door['center'] - door['width'] / 2))
                previous = door['center'] + door['width'] / 2
            spans.append((previous, 5.60))
        for index, (start, end) in enumerate(spans):
            if end <= start:
                continue
            outline = [(start, .35)]
            for axle in axles:
                radius = cfg['archRadius']
                if not (start < axle - radius and end > axle + radius):
                    continue
                outline.append((axle - radius, .35))
                for step in range(9):
                    a = math.pi - step * math.pi / 8
                    outline.append((axle + math.cos(a) * radius, cfg['wheelRadius'] + math.sin(a) * radius))
                outline.append((axle + radius, .35))
            outline += [(end, .35), (end, 1.39), (start, 1.39)]
            profile(f'body-side-{side}-panel-{index:02}', outline, .065, side * 1.245, paint, parent, coll, .008)
        for axle_id, axle in enumerate(axles):
            inner, outer = cfg['archRadius'], cfg['archOuterRadius']
            outline = [(axle - outer, .35)]
            outline += [(axle + math.cos(math.pi - i * math.pi / 8) * outer,
                         cfg['wheelRadius'] + math.sin(i * math.pi / 8) * outer) for i in range(9)]
            outline += [(axle + outer, .35), (axle + inner, .35)]
            outline += [(axle + math.cos(i * math.pi / 8) * inner,
                         cfg['wheelRadius'] + math.sin(i * math.pi / 8) * inner) for i in range(9)]
            outline.append((axle - inner, .35))
            profile(f'wheel-arch-{side}-{axle_id}', outline, .055, side * 1.28, trim, parent, coll, .006)
        box(f'window-header-{side}', (.075, .12, 11.36), (side * 1.245, 2.745, -.07), trim, parent, coll)
        box(f'roof-gutter-{side}', (.10, .17, 11.43), (side * 1.235, 2.88, -.075), paint, parent, coll, .035)
        # Fixed panes end at each door opening and at the enclosed rear equipment bay.
        mullions = [-5.02, -3.78, -2.1, -.77, .77, 2.35, 4.08, 5.57]
        window_spans = []
        for start, end in spans:
            start, end = max(start, -5.02), min(end, 5.57)
            if end > start:
                edges = [start] + [p for p in mullions if start + .02 < p < end - .02] + [end]
                window_spans += list(zip(edges, edges[1:]))
        for index, (start, end) in enumerate(window_spans):
            center, length = (start + end) / 2, end - start
            box(f'window-{side}-{index:02}', (.018, 1.28, max(.02, length - .065)),
                (side * 1.265, 2.055, center), glass, parent, coll, .008)
            box(f'window-sill-{side}-{index:02}', (.075, .075, length), (side * 1.25, 1.405, center), trim, parent, coll)
            box(f'window-post-{side}-{index:02}', (.075, 1.36, .055), (side * 1.256, 2.06, start), trim, parent, coll)
            # Opening transom only; avoid the earlier full-width extra horizontal grid.
            if length > 1.0:
                box(f'window-transom-{side}-{index:02}', (.025, .025, length - .09),
                    (side * 1.28, 2.43, center), trim, parent, coll, .003)
    box('floor-low-entry', (2.28, .11, 11.52), (0, .30, 0), mats['floor'], parent, coll)
    box('roof-deck', (2.40, .10, 11.65), (0, 3.015, -.02), paint, parent, coll, .045)
    box('rear-equipment-enclosure', (2.40, 2.32, .93), (0, 1.56, -5.515), paint, parent, coll, .055)
    for side in (-1, 1):
        box(f'rear-side-vent-panel-{side}', (.045, 1.23, .69), (side * 1.265, 2.06, -5.43), trim, parent, coll)
        for row in range(10):
            box(f'rear-side-louver-{side}-{row}', (.024, .028, .58), (side * 1.294, 1.55 + row * .105, -5.43),
                mats['metal'], parent, coll, .004)
    build_front(mats, parent, coll)
    build_rear(mats, parent, coll)


def nose_z(x, y):
    return 6.005 + (1 - (x / 1.14) ** 2) * .055 - abs(y - .9) * .024


def build_front(mats, parent, coll):
    # Curved painted fascia, integrated with swept chamfered front corners.
    vertices, faces = [], []
    for row in range(7):
        y = .35 + row / 6 * 1.17
        for column in range(25):
            x = (column / 12 - 1) * 1.13
            vertices.append((x, y, nose_z(x, y)))
            if row < 6 and column < 24:
                a = row * 25 + column
                faces.append((a, a + 1, a + 26, a + 25))
    mesh('front-painted-fascia', vertices, faces, mats['paint'], parent, coll, smooth=True)
    vertices, faces = [], []
    for column in range(33):
        u = column / 16 - 1
        x, span = u * 1.12, abs(u)
        bottom = 1.075 + min(span, .61) * (.155 / .61) + max(0, span - .61) * (.25 / .39)
        for y in (bottom, 1.61):
            vertices.append((x, y, nose_z(x, y) + .022))
        if column < 32:
            a = column * 2
            faces.append((a, a + 2, a + 3, a + 1))
    mesh('front-black-V-mask', vertices, faces, mats['trim'], parent, coll, smooth=True)
    vertices, faces = [], []
    for row in range(13):
        v = row / 12
        for column in range(33):
            u = column / 16 - 1
            edge = max(0, (abs(u) - .84) / .16)
            bottom = 1.37 + edge * .15
            top = 2.805 - edge * .075
            y = bottom + (top - bottom) * v
            x = u * (1.105 - .015 * v)
            vertices.append((x, y, 6.055 - (y - 1.37) * .145 + (1 - u * u) * .055))
            if row < 12 and column < 32:
                a = row * 33 + column
                faces.append((a, a + 1, a + 34, a + 33))
    mesh('windshield-panoramic', vertices, faces, mats['windshield'], parent, coll, smooth=True)
    box('front-destination-recess', (1.83, .32, .035), (0, 2.59, 5.939), mats['trim'], parent, coll, .035)
    box('front-brow-closed-header', (2.19, .20, .105), (0, 2.88, 5.922), mats['paint'], parent, coll, .04)
    # Blue eyebrows turn down at the outside corners, as on the complete cover.
    for side in (-1, 1):
        profile(f'front-eyebrow-{side}', [(5.60, 2.77), (6.01, 2.77), (6.035, 2.94), (5.60, 3.02)],
                .16, side * 1.10, mats['paint'], parent, coll, .045)
        mesh(f'front-corner-glass-{side}', [(side * 1.268, 1.44, 5.57), (side * 1.105, 1.49, 6.03),
              (side * 1.09, 2.73, 5.88), (side * 1.268, 2.72, 5.57)],
             [(0, 1, 2, 3)] if side == 1 else [(3, 2, 1, 0)], mats['windshield'], parent, coll, smooth=True)
        rod(f'front-A-pillar-{side}', (side * 1.12, 1.47, 6.008), (side * 1.10, 2.79, 5.84),
            .037, mats['trim'], parent, coll)
        profile(f'front-blue-cheek-{side}', [(5.58, .35), (6.005, .35), (6.01, 1.50), (5.58, 1.40)],
                .13, side * 1.19, mats['paint'], parent, coll, .028)
        box(f'headlamp-pocket-{side}', (.51, .205, .05), (side * .835, .63, 6.029), mats['trim'], parent, coll, .04)
        box(f'headlamp-lens-{side}', (.455, .151, .027), (side * .835, .63, 6.06), mats['lamp'], parent, coll, .025)
        side_id = 'left' if side == -1 else 'right'
        mirror = empty(f'mirror-{side_id}-pivot', parent, coll, (side * 1.16, 2.67, 5.57))
        rod(f'mirror-{side}-arm', (0, 0, 0), (side * .36, -.13, .19), .026, mats['trim'], mirror, coll)
        box(f'mirror-{side}-housing', (.15, .43, .22), (side * .38, -.36, .20), mats['trim'], mirror, coll, .055)
        box(f'mirror-{side}-glass', (.018, .33, .16), (side * .465, -.36, .20), mats['metal'], mirror, coll)
        wiper = empty(f'wiper-{side_id}-pivot', parent, coll, (side * .62, 1.43, 6.115))
        rod(f'wiper-{side}-arm', (0, 0, 0), (-side * .31, .42, -.05), .012, mats['trim'], wiper, coll)
        rod(f'wiper-{side}-blade', (-side * .31, .42, -.05), (side * .14, .20, -.028), .018, mats['trim'], wiper, coll)
    box('front-lower-bumper', (2.12, .12, .075), (0, .40, 6.002), mats['paint'], parent, coll, .035)


def build_rear(mats, parent, coll):
    box('rear-upper-black-service-mask', (2.23, 1.34, .04), (0, 2.10, -6.025), mats['trim'], parent, coll, .05)
    box('rear-centre-service-cover', (.53, 1.73, .09), (0, 1.70, -6.075), mats['trim'], parent, coll, .025)
    box('rear-destination-recess', (.44, .34, .025), (.66, 2.45, -6.054), mats['trim'], parent, coll, .045)
    for side in (-1, 1):
        rod(f'rear-ladder-rail-{side}', (side * .28, .85, -6.16), (side * .28, 3.19, -6.16),
            .018, mats['metal'], parent, coll)
        for row in range(5):
            rod(f'rear-radiator-slat-{side}-{row}', (side * .45, 1.86 + row * .09, -6.063),
                (side * .96, 2.03 + row * .09, -6.063), .012, mats['metal'], parent, coll)
        for index in range(3):
            from .geometry import cylinder
            cylinder(f'rear-lamp-{side}-{index}', .065, .028, (side * 1.01, .76 + index * .175, -6.055),
                     mats['amber'] if index == 1 else mats['brake'], parent, coll, axis='z', segments=20)
        from .geometry import cylinder
        cylinder(f'retrieval-drum-{side}', .185, .07, (side * .62, 1.13, -6.07), mats['paint'], parent, coll, axis='z')
    for row in range(9):
        rod(f'rear-ladder-rung-{row}', (-.28, .94 + row * .27, -6.16), (.28, .94 + row * .27, -6.16),
            .016, mats['metal'], parent, coll)
