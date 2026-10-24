"""Independent steering, spin, door, wiper and pole pivots for the render adapter."""
import math
from .geometry import empty, box, cylinder, lathe_x, rod


def build_wheels(cfg, mats, chassis, coll):
    radius = cfg['wheelRadius']
    for axle_id, axle in (('front', cfg['frontAxle']), ('rear', cfg['rearAxle'])):
        for side_id, side in (('left', -1), ('right', 1)):
            steer = empty(f'wheel-steer-{axle_id}-{side_id}', chassis, coll, (side * cfg['wheelTrackHalf'], radius, axle))
            steer['pivot_role'] = 'steering about runtime Y'
            spin = empty(f'wheel-spin-{axle_id}-{side_id}', steer, coll)
            spin['pivot_role'] = 'axle rotation about runtime X'
            points = [(.29, -.135), (.405, -.15), (.463, -.12), (radius, -.075), (radius, .075),
                      (.463, .12), (.405, .15), (.29, .135), (.29, -.135)]
            lathe_x(f'tire-{axle_id}-{side_id}', points, (0, 0, 0), mats['rubber'], spin, coll)
            if axle_id == 'rear':
                lathe_x(f'tire-rear-dual-inner-{side_id}', points, (-side * .31, 0, 0), mats['rubber'], spin, coll)
            rim = [(.285, side * .145), (.314, side * .151), (.322, side * .166),
                   (.305, side * .18), (.27, side * .17), (.19, side * .14), (0, side * .15)]
            lathe_x(f'rim-{axle_id}-{side_id}', rim, (0, 0, 0), mats['metal'], spin, coll)
            cylinder(f'hub-{axle_id}-{side_id}', .115 if axle_id == 'front' else .16, .065,
                     (side * .185, 0, 0), mats['metal'], spin, coll, axis='x')
            for index in range(10):
                a = index * math.tau / 10
                cylinder(f'rim-recess-{axle_id}-{side_id}-{index}', .032, .012,
                         (side * .184, math.sin(a) * .24, math.cos(a) * .24), mats['trim'], spin, coll, axis='x', segments=12)


def build_doors(cfg, mats, body, coll):
    for door in cfg['doors']:
        center, half = door['center'], door['width'] / 2
        hinge, leaf = half - .06, half - .07
        box(f'door-{door["id"]}-header', (.075, .075, door['width']), (-1.28, 2.72, center), mats['trim'], body, coll)
        box(f'door-{door["id"]}-threshold', (.27, .055, door['width']), (-1.21, .37, center), mats['threshold'], body, coll)
        for direction in (-1, 1):
            part = 'forward' if direction == -1 else 'rearward'
            pivot = empty(f'door-{door["id"]}-{part}-pivot', body, coll, (-1.30, .40, center - direction * hinge))
            pivot['open_direction'] = direction
            pivot['pivot_role'] = 'leaf hinge about runtime Y; closed rotation 0'
            local_z = direction * hinge / 2
            box(f'door-{door["id"]}-{part}-glass', (.016, 2.09, leaf - .08), (-.006, 1.15, local_z), mats['glass'], pivot, coll, .008)
            for edge in (-1, 1):
                box(f'door-{door["id"]}-{part}-edge-{edge}', (.07, 2.28, .035), (0, 1.14, local_z + edge * (leaf / 2 - .018)), mats['trim'], pivot, coll, .008)
            for y in (.08, 2.25):
                box(f'door-{door["id"]}-{part}-crossbar-{y}', (.075, .10, leaf), (0, y, local_z), mats['trim'], pivot, coll)
            rod(f'door-{door["id"]}-{part}-inside-handrail', (.045, .82, local_z - direction * .18),
                (.045, 1.28, local_z + direction * .18), .017, mats['threshold'], pivot, coll)


def build_poles(cfg, mats, root, coll):
    # Neutral preview pose: shafts lie along a local +Y axis, with origins at their bases.
    # Runtime replaces aim/head transforms with the existing solver's world endpoints.
    mount = cfg['poleMount']
    length = 7.8
    rise = 6.2 - mount['height']
    backward = math.sqrt(length ** 2 - rise ** 2)
    for side_id, side in (('left', -1), ('right', 1)):
        base = (side * mount['halfSpacing'], mount['height'], mount['longitudinal'])
        head = (side * .35, 6.2, mount['longitudinal'] - backward)
        aim = empty(f'pole-{side_id}-aim', root, coll, base)
        aim['pivot_role'] = 'world-space contact base; local +Y is shaft direction'
        from mathutils import Vector
        from .geometry import xyz
        direction = Vector(xyz(head)) - Vector(xyz(base))
        aim.rotation_mode = 'QUATERNION'
        aim.rotation_quaternion = direction.to_track_quat('Z', 'Y')
        for section, fraction, offset in (('lower', .56, 0), ('upper', .44, length * .56)):
            pivot = empty(f'pole-{side_id}-shaft-{section}', aim, coll)
            # Local Blender Z is runtime Y after export, both in the aim's local space.
            pivot.location.z = offset
            pivot.scale.z = length * fraction
            cylinder(f'pole-{side_id}-shaft-{section}-mesh', .035 if section == 'lower' else .024,
                     1, (0, .5, 0), mats['metal'] if section == 'upper' else mats['trim'], pivot, coll, segments=16)
        shoe = empty(f'pole-{side_id}-contact-head', root, coll, head)
        box(f'pole-{side_id}-contact-shoe', (.11, .075, .32), (0, .015, 0), mats['trim'], shoe, coll)
        cylinder(f'pole-{side_id}-contact-indicator', .024, .018, (0, -.04, 0), mats['contact'], shoe, coll)
        rope = empty(f'pole-{side_id}-retrieval-rope', root, coll, (side * .62, 1.13, -6.11))
        rope['pivot_role'] = 'world-space drum; local +Y stretches toward contact head'
        rope_head = Vector(xyz(head)) - rope.location
        rope.rotation_mode = 'QUATERNION'
        rope.rotation_quaternion = rope_head.to_track_quat('Z', 'Y')
        rope.scale.z = rope_head.length
        cylinder(f'pole-{side_id}-retrieval-rope-mesh', .006, 1, (0, .5, 0), mats['rubber'], rope, coll, segments=6)


def build_interior(cfg, mats, body, coll):
    for side in (-1, 1):
        for index, z in enumerate((-4.5, -3.6, -2.4, -1.4, .9, 1.9, 2.9)):
            if side == -1 and any(abs(z - door['center']) < door['width'] / 2 + .2 for door in cfg['doors']):
                continue
            y = 1.20 if min(abs(z - cfg['frontAxle']), abs(z - cfg['rearAxle'])) < .9 else .88
            box(f'seat-{side}-{index}-cushion', (.44, .09, .40), (side * .83, y, z), mats['seat'], body, coll, .045)
            box(f'seat-{side}-{index}-back', (.44, .54, .07), (side * .83, y + .26, z - .20), mats['seat'], body, coll, .035)
        rod(f'ceiling-grab-rail-{side}', (side * .61, 2.55, -4.8), (side * .61, 2.55, 4.2), .017, mats['threshold'], body, coll)
    box('driver-dashboard', (1.10, .24, .55), (.49, 1.29, 5.20), mats['trim'], body, coll, .07)
