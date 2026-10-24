"""Gate A control surfaces: a shared body envelope and swept, continuous end caps.

Only silhouette-bearing surfaces live here. Detail objects stay in their modules.
Coordinates follow the unchanged runtime contract: X across, Y up, +Z forward.
"""
import math
from .geometry import mesh, rod, box, empty


def lerp(a, b, t):
    return a + (b - a) * t


def sample_profile(keys, value):
    for (a, av), (b, bv) in zip(keys, keys[1:]):
        if value <= b:
            return lerp(av, bv, max(0, (value - a) / (b - a)))
    return keys[-1][1]


def half_width(y):
    return sample_profile([(.35, 1.238), (.65, 1.262), (1.10, 1.275),
                           (1.40, 1.275), (2.70, 1.258), (2.88, 1.25)], y)


def arch_height(z, cfg):
    result = .35
    radius = cfg['archRadius']
    for axle in (cfg['frontAxle'], cfg['rearAxle']):
        if abs(z - axle) <= radius + 1e-8:
            points = sorted((axle + math.cos(i * math.pi / 8) * radius,
                             cfg['wheelRadius'] + math.sin(i * math.pi / 8) * radius) for i in range(9))
            result = max(result, sample_profile(points, z))
    return result


def side_skin(name, start, end, side, cfg, mat, parent, coll):
    columns = {start, end}
    for i in range(1, math.ceil((end - start) / .32)):
        columns.add(min(end, start + i * .32))
    for axle in (cfg['frontAxle'], cfg['rearAxle']):
        radius = cfg['archRadius']
        if start < axle - radius and axle + radius < end:
            columns.update(axle + math.cos(i * math.pi / 8) * radius for i in range(9))
            columns.update([axle - radius - .002, axle + radius + .002])
    columns = sorted(columns)
    rows, vertices, faces = 5, [], []
    for inside in (False, True):
        for z in columns:
            bottom = arch_height(z, cfg)
            for row in range(rows + 1):
                y = lerp(bottom, 1.395, row / rows)
                vertices.append((side * (half_width(y) - (.055 if inside else 0)), y, z))
    count = len(columns) * (rows + 1)
    for column in range(len(columns) - 1):
        for row in range(rows):
            a = column * (rows + 1) + row
            b = a + rows + 1
            faces += [(a, a + 1, b + 1, b), (a + count, b + count, b + count + 1, a + count + 1)]
    boundary = list(range(rows + 1))
    boundary += [i * (rows + 1) + rows for i in range(1, len(columns))]
    boundary += list(range(count - 2, count - rows - 2, -1))
    boundary += [i * (rows + 1) for i in range(len(columns) - 2, 0, -1)]
    for a, b in zip(boundary, boundary[1:] + boundary[:1]):
        faces.append((a, b, b + count, a + count))
    return mesh(name, vertices, faces, mat, parent, coll, smooth=True)


def rolled_roof(mat, parent, coll):
    # One continuous cross-section rolls the roof into the side glazing belt.
    left = [(-1.27, 2.72), (-1.278, 2.81), (-1.266, 2.89), (-1.238, 2.965),
            (-1.19, 3.025), (-1.12, 3.066), (-.98, 3.082), (0, 3.088)]
    section = left + [(-x, y) for x, y in left[-2::-1]]
    vertices, faces = [], []
    sections = [(-5.94, .94, -.035), (-5.75, 1, 0), (-4, 1, 0), (0, 1, 0),
                (3.5, 1, 0), (5.5, 1, -.008), (5.79, .98, -.035)]
    for z, scale, drop in sections:
        vertices += [(x * scale, y + drop, z) for x, y in section]
    size = len(section)
    for row in range(len(sections) - 1):
        for i in range(size - 1):
            a = row * size + i
            faces.append((a, a + 1, a + size + 1, a + size))
    faces += [tuple(range(size - 1, -1, -1)), tuple(range((len(sections) - 1) * size, len(sections) * size))]
    return mesh('body-continuous-rolled-roof', vertices, faces, mat, parent, coll, smooth=True)


def corner_depth(x, half=1.275):
    return 1 - max(0, 1 - min(.999999, abs(x) / half) ** 4) ** .25


def front_z(x, y):
    longitudinal = sample_profile([(.34, 5.985), (.48, 6.025), (.76, 6.065),
                                   (1.10, 6.05), (1.55, 6.025), (3.1, 5.82)], y)
    return longitudinal - corner_depth(x) * .465


def v_edge(x):
    span = min(1, abs(x) / 1.11)
    return 1.075 + min(span, .60) * (.16 / .60) + max(0, span - .60) * (.25 / .40)


def front_grid(name, evaluate, rows, columns, mat, parent, coll, thickness=0):
    vertices, faces = [], []
    # Sine parameterization distributes enough control points around the corner return.
    for row in range(rows + 1):
        for col in range(columns + 1):
            theta = lerp(-math.pi / 2, math.pi / 2, col / columns)
            x = math.copysign(abs(math.sin(theta)) ** .5, theta) * 1.275 if theta else 0
            vertices.append(evaluate(x, row / rows))
            if row < rows and col < columns:
                a = row * (columns + 1) + col
                faces.append((a, a + 1, a + columns + 2, a + columns + 1))
    return mesh(name, vertices, faces, mat, parent, coll, smooth=True)


def fascia_panel(name, x_center, width, height, y_center, mat, parent, coll, offset):
    # Chamfered lamp recess follows the actual nose skin instead of floating on a box.
    rows, columns, vertices, faces = 4, 12, [], []
    for depth in (offset - .02, offset):
        for row in range(rows + 1):
            t = row / rows
            scale = sample_profile([(0, .92), (.25, 1), (.75, 1), (1, .86)], t)
            y = y_center + (t - .5) * height
            for column in range(columns + 1):
                x = x_center + (column / columns - .5) * width * scale
                vertices.append((x, y, front_z(x, y) + depth))
    count = (rows + 1) * (columns + 1)
    for row in range(rows):
        for column in range(columns):
            a = row * (columns + 1) + column
            b = a + columns + 1
            faces += [(a, b, b + 1, a + 1), (a + count, a + count + 1, b + count + 1, b + count)]
    boundary = list(range(columns + 1))
    boundary += [row * (columns + 1) + columns for row in range(1, rows + 1)]
    boundary += list(range(count - 2, count - columns - 2, -1))
    boundary += [row * (columns + 1) for row in range(rows - 1, 0, -1)]
    for a, b in zip(boundary, boundary[1:] + boundary[:1]):
        faces.append((a, a + count, b + count, b))
    return mesh(name, vertices, faces, mat, parent, coll, smooth=True)


def build_front(cfg, mats, parent, coll):
    front_grid('front-continuous-sculpted-fascia',
               lambda x, t: (x, lerp(.35, v_edge(x) + .012, t), front_z(x, lerp(.35, v_edge(x) + .012, t))),
               8, 48, mats['paint'], parent, coll)
    front_grid('front-black-V-surround',
               lambda x, t: (x, lerp(v_edge(x), 1.60, t), front_z(x, lerp(v_edge(x), 1.60, t)) + .016),
               3, 48, mats['trim'], parent, coll)

    def glass_point(x, t):
        span = abs(x) / 1.275
        corner = max(0, (span - .81) / .19)
        low = 1.365 + .12 * corner ** 1.5
        high = 2.835 - .135 * corner ** 1.5
        y = lerp(low, high, t)
        return (x, y, 6.075 - (y - 1.365) * .145 - corner_depth(x) * .47 + .022 * (1 - span * span))

    front_grid('windshield-continuous-panoramic', glass_point, 14, 48, mats['windshield'], parent, coll)
    box('front-destination-recess', (1.82, .29, .025), (0, 2.60, 5.935), mats['trim'], parent, coll, .028)
    # A single swept brow turns down into the side shoulders; no rectangular eyebrows.
    vertices, faces = [], []
    columns = 48
    for back in (False, True):
        for upper in (False, True):
            for i in range(columns + 1):
                theta = lerp(-math.pi / 2, math.pi / 2, i / columns)
                x = math.copysign(abs(math.sin(theta)) ** .5, theta) * 1.285 if theta else 0
                span = abs(x) / 1.285
                drop = max(0, (span - .83) / .17) ** 1.5
                y = (3.075 - .17 * drop) if upper else (2.845 - .14 * drop)
                z = 5.985 - corner_depth(x, 1.285) * .43 - (.10 if back else 0)
                vertices.append((x, y, z))
    size = columns + 1
    for i in range(columns):
        faces += [(i, i + 1, size + i + 1, size + i),
                  (2 * size + i, 3 * size + i, 3 * size + i + 1, 2 * size + i + 1),
                  (size + i, size + i + 1, 3 * size + i + 1, 3 * size + i),
                  (i, 2 * size + i, 2 * size + i + 1, i + 1)]
    faces += [(0, size, 3 * size, 2 * size), (columns, 2 * size - 1, 4 * size - 1, 3 * size - 1)]
    mesh('front-one-piece-sculpted-brow', vertices, faces, mats['paint'], parent, coll, smooth=True)
    # Recess/seam lines define the large fascia planes without any painted graphics.
    for side in (-1, 1):
        for a, b in [((side * 1.16, 1.16), (side * .65, .82)),
                     ((side * .65, .82), (0, .79))]:
            rod(f'front-fascia-plane-seam-{side}-{a[0]}', (a[0], a[1], front_z(*a) + .008),
                (b[0], b[1], front_z(*b) + .008), .004, mats['trim'], parent, coll)
        fascia_panel(f'headlamp-recess-{side}', side * .88, .49, .19, .63, mats['trim'], parent, coll, .017)
        fascia_panel(f'headlamp-review-cover-{side}', side * .88, .44, .145, .63, mats['lamp'], parent, coll, .025)
        side_id = 'left' if side == -1 else 'right'
        # Posts follow the swept glass edge; the adjoining side windows share the same shoulder.
        for row in range(7):
            a, b = glass_point(side * 1.215, row / 7), glass_point(side * 1.215, (row + 1) / 7)
            rod(f'front-curved-A-post-{side}-{row}', a, b, .025, mats['trim'], parent, coll)
        mirror = empty(f'mirror-{side_id}-pivot', parent, coll, (side * 1.21, 2.67, 5.57))
        rod(f'mirror-{side_id}-arm', (0, 0, 0), (side * .32, -.12, .22), .023, mats['trim'], mirror, coll)
        box(f'mirror-{side_id}-housing', (.135, .43, .21), (side * .35, -.35, .22), mats['trim'], mirror, coll, .05)
        box(f'mirror-{side_id}-glass', (.012, .33, .15), (side * .425, -.35, .22), mats['metal'], mirror, coll, .004)
        wiper = empty(f'wiper-{side_id}-pivot', parent, coll, (side * .62, 1.43, 6.115))
        rod(f'wiper-{side_id}-arm', (0, 0, 0), (-side * .31, .42, -.05), .010, mats['trim'], wiper, coll)
        rod(f'wiper-{side_id}-blade', (-side * .31, .42, -.05), (side * .14, .20, -.028), .015, mats['trim'], wiper, coll)


def build_rear_cap(mats, parent, coll):
    vertices, faces = [], []
    rows, columns = 10, 32
    for row in range(rows + 1):
        y = lerp(.35, 2.79, row / rows)
        half = half_width(y)
        for col in range(columns + 1):
            theta = lerp(-math.pi / 2, math.pi / 2, col / columns)
            x = math.copysign(abs(math.sin(theta)) ** .5, theta) * half if theta else 0
            z = -6.0 + corner_depth(x, half) * .23
            vertices.append((x, y, z))
            if row < rows and col < columns:
                a = row * (columns + 1) + col
                faces.append((a, a + columns + 1, a + columns + 2, a + 1))
    mesh('rear-continuous-rounded-cap', vertices, faces, mats['paint'], parent, coll, smooth=True)
