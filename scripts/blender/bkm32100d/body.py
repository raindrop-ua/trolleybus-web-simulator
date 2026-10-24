"""Body envelope, glazing and front/rear fascia. No detailed texture artwork."""
import math
from .geometry import box, mesh, profile, rod, empty
from .surfaces import side_skin, rolled_roof, build_front, build_rear_cap


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
            side_skin(f'body-side-{side}-panel-{index:02}', start, end, side, cfg, paint, parent, coll)
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
    rolled_roof(paint, parent, coll)
    box('rear-equipment-enclosure', (2.35, 2.25, .75), (0, 1.56, -5.43), paint, parent, coll, .055)
    for side in (-1, 1):
        box(f'rear-side-vent-panel-{side}', (.045, 1.23, .69), (side * 1.265, 2.06, -5.43), trim, parent, coll)
        for row in range(10):
            box(f'rear-side-louver-{side}-{row}', (.024, .028, .58), (side * 1.294, 1.55 + row * .105, -5.43),
                mats['metal'], parent, coll, .004)
    build_front(cfg, mats, parent, coll)
    build_rear_cap(mats, parent, coll)
    build_rear(mats, parent, coll)



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
